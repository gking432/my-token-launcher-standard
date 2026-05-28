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
        filter: isDark ? 'grayscale(1) invert(1) brightness(2)' : 'none',
        mixBlendMode: isDark ? 'screen' : 'multiply',
      }}
    />
  );
};

export default Logo;

