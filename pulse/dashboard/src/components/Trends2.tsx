/**
 * Trends 2 — Editorial Intelligence View (Vite dashboard)
 *
 * Alternative visualisation for the trends page, inspired by the Stitch
 * "Digital Curator" design language (see stitch_fmcg_trend_navigator-3/DESIGN.md):
 *   • Maritime blue palette with tonal layering (no 1px borders)
 *   • Manrope headlines + Inter body pairing
 *   • Pill category filter chips, dot-probability bar, pill direction badges
 *   • Editorial "insight rail" accent on the section header
 *
 * Data is wired to real trends from usePrism — no mock content from the design source.
 */

import React, { useMemo, useState, FC } from 'react';
import { motion } from 'framer-motion';
import {
  Search, TrendingUp, TrendingDown, Users, Store, Cpu, Landmark,
  Leaf, Swords, Sparkles, ArrowLeft,
} from 'lucide-react';
import usePrism from '../hooks/usePrism';
import { CATEGORIES, fmtPct, fmtShift } from '../lib/format';
import type { Trend, ForceName, CategoryId } from '../types';

const S = {
  bg:                 '#f8f9ff',
  surface:            '#ffffff',
  surfaceLow:         '#eff4ff',
  surfaceContainer:   '#e5eeff',
  surfaceHigh:        '#dce9ff',
  surfaceHighest:     '#d2e4ff',
  primary:            '#005db5',
  primaryDim:         '#0052a0',
  primaryContainer:   '#d6e3ff',
  onPrimaryContainer: '#00519e',
  onBg:               '#00345e',
  onSurface:          '#00345e',
  onSurfaceVariant:   '#26619d',
  secondaryContainer: '#d5e3fc',
  onSecondaryContainer:'#455367',
  tertiaryContainer:  '#dae2fd',
  onTertiaryContainer:'#4a5167',
  error:              '#9f403d',
  errorContainer:     '#fe8983',
  onErrorContainer:   '#752121',
};

const HEADLINE_FONT = "'Manrope', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const BODY_FONT     = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

const FORCE_TILE: Record<ForceName, { Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; bg: string; fg: string }> = {
  Consumer:      { Icon: Users,    bg: S.primaryContainer,   fg: S.primary },
  Customer:      { Icon: Store,    bg: S.secondaryContainer, fg: S.onSecondaryContainer },
  Technology:    { Icon: Cpu,      bg: S.tertiaryContainer,  fg: S.onTertiaryContainer },
  Government:    { Icon: Landmark, bg: S.surfaceHighest,     fg: S.onSurface },
  Environmental: { Icon: Leaf,     bg: S.surfaceHigh,        fg: S.primary },
  Competitive:   { Icon: Swords,   bg: S.surfaceContainer,   fg: S.primaryDim },
};

const DotBar: FC<{ value: number }> = ({ value }) => (
  <div style={{ display: 'flex', gap: 6 }} aria-label={`Probability ${value} of 5`}>
    {[1, 2, 3, 4, 5].map((d) => (
      <span
        key={d}
        style={{
          display: 'inline-block',
          width: 10, height: 10, borderRadius: 999,
          backgroundColor: d <= value ? S.primary : S.surfaceHigh,
        }}
      />
    ))}
  </div>
);

const DirectionPill: FC<{ direction: 'Expansion' | 'Contraction' }> = ({ direction }) => {
  const isExp = direction === 'Expansion';
  const Icon = isExp ? TrendingUp : TrendingDown;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 12px', borderRadius: 999,
      fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
      backgroundColor: isExp ? S.primaryContainer : S.errorContainer,
      color:           isExp ? S.onPrimaryContainer : S.onErrorContainer,
    }}>
      <Icon size={13} strokeWidth={2.5} />
      {direction}
    </span>
  );
};

interface Trends2Props {
  onBack?: () => void;
}

