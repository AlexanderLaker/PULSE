'use client';

/**
 * Chip — the ONE chip language for recurring semantics (R-18, design review
 * 2026-07-01). Direction, evidence grade and provenance were previously
 * styled three different ways across Trends / drill-down / Journey /
 * Explorer (slate ↗ pills vs green ▲ chips vs emoji stickers). One
 * component, text + colour (never colour or emoji alone), glyph arrows
 * only for direction (matches ShiftValue).
 */

import React from 'react';
import { S, BODY_FONT } from '@/lib/theme';

type ChipSpec = { label: string; bg: string; ink: string; glyph?: string };

const SPECS: Record<string, ChipSpec> = {
  /* direction */
  expansion:   { label: 'Expansion',   bg: S.expansionDim,     ink: S.expansionInk,  glyph: '▲' },
  contraction: { label: 'Contraction', bg: S.contractionDim,   ink: S.contractionInk, glyph: '▼' },
  /* evidence grade (Explorer source ladder wording) */
  reported:  { label: 'Reported',  bg: S.greenSoft,        ink: S.expansionInk },
  derived:   { label: 'Derived',   bg: S.blueSoft,         ink: S.primaryDim },
  estimate:  { label: 'Estimate',  bg: S.amberSoft,        ink: S.amber },
  /* provenance (D7 semantics unchanged — styling unified) */
  ai:        { label: 'AI suggestion',      bg: S.surfaceContainer, ink: S.onSurfaceVariant },
  reviewed:  { label: 'Expert-reviewed',    bg: S.greenSoft,        ink: S.expansionInk },
  authored:  { label: 'Strategist-authored', bg: S.surfaceContainer, ink: S.onSurfaceVariant },
  /* neutral */
  neutral:   { label: '',          bg: S.surfaceContainer, ink: S.onSurfaceVariant },
};

export type ChipKind = keyof typeof SPECS;

const Chip: React.FC<{
  kind: ChipKind;
  /** Override the default label (e.g. "Estimate · RSP"). */
  label?: string;
  title?: string;
  /** Compact = 1px 6px padding for dense rows. */
  compact?: boolean;
  style?: React.CSSProperties;
}> = ({ kind, label, title, compact, style }) => {
  const spec = SPECS[kind] ?? SPECS.neutral!;
  return (
    <span
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: compact ? '1px 7px' : '2px 8px',
        borderRadius: 999,
        backgroundColor: spec.bg,
        color: spec.ink,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        fontFamily: BODY_FONT,
        whiteSpace: 'nowrap',
        lineHeight: 1.4,
        ...style,
      }}
    >
      {spec.glyph && <span aria-hidden>{spec.glyph}</span>}
      {label ?? spec.label}
    </span>
  );
};

export default Chip;
