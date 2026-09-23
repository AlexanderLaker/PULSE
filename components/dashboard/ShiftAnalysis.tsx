/**
 * Shift Analysis: the Shift Matrix of the served run, read through four
 * lenses.
 *
 *   Time Path     category x year: the Monte Carlo median shift
 *   Force         category x the six forces, at a selected year
 *   Value chain   category x the eight value-chain stages, at a selected year
 *   Region        category x the four regions, at a selected year
 *
 * The engine writes the lens decompositions (simulation.decompositions). Each
 * splits a category's median shift in a year across its dimension, so every
 * lens row adds up to the Time Path cell and the four lenses reconcile cell by
 * cell.
 *
 * The totals (shift/matrixModel.ts) are category-weighted averages with the
 * run's own category shares (category_weights_used, the row sums of the cell
 * weights the run rolled up with), never sums:
 *
 *   grand[y]         = sum_c w[c] x median[c][y]    / sum_c w[c]
 *   col_total[d][y]  = sum_c w[c] x decomp[c][d][y] / sum_c w[c]
 *   row_total[c][y]  = median[c][y]                 (the Time Path cell)
 *
 * Each category's lens shares add up to 1, so the column totals add up to the
 * grand total and all four lenses show the same grand total in a year. Rows
 * carry no weights of their own: a row total is the one number the simulation
 * produces per (category, year), and the force and cell weights already shape
 * how a row is split.
 *
 * On the Time Path the impact filter shows the part of each cell the
 * expanding or the contracting drivers carry, splitting the median by the
 * drivers' contributions at the score means (lib/driverAttribution.ts). The
 * same attribution ranks the drivers in the drill-down; without the model
 * configuration or the drivers there is none, and the filter and the
 * drill-down say which of the two is missing.
 *
 * Above the matrix a KPI strip shows the portfolio band and the most resilient
 * and most exposed categories; a row or a category tile opens the drill-down
 * (CategoryDetailPanel). Without a run the page says why, from the service's
 * own diagnosis. The "About this model" footer carries the run's provenance
 * and the method. The parts live in shift/: the matrix model, the toolbar
 * controls, the KPI tile, the matrix table, the state without a run, the run
 * notices and details, and the footer.
 */

'use client';

import { useEffect, useMemo, useState, type FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertTriangle } from 'lucide-react';
import usePrism from '@/hooks/usePrism';
import { getDiagnostics } from '@/lib/apiClient';
import { CATEGORIES, CATEGORY_NAMES, HORIZON, categoryDisplay } from '@/lib/format';
import { S, HEADLINE_FONT, BODY_FONT } from '@/lib/theme';
import { categoryShares, getYearPercentiles } from '@/lib/shiftMatrix';
import { attributeRun, signParts } from '@/lib/driverAttribution';
import { cellWeightsBasis } from '@/lib/cellWeights';
import CategoryDetailPanel from './shift/CategoryDetailPanel';
import type { DiagnosticsResult } from '@/types';
import {
  buildMatrix, type CellMap, columnTotals, type ImpactFilter, type MatrixModel, ROWS,
  type ViewMode,
} from './shift/matrixModel';
import { IMPACT_META, SegControl, VIEW_META, YearStepper } from './shift/controls';
import { KpiTile } from './shift/KpiTile';
import { Matrix, PeakStressTooltip } from './shift/Matrix';
import { noRunReason, NoRunState } from './shift/NoRunState';
import { RunNotices } from './shift/RunDetails';
import { AboutThisModel } from './shift/AboutThisModel';

