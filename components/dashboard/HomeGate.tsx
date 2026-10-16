/**
 * The entry view: "Profit Pool Model" over four doors, one per tab in tab
 * order, telling the system's story once across the top: the input, the
 * context, the output, the market. The gate only points the way: no
 * figures, no run metadata, no footer.
 *
 * What the artwork shows:
 *   - Drivers: a dot cluster per force, sized by the number of drivers in
 *     that force, so the door shows the shape of the evidence base.
 *   - Profit Pool Shift Analysis: the 13 categories' median shifts in the
 *     terminal year, tinted with the matrix's own heat ramp (heatFill), and
 *     below them the portfolio's P10–P90 band with its median. Until a run
 *     loads the cells keep the neutral tint.
 *   - Consumer Journey: an abstract pictogram. The journey overlay is
 *     qualitative, so the art must not suggest a per-stage decomposition.
 *   - Profit Pool Explorer: a static mekko in that page's chart grammar (bar
 *     width = revenue share, height = GP1 proxy, arrows = pool development).
 *     It is not wired to lib/profitPoolData, which stays out of the initial
 *     bundle.
 *
 * A click or Enter opens the tab; keys 1–4 do the same while the gate is the
 * visible pane. The entrance animation respects prefers-reduced-motion.
 */

'use client';

import { useEffect, useMemo, type FC, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import usePrism from '@/hooks/usePrism';
import { overlayOpen } from '@/hooks/useOverlay';
import {
  S, INK_RGB, PRIMARY_RGB, CONTRACTION_RGB, EXPANSION_RGB, HEADLINE_FONT, BODY_FONT, FIGURES,
} from '@/lib/theme';
import { CATEGORIES, FLAT_EPS, FORCE_COLORS, HORIZON, heatFill, heatScaleFor } from '@/lib/format';
import { getYearPercentiles } from '@/lib/shiftMatrix';
import { DRIVER_CODE_MAP } from '@/data/driverCodeMap';
import type { ForceName } from '@/types';

/** The tabs the gate opens: the dashboard's tab ids. */
export type GateRoom =
  | 'drivers'
  | 'consumer-journey'
  | 'shift-analysis'
  | 'profit-pool-explorer';

interface HomeGateProps {
  /** True while the gate is the visible pane. Hidden panes stay mounted, so
   *  the keys 1–4 listen only then. */
  active: boolean;
  onNavigate: (room: GateRoom) => void;
}

// ─── The gate's own palette; every other colour comes from the theme ─────
// Colour is used as light: a white-to-tint gradient per door plus one soft
// radial glow. The journey door's accent is a violet next to the primary blue.
const JOURNEY_VIOLET = '#6b4fc4';
const glow = (rgb: string, alpha: number) => `radial-gradient(420px 300px at 50% 34%, rgba(${rgb}, ${alpha}), transparent 70%)`;
const WASH = {
  drivers:  { bg: 'linear-gradient(180deg,#ffffff 0%,#f2f7ff 100%)', glow: glow(PRIMARY_RGB, 0.07) },
  journey:  { bg: 'linear-gradient(180deg,#ffffff 0%,#f5f3fe 100%)', glow: glow('107, 79, 196', 0.07) },
  shift:    { bg: 'linear-gradient(180deg,#ffffff 0%,#eef3fb 100%)', glow: glow(INK_RGB, 0.06) },
  explorer: { bg: 'linear-gradient(180deg,#ffffff 0%,#f0faf8 100%)', glow: glow('15, 155, 142', 0.07) },
} as const;
/** The text navy at a given opacity, for the artworks' line work. */
const ink = (alpha: number) => `rgba(${INK_RGB}, ${alpha})`;

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

// ─── Drivers constellation ─────────────────────────────────────────
// Hand-tuned dot positions per force cluster (up to 8 slots each); a cluster
// draws max(3, round(drivers in the force / 4)) of them.
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
/** The driver base per force (data/driverCodeMap.ts): the dot counts until the drivers load. */
const BASE_FORCE_COUNTS = Object.values(DRIVER_CODE_MAP).reduce<Record<string, number>>(
  (counts, d) => ({ ...counts, [d.force]: (counts[d.force] ?? 0) + 1 }), {}) as Record<ForceName, number>;

const CATEGORY_COLOR: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.name, c.color]));
// One cell per category in CATEGORIES order, four to a row; the portfolio
// band sits under the fourth row, inside the shared 300 x 230 viewBox.
const CELL_X = [10, 72, 134, 196];
const CELL_Y = [14, 60, 106, 152];
// Band geometry (SVG x-range shared by rail and fill), under the cell block.
const BAND_X0 = 10;
const BAND_W = 238;
// Rail top; the P10–P90 fill and the median tick are centred on the rail.
const BAND_Y = 200;

// ═══════════════════════════════════════════════════════════════════
// Door artworks
// ═══════════════════════════════════════════════════════════════════

