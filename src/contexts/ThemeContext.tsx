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
  bgSecondary:   '#f8f9fa',
  bgHover:       '#f5f5f5',
  border:        '#e7ebee',
  borderSecondary:'#d3d3d3',
  textPrimary:   '#0a0b0d',
  textSecondary: '#5b616e',
  textMuted:     '#8a9ba8',
  accent:        '#00d4aa',
  accentHover:   '#00b894',
  accentLight:   '#d6f0ea',
  positive:      '#00d4aa',
  negative:      '#ff4757',
  chartBg:       '#fbfbfb',
  chartText:     '#5b616e',
  chartGrid:     '#f0f0f0',
};

const dark: ThemeColors = {
  bgPrimary:     '#0f1117',
  bgSecondary:   '#181b25',
  bgHover:       '#1e2130',
  border:        '#252836',
  borderSecondary:'#252836',
  textPrimary:   '#e8eaed',
  textSecondary: '#9aa5b4',
  textMuted:     '#5b6474',
  accent:        '#00d4aa',
  accentHover:   '#00b894',
  accentLight:   '#0c2b26',
  positive:      '#00d4aa',
  negative:      '#ff4757',
  chartBg:       '#181b25',
  chartText:     '#9aa5b4',
  chartGrid:     '#252836',
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
