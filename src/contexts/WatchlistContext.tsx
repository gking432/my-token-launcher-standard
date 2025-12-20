import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { WatchlistItem, getWatchlist, addToWatchlist, removeFromWatchlist, isInWatchlist, toggleWatchlist as toggleWatchlistUtil } from '../utils/watchlistStorage';

interface WatchlistContextType {
  watchlist: WatchlistItem[];
  addToWatchlist: (item: WatchlistItem) => void;
  removeFromWatchlist: (metadataAddress: string) => void;
  isInWatchlist: (metadataAddress: string) => boolean;
  toggleWatchlist: (item: WatchlistItem) => boolean;
  refreshWatchlist: () => void;
}

const WatchlistContext = createContext<WatchlistContextType | undefined>(undefined);

export const useWatchlist = () => {
  const context = useContext(WatchlistContext);
  if (!context) {
    throw new Error('useWatchlist must be used within a WatchlistProvider');
  }
  return context;
};

interface WatchlistProviderProps {
  children: ReactNode;
}

export const WatchlistProvider: React.FC<WatchlistProviderProps> = ({ children }) => {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);

  const refreshWatchlist = () => {
    setWatchlist(getWatchlist());
  };

  useEffect(() => {
    refreshWatchlist();
    
    // Listen for storage changes (in case watchlist is updated in another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'token_watchlist') {
        refreshWatchlist();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleAddToWatchlist = (item: WatchlistItem) => {
    addToWatchlist(item);
    refreshWatchlist();
  };

  const handleRemoveFromWatchlist = (metadataAddress: string) => {
    removeFromWatchlist(metadataAddress);
    refreshWatchlist();
  };

  const handleIsInWatchlist = (metadataAddress: string): boolean => {
    return isInWatchlist(metadataAddress);
  };

  const handleToggleWatchlist = (item: WatchlistItem): boolean => {
    const result = toggleWatchlistUtil(item);
    refreshWatchlist();
    return result;
  };

  return (
    <WatchlistContext.Provider
      value={{
        watchlist,
        addToWatchlist: handleAddToWatchlist,
        removeFromWatchlist: handleRemoveFromWatchlist,
        isInWatchlist: handleIsInWatchlist,
        toggleWatchlist: handleToggleWatchlist,
        refreshWatchlist,
      }}
    >
      {children}
    </WatchlistContext.Provider>
  );
};