const DriversArt: FC<{ countsByForce: Record<ForceName, number> }> = ({ countsByForce }) => (
  <svg width="300" height="230" viewBox="0 0 300 230" fill="none" aria-hidden="true">
    {CLUSTER_ORDER.map((force, i) => {
      const dots = Math.max(3, Math.round((countsByForce[force] ?? 0) / 4));
      const spots = CLUSTER_SPOTS[i].slice(0, dots);
      const c = FORCE_COLORS[force];
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
      stroke={ink(0.12)} strokeWidth={1.25}
    />
    {/* the evidence flows in */}
    <path
      d="M112 192 C 130 208, 148 214, 162 216 M196 176 C 184 196, 172 208, 162 216 M152 184 C 154 196, 158 208, 162 216"
      stroke={ink(0.22)} strokeWidth={1.25} strokeDasharray="2 5" fill="none"
    />
    <circle cx={163} cy={217} r={10} fill={S.surface} stroke={ink(0.35)} strokeWidth={1.5} />
    <path
      d="M159 217 L167 217 M164 214 L167 217 L164 220"
      stroke={S.primary} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" fill="none"
    />
  </svg>
);

/** Static and abstract: the journey overlay is qualitative. */
const JourneyArt: FC = () => {
  const nodes: Array<[number, number]> = [[16, 120], [72, 92], [132, 106], [192, 146], [250, 130]];
  const bars: Array<{ h: number; up: boolean }> = [
    { h: 46, up: false }, { h: 33, up: false }, { h: 46, up: true }, { h: 55, up: false }, { h: 37, up: true },
  ];
  return (
    <svg width="300" height="230" viewBox="0 0 300 230" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="gate-jg" x1="0" y1="0" x2="300" y2="230" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={S.primary} />
          <stop offset="1" stopColor={JOURNEY_VIOLET} />
        </linearGradient>
      </defs>
      <g transform="translate(0,14)">
        {bars.map((b, i) => (
          <rect
            key={i} x={nodes[i][0] - 6} y={nodes[i][1] - 28 - b.h} width={12} height={b.h} rx={6}
            fill={b.up ? `rgba(${EXPANSION_RGB}, 0.38)` : `rgba(${CONTRACTION_RGB}, 0.42)`}
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
              key={i} cx={x} cy={y} r={7} fill={S.surface}
              stroke={i === 0 ? S.primary : i === 4 ? JOURNEY_VIOLET : ink(0.3)}
              strokeWidth={i === 0 || i === 4 ? 2.25 : 1.75}
            />
          ),
        )}
        <path d="M284 108 L 292 104 M284 108 L 288 116" stroke={JOURNEY_VIOLET} strokeWidth={2} strokeLinecap="round" opacity={0.7} />
      </g>
    </svg>
  );
};

/** The band's tint: the shift's hue, or the ink when the median is flat (as shiftColor has it). */
const bandTone = (band: { median: number } | null): string =>
  !band || Math.abs(band.median) < FLAT_EPS ? INK_RGB : band.median > 0 ? EXPANSION_RGB : CONTRACTION_RGB;

/** The categories' terminal-year medians and, below them, the portfolio band. */
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
      <rect x={BAND_X0} y={BAND_Y} width={BAND_W} height={5} rx={2.5} fill={ink(0.08)} />
      {bandGeom && (
        <>
          <rect
            x={bandGeom.x10} y={BAND_Y - 2} width={Math.max(bandGeom.x90 - bandGeom.x10, 6)} height={9} rx={4.5}
            fill={`rgba(${bandTone(band)}, 0.16)`}
          />
          <rect x={bandGeom.xMed - 1.25} y={BAND_Y - 7} width={2.5} height={19} rx={1.25} fill={S.onBg} />
        </>
      )}
    </svg>
  );
};

/** A static mekko in the Explorer page's chart grammar. */
const ExplorerArt: FC = () => {
  const bars = [
    { share: 0.29, gp1: 0.75, up: true,  category: 'LHC: FCA' },
    { share: 0.21, gp1: 0.60, up: false, category: 'LHC: LAD' },
    { share: 0.16, gp1: 0.85, up: true,  category: 'LHC: FCN' },
    { share: 0.13, gp1: 0.50, up: false, category: 'Hair: Care' },
    { share: 0.10, gp1: 0.375, up: false, category: 'Hair: Color' },
  ].map((b) => ({ ...b, color: CATEGORY_COLOR[b.category] }));
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
      <path d="M14 208 L 286 208" stroke={ink(0.18)} strokeWidth={1.5} />
      <path d="M14 208 L 14 44" stroke={ink(0.1)} strokeWidth={1.5} />
      {drawn.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={7} fill={b.color} fillOpacity={0.18} stroke={b.color} strokeWidth={1.5} opacity={0.9} />
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
               transition-[transform,box-shadow] duration-500 shadow-door
               hover:-translate-y-1.5 hover:scale-[1.012] hover:shadow-door-hover
               focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px]
               focus-visible:outline-theme-primary"
    style={{ background: wash.bg, border: `1px solid ${ink(0.06)}`, fontFamily: BODY_FONT }}
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

    {/* keyboard hint, shown on hover and keyboard focus */}
    <span
      aria-hidden="true"
      className="absolute right-[22px] top-6 flex h-[22px] w-[22px] items-center justify-center rounded-[7px]
                 border bg-theme-surface/85 text-[11px] opacity-0 transition-opacity duration-300
                 group-hover:opacity-90 group-focus-visible:opacity-90"
      style={{ ...FIGURES, color: S.onSurfaceVariant, borderColor: S.cardBorderStrong }}
    >
      {keyHint}
    </span>

    {/* the go arrow turns from → to ↗ on hover */}
    <span
      aria-hidden="true"
      className="absolute bottom-[22px] right-[22px] flex h-[38px] w-[38px] items-center justify-center
                 rounded-full border text-base opacity-75 backdrop-blur-[6px] transition-all duration-300
                 bg-theme-surface/85 text-theme-on-surface-variant border-theme-card-border
                 group-hover:-rotate-45 group-hover:opacity-100 group-hover:bg-theme-primary
                 group-hover:text-theme-on-primary group-hover:border-theme-primary
                 group-focus-visible:opacity-100 group-focus-visible:bg-theme-primary
                 group-focus-visible:text-theme-on-primary group-focus-visible:border-theme-primary"
    >
      →
    </span>
  </motion.button>
);

// ═══════════════════════════════════════════════════════════════════
// The gate
// ═══════════════════════════════════════════════════════════════════

const ROOM_KEYS: Record<string, GateRoom> = {
  '1': 'drivers',
  '2': 'consumer-journey',
  '3': 'shift-analysis',
  '4': 'profit-pool-explorer',
};

const HomeGate: FC<HomeGateProps> = ({ active, onNavigate }) => {
  const { drivers, simulation } = usePrism();
  const reduced = useReducedMotion() ?? false;

  // Drivers per force, and in all; the driver base until the drivers load.
  const countsByForce = useMemo<Record<ForceName, number>>(() => {
    if (!drivers.length) return BASE_FORCE_COUNTS;
    const counts = Object.fromEntries(CLUSTER_ORDER.map((f) => [f, 0])) as Record<ForceName, number>;
    for (const d of drivers) counts[d.force] += 1;
    return counts;
  }, [drivers]);
  const driverCount = drivers.length || Object.keys(DRIVER_CODE_MAP).length;

  const matrixCells = useMemo<Array<number | null>>(
    () => CATEGORIES.map((c) => getYearPercentiles(simulation?.shifts, c.name, HORIZON)?.median ?? null),
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

  const band = simulation?.totals.portfolio[String(HORIZON)] ?? null;

  // Keys 1–4 open a tab while the gate is the visible pane and no dialog
  // (the welcome dialog, Settings) covers it.
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || overlayOpen()) return;
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
          eyebrow="The input" title="Drivers" caption={`${driverCount} drivers: the evidence.`}
          keyHint="1" wash={WASH.drivers} delay={0.08} reduced={reduced}
          ariaLabel={`Drivers, the input. ${driverCount} drivers: the evidence. Shortcut key 1.`}
          onOpen={() => onNavigate('drivers')}
        >
          <DriversArt countsByForce={countsByForce} />
        </Door>

        <Door
          eyebrow="The context" title="Consumer Journey" caption="Consumer moments and the drivers behind them."
          keyHint="2" wash={WASH.journey} delay={0.16} reduced={reduced}
          ariaLabel="Consumer Journey, the context. Consumer moments and the drivers behind them. Shortcut key 2."
          onOpen={() => onNavigate('consumer-journey')}
        >
          <JourneyArt />
        </Door>

        <Door
          eyebrow="The output" title="Profit Pool Shift Analysis" caption={`Every category's shift to ${HORIZON}.`}
          keyHint="3" wash={WASH.shift} delay={0.24} reduced={reduced}
          ariaLabel={`Profit Pool Shift Analysis, the output. Every category's shift to ${HORIZON}. Shortcut key 3.`}
          onOpen={() => onNavigate('shift-analysis')}
        >
          <ShiftArt cells={matrixCells} highlightIdx={highlightIdx} band={band} />
        </Door>

        <Door
          eyebrow="The market" title="Profit Pool Explorer" caption="The pools, sized and sourced."
          beta keyHint="4" wash={WASH.explorer} delay={0.32} reduced={reduced}
          ariaLabel="Profit Pool Explorer (Beta), the market. The pools, sized and sourced. Shortcut key 4."
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
            style={{ color: ink(0.34), left: `calc((100% - 54px)*${f} + ${2 + i * 18}px)` }}
          >
            →
          </motion.span>
        ))}
      </section>
    </div>
  );
};

export default HomeGate;
