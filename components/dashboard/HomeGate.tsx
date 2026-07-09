/**
 * HomeGate — "Profit Pool Model", the entry view of PRISM.
 *
 * The gate is a pure wayfinding surface (owner design review, July 2026):
 * one headline, four equal doors in product-tab order, the system's story
 * told once across the top — THE INPUT → THE LENS → THE OUTPUT → THE MARKET
 * — and nothing else. No numbers, no run metadata, no footer.
 *
 * Honest-display notes (what is live and what is deliberately not):
 *   • Trends door   — LIVE: constellation dot count per force is derived
 *     from the trend store (∝ trends-per-force), so the door shows the
 *     shape of the current evidence base. Geometry only, no numbers.
 *   • Shift door    — LIVE: the 12 heat cells are the 12 categories'
 *     MC-median shifts at the terminal year from the persisted run,
 *     tinted through lib/format's heatFill (the matrix's own ramp, F1/U3);
 *     the band below is the joint portfolio P10–median–P90 (D3). Until
 *     the run loads, cells render in the neutral base tint — never fake.
 *   • Journey door  — STATIC by design: the journey overlay is qualitative
 *     (owner ruling O3 deleted the quantitative stage layer); the artwork
 *     is an abstract pictogram and must not imply a per-stage decomposition
 *     exists in the model.
 *   • Explorer door — STATIC mekko pictogram mirroring that page's chart
 *     grammar (bar width = revenue share, height = GP1 proxy, arrows =
 *     pool development). lib/profitPoolData stays out of the initial
 *     bundle (F10), so the art is not wired to it.
 *
 * Interaction: click / Enter opens the pane via the dashboard's keep-alive
 * tab opener; keys 1–4 jump straight into a room while the gate is the
 * active pane. Entrance animation respects prefers-reduced-motion.
 */

'use client';

import React, { FC, ReactNode, useEffect, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import usePrism from '@/hooks/usePrism';
import { S, HEADLINE_FONT, BODY_FONT, MONO_FONT } from '@/lib/theme';
import { CATEGORIES, YEARS, heatFill, heatScaleFor } from '@/lib/format';
import type { ForceName } from '@/types';
import type { PercentileDistribution, ShiftPath } from '@/types/simulation';

/** Tabs the gate can open — mirrors the dashboard's production tab ids. */
export type GateRoom =
  | 'trends-2'
  | 'consumer-journey-2'
  | 'profit-pool-2'
  | 'profit-pool-explorer';

interface HomeGateProps {
  /** True while the gate is the visible pane — gates the 1–4 key listener
   *  (panes stay mounted when hidden, keep-alive architecture). */
  active: boolean;
  onNavigate: (room: GateRoom) => void;
}

// ─── Local design tokens (gate-only washes; base colours from theme) ──
// Colour is used as light: a white→tint gradient per door plus one soft
// radial glow. Values are gate-specific by design — not shared tokens.
const WASH = {
  trends:   { bg: 'linear-gradient(180deg,#ffffff 0%,#f2f7ff 100%)', glow: 'radial-gradient(420px 300px at 50% 34%, rgba(0,93,181,.07), transparent 70%)' },
  journey:  { bg: 'linear-gradient(180deg,#ffffff 0%,#f5f3fe 100%)', glow: 'radial-gradient(420px 300px at 50% 34%, rgba(107,79,196,.07), transparent 70%)' },
  shift:    { bg: 'linear-gradient(180deg,#ffffff 0%,#eef3fb 100%)', glow: 'radial-gradient(420px 300px at 50% 34%, rgba(0,52,94,.06), transparent 70%)' },
  explorer: { bg: 'linear-gradient(180deg,#ffffff 0%,#f0faf8 100%)', glow: 'radial-gradient(420px 300px at 50% 34%, rgba(15,155,142,.07), transparent 70%)' },
} as const;

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

// ─── Trends constellation layout ──────────────────────────────────
// Hand-tuned cluster positions per force (up to 8 dot slots each); the
// NUMBER of dots rendered per cluster is live: max(3, round(count / 4)).
const CLUSTER_ORDER: ForceName[] = [
  'Consumer', 'Technology', 'Government', 'Competitive', 'Environmental', 'Customer',
];
const CLUSTER_SPOTS: Array<Array<[number, number, number]>> = [
  [[66, 52, 8], [104, 28, 5.5], [126, 62, 6.5], [84, 92, 4.5], [38, 86, 5], [20, 66, 4], [100, 24, 4], [52, 74, 4.5]],
  [[188, 40, 6.5], [222, 60, 4.5], [208, 22, 4], [160, 64, 4], [240, 44, 3.5]],
  [[258, 84, 6], [272, 58, 4], [240, 110, 4.5], [286, 96, 3.5]],
  [[80, 164, 6.5], [52, 188, 4.5], [112, 192, 5], [40, 150, 4]],
  [[170, 150, 6.5], [196, 176, 4.5], [152, 184, 4]],
  [[242, 152, 6.5], [262, 182, 4.5], [224, 168, 4]],
];
const FORCE_COLOR: Record<ForceName, string> = {
  Consumer: '#005db5', Customer: '#6b4fc4', Technology: '#0e8aa8',
  Government: '#b07d2b', Environmental: '#2f8f4e', Competitive: '#b0504a',
};
/** v3.5 base composition — placeholder dot counts until the store loads. */
const FALLBACK_FORCE_COUNTS: Record<ForceName, number> = {
  Consumer: 32, Technology: 18, Government: 14, Competitive: 14, Environmental: 11, Customer: 10,
};

// ─── Shift-matrix helpers (mirrors ProfitPoolAnalysis2's tolerant read) ──
function extractMedian(v: PercentileDistribution | number | undefined): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  return v.median ?? null;
}
function medianAt(
  shifts: Record<string, ShiftPath> | undefined,
  catName: string,
  catId: string,
  year: number,
): number | null {
  if (!shifts) return null;
  const path = shifts[catName] ?? shifts[catId];
  if (!path) return null;
  const v = (path as Record<string | number, unknown>)[year]
         ?? (path as Record<string | number, unknown>)[String(year)];
  return extractMedian(v as PercentileDistribution | number | undefined);
}

