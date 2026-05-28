import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface LogoProps {
  height?: number;
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ height = 32, className }) => {
  const { isDark } = useTheme();

  return (
    <img
      src="/logo.png"
      alt="MoveMint"
      height={height}
      className={className}
      style={{
        display: 'block',
        width: 'auto',
        filter: isDark ? 'brightness(1.05)' : 'none',
      }}
    />
  );
};

export default Logo;

