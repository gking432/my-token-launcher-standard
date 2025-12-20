export interface WatchlistItem {
  name: string;
  symbol: string;
  icon: string;
  iconBg: string;
  metadataAddress: string;
  creatorAddress?: string;
}

const WATCHLIST_STORAGE_KEY = 'token_watchlist';

export const getWatchlist = (): WatchlistItem[] => {
  const stored = localStorage.getItem(WATCHLIST_STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const addToWatchlist = (item: WatchlistItem): void => {
  const watchlist = getWatchlist();
  // Check if already exists
  const exists = watchlist.some(
    (w) => w.metadataAddress.toLowerCase() === item.metadataAddress.toLowerCase()
  );
  if (!exists) {
    watchlist.push(item);
    localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlist));
  }
};

export const removeFromWatchlist = (metadataAddress: string): void => {
  const watchlist = getWatchlist();
  const filtered = watchlist.filter(
    (w) => w.metadataAddress.toLowerCase() !== metadataAddress.toLowerCase()
  );
  localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(filtered));
};

export const isInWatchlist = (metadataAddress: string): boolean => {
  const watchlist = getWatchlist();
  return watchlist.some(
    (w) => w.metadataAddress.toLowerCase() === metadataAddress.toLowerCase()
  );
};

export const toggleWatchlist = (item: WatchlistItem): boolean => {
  const isIn = isInWatchlist(item.metadataAddress);
  if (isIn) {
    removeFromWatchlist(item.metadataAddress);
    return false;
  } else {
    addToWatchlist(item);
    return true;
  }
};


