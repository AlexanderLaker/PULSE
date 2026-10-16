/**
 * The drill-down of one category, opened from a Shift Matrix row or a KPI
 * tile: its shift path with the P10 to P90 band, the force attribution and
 * the regional shifts in the year it is opened on (named in both section
 * titles), and the drivers behind its terminal-year shift, ranked by their
 * share of it. Its header offers the link to this view, the figures as CSV
 * and the panel as an image.
 *
 * The contributing drivers are attributed at the score means with
 * lib/driverAttribution.ts, the decomposition the PRISM Analysis on the
 * Drivers page is written on, so a driver's rank here and its reading agree.
 * Without the model configuration or the drivers there is no attribution,
 * and the panel says which is missing instead of ranking the drivers another
 * way.
 *
 * The panel shares the Shift Analysis surface (S tokens, Manrope headlines,
 * tabular Inter figures, white cards on the light page background), so the
 * drill-down reads as the same page rather than a pop-out.
 */
import React, { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { motion } from 'framer-motion';
import { X, Activity, Zap, Layers, LineChart, Globe, Link2, FileSpreadsheet, ImageDown } from 'lucide-react';
import {
  BASE_YEAR, FIRST_YEAR, FLAT_EPS, FORCES, HORIZON, NO_VALUE, YEARS, fmtShift, fmtPct, fmtDateTimeUtc,
  categoryDisplay, categoryOf, groupDisplay, heatText,
} from '@/lib/format';
import { S, SHADOW, HEADLINE_FONT, BODY_FONT, FIGURES } from '@/lib/theme';
import { cellWeightsBasis, rowShares } from '@/lib/cellWeights';
import type { RunAttribution } from '@/lib/driverAttribution';
import { csvText, downloadText, safeFilename, tablesToCsv } from '@/lib/exportCsv';
import { downloadNodeAsPng } from '@/lib/exportImage';
import useOverlay from '@/hooks/useOverlay';
import useViewUrl from '@/hooks/useViewUrl';
import type { Driver, SimulationResult } from '@/types';
import {
  ForceDecomposition, MiniPathChart, RegionalDecomposition,
  type RegionalRow, Section,
} from './detailCharts';
import { type Contributor, ContributorList, driverCode, rankContributors } from './contributors';
import { ESTIMATE_EXPORT_NOTE, bandCoverageSentence } from './matrixModel';

interface CategoryDetailPanelProps {
  /** The category's API key, e.g. "LHC: FCN". */
  category: string;
  /** The year the force and regional sections show: the matrix's year on an
   *  attribution lens, the horizon on the Time path. */
  year: number;
  simulation: SimulationResult;
  drivers: Driver[];
  /** The drivers' parts of the shift at the score means, or the input they lack. */
  attribution: RunAttribution;
  onClose: () => void;
  /** Opens the Drivers page searched for a driver's name; makes every driver card a link. */
  onOpenDriver?: (name: string) => void;
}

/** A difference of two shifts in percentage points, signed like fmtShift: 0.0012 -> "+0.1 pt". */
const pt = (v: number): string => `${v >= FLAT_EPS ? '+' : ''}${(Math.abs(v) < FLAT_EPS ? 0 : v * 100).toFixed(1)} pt`;

// ─── Has the keyboard been used? ─────────────────────────────────────────
// "Esc to close" is shown once a key has been pressed anywhere in this
// session, so a touch or mouse user is not told about a key they do not use.

let keyboardSeen = false;
const keyboardListeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', () => {
    keyboardSeen = true;
    keyboardListeners.forEach((listener) => listener());
  }, { once: true, capture: true });
}
const subscribeKeyboard = (listener: () => void) => {
  keyboardListeners.add(listener);
  return () => { keyboardListeners.delete(listener); };
};
const useKeyboardSeen = () => useSyncExternalStore(subscribeKeyboard, () => keyboardSeen, () => false);

// ─── The drill-down as CSV ───────────────────────────────────────────────

export interface DrillDownCsvInput {
  category: string;
  year: number;
  simulation: SimulationResult;
  /** The category's median in `year` split by force. */
  forceDecomposition: Record<string, number>;
  contributors: Contributor[];
}

