/**
 * PRISM Innovation Explorer — Cinematic Product Photography
 *
 * Each of the 43 innovation concepts renders a bespoke, cinematic editorial
 * photograph generated from a description-specific prompt via Pollinations
 * (Flux). The branded gradient remains as the loading/error fallback so the
 * card is never empty, and a dark gradient overlay is applied by the parent
 * card for text contrast.
 */

import React, { useState } from 'react';
import { getInnovationImageUrl } from '../../data/innovationImages';

interface ProductImageProps {
  innovationId: string;
  innovationNumber?: number;
  gradient: string;
  accent: string;
  size?: 'card' | 'hero';
  /**
   * When true, the image is loaded eagerly with high fetch priority.
   * Set this for above-the-fold cards (the hero + first row of the bento
   * grid) so they paint immediately instead of waiting for the browser's
   * lazy-load heuristic.
   */
  priority?: boolean;
}

export default function InnovationProductImage({
  innovationId,
  innovationNumber,
  gradient,
  accent,
  size = 'card',
  priority = false,
}: ProductImageProps) {
  const seed =
    typeof innovationNumber === 'number'
      ? innovationNumber
      : parseInt(innovationId.replace(/\D/g, ''), 10) || 1;

  const url = getInnovationImageUrl(innovationId, seed, size);
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        background: gradient,
      }}
    >
      {url && !errored && (
        <img
          src={url}
          alt=""
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          // Elevates above-the-fold images so they start downloading
          // during the initial navigation instead of after layout.
          // Supported by Chrome/Edge/Safari; ignored elsewhere.
          // Spread-cast to sidestep React TS-type drift across versions.
          {...({ fetchpriority: priority ? 'high' : 'auto' } as Record<string, string>)}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.6s ease-out',
          }}
        />
      )}

      {/* Subtle accent glow — visible during load, softens the photo edges */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at center, transparent 40%, ${accent}15 100%)`,
          pointerEvents: 'none',
          mixBlendMode: 'multiply',
        }}
      />
    </div>
  );
}
