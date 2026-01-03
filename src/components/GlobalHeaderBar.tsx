import React from 'react';

interface GlobalHeaderBarProps {
  height?: string;
  backgroundColor?: string;
  borderColor?: string;
}

const GlobalHeaderBar: React.FC<GlobalHeaderBarProps> = ({
  height = '40px',
  backgroundColor = '#ffffff',
  borderColor = '#e7ebee'
}) => {
  return (
    <div style={{
      background: backgroundColor,
      width: '100%',
      height: height,
      borderBottom: `1px solid ${borderColor}`,
      flexShrink: 0
    }}>
    </div>
  );
};

export default GlobalHeaderBar;



