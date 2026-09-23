/**
 * The drivers behind a category's terminal-year shift: the ranking at the
 * score means (lib/driverAttribution.ts) and the card of one driver.
 */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { FORCE_COLORS, HORIZON, NO_VALUE, fmtShift, fmtPct } from '@/lib/format';
import { S, SHADOW, BODY_FONT, MONO_FONT } from '@/lib/theme';
import { reconciliationFactor, type AttributionResult } from '@/lib/driverAttribution';
import type { Driver } from '@/types';

// ─── Contributing drivers ──────────────────────────────────────────────────

/** One driver's part in the category's terminal-year shift. */
interface Contributor {
  driver: Driver;
  /** The driver's exposure score for the category: 0 to 5, and above 0 for every contributor. */
  exposure: number;
  /** Signed, in shift units; the category's contributors add up to its terminal-year median
   *  (reconciliationFactor says when they cannot). */
  contribution: number;
  /** |contribution| over the category's total |contribution|. */
  share: number;
}

/**
 * The drivers that touch the category, largest part first: each driver's
 * contribution at the score means in the terminal year, scaled by the
 * category's reconciliationFactor so the parts add up to the median the
 * matrix shows. The scaling never changes a driver's sign.
 */
export function rankContributors(
  category: string, drivers: Driver[], attribution: AttributionResult, median: number,
): Contributor[] {
  const exposed = drivers.filter((d) => d.category_exposure[category] > 0);
  const raw = exposed.map((d) => attribution.byDriver[d.id].category[category][HORIZON]);
  const scale = reconciliationFactor(raw.reduce((a, b) => a + b, 0), median);
  const scaled = raw.map((v) => v * scale);
  const totalAbs = scaled.reduce((a, b) => a + Math.abs(b), 0);
  return exposed
    .map((driver, i) => ({
      driver,
      exposure: driver.category_exposure[category],
      contribution: scaled[i],
      share: totalAbs > 1e-9 ? Math.abs(scaled[i]) / totalAbs : 0,
    }))
    .sort((a, b) => {
      const gap = Math.abs(b.contribution) - Math.abs(a.contribution);
      return Math.abs(gap) > 1e-9
        ? gap
        : Math.abs(b.driver.expected_effect) - Math.abs(a.driver.expected_effect);
    });
}

// ─── DriverCard ────────────────────────────────────────────────────────────
// One ranked row: how big the driver's part is, which way it points and
// whether it matters. The hero figure is its share of the category's
// movement (the shares add up to 100% across the list), which turns a wall
// of near-zero contributions into a ranking; beneath it the signed
// contribution in the matrix's own units.

interface DriverCardProps {
  contributor: Contributor;
  /** Position in the ranking, from 0. */
  index: number;
  /** When provided, the card is a link into the Drivers page. */
  onOpen?: () => void;
}

export const DriverCard: React.FC<DriverCardProps> = ({ contributor, index, onOpen }) => {
  const { driver, exposure, contribution, share } = contributor;
  const [hovered, setHovered] = useState(false);
  const rank = index + 1;
  const isExpansion = contribution !== 0
    ? contribution > 0
    : driver.direction === 'Expansion';
  const dirColor = isExpansion ? S.expansion : S.contraction;
  const dirBg = isExpansion ? S.expansionDim : S.contractionDim;
  const dirInk = isExpansion ? S.expansionInk : S.contractionInk;
  const forceColor = FORCE_COLORS[driver.force];

  // The share bar: capped at 100%, and at least 2% wide for any non-zero
  // share, so a small driver stays visible next to the largest.
  const barWidth = share > 0 ? Math.max(2, Math.min(100, share * 100)) : 0;
  const shareLabel = share > 0 ? fmtPct(share, share >= 0.1 ? 0 : 1) : NO_VALUE;
  const contribLabel = contribution !== 0 ? fmtShift(contribution, 1) : NO_VALUE;

  const interactive = !!onOpen;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03, duration: 0.25, ease: 'easeOut' }}
      onClick={onOpen}
      onMouseEnter={interactive ? () => setHovered(true) : undefined}
      onMouseLeave={interactive ? () => setHovered(false) : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive
        ? `${rank}. ${driver.name}: ${shareLabel} of the movement, contribution ${contribLabel}, `
          + `${isExpansion ? 'expansion' : 'contraction'}. Opens it on the Drivers page`
        : undefined}
      onKeyDown={interactive ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen?.(); }
      } : undefined}
      style={{
        padding: '12px 14px',
        backgroundColor: S.surface,
        borderRadius: 12,
        border: `1px solid ${hovered ? S.primary : S.cardBorder}`,
        boxShadow: hovered ? SHADOW.lift : 'none',
        display: 'grid',
        gridTemplateColumns: interactive ? '28px 1fr auto 18px' : '28px 1fr auto',
        columnGap: 12,
        alignItems: 'center',
        cursor: interactive ? 'pointer' : 'default',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 999,
          backgroundColor: rank <= 5 ? S.primaryContainer : S.surfaceLow,
          color: rank <= 5 ? S.onPrimaryContainer : S.onSurfaceVariant,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: MONO_FONT,
          fontSize: 11.5,
          fontWeight: 700,
        }}
      >
        {rank}
      </div>

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: S.onSurface,
            fontFamily: BODY_FONT,
            lineHeight: 1.3,
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
          }}
          title={driver.name}
        >
          {driver.name}
        </div>

        {/* Force, exposure and direction */}
        <div
          style={{
            marginTop: 4,
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
            fontSize: 11,
            color: S.onSurfaceVariant,
            fontFamily: BODY_FONT,
          }}
        >
          <span style={{ color: forceColor, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: forceColor, display: 'inline-block', flexShrink: 0 }} />
            {driver.force}
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              padding: '1px 7px',
              borderRadius: 999,
              backgroundColor: S.surfaceLow,
              color: S.onSurfaceVariant,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            Exposure {exposure}/5
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              padding: '1px 7px',
              borderRadius: 999,
              backgroundColor: dirBg,
              color: dirInk,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {isExpansion ? '▲' : '▼'} {isExpansion ? 'Expansion' : 'Contraction'}
          </span>
        </div>

        <div
          style={{
            marginTop: 8,
            height: 4,
            borderRadius: 2,
            backgroundColor: S.surfaceLow,
            overflow: 'hidden',
          }}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${barWidth}%` }}
            transition={{ delay: 0.08 + index * 0.02, duration: 0.5, ease: 'easeOut' }}
            style={{
              height: '100%',
              backgroundColor: dirColor,
              opacity: 0.82,
              borderRadius: 2,
            }}
          />
        </div>
      </div>

      {/* Share of movement, then the signed contribution */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 2,
          minWidth: 68,
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 800,
            fontFamily: MONO_FONT,
            color: dirColor,
            lineHeight: 1,
            letterSpacing: '-0.01em',
          }}
        >
          {shareLabel}
        </div>
        <div
          style={{
            fontSize: 11,
            color: S.mutedText,
            fontFamily: MONO_FONT,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}
        >
          of movement
        </div>
        <div
          style={{
            marginTop: 2,
            fontSize: 11,
            color: S.onSurfaceVariant,
            fontFamily: MONO_FONT,
            fontWeight: 600,
          }}
        >
          {contribLabel}
        </div>
      </div>

      {interactive && (
        <ArrowUpRight
          size={15}
          strokeWidth={2.4}
          aria-hidden
          style={{
            color: S.primary,
            opacity: hovered ? 1 : 0.4,
            transition: 'opacity 0.15s ease',
            flexShrink: 0,
          }}
        />
      )}
    </motion.div>
  );
};
