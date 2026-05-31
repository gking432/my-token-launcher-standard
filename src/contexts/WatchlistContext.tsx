import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
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
  const { account } = useWallet();
  const walletAddress = account?.address?.toString();

  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);

  const refreshWatchlist = () => {
    setWatchlist(getWatchlist(walletAddress));
  };

  // Reload whenever the connected wallet changes
  useEffect(() => {
    refreshWatchlist();
    const key = walletAddress ? `token_watchlist_${walletAddress.toLowerCase()}` : 'token_watchlist';
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key) refreshWatchlist();
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress]);

  const handleAddToWatchlist = (item: WatchlistItem) => {
    addToWatchlist(item, walletAddress);
    refreshWatchlist();
  };

  const handleRemoveFromWatchlist = (metadataAddress: string) => {
    removeFromWatchlist(metadataAddress, walletAddress);
    refreshWatchlist();
  };

  const handleIsInWatchlist = (metadataAddress: string): boolean => {
    return isInWatchlist(metadataAddress, walletAddress);
  };

  const handleToggleWatchlist = (item: WatchlistItem): boolean => {
    const result = toggleWatchlistUtil(item, walletAddress);
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