const TERMINAL_YEAR = YEARS[YEARS.length - 1];
// 12 cells = the 12 categories, canonical CATEGORIES order, 4 × 3 grid.
const CELL_X = [10, 72, 134, 196];
const CELL_Y = [14, 60, 106];
// Band geometry (SVG x-range shared by rail and fill).
const BAND_X0 = 10;
const BAND_W = 238;

// ═══════════════════════════════════════════════════════════════════
// Door artworks
// ═══════════════════════════════════════════════════════════════════

const TrendsArt: FC<{ countsByForce: Record<ForceName, number> }> = ({ countsByForce }) => (
  <svg width="300" height="230" viewBox="0 0 300 230" fill="none" aria-hidden="true">
    {CLUSTER_ORDER.map((force, i) => {
      const dots = Math.max(3, Math.round((countsByForce[force] ?? 0) / 4));
      const spots = CLUSTER_SPOTS[i].slice(0, dots);
      const c = FORCE_COLOR[force];
      return (
        <g key={force}>
          <circle cx={CLUSTER_SPOTS[i][0][0]} cy={CLUSTER_SPOTS[i][0][1]} r={15} fill={c} opacity={0.10} />
          {spots.map(([x, y, r], j) => (
            <circle key={j} cx={x} cy={y} r={r} fill={c} opacity={j ? 0.55 + 0.35 / j : 1} />
          ))}
        </g>
      );
    })}
    <path
      d="M126 62 L188 40 M222 60 L258 84 M84 92 L80 164 M170 150 L196 176 M126 62 L170 150 M242 152 L262 182"
      stroke="rgba(0,52,94,.12)" strokeWidth={1.25}
    />
    {/* the evidence flows in */}
    <path
      d="M112 192 C 130 208, 148 214, 162 216 M196 176 C 184 196, 172 208, 162 216 M152 184 C 154 196, 158 208, 162 216"
      stroke="rgba(0,52,94,.22)" strokeWidth={1.25} strokeDasharray="2 5" fill="none"
    />
    <circle cx={163} cy={217} r={10} fill="#fff" stroke="rgba(0,52,94,.35)" strokeWidth={1.5} />
    <path
      d="M159 217 L167 217 M164 214 L167 217 L164 220"
      stroke={S.primary} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" fill="none"
    />
  </svg>
);

