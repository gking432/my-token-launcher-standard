import { useEffect, useMemo, useState } from 'react';

// Local prototype store for boost contributions. Real implementation will
// move to an on-chain entry function once the contract is upgraded — at that
// point, swap `getBoostMap()` for an indexer/RPC query keyed on the same
// (token address → total active APT) shape so callers don't change.

export interface BoostEntry {
  wallet: string;
  amount: number;
  timestamp: number;
}

interface BoostStore {
  [tokenAddr: string]: BoostEntry[];
}

const STORAGE_KEY = 'mm_boost_store_v1';
const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000;

function readStore(): BoostStore {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeStore(s: BoostStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

const listeners = new Set<() => void>();
const notify = () => listeners.forEach(fn => fn());

export function addBoost(tokenAddr: string, amount: number, wallet: string) {
  const key = tokenAddr.toLowerCase();
  const store = readStore();
  if (!store[key]) store[key] = [];
  store[key].push({ wallet: wallet.toLowerCase(), amount, timestamp: Date.now() });
  writeStore(store);
  notify();
}

// Returns: { [tokenAddr]: totalActiveAptInWindow }
function getBoostMap(windowMs: number): Record<string, number> {
  const store = readStore();
  const now = Date.now();
  const out: Record<string, number> = {};
  for (const [addr, entries] of Object.entries(store)) {
    const total = entries
      .filter(e => now - e.timestamp < windowMs)
      .reduce((s, e) => s + e.amount, 0);
    if (total > 0) out[addr] = total;
  }
  return out;
}

export function useBoostData(windowMs: number = DEFAULT_WINDOW_MS) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const fn = () => setTick(t => t + 1);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);

  // Also re-tick periodically so entries naturally fall out of the window.
  useEffect(() => {
    const i = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(i);
  }, []);

  return useMemo(() => getBoostMap(windowMs), [tick, windowMs]);
}

export const BOOST_WINDOWS = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
} as const;

export type BoostWindow = keyof typeof BOOST_WINDOWS;
