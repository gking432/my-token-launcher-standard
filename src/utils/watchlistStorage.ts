export interface WatchlistItem {
  name: string;
  symbol: string;
  icon: string;
  iconBg: string;
  metadataAddress: string;
  creatorAddress?: string;
}

const storageKey = (walletAddress?: string) =>
  walletAddress ? `token_watchlist_${walletAddress.toLowerCase()}` : 'token_watchlist';

export const getWatchlist = (walletAddress?: string): WatchlistItem[] => {
  const stored = localStorage.getItem(storageKey(walletAddress));
  return stored ? JSON.parse(stored) : [];
};

export const addToWatchlist = (item: WatchlistItem, walletAddress?: string): void => {
  const key = storageKey(walletAddress);
  const watchlist = getWatchlist(walletAddress);
  const exists = watchlist.some(
    (w) => w.metadataAddress.toLowerCase() === item.metadataAddress.toLowerCase()
  );
  if (!exists) {
    watchlist.push(item);
    localStorage.setItem(key, JSON.stringify(watchlist));
  }
};

export const removeFromWatchlist = (metadataAddress: string, walletAddress?: string): void => {
  const key = storageKey(walletAddress);
  const filtered = getWatchlist(walletAddress).filter(
    (w) => w.metadataAddress.toLowerCase() !== metadataAddress.toLowerCase()
  );
  localStorage.setItem(key, JSON.stringify(filtered));
};

export const isInWatchlist = (metadataAddress: string, walletAddress?: string): boolean => {
  return getWatchlist(walletAddress).some(
    (w) => w.metadataAddress.toLowerCase() === metadataAddress.toLowerCase()
  );
};

export const toggleWatchlist = (item: WatchlistItem, walletAddress?: string): boolean => {
  if (isInWatchlist(item.metadataAddress, walletAddress)) {
    removeFromWatchlist(item.metadataAddress, walletAddress);
    return false;
  } else {
    addToWatchlist(item, walletAddress);
    return true;
  }
};


