import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface LogoProps {
  height?: number;
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ height = 34, className }) => {
  const { isDark } = useTheme();
  const textFill = isDark ? '#f5f5f7' : '#1d1d1f';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 460 80"
      height={height}
      style={{ display: 'block', width: 'auto', overflow: 'visible' }}
      className={className}
      aria-label="MoveMint"
    >
      {/* Mint leaf icon */}
      {/* Leaf body — teardrop pointed at top, rounded at base */}
      <path
        d="M 40 4 C 30 4, 8 18, 8 38 C 8 56, 22 70, 40 72 C 58 70, 72 56, 72 38 C 72 18, 50 4, 40 4 Z"
        fill="#33972e"
      />
      {/* Stem */}
      <line x1="40" y1="72" x2="40" y2="79" stroke="#33972e" strokeWidth="4" strokeLinecap="round" />
      {/* Center vein */}
      <line x1="40" y1="9" x2="40" y2="68" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" />
      {/* Side veins */}
      <line x1="40" y1="28" x2="60" y2="36" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="40" y1="28" x2="20" y2="36" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="40" y1="47" x2="58" y2="53" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="40" y1="47" x2="22" y2="53" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" />

      {/* Wordmark */}
      <text
        x="96" y="56"
        fontSize="44"
        fontWeight="700"
        letterSpacing="-1.5"
        fill={textFill}
        fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
      >MoveMint</text>
    </svg>
  );
};

export default Logo;