/** Static, abstract by design — the journey layer is qualitative (O3). */
const JourneyArt: FC = () => {
  const nodes: Array<[number, number]> = [[16, 120], [72, 92], [132, 106], [192, 146], [250, 130]];
  const bars: Array<{ h: number; up: boolean }> = [
    { h: 46, up: false }, { h: 33, up: false }, { h: 46, up: true }, { h: 55, up: false }, { h: 37, up: true },
  ];
  return (
    <svg width="300" height="230" viewBox="0 0 300 230" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="gate-jg" x1="0" y1="0" x2="300" y2="230" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#005db5" />
          <stop offset="1" stopColor="#6b4fc4" />
        </linearGradient>
      </defs>
      <g transform="translate(0,14)">
        {bars.map((b, i) => (
          <rect
            key={i} x={nodes[i][0] - 6} y={nodes[i][1] - 28 - b.h} width={12} height={b.h} rx={6}
            fill={b.up ? 'rgba(31,122,61,.38)' : 'rgba(159,64,61,.42)'}
          />
        ))}
        <path
          d="M16 120 C 60 70, 104 70, 148 112 C 192 154, 236 152, 284 108"
          stroke="url(#gate-jg)" strokeWidth={2.5} strokeLinecap="round" strokeDasharray="1 9" opacity={0.85} fill="none"
        />
        {nodes.map(([x, y], i) =>
          i === 2 ? (
            <circle key={i} cx={x} cy={y} r={11} fill="url(#gate-jg)" />
          ) : (
            <circle
              key={i} cx={x} cy={y} r={7} fill="#fff"
              stroke={i === 0 ? '#005db5' : i === 4 ? '#6b4fc4' : 'rgba(0,52,94,.30)'}
              strokeWidth={i === 0 || i === 4 ? 2.25 : 1.75}
            />
          ),
        )}
        <path d="M284 108 L 292 104 M284 108 L 288 116" stroke="#6b4fc4" strokeWidth={2} strokeLinecap="round" opacity={0.7} />
      </g>
    </svg>
  );
};

/** LIVE: 12 category medians at the terminal year + joint portfolio band. */
const ShiftArt: FC<{
  cells: Array<number | null>;
  highlightIdx: number | null;
  band: { p10: number; median: number; p90: number } | null;
}> = ({ cells, highlightIdx, band }) => {
  const scale = heatScaleFor(cells);
  // Band x-mapping over a domain padded around [min(p10,0), max(p90,0)].
  let bandGeom: { x10: number; xMed: number; x90: number } | null = null;
  if (band) {
    const lo = Math.min(band.p10, 0);
    const hi = Math.max(band.p90, 0);
    const pad = Math.max((hi - lo) * 0.18, 0.005);
    const x = (v: number) => BAND_X0 + BAND_W * ((v - (lo - pad)) / (hi + pad - (lo - pad)));
    bandGeom = { x10: x(band.p10), xMed: x(band.median), x90: x(band.p90) };
  }
  return (
    <svg width="300" height="230" viewBox="0 0 300 230" fill="none" aria-hidden="true">
      {cells.map((v, i) => {
        const r = Math.floor(i / 4);
        const c = i % 4;
        return (
          <rect
            key={i} x={CELL_X[c]} y={CELL_Y[r]} width={52} height={36} rx={9}
            fill={heatFill(v, scale)}
            stroke={highlightIdx === i ? S.onBg : undefined}
            strokeWidth={highlightIdx === i ? 1.5 : undefined}
          />
        );
      })}
      <rect x={BAND_X0} y={162} width={BAND_W} height={5} rx={2.5} fill="rgba(0,52,94,.08)" />
      {bandGeom && (
        <>
          <rect
            x={bandGeom.x10} y={160} width={Math.max(bandGeom.x90 - bandGeom.x10, 6)} height={9} rx={4.5}
            fill="rgba(159,64,61,.16)"
          />
          <rect x={bandGeom.xMed - 1.25} y={155} width={2.5} height={19} rx={1.25} fill={S.onBg} />
        </>
      )}
    </svg>
  );
};

