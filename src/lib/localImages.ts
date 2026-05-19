// Tiny localStorage-backed image cache keyed by metadata address.
// Used as a fallback when no on-chain icon_uri exists yet (image upload at launch).

const KEY = 'mm-local-images-v1';

type Store = Record<string, string>; // metadataAddress (lowercased) → data URL

function read(): Store {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
  catch { return {}; }
}

function write(s: Store) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

export function getLocalImage(metadataAddr?: string | null): string | null {
  if (!metadataAddr) return null;
  return read()[metadataAddr.toLowerCase()] || null;
}

export function setLocalImage(metadataAddr: string, dataUrl: string) {
  if (!metadataAddr) return;
  const s = read();
  s[metadataAddr.toLowerCase()] = dataUrl;
  write(s);
}

export const MAX_IMAGE_BYTES = 256 * 1024; // 256KB — localStorage limit is ~5MB
