/**
 * PRISM Innovation Explorer — Product Stock Photos
 * Professional Unsplash stock photos mapped to each innovation concept.
 * Gradient backdrop shows during load and as fallback if image fails.
 */

import React, { useState } from 'react';

interface ProductImageProps {
  innovationId: string;
  gradient: string;
  accent: string;
  size?: 'card' | 'hero';
}

// Curated Unsplash stock photos — topical, editorial quality.
// Format: https://images.unsplash.com/photo-{id}?w=1200&auto=format&fit=crop&q=70
const stockPhotos: Record<string, string> = {
  // inn_01 — Microbiome-Powered Scalp Care System
  'inn_01': 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1200&auto=format&fit=crop&q=70',
  // inn_02 — Anti-Thinning Hair Density Platform
  'inn_02': 'https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=1200&auto=format&fit=crop&q=70',
  // inn_03 — Bio-Logic Concentrated Laundry Sheets
  'inn_03': 'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=1200&auto=format&fit=crop&q=70',
  // inn_04 — Premium Fabric Refresh Ecosystem
  'inn_04': 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=1200&auto=format&fit=crop&q=70',
  // inn_05 — Smart Auto-Dosing Laundry Cartridge
  'inn_05': 'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?w=1200&auto=format&fit=crop&q=70',
  // inn_06 — Garment Lifetime Protection Platform
  'inn_06': 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=1200&auto=format&fit=crop&q=70',
  // inn_07 — Premium Men's Grooming Ecosystem
  'inn_07': 'https://images.unsplash.com/photo-1621607512214-68297480165e?w=1200&auto=format&fit=crop&q=70',
  // inn_08 — AI-Personalized Home Hair Color Platform
  'inn_08': 'https://images.unsplash.com/photo-1560869713-7d0a29430803?w=1200&auto=format&fit=crop&q=70',
  // inn_09 — PFAS-Free Premium Dish Care System
  'inn_09': 'https://images.unsplash.com/photo-1584947897558-4e06f2a7b8e1?w=1200&auto=format&fit=crop&q=70',
  // inn_10 — Biotech-Powered Hair Repair System
  'inn_10': 'https://images.unsplash.com/photo-1526045478516-99145907023c?w=1200&auto=format&fit=crop&q=70',
  // inn_11 — Climate-Adaptive Insect Defense System
  'inn_11': 'https://images.unsplash.com/photo-1589133301875-d8db3f1ea1f4?w=1200&auto=format&fit=crop&q=70',
  // inn_12 — Professional-to-Consumer Bond Repair
  'inn_12': 'https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=1200&auto=format&fit=crop&q=70',
  // inn_13 — Emerging Markets Affordable Innovation
  'inn_13': 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=1200&auto=format&fit=crop&q=70',
  // inn_14 — Day-2 Hair Revival System
  'inn_14': 'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=1200&auto=format&fit=crop&q=70',
  // inn_15 — Premium Aromatherapy Home Care
  'inn_15': 'https://images.unsplash.com/photo-1596178065887-1198b6148b2b?w=1200&auto=format&fit=crop&q=70',
  // inn_16 — Circular Refill Station Network
  'inn_16': 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=1200&auto=format&fit=crop&q=70',
};

export default function InnovationProductImage({ innovationId, gradient, accent, size = 'card' }: ProductImageProps) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const photoUrl = stockPhotos[innovationId];

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: gradient,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Stock photo */}
      {photoUrl && !imgError && (
        <img
          src={photoUrl}
          alt=""
          loading="lazy"
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgError(true)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: imgLoaded ? 1 : 0,
            transition: 'opacity 0.6s ease-out',
          }}
        />
      )}
      {/* Editorial color overlay — brand-tinted wash */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `linear-gradient(135deg, ${accent}55 0%, ${accent}22 40%, rgba(0,0,0,0.25) 100%)`,
        mixBlendMode: 'multiply',
        pointerEvents: 'none',
      }} />
      {/* Subtle grain / vignette */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 40%, rgba(0,0,0,0.25) 100%)',
        pointerEvents: 'none',
      }} />
    </div>
  );
}