/** Static mekko pictogram — the Explorer page's chart grammar (F10: not wired). */
const ExplorerArt: FC = () => {
  const bars = [
    { share: 0.29, gp1: 0.75, up: true,  fill: 'rgba(15,155,142,.18)', stroke: '#0f9b8e' },
    { share: 0.21, gp1: 0.60, up: false, fill: 'rgba(0,93,181,.18)',   stroke: '#005db5' },
    { share: 0.16, gp1: 0.85, up: true,  fill: 'rgba(47,143,78,.18)',  stroke: '#2f8f4e' },
    { share: 0.13, gp1: 0.50, up: false, fill: 'rgba(176,125,43,.18)', stroke: '#b07d2b' },
    { share: 0.10, gp1: 0.375, up: false, fill: 'rgba(176,80,74,.18)', stroke: '#b0504a' },
  ];
  const total = bars.reduce((s, b) => s + b.share, 0);
  let x = 20;
  const drawn = bars.map((b) => {
    const w = (b.share / total) * 248;
    const h = b.gp1 * 160;
    const geom = { ...b, x, w, h, y: 208 - h, cx: x + w / 2 };
    x += w + 6;
    return geom;
  });
  return (
    <svg width="300" height="230" viewBox="0 0 300 230" fill="none" aria-hidden="true">
      <path d="M14 208 L 286 208" stroke="rgba(0,52,94,.18)" strokeWidth={1.5} />
      <path d="M14 208 L 14 44" stroke="rgba(0,52,94,.10)" strokeWidth={1.5} />
      {drawn.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={7} fill={b.fill} stroke={b.stroke} strokeWidth={1.5} opacity={0.9} />
          <path
            fill="none" stroke={b.up ? S.expansion : S.contraction} strokeWidth={2.5}
            strokeLinecap="round" strokeLinejoin="round"
            d={b.up
              ? `M${b.cx} ${b.y - 14} L ${b.cx} ${b.y - 28} M${b.cx - 6} ${b.y - 21} L ${b.cx} ${b.y - 29} L ${b.cx + 6} ${b.y - 21}`
              : `M${b.cx} ${b.y - 28} L ${b.cx} ${b.y - 14} M${b.cx - 6} ${b.y - 21} L ${b.cx} ${b.y - 13} L ${b.cx + 6} ${b.y - 21}`}
          />
        </g>
      ))}
    </svg>
  );
};

// ═══════════════════════════════════════════════════════════════════
// Door tile
// ═══════════════════════════════════════════════════════════════════