/** The figures of the panel as the panel shows them: the shift path per year
 *  with its band, the force attribution of the year, then the contributing
 *  drivers in rank order. */
export function drillDownCsv({ category, year, simulation, forceDecomposition, contributors }: DrillDownCsvInput): string {
  const meta = simulation.run_meta;
  const onEstimate = cellWeightsBasis(simulation.cell_weights_source) === 'estimate';
  const path = simulation.shifts[category];
  const preamble: string[][] = [
    ['PRISM Shift Analysis drill-down'],
    ['Category', categoryDisplay(category), groupDisplay(categoryOf(category).group)],
    ['Year', String(year)],
    ['Run', `#${meta.run_id}`, fmtDateTimeUtc(meta.run_date)],
    ['Values', `signed % vs ${BASE_YEAR}, one decimal; the shift path gives the median with its P10 and P90`],
    ['Bands', bandCoverageSentence(onEstimate)],
    ...(onEstimate ? [['Weights', ESTIMATE_EXPORT_NOTE]] : []),
  ];
  const forces = [...FORCES].sort((a, b) => Math.abs(forceDecomposition[b] ?? 0) - Math.abs(forceDecomposition[a] ?? 0));
  return tablesToCsv(preamble, [
    {
      header: ['Year', 'Median', 'P10', 'P90'],
      rows: YEARS.map((y) => {
        const d = path[String(y)];
        return [String(y), fmtShift(d.median, 1), fmtShift(d.p10, 1), fmtShift(d.p90, 1)];
      }),
    },
    {
      header: ['Force', `Attribution ${year}`],
      rows: forces.map((f) => [f, fmtShift(forceDecomposition[f] ?? 0, 1)]),
    },
    {
      header: ['Rank', 'Driver', 'Code', 'Force', 'Exposure', 'Share of movement', `Contribution ${HORIZON}`],
      rows: contributors.map((c, i) => [
        String(i + 1), csvText(c.driver.name), driverCode(c.driver) ?? '', c.driver.force, `${c.exposure}/5`,
        c.share > 0 ? fmtPct(c.share, c.share >= 0.1 ? 0 : 1) : NO_VALUE,
        c.contribution !== 0 ? fmtShift(c.contribution, 1) : NO_VALUE,
      ]),
    },
  ]);
}

// ─── The panel ───────────────────────────────────────────────────────────

const KPI_LABEL: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  fontWeight: 700,
  color: S.onSurfaceVariant,
  fontFamily: HEADLINE_FONT,
};

const KPI_TILE: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: 12,
  backgroundColor: S.surfaceLow,
  border: `1px solid ${S.cardBorder}`,
  minWidth: 0,
};

/** A small action button of the header: an icon and a word. */
const HeaderAction: React.FC<{
  icon: React.ElementType;
  label: string;
  /** The accessible name where the visible word is short: it contains the word. */
  ariaLabel?: string;
  onClick: () => void;
  /** Busy: the button ignores clicks but keeps the keyboard focus it holds
   *  (a disabled button would drop it, and the export gives it back after). */
  disabled?: boolean;
}> = ({ icon: Icon, label, ariaLabel, onClick, disabled }) => (
  <button
    type="button"
    onClick={disabled ? undefined : onClick}
    aria-disabled={disabled || undefined}
    aria-label={ariaLabel}
    data-print-hide
    className="inline-flex items-center gap-1.5 rounded-lg transition-colors hover:bg-theme-surface-low"
    style={{
      height: 30,
      padding: '0 10px',
      border: `1px solid ${S.cardBorder}`,
      backgroundColor: S.surface,
      color: S.onSurfaceVariant,
      fontFamily: BODY_FONT,
      fontSize: 12,
      fontWeight: 600,
      cursor: disabled ? 'progress' : 'pointer',
      opacity: disabled ? 0.6 : 1,
      whiteSpace: 'nowrap',
    }}
  >
    <Icon size={13} strokeWidth={2.3} aria-hidden />
    {label}
  </button>
);

