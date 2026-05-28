export function truncateAddress(addr: string | null | undefined, prefix = 6, suffix = 4): string {
  if (!addr) return '';
  const s = String(addr);
  if (s.length <= prefix + suffix + 1) return s;
  return `${s.slice(0, prefix)}…${s.slice(-suffix)}`;
}
