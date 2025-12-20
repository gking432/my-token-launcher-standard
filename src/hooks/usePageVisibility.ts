import { useState, useEffect } from 'react';

/**
 * Custom hook to detect if the page/tab is visible
 * Returns true when the page is visible, false when hidden
 */
export const usePageVisibility = (): boolean => {
  const [isVisible, setIsVisible] = useState<boolean>(() => {
    // Check initial state
    if (typeof document !== 'undefined') {
      return !document.hidden;
    }
    return true; // Default to true for SSR
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      const newVisibility = !document.hidden;
      setIsVisible(newVisibility);
      // Log visibility changes for debugging
      console.log(`👁️ Page visibility changed: ${newVisibility ? 'VISIBLE' : 'HIDDEN'}`);
    };

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return isVisible;
};
