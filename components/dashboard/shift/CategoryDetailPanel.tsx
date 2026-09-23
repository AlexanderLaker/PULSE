/**
 * The drill-down of one category, opened from a Shift Matrix row or a KPI
 * tile: its shift path with the P10–P90 band, the force attribution and the
 * regional shifts at the selected year, and the drivers behind its
 * terminal-year shift, ranked by their share of it.
 *
 * The contributing drivers are attributed at the score means with
 * lib/driverAttribution.ts, the decomposition the PRISM Analysis on the
 * Drivers page is written on, so a driver's rank here and its reading agree.
 * Without the model configuration there is no attribution, and the panel
 * says so instead of ranking the drivers another way.
 *
 * The panel shares the Shift Analysis surface (S tokens, Manrope headlines,
 * JetBrains Mono figures, white cards on the light page background), so the
 * drill-down reads as the same page rather than a pop-out.
 */
import React, { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Activity, Zap, Layers, LineChart, Globe } from 'lucide-react';
import {
  CATEGORIES, FIRST_YEAR, FLAT_EPS, HORIZON, fmtShift, fmtPct, categoryDisplay, groupDisplay,
} from '@/lib/format';
import { S, SHADOW, HEADLINE_FONT, BODY_FONT, MONO_FONT } from '@/lib/theme';
import { rowShares } from '@/lib/cellWeights';
import type { AttributionResult } from '@/lib/driverAttribution';
import useOverlay from '@/hooks/useOverlay';
import type { Driver, SimulationResult } from '@/types';
import {
  ForceDecomposition, MiniPathChart, RegionalDecomposition,
  type RegionalRow, Section,
} from './detailCharts';
import { DriverCard, rankContributors } from './contributors';

interface CategoryDetailPanelProps {
  /** The category's API key, e.g. "LHC: FCN". */
  category: string;
  /** The year the force and regional sections show. */
  year: number;
  simulation: SimulationResult;
  drivers: Driver[];
  /** The drivers' parts of the shift at the score means; null without the model configuration. */
  attribution: AttributionResult | null;
  onClose: () => void;
  /** Opens the Drivers page searched for a driver's name; makes every driver card a link. */
  onOpenDriver?: (name: string) => void;
}

/** A difference of two shifts in percentage points, signed like fmtShift: 0.0012 -> "+0.1 pt". */
const pt = (v: number): string => `${v >= FLAT_EPS ? '+' : ''}${(Math.abs(v) < FLAT_EPS ? 0 : v * 100).toFixed(1)} pt`;