const Door: FC<{
  eyebrow: string;
  title: string;
  caption: string;
  beta?: boolean;
  keyHint: string;
  wash: { bg: string; glow: string };
  delay: number;
  reduced: boolean;
  ariaLabel: string;
  onOpen: () => void;
  children: ReactNode;
}> = ({ eyebrow, title, caption, beta, keyHint, wash, delay, reduced, ariaLabel, onOpen, children }) => (
  <motion.button
    type="button"
    onClick={onOpen}
    aria-label={ariaLabel}
    initial={reduced ? false : { opacity: 0, y: 20, scale: 0.985 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: 0.6, ease: EASE, delay }}
    className="group relative flex flex-col justify-between overflow-hidden rounded-[28px] p-[26px] pb-6 text-left
               transition-[transform,box-shadow] duration-500
               [box-shadow:0_1px_2px_rgba(0,52,94,.03),0_24px_48px_-28px_rgba(0,52,94,.12)]
               hover:-translate-y-1.5 hover:scale-[1.012]
               hover:[box-shadow:0_2px_4px_rgba(0,52,94,.04),0_40px_80px_-32px_rgba(0,52,94,.22)]
               focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px]
               focus-visible:outline-[var(--gate-primary)]"
    style={{ background: wash.bg, border: '1px solid rgba(0,52,94,.06)', fontFamily: BODY_FONT }}
  >
    <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: wash.glow }} />

    <div className="relative z-[1]">
      <p
        className="mb-[7px] text-[10.5px] font-bold uppercase tracking-[.13em]"
        style={{ fontFamily: HEADLINE_FONT, color: S.onSurfaceVariant }}
      >
        {eyebrow}
      </p>
      <h2
        className="pr-2 text-[19px] xl:text-[22px] font-extrabold tracking-[-.022em]"
        style={{ fontFamily: HEADLINE_FONT, color: S.onBg }}
      >
        {title}
        {beta && (
          <span
            className="ml-2 inline-block rounded-full border px-2 py-[2px] align-[2px] text-[10px] font-bold uppercase tracking-[.09em]"
            style={{ fontFamily: HEADLINE_FONT, color: S.mutedText, borderColor: S.cardBorderStrong }}
          >
            Beta
          </span>
        )}
      </h2>
    </div>

    <div
      aria-hidden="true"
      className="absolute inset-0 flex items-center justify-center pt-[88px] pb-[74px]
                 transition-transform duration-700 group-hover:-translate-y-0.5 group-hover:scale-105
                 [&>svg]:h-auto [&>svg]:max-w-[86%]"
    >
      {children}
    </div>

    <div className="relative z-[1]">
      <p className="pr-[52px] text-sm font-medium" style={{ color: S.mutedText }}>{caption}</p>
    </div>

    {/* keyboard hint — revealed on hover / keyboard focus */}
    <span
      aria-hidden="true"
      className="absolute right-[22px] top-6 flex h-[22px] w-[22px] items-center justify-center rounded-[7px]
                 border bg-[rgba(255,255,255,.85)] text-[11px] opacity-0 transition-opacity duration-300
                 group-hover:opacity-90 group-focus-visible:opacity-90"
      style={{ fontFamily: MONO_FONT, color: S.onSurfaceVariant, borderColor: S.cardBorderStrong }}
    >
      {keyHint}
    </span>

    {/* the go affordance — rotates → to ↗ on hover */}
    <span
      aria-hidden="true"
      className="absolute bottom-[22px] right-[22px] flex h-[38px] w-[38px] items-center justify-center
                 rounded-full border text-base opacity-75 backdrop-blur-[6px] transition-all duration-300
                 bg-[rgba(255,255,255,.85)] text-[var(--gate-ink2)] border-[var(--gate-hairline)]
                 group-hover:-rotate-45 group-hover:opacity-100 group-hover:bg-[var(--gate-primary)]
                 group-hover:text-white group-hover:border-[var(--gate-primary)]
                 group-focus-visible:opacity-100 group-focus-visible:bg-[var(--gate-primary)]
                 group-focus-visible:text-white group-focus-visible:border-[var(--gate-primary)]"
    >
      →
    </span>
  </motion.button>
);

// ═══════════════════════════════════════════════════════════════════
// The gate
// ═══════════════════════════════════════════════════════════════════

const ROOM_KEYS: Record<string, GateRoom> = {
  '1': 'trends-2',
  '2': 'consumer-journey-2',
  '3': 'profit-pool-2',
  '4': 'profit-pool-explorer',
};

