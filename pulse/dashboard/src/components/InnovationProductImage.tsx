/**
 * PRISM Innovation Explorer — Topical Editorial Illustrations
 * Each innovation gets a large, topically-accurate Lucide icon composition
 * rendered on a branded gradient backdrop. No external image dependencies,
 * guaranteed to match each concept's subject matter.
 */

import React from 'react';
import {
  FlaskConical,
  Droplets,
  Sparkles,
  Layers,
  Shirt,
  SprayCan,
  Wind,
  Cpu,
  Zap,
  ShieldCheck,
  User,
  Palette,
  Utensils,
  Dna,
  Bug,
  Link2,
  Globe,
  Package,
  Sun,
  Leaf,
  Recycle,
  Container,
  Scissors,
  type LucideIcon,
} from 'lucide-react';

interface ProductImageProps {
  innovationId: string;
  gradient: string;
  accent: string;
  size?: 'card' | 'hero';
}

// Each innovation maps to a topically-accurate primary icon + secondary accent icon.
// These icons were chosen to match the exact product concept described in innovations.ts.
const iconMap: Record<string, { primary: LucideIcon; accent: LucideIcon; label: string }> = {
  // inn_01 — Microbiome-Powered Scalp Care System
  inn_01: { primary: FlaskConical, accent: Droplets, label: 'Scalp Science' },
  // inn_02 — Anti-Thinning Hair Density Platform
  inn_02: { primary: Sparkles, accent: Scissors, label: 'Hair Density' },
  // inn_03 — Bio-Logic Concentrated Laundry Sheets
  inn_03: { primary: Layers, accent: Shirt, label: 'Laundry Sheets' },
  // inn_04 — Premium Fabric Refresh Ecosystem
  inn_04: { primary: SprayCan, accent: Wind, label: 'Fabric Refresh' },
  // inn_05 — Smart Auto-Dosing Laundry Cartridge System
  inn_05: { primary: Cpu, accent: Zap, label: 'Smart Cartridge' },
  // inn_06 — Garment Lifetime Protection Platform
  inn_06: { primary: Shirt, accent: ShieldCheck, label: 'Garment Care' },
  // inn_07 — Premium Men's Grooming Ecosystem
  inn_07: { primary: User, accent: Sparkles, label: "Men's Grooming" },
  // inn_08 — AI-Personalized Home Hair Color Platform
  inn_08: { primary: Palette, accent: Sparkles, label: 'AI Color' },
  // inn_09 — PFAS-Free Premium Dish Care System
  inn_09: { primary: Utensils, accent: Droplets, label: 'Dish Care' },
  // inn_10 — Biotech-Powered Hair Repair System
  inn_10: { primary: Dna, accent: FlaskConical, label: 'Biotech Repair' },
  // inn_11 — Climate-Adaptive Insect Defense System
  inn_11: { primary: Bug, accent: ShieldCheck, label: 'Insect Defense' },
  // inn_12 — Professional-to-Consumer Bond Repair
  inn_12: { primary: Link2, accent: Sparkles, label: 'Bond Repair' },
  // inn_13 — Emerging Markets Affordable Innovation System
  inn_13: { primary: Package, accent: Globe, label: 'Sachet Economy' },
  // inn_14 — Day-2 Hair Revival System
  inn_14: { primary: Sun, accent: Wind, label: 'Day-2 Revival' },
  // inn_15 — Premium Aromatherapy Home Care Collection
  inn_15: { primary: Leaf, accent: Droplets, label: 'Aromatherapy' },
  // inn_16 — Circular Refill Station Network
  inn_16: { primary: Recycle, accent: Container, label: 'Refill Station' },
};

export default function InnovationProductImage({
  innovationId,
  gradient,
  accent,
  size = 'card',
}: ProductImageProps) {
  const config = iconMap[innovationId] || iconMap.inn_01;
  const PrimaryIcon = config.primary;
  const AccentIcon = config.accent;

  const primarySize = size === 'hero' ? 200 : 120;
  const accentSize = size === 'hero' ? 110 : 64;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: gradient,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Editorial diagonal pattern */}
      <svg
        width="100%"
        height="100%"
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.12,
          pointerEvents: 'none',
        }}
      >
        <defs>
          <pattern
            id={`diag-${innovationId}`}
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="24" stroke="#ffffff" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#diag-${innovationId})`} />
      </svg>

      {/* Soft radial glow behind primary icon */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: primarySize * 2.2,
          height: primarySize * 2.2,
          background: `radial-gradient(circle, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 65%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Accent icon — offset, decorative */}
      <div
        style={{
          position: 'absolute',
          top: size === 'hero' ? '22%' : '18%',
          right: size === 'hero' ? '18%' : '14%',
          opacity: 0.32,
          transform: 'rotate(-8deg)',
          pointerEvents: 'none',
        }}
      >
        <AccentIcon
          size={accentSize}
          strokeWidth={1.4}
          color="#ffffff"
        />
      </div>

      {/* Primary icon — centered, hero element */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          filter: `drop-shadow(0 8px 24px ${accent}99)`,
        }}
      >
        <PrimaryIcon
          size={primarySize}
          strokeWidth={1.2}
          color="#ffffff"
          style={{
            opacity: 0.96,
          }}
        />
      </div>

      {/* Bottom label — editorial caption */}
      {size === 'hero' && (
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            left: 32,
            zIndex: 3,
            fontFamily: "'Manrope', 'Inter', sans-serif",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.82)',
            padding: '6px 12px',
            background: 'rgba(0,0,0,0.24)',
            borderRadius: 999,
            backdropFilter: 'blur(8px)',
          }}
        >
          {config.label}
        </div>
      )}

      {/* Editorial color overlay — brand-tinted wash */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(135deg, ${accent}22 0%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.18) 100%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Subtle vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at center, rgba(0,0,0,0) 50%, rgba(0,0,0,0.28) 100%)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