const CategoryDetailPanel: React.FC<CategoryDetailPanelProps> = ({
  category, year, simulation, drivers, attribution, onClose, onOpenDriver,
}) => {
  const group = CATEGORIES.find((c) => c.name === category)?.group;
  const path = simulation.shifts[category];

  // Anchor of the momentum explainer (the tile's bottom centre); it is
  // fixed-positioned like the matrix cell tooltip.
  const [pathHover, setPathHover] = useState<{ x: number; y: number } | null>(null);

  // Escape closes, focus stays inside, the page behind does not scroll, and
  // focus returns to the row or tile that opened the panel.
  const panelRef = useRef<HTMLElement | null>(null);
  useOverlay(true, onClose, panelRef);

  const forceDecomposition = simulation.decompositions.force[String(year)][category];

  const regionalShift = useMemo<RegionalRow[]>(() => {
    const shares = rowShares(simulation.cell_weights_used, category);
    return Object.entries(simulation.regional_shift_matrix[category])
      .map(([region, cell]) => ({ region, median: cell.path[String(year)].median, share: shares?.[region] }))
      .sort((a, b) => Math.abs(b.median) - Math.abs(a.median));
  }, [simulation, category, year]);

  const shiftEnd = path[String(HORIZON)].median;
  const shiftStart = path[String(FIRST_YEAR)].median;
  const velocity = shiftEnd - shiftStart;
  // The change in the final year, per iteration (the run's velocity band).
  const lastYearChange = simulation.velocity[category]?.[String(HORIZON)];

  const contributors = useMemo(
    () => (attribution ? rankContributors(category, drivers, attribution, shiftEnd) : []),
    [category, drivers, attribution, shiftEnd],
  );
  const exposedDrivers = useMemo(
    () => drivers.filter((d) => d.category_exposure[category] > 0).length,
    [category, drivers],
  );

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
    const pts = `${velocity >= FLAT_EPS ? '+' : ''}${(velocity * 100).toFixed(1)} pt`;
    if (shiftEnd < -FLAT_EPS && velocity > FLAT_EPS)
      return { msg: 'Contraction easing', pts, color: S.onSurface };
    if (shiftEnd < -FLAT_EPS && velocity < -FLAT_EPS)
      return { msg: 'Contraction deepening', pts, color: S.contractionInk };
    if (shiftEnd > FLAT_EPS && velocity > FLAT_EPS)
      return { msg: 'Expansion accelerating', pts, color: S.expansionInk };
    if (shiftEnd > FLAT_EPS && velocity < -FLAT_EPS)
      return { msg: 'Expansion slowing', pts, color: S.amber };
    return { msg: 'Broadly flat', pts, color: S.onSurface };
  }, [shiftEnd, velocity]);

  const showMomentumHelp = (e: React.SyntheticEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPathHover({ x: r.left + r.width / 2, y: r.bottom });
  };

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
      <motion.aside
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
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 2,
            padding: '22px 24px 18px',
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
            <span
              aria-hidden
              style={{
                fontSize: 11, fontWeight: 600, color: S.mutedText,
                fontFamily: BODY_FONT, alignSelf: 'center', marginRight: 8,
                whiteSpace: 'nowrap',
              }}
            >
              Esc to close
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
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

          {/* KPI strip */}
          <div
            style={{
              marginTop: 18,
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 10,
            }}
          >
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 12,
                backgroundColor: S.surfaceLow,
                border: `1px solid ${S.cardBorder}`,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  color: S.onSurfaceVariant,
                  fontFamily: HEADLINE_FONT,
                }}
              >
                {HORIZON} Shift
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 19,
                  fontWeight: 800,
                  fontFamily: MONO_FONT,
                  color: shiftEnd > 0 ? S.expansionInk : shiftEnd < 0 ? S.contractionInk : S.onSurface,
                  lineHeight: 1,
                }}
              >
                {fmtShift(shiftEnd, 1)}
              </div>
            </div>

            {/* Momentum: the explainer opens on hover, keyboard focus and tap. */}
            <div
              onMouseEnter={showMomentumHelp}
              onMouseLeave={() => setPathHover(null)}
              onFocus={showMomentumHelp}
              onBlur={() => setPathHover(null)}
              onClick={(e) => {
                if (pathHover) { setPathHover(null); return; }
                showMomentumHelp(e);
              }}
              tabIndex={0}
              aria-label={`Momentum: ${momentum.msg}, ${momentum.pts} between ${FIRST_YEAR} and ${HORIZON}`}
              style={{
                position: 'relative',
                padding: '12px 14px',
                borderRadius: 12,
                backgroundColor: S.surfaceLow,
                border: `1px solid ${S.cardBorder}`,
                cursor: 'help',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  color: S.onSurfaceVariant,
                  fontFamily: HEADLINE_FONT,
                }}
              >
                Momentum
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 19,
                  fontWeight: 800,
                  fontFamily: MONO_FONT,
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
            </div>

            <div
              style={{
                padding: '12px 14px',
                borderRadius: 12,
                backgroundColor: S.surfaceLow,
                border: `1px solid ${S.cardBorder}`,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  color: S.onSurfaceVariant,
                  fontFamily: HEADLINE_FONT,
                }}
              >
                Drivers
              </div>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
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

            <Section title="Force Decomposition" icon={Zap}>
              <ForceDecomposition decomposition={forceDecomposition} />
            </Section>

            <Section title="Regional Shift" icon={Globe}>
              <RegionalDecomposition rows={regionalShift} />
            </Section>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            {!attribution && exposedDrivers > 0 && (
              <Section title="Contributing Drivers" icon={Layers}>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: S.onSurfaceVariant, fontFamily: BODY_FONT }}>
                  The drivers behind this row are attributed with the model configuration, which did not
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
                      <span style={{ fontFamily: MONO_FONT, fontWeight: 700, color: S.onBg }}>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {contributors.map((contributor, idx) => (
                    <DriverCard
                      key={contributor.driver.id}
                      contributor={contributor}
                      index={idx}
                      onOpen={onOpenDriver ? () => onOpenDriver(contributor.driver.name) : undefined}
                    />
                  ))}
                </div>
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
            <Activity
              size={10}
              style={{ display: 'inline', verticalAlign: -1, marginRight: 4 }}
            />
            Shifts are cumulative vs 2025 from the Monte Carlo engine. Force shares sum to
            the row&rsquo;s MC median at the selected year.
            {contributors.length > 0
              && ' Contributing drivers: the same decomposition as the PRISM Analysis on the Drivers page (force weight × attenuation × overlap correction × expected materialisation × category and regional exposure, rolled up with the run’s cell weights), rescaled here to the row’s terminal-year median, so the ranking agrees with the readings. A bar is the driver’s part of the row’s gross movement, headwinds and tailwinds counted by size, and the bars add up to 100%; the readings quote shares of the net shift, which are larger where tailwinds offset headwinds.'}
          </footer>
        </div>
      </motion.aside>

      {/* The momentum explainer, in the matrix cell tooltip's style: fixed
          position, light card, uppercase eyebrow, pointer arrow. */}
      {pathHover && (
        <div
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
            maxWidth: 280,
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
            Velocity of the profit-pool shift across the horizon:
            <span style={{ fontFamily: MONO_FONT, fontWeight: 600, opacity: 0.95 }}>
              {' '}horizon-end − horizon-start{' '}
            </span>
            of the MC median path.
          </div>
          {lastYearChange && (
            <div style={{ marginTop: 6, lineHeight: 1.5, opacity: 0.92 }}>
              Change in {HORIZON} alone: median {pt(lastYearChange.median)}, 80% of iterations between{' '}
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
