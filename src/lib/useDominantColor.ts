import { useEffect, useState } from 'react';

// Extracts a vibrant dominant color from a token logo so the Boost hero can
// auto-generate a banner that matches the coin's branding. Falls back to a
// deterministic palette color (keyed off the symbol) when the image is missing
// or cross-origin tainted.

export interface Palette {
  base: string;   // rgb(...)
  dark: string;   // darker shade for gradient depth
  light: string;  // lighter shade for highlights
  isLight: boolean;
}

const FALLBACK_PALETTE = ['#5E5CE6', '#059669', '#FF9F0A', '#BF5AF2', '#0A84FF', '#FF6482', '#A2845E', '#30B0C7'];

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function makePalette(r: number, g: number, b: number): Palette {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const dark = `rgb(${clamp(r * 0.52)}, ${clamp(g * 0.52)}, ${clamp(b * 0.52)})`;
  const light = `rgb(${clamp(r + (255 - r) * 0.4)}, ${clamp(g + (255 - g) * 0.4)}, ${clamp(b + (255 - b) * 0.4)})`;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return { base: `rgb(${r}, ${g}, ${b})`, dark, light, isLight: lum > 0.62 };
}

function fallbackFor(symbol: string): Palette {
  const key = symbol.replace('$', '').charCodeAt(0) || 0;
  return makePalette(...hexToRgb(FALLBACK_PALETTE[key % FALLBACK_PALETTE.length]));
}

export function useDominantColor(src: string | null | undefined, symbol: string): Palette {
  const [palette, setPalette] = useState<Palette>(() => fallbackFor(symbol));

  useEffect(() => {
    let cancelled = false;
    const fb = fallbackFor(symbol);
    if (!src) {
      setPalette(fb);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      if (cancelled) return;
      try {
        const size = 36;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) { setPalette(fb); return; }
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        // Coarse 6-bit-per-channel buckets, weighted toward vibrant pixels.
        const buckets = new Map<string, { n: number; w: number; r: number; g: number; b: number }>();
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a < 128) continue;
          const r = data[i], g = data[i + 1], b = data[i + 2];
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          const sat = max === 0 ? 0 : (max - min) / max;
          const bright = max / 255;
          if (bright > 0.95 && sat < 0.12) continue; // skip near-white
          if (bright < 0.12) continue;               // skip near-black
          const weight = 0.25 + sat * bright;
          const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
          const cur = buckets.get(key) || { n: 0, w: 0, r: 0, g: 0, b: 0 };
          cur.n += 1; cur.w += weight; cur.r += r; cur.g += g; cur.b += b;
          buckets.set(key, cur);
        }

        if (buckets.size === 0) { setPalette(fb); return; }
        let best: { n: number; w: number; r: number; g: number; b: number } | null = null;
        buckets.forEach(v => {
          if (!best || v.w > best.w) best = v;
        });
        if (!best) { setPalette(fb); return; }
        const top = best as { n: number; w: number; r: number; g: number; b: number };
        setPalette(makePalette(top.r / top.n, top.g / top.n, top.b / top.n));
      } catch {
        setPalette(fb); // canvas tainted by CORS
      }
    };

    img.onerror = () => { if (!cancelled) setPalette(fb); };
    img.src = src;

    return () => { cancelled = true; };
  }, [src, symbol]);

  return palette;
}
