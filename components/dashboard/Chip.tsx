'use client';

/**
 * Chip: one look for the labels that recur across the dashboard: a driver's
 * direction, an evidence grade, the provenance of a score or a text. A chip
 * always carries text, so its meaning never rests on colour alone; only the
 * direction chips add a glyph, the same arrows ShiftValue uses.
 */

import React from 'react';
import { S, BODY_FONT } from '@/lib/theme';

export type ChipKind =
  | 'expansion' | 'contraction'   // a driver's direction
  | 'reported' | 'estimate'       // an evidence grade
  | 'edited' | 'authored'         // provenance
  | 'neutral';                    // no meaning of its own: the label carries it

type ChipSpec = { label: string; bg: string; ink: string; glyph?: string };

const SPECS: Record<ChipKind, ChipSpec> = {
  expansion:   { label: 'Expansion',   bg: S.expansionDim,   ink: S.expansionInk,   glyph: '▲' },
  contraction: { label: 'Contraction', bg: S.contractionDim, ink: S.contractionInk, glyph: '▼' },
  reported:    { label: 'Reported',    bg: S.greenSoft,      ink: S.expansionInk },
  estimate:    { label: 'Estimate',    bg: S.amberSoft,      ink: S.amber },
  edited:      { label: 'Edited',      bg: S.greenSoft,      ink: S.expansionInk },
  authored:    { label: 'Strategist-authored', bg: S.surfaceContainer, ink: S.onSurfaceVariant },
  neutral:     { label: '',            bg: S.surfaceContainer, ink: S.onSurfaceVariant },
};

const Chip: React.FC<{
  kind: ChipKind;
  /** Replaces the kind's own label (e.g. "Estimate · RSP"). */
  label?: string;
  title?: string;
  /** Tighter padding for dense rows. */
  compact?: boolean;
  style?: React.CSSProperties;
}> = ({ kind, label, title, compact, style }) => {
  const spec = SPECS[kind];
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