const CategoryDetailPanel: React.FC<CategoryDetailPanelProps> = ({
  category, year, simulation, drivers, attribution, onClose, onOpenDriver,
}) => {
  const group = categoryOf(category).group;
  const path = simulation.shifts[category];
  // A run weighted with the estimated cell weights says so under its figures.
  const onEstimate = cellWeightsBasis(simulation.cell_weights_source) === 'estimate';
  const keyboardUsed = useKeyboardSeen();
  const { href } = useViewUrl();

  // Anchor of the momentum explainer (the tile's bottom centre); it is
  // fixed-positioned like the matrix cell tooltip.
  const [pathHover, setPathHover] = useState<{ x: number; y: number } | null>(null);
  const momentumHelpId = useId();

  // Escape closes, focus stays inside, the page behind does not scroll, and
  // focus returns to the row or tile that opened the panel.
  const panelRef = useRef<HTMLElement | null>(null);
  useOverlay(true, onClose, panelRef);

  // The left column sticks under the header on large screens, so the chart
  // stays in view while the driver list scrolls: only where it fits under
  // the header, else its own bottom would be out of reach.
  const headerRef = useRef<HTMLElement | null>(null);
  const leftRef = useRef<HTMLDivElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [leftFits, setLeftFits] = useState(false);
  useEffect(() => {
    const aside = panelRef.current;
    const header = headerRef.current;
    const left = leftRef.current;
    if (!aside || !header || !left || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      const h = header.offsetHeight;
      setHeaderHeight(h);
      setLeftFits(left.offsetHeight + h + 40 <= aside.clientHeight);
    });
    observer.observe(aside);
    observer.observe(header);
    observer.observe(left);
    return () => observer.disconnect();
  }, []);

  const forceDecomposition = simulation.decompositions.force[String(year)][category];

  const regionalShift = useMemo<RegionalRow[]>(() => {
    const shares = rowShares(simulation.cell_weights_used, category);
    return Object.entries(simulation.regional_shift_matrix[category])
      .map(([region, cell]) => ({ region, median: cell.path[String(year)].median, share: shares?.[region] }))
      .sort((a, b) => Math.abs(b.median) - Math.abs(a.median));
  }, [simulation, category, year]);

  const terminal = path[String(HORIZON)];
  const shiftEnd = terminal.median;
  const shiftStart = path[String(FIRST_YEAR)].median;
  // How the median path moves across the horizon: a difference of two
  // medians, which the Momentum tile names as such. The run's velocity, the
  // per-iteration year-on-year change, is lastYearChange.
  const movement = shiftEnd - shiftStart;
  // The change in the final year, per iteration (the run's velocity band).
  const lastYearChange = simulation.velocity[category]?.[String(HORIZON)];

  const contributors = useMemo(
    () => (attribution.result ? rankContributors(category, drivers, attribution.result, shiftEnd) : []),
    [category, drivers, attribution, shiftEnd],
  );
  const exposedDrivers = useMemo(
    () => drivers.filter((d) => d.category_exposure[category] > 0).length,
    [category, drivers],
  );
  // Drivers edited, added or removed since the run: the ranking uses the
  // drivers as they are now, the run's figures the drivers as they were.
  const since = simulation.inputs_since_run;
  const changedSinceRun = since.changed.length + since.added.length + since.removed.length;

  // Share of the category's movement carried by its five largest drivers.
  const topShare = useMemo(() => {
    const total = contributors.reduce((acc, c) => acc + Math.abs(c.contribution), 0);
    if (total <= 1e-9) return 0;
    const top = contributors.slice(0, 5).reduce((acc, c) => acc + Math.abs(c.contribution), 0);
    return top / total;
  }, [contributors]);

  // Momentum is said in words, because "+1.2 pt" in green under a red
  // headline reads as good news when it means "still shrinking, more
  // slowly". The colour follows the message: deepening in contraction ink,
  // easing in calm navy, accelerating in expansion ink, slowing in amber. The
  // value is in percentage points: a difference of two percentages.
  const momentum = useMemo(() => {
    const pts = pt(movement);
    if (shiftEnd < -FLAT_EPS && movement > FLAT_EPS)
      return { msg: 'Contraction easing', pts, color: S.onSurface };
    if (shiftEnd < -FLAT_EPS && movement < -FLAT_EPS)
      return { msg: 'Contraction deepening', pts, color: S.contractionInk };
    if (shiftEnd > FLAT_EPS && movement > FLAT_EPS)
      return { msg: 'Expansion accelerating', pts, color: S.expansionInk };
    if (shiftEnd > FLAT_EPS && movement < -FLAT_EPS)
      return { msg: 'Expansion slowing', pts, color: S.amber };
    return { msg: 'Broadly flat', pts, color: S.onSurface };
  }, [shiftEnd, movement]);

  const showMomentumHelp = (e: React.SyntheticEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPathHover({ x: r.left + r.width / 2, y: r.bottom });
  };

  // ─── Copy link, CSV, PNG ───
  const [status, setStatus] = useState<string | null>(null);
  const [linkFallback, setLinkFallback] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const exportTitle = `PRISM-${categoryDisplay(category)}-drill-down-${year}`;

  const copyLink = async () => {
    const address = href() || (typeof window !== 'undefined' ? window.location.href : '');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('no clipboard');
      await navigator.clipboard.writeText(address);
      setLinkFallback(null);
      setStatus('Link copied');
    } catch {
      setLinkFallback(address);
      setStatus('The clipboard is not available here; copy the address from the field');
    }
  };

  const exportCsv = () => {
    const csv = drillDownCsv({ category, year, simulation, forceDecomposition, contributors });
    const ok = downloadText(safeFilename(exportTitle, 'csv'), csv);
    setStatus(ok ? 'CSV downloaded' : 'This browser cannot save the CSV');
  };

  const exportPng = async () => {
    const node = panelRef.current;
    if (!node) return;
    setExporting(true);
    setStatus('Preparing the image…');
    try {
      await downloadNodeAsPng(node, safeFilename(exportTitle, 'png'), {
        backgroundColor: S.bg, expandScroll: true,
      });
      setStatus('PNG downloaded');
    } catch (err) {
      const reason = err instanceof Error && err.message ? err.message : 'the renderer failed';
      setStatus(`The image could not be made: ${reason}`);
    } finally {
      setExporting(false);
    }
  };

  const footerDetails = `The force attribution splits the row’s median in ${year} by the size of each force’s `
    + 'drivers, not their direction, so a force whose drivers push both ways still shows a share in the '
    + 'median’s direction; the contributing drivers carry their signs.'
    + (contributors.length > 0
      ? ' Contributing drivers: the same decomposition as the PRISM Analysis on the Drivers page (expected effect × force weight × attenuation × overlap correction × expected materialisation × category and regional exposure, rolled up with the run’s cell weights), scaled here so they add up to the row’s terminal-year median (where that would reverse them, halve them or more than double them, they stay at the means); the ranking agrees with the readings. A bar is the driver’s part of the row’s gross movement, headwinds and tailwinds counted by size, and the bars add up to 100%; the readings quote shares of the net shift, which are larger where tailwinds offset headwinds.'
      : '');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        // top = 64px keeps the sticky top navigation (h-16) visible and
        // usable while the drill-down is open.
        position: 'fixed',
        top: 64,
        right: 0,
        bottom: 0,
        left: 0,
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'center',
        padding: 16,
        backgroundColor: S.scrim,
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        zIndex: 40,
        fontFamily: BODY_FONT,
      }}
    >
      {/* A full-page destination below the navigation, not a side drawer. */}
      <motion.section
        ref={panelRef}
        initial={{ opacity: 0, scale: 0.985, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.985, y: 8 }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${categoryDisplay(category)} drill-down`}
        tabIndex={-1}
        style={{
          // The aside is the scroll container; the sticky header stays
          // pinned while the body scrolls.
          position: 'relative',
          width: '100%',
          height: '100%',
          backgroundColor: S.bg,
          border: `1px solid ${S.cardBorder}`,
          borderRadius: 20,
          boxShadow: SHADOW.dialog,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          zIndex: 45,
        }}
      >
        <header
          ref={headerRef}
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 2,
            padding: '20px 20px 16px',
            backgroundColor: S.surface,
            borderBottom: `1px solid ${S.cardBorder}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: S.onSurfaceVariant,
                  fontFamily: HEADLINE_FONT,
                }}
              >
                {groupDisplay(group)} · Drill-down
              </div>
              <h2
                style={{
                  marginTop: 4,
                  fontSize: 26,
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: S.onBg,
                  fontFamily: HEADLINE_FONT,
                  lineHeight: 1.15,
                }}
              >
                {categoryDisplay(category)}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              data-print-hide
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                backgroundColor: S.surfaceLow,
                color: S.onSurfaceVariant,
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.15s ease, color 0.15s ease',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = S.primaryContainer;
                e.currentTarget.style.color = S.onPrimaryContainer;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = S.surfaceLow;
                e.currentTarget.style.color = S.onSurfaceVariant;
              }}
            >
              <X size={16} strokeWidth={2.4} />
            </button>
          </div>

          {/* The link, the figures and the image of this panel; the status
              of the last action beside them. Control, so the row leaves an
              image or a print whole. */}
          <div
            className="flex flex-wrap items-center gap-2"
            style={{ marginTop: 12 }}
            data-print-hide
          >
            <HeaderAction icon={Link2} label="Copy link" ariaLabel="Copy link to this drill-down" onClick={() => { void copyLink(); }} />
            <HeaderAction icon={FileSpreadsheet} label="CSV" ariaLabel="Download this drill-down as CSV" onClick={exportCsv} />
            <HeaderAction icon={ImageDown} label="PNG" ariaLabel="Download this drill-down as PNG"
              onClick={() => { void exportPng(); }} disabled={exporting} />
            {/* The visible status; the announcement is the live region under
                the row, which the capture does not hide. */}
            {status && (
              <span aria-hidden style={{ fontSize: 11.5, fontWeight: 600, color: S.onSurfaceVariant, fontFamily: BODY_FONT }}>
                {status}
              </span>
            )}
            {keyboardUsed && (
              <span
                aria-hidden
                data-print-hide
                style={{
                  marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: S.mutedText,
                  fontFamily: BODY_FONT, whiteSpace: 'nowrap',
                }}
              >
                Esc to close
              </span>
            )}
          </div>
          {status && <span role="status" className="sr-only">{status}</span>}
          {linkFallback && (
            <input
              type="text"
              readOnly
              value={linkFallback}
              aria-label="Link to this drill-down"
              onFocus={(e) => e.currentTarget.select()}
              data-print-hide
              style={{
                marginTop: 8, width: '100%', padding: '6px 10px', borderRadius: 8,
                border: `1px solid ${S.cardBorder}`, backgroundColor: S.surfaceLow,
                color: S.onSurface, ...FIGURES, fontSize: 11.5,
              }}
            />
          )}

          {/* KPI strip */}
          <div
            style={{
              marginTop: 16,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 10,
            }}
          >
            <div style={KPI_TILE}>
              <div style={KPI_LABEL}>{HORIZON} Shift</div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 19,
                  fontWeight: 800,
                  ...FIGURES,
                  color: heatText(shiftEnd),
                  lineHeight: 1,
                }}
              >
                {fmtShift(shiftEnd, 1)}
              </div>
              <div
                style={{
                  marginTop: 5, fontSize: 11.5, fontWeight: 600, color: S.onSurfaceVariant,
                  ...FIGURES, fontVariantNumeric: 'tabular-nums', lineHeight: 1.25,
                }}
              >
                P10 {fmtShift(terminal.p10, 1)} to P90 {fmtShift(terminal.p90, 1)}
              </div>
            </div>

            {/* Momentum: the explainer opens on hover, keyboard focus and tap. */}
            <button
              type="button"
              onMouseEnter={showMomentumHelp}
              onMouseLeave={() => setPathHover(null)}
              onFocus={showMomentumHelp}
              onBlur={() => setPathHover(null)}
              onClick={(e) => {
                if (pathHover) { setPathHover(null); return; }
                showMomentumHelp(e);
              }}
              aria-expanded={!!pathHover}
              aria-controls={pathHover ? momentumHelpId : undefined}
              aria-label={`Momentum: ${momentum.msg}, ${momentum.pts} between ${FIRST_YEAR} and ${HORIZON}. Explains the figure`}
              style={{
                ...KPI_TILE,
                position: 'relative',
                cursor: 'help',
                textAlign: 'left',
                font: 'inherit',
                display: 'block',
                width: '100%',
              }}
            >
              <div style={KPI_LABEL}>Momentum</div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 19,
                  fontWeight: 800,
                  ...FIGURES,
                  color: momentum.color,
                  lineHeight: 1,
                }}
              >
                {momentum.pts}
              </div>
              <div style={{ marginTop: 3, fontSize: 11, fontWeight: 600, color: momentum.color, fontFamily: BODY_FONT, lineHeight: 1.25 }}>
                {momentum.msg}{' '}
                <span style={{ color: S.mutedText, fontWeight: 400 }}>· {FIRST_YEAR} → {HORIZON}</span>
              </div>
            </button>

            <div style={KPI_TILE}>
              <div style={KPI_LABEL}>Drivers</div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 19,
                  fontWeight: 800,
                  color: S.onBg,
                  fontFamily: HEADLINE_FONT,
                  lineHeight: 1,
                }}
              >
                {exposedDrivers}
              </div>
            </div>
          </div>
        </header>

        {/* Two columns on large screens: what the simulation says on the
            left, the ranked drivers behind it on the right; one column below lg. */}
        <div
          className="grid gap-4 items-start lg:grid-cols-2"
          style={{
            padding: '20px 20px 28px',
            backgroundColor: S.bg,
          }}
        >
          <div
            ref={leftRef}
            className={leftFits ? 'lg:sticky' : undefined}
            style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0, top: headerHeight + 16 }}
          >
            <Section
              title={`Shift Path · ${FIRST_YEAR}–${HORIZON}`}
              icon={LineChart}
              trailing={
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 10px',
                    borderRadius: 999,
                    backgroundColor: S.primaryContainer,
                    color: S.onPrimaryContainer,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'none',
                    fontFamily: BODY_FONT,
                  }}
                >
                  P10 to P90
                </span>
              }
            >
              <MiniPathChart path={path} />
            </Section>

            <Section title={`Force attribution · ${year}`} icon={Zap}>
              <ForceDecomposition decomposition={forceDecomposition} />
            </Section>

            <Section title={`Regional shift · ${year}`} icon={Globe}>
              <RegionalDecomposition rows={regionalShift} onEstimate={onEstimate} />
            </Section>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            {attribution.missing && (
              <Section title="Contributing Drivers" icon={Layers}>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: S.onSurfaceVariant, fontFamily: BODY_FONT }}>
                  The drivers behind this row are attributed with {attribution.missing}, which did not
                  load. Reload the page to try again.
                </p>
              </Section>
            )}
            {contributors.length > 0 && (
              <Section
                title="Contributing Drivers"
                icon={Layers}
                trailing={
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: S.onSurfaceVariant,
                      letterSpacing: '0.06em',
                      fontFamily: HEADLINE_FONT,
                    }}
                  >
                    {contributors.length} TOTAL
                    {topShare > 0 ? ' · TOP-5 ' + fmtPct(topShare, 0) : ''}
                  </span>
                }
              >
                {changedSinceRun > 0 && (
                  <p
                    role="note"
                    style={{
                      margin: '0 0 12px', padding: '8px 12px', borderRadius: 10, fontSize: 12, lineHeight: 1.5,
                      backgroundColor: S.amberContainer, color: S.onAmberContainer, fontFamily: BODY_FONT,
                    }}
                  >
                    {changedSinceRun === 1 ? 'One driver has' : `${changedSinceRun} drivers have`} changed since
                    this run. The parts below use the drivers as they are now, scaled to this run&rsquo;s median;
                    the run&rsquo;s own figures show the drivers as they were until the next production run.
                  </p>
                )}
                {/* Concentration: the share of movement the top five carry */}
                {topShare > 0 && (
                  <div
                    style={{
                      marginBottom: 12,
                      padding: '10px 12px',
                      borderRadius: 10,
                      backgroundColor: S.surfaceLow,
                      border: `1px solid ${S.cardBorder}`,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        marginBottom: 6,
                        fontSize: 11,
                        color: S.onSurfaceVariant,
                        fontFamily: BODY_FONT,
                        letterSpacing: '0.02em',
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>Top 5 drivers</span>
                      <span style={{ ...FIGURES, fontWeight: 700, color: S.onBg }}>
                        {fmtPct(topShare, 0)} of movement
                      </span>
                    </div>
                    <div
                      style={{
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: S.surface,
                        overflow: 'hidden',
                        border: `1px solid ${S.cardBorder}`,
                      }}
                    >
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, topShare * 100)}%` }}
                        transition={{ delay: 0.1, duration: 0.6, ease: 'easeOut' }}
                        style={{
                          height: '100%',
                          backgroundColor: S.primary,
                          opacity: 0.82,
                        }}
                      />
                    </div>
                  </div>
                )}
                <ContributorList contributors={contributors} onOpenDriver={onOpenDriver} />
              </Section>
            )}
          </div>

          <footer
            className="lg:col-span-2"
            style={{
              marginTop: 4,
              padding: '0 4px',
              fontSize: 11,
              color: S.mutedText,
              lineHeight: 1.55,
              fontFamily: BODY_FONT,
            }}
          >
            <p style={{ margin: 0 }}>
              <Activity
                size={10}
                aria-hidden
                style={{ display: 'inline', verticalAlign: -1, marginRight: 4 }}
              />
              Shifts are cumulative against {BASE_YEAR}, from the Monte Carlo engine.
            </p>
            {/* What the bands cover and, on an estimate run, how the figures are
                weighted: the page says both above the matrix, which this
                dialog covers, and an image export or a print of the panel
                carries them. */}
            <p data-testid="drill-down-notes" style={{ margin: '4px 0 0' }}>
              {bandCoverageSentence(onEstimate)}
              {onEstimate ? ` ${ESTIMATE_EXPORT_NOTE}` : ''}
            </p>
            <details style={{ marginTop: 4 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, color: S.onSurfaceVariant }}>
                How these figures are computed
              </summary>
              <p style={{ margin: '4px 0 0' }}>{footerDetails}</p>
            </details>
          </footer>
        </div>
      </motion.section>

      {/* The momentum explainer, in the matrix cell tooltip's style: fixed
          position, light card, uppercase eyebrow, pointer arrow. */}
      {pathHover && (
        <div
          id={momentumHelpId}
          data-print-hide
          className="fixed z-50 pointer-events-none rounded-xl"
          style={{
            left: pathHover.x,
            top: pathHover.y + 10,
            transform: 'translate(-50%, 0)',
            backgroundColor: S.surface,
            color: S.onSurface,
            border: `1px solid ${S.cardBorderStrong}`,
            padding: '10px 14px',
            fontFamily: BODY_FONT,
            fontSize: 12,
            maxWidth: 'min(280px, calc(100vw - 32px))',
            boxShadow: SHADOW.popover,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              opacity: 0.75,
              marginBottom: 6,
              fontFamily: HEADLINE_FONT,
            }}
          >
            Momentum · What this means
          </div>
          <div style={{ lineHeight: 1.5, opacity: 0.92 }}>
            How the median shift moves across the horizon: the {HORIZON} median minus the{' '}
            {FIRST_YEAR} median, in percentage points. It is a difference of two medians, not a
            change any iteration makes.
          </div>
          {lastYearChange && (
            <div style={{ marginTop: 6, lineHeight: 1.5, opacity: 0.92 }}>
              Change in {HORIZON} alone: median {pt(lastYearChange.median)}, 80% of simulated outcomes between{' '}
              {pt(lastYearChange.p10)} and {pt(lastYearChange.p90)}.
            </div>
          )}
          <div style={{ marginTop: 6, opacity: 0.65, fontSize: 11 }}>
            Contraction easing / deepening · Expansion accelerating / slowing: the label names the direction of travel
          </div>
          {/* Points up, because the card sits below the tile. */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: -6,
              width: 10,
              height: 10,
              backgroundColor: S.surface,
              borderTop: `1px solid ${S.cardBorderStrong}`,
              borderLeft: `1px solid ${S.cardBorderStrong}`,
              transform: 'translateX(-50%) rotate(45deg)',
            }}
          />
        </div>
      )}
    </motion.div>
  );
};

export default CategoryDetailPanel;
