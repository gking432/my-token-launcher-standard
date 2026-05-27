import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface LogoProps {
  height?: number;
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ height = 34, className }) => {
  const { isDark } = useTheme();

  return (
    <div
      className={className}
      style={{ display: 'flex', alignItems: 'center', gap: Math.round(height * 0.38), lineHeight: 1 }}
    >
      <img
        src="/favicon.svg"
        alt=""
        height={height}
        width={height}
        style={{ display: 'block', flexShrink: 0 }}
      />
      <span style={{
        fontSize: Math.round(height * 1.05),
        lineHeight: 1,
        letterSpacing: '-0.03em',
        whiteSpace: 'nowrap',
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: isDark ? '#f5f5f7' : '#1d1d1f',
      }}>
        <span style={{ fontWeight: 400 }}>Move</span>
        <span style={{ fontWeight: 700 }}>Mint</span>
      </span>
    </div>
  );
};

export default Logo;
