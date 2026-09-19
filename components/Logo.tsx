
import React, { useState } from 'react';

export const LOGO_URL = "/logo.png";
export const LOGO_FALLBACK_URL = "https://res.cloudinary.com/cmny1t9m/image/upload/v1789807753/logo%20new.png";

export const Logo = ({ className = "h-12", alt = "JDG Teleco" }: { className?: string; alt?: string }) => {
  const [src, setSrc] = useState<string>(LOGO_URL);

  return (
    <img
      src={src}
      alt={alt}
      className={`object-contain ${className}`}
      onError={() => {
        if (src !== LOGO_FALLBACK_URL) {
          setSrc(LOGO_FALLBACK_URL);
        }
      }}
    />
  );
};