const Trends2: FC<Trends2Props> = ({ onBack }) => {
  const { trends, loading, backendAvailable } = usePrism();
  const [categoryFilter, setCategoryFilter] = useState<CategoryId | 'all'>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo<Trend[]>(() => {
    const q = search.trim().toLowerCase();
    return (trends || []).filter((t) => {
      if (categoryFilter !== 'all') {
        const exposure = t.category_exposure?.[categoryFilter as CategoryId] ?? 0;
        if (exposure <= 0) return false;
      }
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        (t.description?.toLowerCase().includes(q) ?? false) ||
        t.force.toLowerCase().includes(q)
      );
    });
  }, [trends, categoryFilter, search]);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: S.bg, color: S.onBg, fontFamily: BODY_FONT }}>
      <main style={{ maxWidth: 1440, margin: '0 auto', padding: '40px 32px 40px 72px' }}>
        {/* Back button */}
        {onBack && (
          <button
            onClick={onBack}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', marginBottom: 24,
              borderRadius: 999, border: 'none',
              backgroundColor: S.surfaceLow, color: S.primary,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <ArrowLeft size={14} /> Back
          </button>
        )}

        {/* Editorial header with insight rail */}
        <header style={{ marginBottom: 32, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 32 }}>
          <div style={{ paddingLeft: 20, borderLeft: `4px solid ${S.primary}` }}>
            <div style={{
              fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '0.18em', color: S.onSurfaceVariant, marginBottom: 8,
            }}>
              Trend Intelligence · Editorial View
            </div>
            <h1 style={{
              fontFamily: HEADLINE_FONT, color: S.onBg,
              fontSize: '2.5rem', lineHeight: 1.1, fontWeight: 800,
              letterSpacing: '-0.02em', margin: 0,
            }}>
              The Forces Shaping FMCG
            </h1>
            <p style={{
              marginTop: 8, maxWidth: 640, fontSize: 15,
              color: S.onSurfaceVariant, lineHeight: 1.55,
            }}>
              A curated lens on the {trends?.length ?? 0} signals driving
              profit-pool reallocation across categories through 2036.
            </p>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', width: '100%', maxWidth: 320 }}>
            <Search size={16} style={{
              position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
              color: S.onSurfaceVariant,
            }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search trends…"
              style={{
                width: '100%', padding: '10px 16px 10px 42px',
                borderRadius: 999, fontSize: 14,
                backgroundColor: S.surfaceLow, color: S.onSurface,
                border: 'none', outline: 'none',
              }}
            />
          </div>
        </header>

        {/* Category filter chips */}
        <section style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, scrollbarWidth: 'none' }}>
            <FilterChip label="All" active={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')} />
            {CATEGORIES.map((c) => (
              <FilterChip
                key={c.id}
                label={c.short}
                active={categoryFilter === c.id}
                onClick={() => setCategoryFilter(c.id as CategoryId)}
              />
            ))}
          </div>
        </section>

        {/* Trend list card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          style={{
            borderRadius: 20, overflow: 'hidden', backgroundColor: S.surface,
            boxShadow: '0 4px 60px -15px rgba(0, 52, 94, 0.08)',
          }}
        >
          {/* Column header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2.3fr 1fr 1fr 0.9fr 0.8fr',
            alignItems: 'center', padding: '20px 32px',
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em',
            backgroundColor: S.surfaceLow, color: S.onSurfaceVariant,
          }}>
            <span>Trend</span>
            <span>Direction</span>
            <span>Probability</span>
            <span style={{ textAlign: 'right' }}>GP1 % Affected</span>
            <span style={{ textAlign: 'right' }}>Shift</span>
          </div>

          {loading && <EmptyRow text="Loading trend intelligence…" />}
          {!loading && !backendAvailable && <EmptyRow text="Backend unavailable — reconnect to view live trend data." />}
          {!loading && backendAvailable && filtered.length === 0 && <EmptyRow text="No trends match the current filter." />}
          {filtered.map((t, idx) => (
            <TrendRow key={t.id ?? idx} trend={t} isLast={idx === filtered.length - 1} />
          ))}
        </motion.div>
      </main>
    </div>
  );
};

const FilterChip: FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      flexShrink: 0, padding: '8px 20px', borderRadius: 999,
      fontSize: 14, fontWeight: 600,
      border: 'none', cursor: 'pointer', transition: 'all 0.2s',
      backgroundColor: active ? S.primaryContainer : S.surfaceLow,
      color:           active ? S.onPrimaryContainer : S.onSurfaceVariant,
    }}
  >
    {label}
  </button>
);

const TrendRow: FC<{ trend: Trend; isLast: boolean }> = ({ trend, isLast }) => {
  const tile = FORCE_TILE[trend.force] ?? FORCE_TILE.Consumer;
  const { Icon } = tile;
  const gp1 = (trend as Trend & { gp1_pct_affected?: number }).gp1_pct_affected;
  const shift = trend.gp1_shift;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '2.3fr 1fr 1fr 0.9fr 0.8fr',
      alignItems: 'center', padding: '24px 32px',
      backgroundColor: S.surface,
      // Tonal divider instead of 1px border, per DESIGN.md "No-Line Rule"
      boxShadow: isLast ? 'none' : `inset 0 -1px 0 ${S.surfaceLow}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
        <div style={{
          width: 44, height: 44, flexShrink: 0, borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: tile.bg, color: tile.fg,
        }}>
          <Icon size={20} strokeWidth={2} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontFamily: HEADLINE_FONT, color: S.onSurface,
            fontWeight: 700, fontSize: 15,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {trend.name}
          </div>
          <div style={{
            color: S.onSurfaceVariant, fontSize: 13,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {trend.description || trend.strategic_implication || `${trend.force} signal`}
          </div>
        </div>
      </div>

      <div><DirectionPill direction={trend.direction} /></div>
      <div><DotBar value={Math.round(trend.probability ?? 0)} /></div>

      <div style={{ textAlign: 'right' }}>
        <span style={{ fontFamily: HEADLINE_FONT, color: S.onSurface, fontWeight: 800, fontSize: '1.15rem' }}>
          {gp1 != null ? fmtPct(gp1) : '—'}
        </span>
      </div>

      <div style={{ textAlign: 'right' }}>
        <span style={{ fontWeight: 700, fontSize: 14,
          color: shift != null && shift < 0 ? S.error : S.onPrimaryContainer,
        }}>
          {shift != null ? fmtShift(shift) : '—'}
        </span>
      </div>
    </div>
  );
};

const EmptyRow: FC<{ text: string }> = ({ text }) => (
  <div style={{
    padding: '64px 32px', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 12,
    color: S.onSurfaceVariant,
  }}>
    <Sparkles size={20} color={S.primary} />
    <div style={{ fontSize: 14 }}>{text}</div>
  </div>
);

export default Trends2;
