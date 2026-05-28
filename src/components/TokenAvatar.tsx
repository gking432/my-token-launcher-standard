import React, { useState } from 'react';

interface TokenAvatarProps {
  image?: string | null;
  symbol?: string;
  className?: string;
  background?: string;
  alt?: string;
  style?: React.CSSProperties;
}

const TokenAvatar: React.FC<TokenAvatarProps> = ({
  image,
  symbol,
  className,
  background,
  alt,
  style,
}) => {
  const [errored, setErrored] = useState(false);
  const letter = (symbol || '?').replace('$', '').charAt(0).toUpperCase();

  if (image && !errored) {
    return (
      <img
        src={image}
        alt={alt || symbol || ''}
        className={className}
        style={{ objectFit: 'cover', ...style }}
        onError={() => setErrored(true)}
      />
    );
  }

  return (
    <div
      className={className}
      style={{
        background,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        ...style,
      }}
    >
      {letter}
    </div>
  );
};

export default TokenAvatar;
