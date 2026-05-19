// localStorage-backed cache for token description + social links, keyed by
// metadata address. Bridges the gap until socials are stored on-chain.

const KEY = 'mm-local-socials-v1';

export interface TokenSocials {
  description?: string;
  twitterLink?: string | null;
  websiteLink?: string | null;
  telegram?: string | null;
}

type Store = Record<string, TokenSocials>;

function read(): Store {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
  catch { return {}; }
}

function write(s: Store) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

export function getLocalSocials(metadataAddr?: string | null): TokenSocials | null {
  if (!metadataAddr) return null;
  const entry = read()[metadataAddr.toLowerCase()];
  return entry ?? null;
}

export function setLocalSocials(metadataAddr: string, socials: TokenSocials) {
  if (!metadataAddr) return;
  const s = read();
  s[metadataAddr.toLowerCase()] = socials;
  write(s);
}