const ShiftAnalysis: FC<{
  /** Admins see the operational reason when there is no run to show. */
  isAdmin?: boolean;
  /** Opens the Drivers page searched for a driver's name; the drill-down's driver cards use it. */
  onNavigateToDriver?: (query: string) => void;
}> = ({ isAdmin = false, onNavigateToDriver }) => {
  const {
    simulation, simulationError, config, drivers, health,
    loading, error, backendAvailable,
    reload,
  } = usePrism();

  const [view, setView] = useState<ViewMode>('time');
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>('total');
  const [selectedYear, setSelectedYear] = useState<number>(HORIZON);
  /** The category whose drill-down is open, by its API key. */
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // The service's own diagnosis, fetched only while there is no run to show,
  // so the page can say why: undefined until it answers, null when the
  // service cannot be reached. Asked again when the service's database state
  // changes (an outage, a migration, a first run).
  const [diagnostics, setDiagnostics] = useState<DiagnosticsResult | null | undefined>(undefined);
  const healthStatus = health?.status;
  const healthReason = health?.simulation_reason;
  useEffect(() => {
    if (loading || simulation || !backendAvailable) return;
    let cancelled = false;
    void getDiagnostics().then((d) => { if (!cancelled) setDiagnostics(d); });
    return () => { cancelled = true; };
  }, [loading, simulation, backendAvailable, healthStatus, healthReason]);

  const categoryWeights = useMemo(
    () => (simulation ? categoryShares(simulation.category_weights_used, CATEGORY_NAMES) : []),
    [simulation],
  );
  // The drivers' parts of the shift at the score means: the drill-down ranks
  // its drivers with it and the impact filter splits the net with it. It
  // needs the configuration and the drivers; without one of them both say
  // which.
  const attribution = useMemo(() => (simulation
    ? attributeRun(drivers, config, CATEGORY_NAMES, simulation.cell_weights_used)
    : null), [drivers, config, simulation]);
  const attributionResult = attribution?.result ?? null;
  const filter: ImpactFilter = attributionResult ? impactFilter : 'total';

  const matrix = useMemo<MatrixModel | null>(() => {
    if (!simulation) return null;
    const model = buildMatrix(simulation, view, selectedYear, categoryWeights);
    if (view !== 'time' || filter === 'total' || !attributionResult) return model;
    // The filter shows each cell's expansion or contraction part. The P10–P90
    // bands describe the unfiltered distribution, so they are dropped.
    const data: CellMap = Object.fromEntries(CATEGORY_NAMES.map((c) => [c, Object.fromEntries(model.columns.map((col) => {
      const v = model.data[c][col];
      return [col, v == null || !isFinite(v) ? null : signParts(attributionResult, c, Number(col), v)[filter]];
    }))]));
    return { ...model, data, colTotals: columnTotals(data, model.columns, categoryWeights), cellDetails: undefined };
  }, [simulation, view, selectedYear, categoryWeights, filter, attributionResult]);

  // The KPI strip: the joint portfolio band at the horizon, and the most
  // resilient and most exposed categories with their own bands.
  const headline = useMemo(() => {
    if (!simulation) return null;
    const terminal = CATEGORIES.flatMap((c) => {
      const band = getYearPercentiles(simulation.shifts, c.name, HORIZON);
      return band ? [{ name: c.name, band }] : [];
    });
    const categoryTiles = terminal.length ? [
      { label: 'Most resilient category', ...terminal.reduce((a, b) => (b.band.median > a.band.median ? b : a)) },
      { label: 'Most exposed category', ...terminal.reduce((a, b) => (b.band.median < a.band.median ? b : a)) },
    ] : [];
    return { portfolio: simulation.totals.portfolio[String(HORIZON)], categoryTiles };
  }, [simulation]);

  const meta = VIEW_META[view];
  const noRun = simulation ? undefined : noRunReason(backendAvailable, diagnostics);
  const onEstimate = simulation != null && cellWeightsBasis(simulation.cell_weights_source) === 'estimate';
  const showOffline = !loading && !backendAvailable;

  // The matrix card's toolbar speaks three distinct vocabularies, so its jobs
  // never blur into one strip of look-alike pills: the lens as a segmented
  // control on the left; on the right a labelled contextual control (the
  // impact filter on Time Path, the year stepper on the attribution lenses);
  // and the peak-stress explainer as an info button.
  const matrixToolbar = (
    <>
      <SegControl
        ariaLabel="Matrix view lens"
        items={(Object.keys(VIEW_META) as ViewMode[]).map((v) => ({
          id: v,
          label: VIEW_META[v].label,
          Icon: VIEW_META[v].Icon,
        }))}
        activeId={view}
        onSelect={(id) => setView(id as ViewMode)}
      />
      <div className="flex flex-wrap items-center justify-end gap-3">
        <span
          style={{
            fontFamily: HEADLINE_FONT,
            fontWeight: 700,
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: S.mutedText,
          }}
        >
          {view === 'time' ? 'Show' : 'Year'}
        </span>
        {view === 'time' ? (
          <SegControl
            size="sm"
            ariaLabel="Driver-impact filter"
            items={(Object.keys(IMPACT_META) as ImpactFilter[]).map((f) => ({
              id: f,
              label: IMPACT_META[f].label,
              Icon: IMPACT_META[f].Icon,
              disabledReason: f !== 'total' && attribution?.missing
                ? `Needs ${attribution.missing}, which did not load; reload the page to try again.`
                : undefined,
            }))}
            activeId={filter}
            onSelect={(id) => setImpactFilter(id as ImpactFilter)}
          />
        ) : (
          <YearStepper year={selectedYear} onChange={setSelectedYear} />
        )}
        <PeakStressTooltip />
      </div>
    </>
  );

  const loadingState = (
    <div
      className="flex items-center justify-center py-24 rounded-2xl"
      style={{ backgroundColor: S.surface, color: S.mutedText }}
    >
      <Loader2 size={20} className="animate-spin" style={{ color: S.primary }} />
      <span className="ml-3 text-[14px]">Loading shift matrix…</span>
    </div>
  );

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: S.bg, color: S.onBg, fontFamily: BODY_FONT }}
    >
      {/* Visible keyboard focus on the matrix's drill-down buttons, whose
          `all: unset` removes the browser's own focus ring. */}
      <style>{`
        .shift-row-open:focus-visible { outline: 2px solid ${S.primary}; outline-offset: 2px; border-radius: 4px; }
        .shift-row-open:focus:not(:focus-visible) { outline: none; }
      `}</style>
      <main className="max-w-[1440px] mx-auto px-8 py-10">

        <AnimatePresence>
          {showOffline && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-6 flex items-center justify-between gap-4 px-5 py-4 rounded-2xl"
              style={{ backgroundColor: S.errorContainer, color: S.onErrorContainer }}
            >
              <div className="flex items-center gap-3">
                <AlertTriangle size={18} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  The PRISM service cannot be reached. The dashboard reloads its data as soon as it answers again.
                </span>
              </div>
              <button
                type="button"
                onClick={() => { void reload(); }}
                className="px-4 py-1.5 rounded-full text-[12px] font-semibold"
                style={{ backgroundColor: S.onErrorContainer, color: S.errorContainer, border: 'none', cursor: 'pointer' }}
              >
                Reconnect
              </button>
            </motion.div>
          )}
          {error && backendAvailable && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-6 px-5 py-4 rounded-2xl"
              style={{ backgroundColor: S.errorContainer, color: S.onErrorContainer, fontSize: 13, fontWeight: 600 }}
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mb-5 pl-5" style={{ borderLeft: `4px solid ${S.primary}` }}>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] mb-2"
            style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}>
            Profit Pool Shift Analysis
          </div>
          <h1 className="font-extrabold tracking-tight"
            style={{ fontFamily: HEADLINE_FONT, color: S.onBg, fontSize: '2.4rem', lineHeight: 1.15 }}>
            Where Profit Pools Shift
          </h1>
          {/* The page carries the relative-exposure framing once, here; the
              full reading note is in "About this model". A run on the
              estimated cell weights says so next to its numbers. */}
          <p className="mt-1.5 max-w-3xl text-[13.5px]" style={{ color: S.onSurfaceVariant, lineHeight: 1.55 }}>
            Relative exposure if no one acts, not a forecast. Four lenses, one set of totals;{' '}
            <span style={{ fontWeight: 600, color: S.onSurface }}>click any value to drill in.</span>
          </p>
          {onEstimate && (
            <p data-testid="estimate-note" className="mt-1 max-w-3xl text-[12.5px]"
              style={{ color: S.mutedText, lineHeight: 1.5 }}>
              Categories and the portfolio are weighted with an estimated HCB gross-profit mix built from public
              reporting, not Henkel P&amp;L. Settings shows how it is built.
            </p>
          )}
        </div>

        {/* The three headline numbers; each band opens on hover, focus or tap.
            The portfolio band is the engine's joint percentile of the
            portfolio shift. */}
        {headline && (
          <div
            className="mb-5 grid gap-3"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}
          >
            <KpiTile
              label={`Portfolio exposure (if no action) · by ${HORIZON}`}
              band={headline.portfolio}
              bandNote="80% of outcomes (joint portfolio)"
            />
            {headline.categoryTiles.map((tile) => (
              <KpiTile
                key={tile.label}
                label={tile.label}
                name={categoryDisplay(tile.name)}
                band={tile.band}
                bandNote="80% of outcomes"
                onOpen={() => setSelectedCategory(tile.name)}
              />
            ))}
          </div>
        )}

        {simulation && <RunNotices simulation={simulation} serviceVersion={health?.version ?? null} />}

        {/* Not keyed on the lens or the year: remounting on a switch would
            drop the keyboard focus from the toolbar that made it. */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {loading ? loadingState : matrix ? (
            <Matrix
              toolbar={matrixToolbar}
              columns={matrix.columns}
              rows={ROWS}
              data={matrix.data}
              subtitle={
                view === 'time'
                  ? (filter !== 'total'
                      ? `${meta.label} · ${IMPACT_META[filter].label}: ${IMPACT_META[filter].description}`
                      : `${meta.label} · ${meta.description}`)
                  : `${meta.label} · ${selectedYear} · ${meta.description}`
              }
              rowTotals={matrix.rowTotals}
              colTotals={matrix.colTotals}
              grandTotal={matrix.grandTotal}
              rowTotalLabel={`Total ${selectedYear}`}
              valueLabel={view !== 'time' ? meta.label
                : filter === 'total' ? 'Median' : `${IMPACT_META[filter].label}’ part`}
              cellDetails={matrix.cellDetails}
              onRowClick={setSelectedCategory}
              noBandsNote={
                view !== 'time'
                  ? 'Switch to Time Path for P10 to P90 bands'
                  : 'Ranges unavailable when filtered to expansion or contraction drivers; bands describe the unfiltered distribution'
              }
            />
          ) : noRun ? (
            <NoRunState reason={noRun} isAdmin={isAdmin} diagnostics={diagnostics} requestError={simulationError} />
          ) : loadingState}
        </motion.section>

        <AnimatePresence>
          {selectedCategory && simulation && attribution && (
            <CategoryDetailPanel
              category={selectedCategory}
              year={view === 'time' ? HORIZON : selectedYear}
              simulation={simulation}
              drivers={drivers}
              attribution={attribution}
              onClose={() => setSelectedCategory(null)}
              onOpenDriver={onNavigateToDriver}
            />
          )}
        </AnimatePresence>

        <AboutThisModel simulation={simulation} config={config} />
      </main>
    </div>
  );
};

export default ShiftAnalysis;