const HomeGate: FC<HomeGateProps> = ({ active, onNavigate }) => {
  const { trends, simulation } = usePrism();
  const reduced = useReducedMotion() ?? false;

  // Live: trends per force (falls back to the v3.5 base until loaded).
  const countsByForce = useMemo<Record<ForceName, number>>(() => {
    if (!trends.length) return FALLBACK_FORCE_COUNTS;
    const counts = { ...FALLBACK_FORCE_COUNTS };
    (Object.keys(counts) as ForceName[]).forEach((f) => { counts[f] = 0; });
    trends.forEach((t) => { counts[t.force] = (counts[t.force] ?? 0) + 1; });
    return counts;
  }, [trends]);

  // Live: category medians at the terminal year, canonical CATEGORIES order.
  const matrixCells = useMemo<Array<number | null>>(
    () => CATEGORIES.map((c) => medianAt(simulation?.shifts, c.name, c.id, TERMINAL_YEAR)),
    [simulation],
  );
  const highlightIdx = useMemo<number | null>(() => {
    let idx: number | null = null;
    let best = 0;
    matrixCells.forEach((v, i) => {
      if (v != null && Math.abs(v) > best) { best = Math.abs(v); idx = i; }
    });
    return idx;
  }, [matrixCells]);

  // Live: joint portfolio band (D3) at the terminal year, when present.
  const band = useMemo(() => {
    const p = simulation?.totals?.portfolio;
    const entry = p?.[String(TERMINAL_YEAR)] ?? p?.[TERMINAL_YEAR as unknown as string];
    if (!entry || entry.p10 == null || entry.p90 == null || entry.median == null) return null;
    return { p10: entry.p10, median: entry.median, p90: entry.p90 };
  }, [simulation]);

  // Keys 1–4 open a room — only while the gate is the visible pane.
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (document.activeElement?.tagName ?? '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      const room = ROOM_KEYS[e.key];
      if (room) onNavigate(room);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, onNavigate]);

  return (
    <div
      className="mx-auto flex w-full max-w-[1480px] flex-col px-4 pb-6 md:px-6"
      style={{
        minHeight: 'calc(100vh - 64px)',
        fontFamily: BODY_FONT,
        // Token bridge for Tailwind hover states (values stay in lib/theme).
        ['--gate-primary' as string]: S.primary,
        ['--gate-ink2' as string]: S.onSurfaceVariant,
        ['--gate-hairline' as string]: S.cardBorder,
      }}
    >
      <motion.header
        initial={reduced ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="py-[clamp(34px,5vh,58px)] pb-[clamp(26px,3.6vh,40px)] text-center"
      >
        <h1
          className="text-[clamp(30px,3.8vw,50px)] font-extrabold leading-[1.06] tracking-[-.032em]"
          style={{ fontFamily: HEADLINE_FONT, color: S.onBg }}
        >
          Profit Pool Model
        </h1>
      </motion.header>

      <section className="relative grid min-h-[460px] flex-1 auto-rows-[minmax(300px,1fr)] grid-cols-1 gap-[18px] sm:grid-cols-2 xl:auto-rows-auto xl:grid-cols-4">
        <Door
          eyebrow="The input" title="Trends" caption="99 trends — the evidence."
          keyHint="1" wash={WASH.trends} delay={0.08} reduced={reduced}
          ariaLabel="Trends — the input. 99 trends, the evidence. Shortcut key 1."
          onOpen={() => onNavigate('trends-2')}
        >
          <TrendsArt countsByForce={countsByForce} />
        </Door>

        <Door
          eyebrow="The lens" title="Consumer Journey" caption="Pool impact, stage by stage."
          keyHint="2" wash={WASH.journey} delay={0.16} reduced={reduced}
          ariaLabel="Consumer Journey — the lens. Pool impact, stage by stage. Shortcut key 2."
          onOpen={() => onNavigate('consumer-journey-2')}
        >
          <JourneyArt />
        </Door>

        <Door
          eyebrow="The output" title="Profit Pool Shift Analysis" caption="Every category's shift to 2035."
          keyHint="3" wash={WASH.shift} delay={0.24} reduced={reduced}
          ariaLabel="Profit Pool Shift Analysis — the output. Every category's shift to 2035. Shortcut key 3."
          onOpen={() => onNavigate('profit-pool-2')}
        >
          <ShiftArt cells={matrixCells} highlightIdx={highlightIdx} band={band} />
        </Door>

        <Door
          eyebrow="The market" title="Profit Pool Explorer" caption="The pools, sized and sourced."
          beta keyHint="4" wash={WASH.explorer} delay={0.32} reduced={reduced}
          ariaLabel="Profit Pool Explorer, beta — the market. The pools, sized and sourced. Shortcut key 4."
          onOpen={() => onNavigate('profit-pool-explorer')}
        >
          <ExplorerArt />
        </Door>

        {/* the thread: input → lens → output → market (4-column layout only) */}
        {[0.25, 0.5, 0.75].map((f, i) => (
          <motion.span
            key={f}
            aria-hidden="true"
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.5 }}
            className="pointer-events-none absolute top-[33px] hidden w-[14px] text-center text-[13px] xl:block"
            style={{ color: 'rgba(0,52,94,.34)', left: `calc((100% - 54px)*${f} + ${2 + i * 18}px)` }}
          >
            →
          </motion.span>
        ))}
      </section>
    </div>
  );
};

export default HomeGate;
