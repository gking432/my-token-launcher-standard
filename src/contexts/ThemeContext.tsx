import React, { createContext, useContext, useState, useEffect } from 'react';

export interface ThemeColors {
  bgPrimary: string;
  bgSecondary: string;
  bgHover: string;
  border: string;
  borderSecondary: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  accentLight: string;
  positive: string;
  negative: string;
  chartBg: string;
  chartText: string;
  chartGrid: string;
}

const light: ThemeColors = {
  bgPrimary:     '#ffffff',
  bgSecondary:   '#fafafa',
  bgHover:       '#f0f0f2',
  border:        '#e5e5e7',
  borderSecondary:'#d2d2d7',
  textPrimary:   '#1d1d1f',
  textSecondary: '#6e6e73',
  textMuted:     '#86868b',
  accent:        '#33972e',
  accentHover:   '#29791f',
  accentLight:   '#edf7ec',
  positive:      '#33972e',
  negative:      '#d70015',
  chartBg:       '#fbfbfb',
  chartText:     '#6e6e73',
  chartGrid:     '#f0f0f0',
};

const dark: ThemeColors = {
  bgPrimary:     '#000000',
  bgSecondary:   '#1c1c1e',
  bgHover:       '#2c2c2e',
  border:        '#38383a',
  borderSecondary:'#48484a',
  textPrimary:   '#f5f5f7',
  textSecondary: '#a1a1a6',
  textMuted:     '#6e6e73',
  accent:        '#40bb38',
  accentHover:   '#55ca4d',
  accentLight:   '#0d2410',
  positive:      '#40bb38',
  negative:      '#ff453a',
  chartBg:       '#1c1c1e',
  chartText:     '#a1a1a6',
  chartGrid:     '#38383a',
};

interface ThemeCtx {
  isDark: boolean;
  theme: ThemeColors;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeCtx>({ isDark: false, theme: light, toggleTheme: () => {} });

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    try { return localStorage.getItem('mm-theme') === 'dark'; } catch { return false; }
  });

  useEffect(() => {
    document.body.setAttribute('data-theme', isDark ? 'dark' : 'light');
    document.body.style.background = isDark ? dark.bgPrimary : light.bgPrimary;
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark(p => {
      const next = !p;
      try { localStorage.setItem('mm-theme', next ? 'dark' : 'light'); } catch {}
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ isDark, theme: isDark ? dark : light, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
