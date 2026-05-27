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
      {/* Brand mark */}
      <rect x="2" y="2" width="76" height="76" rx="16" fill="#33972e" />
      <text
        x="40" y="58"
        textAnchor="middle"
        fontSize="52"
        fontWeight="800"
        fill="white"
        fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
      >M</text>

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
