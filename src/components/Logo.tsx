import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface LogoProps {
  size?: number;
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ size = 22, className }) => {
  const { isDark } = useTheme();

  return (
    <span
      className={className}
      style={{
        fontSize: size,
        letterSpacing: '-0.03em',
        whiteSpace: 'nowrap',
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        lineHeight: 1,
      }}
    >
      <span style={{ fontWeight: 400, color: isDark ? '#f5f5f7' : '#1d1d1f' }}>Move</span>
      <span style={{ fontWeight: 700, color: isDark ? '#40bb38' : '#33972e' }}>Mint</span>
    </span>
  );
};

export default Logo;

