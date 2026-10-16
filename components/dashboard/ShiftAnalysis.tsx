/**
 * Shift Analysis: the Shift Matrix of the served run, read through four
 * lenses.
 *
 *   Time path     category x year: the Monte Carlo median shift
 *   Force         category x the six forces, at a selected year
 *   Value chain   category x the eight value-chain stages, at a selected year
 *   Region        category x the four regions, at a selected year
 *
 * The engine writes the lens decompositions (simulation.decompositions). Each
 * splits a category's median shift in a year across its dimension, so every
 * lens row adds up to the Time path cell and the four lenses reconcile cell by
 * cell.
 *
 * The totals (shift/matrixModel.ts) are category-weighted averages with the
 * run's own category shares (category_weights_used, the row sums of the cell
 * weights the run rolled up with), never sums:
 *
 *   grand[y]         = sum_c w[c] x median[c][y]    / sum_c w[c]
 *   col_total[d][y]  = sum_c w[c] x decomp[c][d][y] / sum_c w[c]
 *   row_total[c][y]  = median[c][y]                 (the Time path cell)
 *
 * Each category's lens shares add up to 1, so the column totals add up to the
 * grand total and all four lenses show the same grand total in a year. Rows
 * carry no weights of their own: a row total is the one number the simulation
 * produces per (category, year), and the force and cell weights already shape
 * how a row is split.
 *
 * On the Time path the impact filter shows the part of each cell the
 * expanding or the contracting drivers carry, splitting the median by the
 * drivers' contributions at the score means (lib/driverAttribution.ts). The
 * same attribution ranks the drivers in the drill-down; without the model
 * configuration or the drivers there is none, and the filter and the
 * drill-down say which of the two is missing.
 *
 * The lens, the year, the impact filter and the open drill-down live in the
 * address bar (hooks/useViewUrl.tsx): the page starts from the address it was
 * opened with, writes every change back (a drill-down pushes a history entry,
 * so Back closes it) and adopts the address when it changes under it.
 *
 * Above the matrix a KPI strip shows the portfolio band and the least exposed
 * and most exposed categories; a row or a category tile opens the drill-down
 * (CategoryDetailPanel). The matrix exports as CSV, as an image and to print.
 * Without a run the page says why, from the service's own diagnosis. The
 * "About this model" footer carries the run's provenance and the method. The
 * parts live in shift/: the matrix model, the toolbar controls, the KPI tile,
 * the matrix table, the state without a run, the run notices and details, and
 * the footer.
 */

'use client';

import { useEffect, useMemo, useRef, useState, type FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertTriangle } from 'lucide-react';
import usePrism from '@/hooks/usePrism';
import { useViewParams } from '@/hooks/useViewUrl';
import { getDiagnostics } from '@/lib/apiClient';
import { CATEGORIES, CATEGORY_NAMES, HORIZON, YEARS, categoryDisplay } from '@/lib/format';
import { S, HEADLINE_FONT, BODY_FONT } from '@/lib/theme';
import { categoryShares, getYearPercentiles } from '@/lib/shiftMatrix';
import { attributeRun, signParts } from '@/lib/driverAttribution';
import { cellWeightsBasis } from '@/lib/cellWeights';
import { downloadText, safeFilename } from '@/lib/exportCsv';
import { downloadNodeAsPng } from '@/lib/exportImage';
import CategoryDetailPanel from './shift/CategoryDetailPanel';
import type { DiagnosticsResult } from '@/types';
import {
  bandCoverageSentence, buildMatrix, type CellMap, columnTotals, ESTIMATE_EXPORT_NOTE, type ImpactFilter, type Lens,
  type MatrixModel, matrixExportTitle, matrixToCsv, ROWS,
} from './shift/matrixModel';
import { ExportMenu, IMPACT_META, LENS_META, SegControl, YearStepper } from './shift/controls';
import { KpiTile } from './shift/KpiTile';
import { Matrix, PeakStressTooltip } from './shift/Matrix';
import { noRunReason, NoRunState } from './shift/NoRunState';
import { RunNotices } from './shift/RunDetails';
import { AboutThisModel } from './shift/AboutThisModel';

// The address parameters, as the parser (lib/viewUrl.ts) lets them through;
// a value it does not know never arrives here.
const LENSES = Object.keys(LENS_META) as Lens[];
const FILTERS = Object.keys(IMPACT_META) as ImpactFilter[];
const parseLens = (v: string | undefined): Lens | null => (LENSES.includes(v as Lens) ? (v as Lens) : null);
const parseFilter = (v: string | undefined): ImpactFilter | null =>
  (FILTERS.includes(v as ImpactFilter) ? (v as ImpactFilter) : null);
const parseYear = (v: string | undefined): number | null => (v && YEARS.includes(Number(v)) ? Number(v) : null);
const parseCategory = (v: string | undefined): string | null => (v && CATEGORY_NAMES.includes(v) ? v : null);

const ShiftAnalysis: FC<{
  /** Admins see the operational reason when there is no run to show. */
  isAdmin?: boolean;
  /** Opens a driver on the Drivers page by its code; the drill-down's driver cards use it. */
  onNavigateToDriver?: (query: string) => void;
}> = ({ isAdmin = false, onNavigateToDriver }) => {
  const {
    simulation, simulationError, config, drivers, health,
    loading, error, apiAvailable,
    reload,
  } = usePrism();

  // ─── The address bar ───
  // Local state starts from the address and is written back on every change;
  // when the address changes under the page (Back, Forward, a pasted link)
  // the new values are adopted during render, as derived state, so the
  // matrix never shows one lens while the address names another.
  const [params, setParams] = useViewParams('shift-analysis');
  const urlLens = parseLens(params.lens);
  const urlYear = parseYear(params.year);
  const urlFilter = parseFilter(params.filter);
  const urlCategory = parseCategory(params.category);
  const urlKey = [params.lens, params.year, params.filter, params.category].map((v) => v ?? '').join('|');

  const [lens, setLens] = useState<Lens>(urlLens ?? 'time');
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>(urlFilter ?? 'total');
  const [selectedYear, setSelectedYear] = useState<number>(urlYear ?? HORIZON);
  /** The category whose drill-down is open, by its API key. */
  const [selectedCategory, setSelectedCategory] = useState<string | null>(urlCategory);
  const [seenKey, setSeenKey] = useState(urlKey);
  if (urlKey !== seenKey) {
    setSeenKey(urlKey);
    if (urlLens && urlLens !== lens) setLens(urlLens);
    if (urlYear && urlYear !== selectedYear) setSelectedYear(urlYear);
    if (urlFilter && urlFilter !== impactFilter) setImpactFilter(urlFilter);
    if (urlCategory !== selectedCategory) setSelectedCategory(urlCategory);
  }

  const changeLens = (next: Lens) => { setLens(next); setParams({ lens: next }); };
  const changeYear = (next: number) => { setSelectedYear(next); setParams({ year: String(next) }); };
  const changeFilter = (next: ImpactFilter) => { setImpactFilter(next); setParams({ filter: next }); };
  const openCategory = (next: string) => { setSelectedCategory(next); setParams({ category: next }, { push: true }); };
  const closeCategory = () => { setSelectedCategory(null); setParams({ category: null }); };

  // The service's own diagnosis, fetched only while there is no run to show,
  // so the page can say why: undefined until it answers, null when the
  // service cannot be reached. Asked again when the service's database state
  // changes (an outage, a migration, a first run).
  const [diagnostics, setDiagnostics] = useState<DiagnosticsResult | null | undefined>(undefined);
  const healthStatus = health?.status;
  const healthReason = health?.simulation_reason;
  useEffect(() => {
    if (loading || simulation || !apiAvailable) return;
    let cancelled = false;
    void getDiagnostics().then((d) => { if (!cancelled) setDiagnostics(d); });
    return () => { cancelled = true; };
  }, [loading, simulation, apiAvailable, healthStatus, healthReason]);

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
    const model = buildMatrix(simulation, lens, selectedYear, categoryWeights);
    if (lens !== 'time' || filter === 'total' || !attributionResult) return model;
    // The filter shows each cell's expansion or contraction part. The P10 to
    // P90 bands describe the unfiltered distribution, so they are dropped.
    const data: CellMap = Object.fromEntries(CATEGORY_NAMES.map((c) => [c, Object.fromEntries(model.columns.map((col) => {
      const v = model.data[c][col];
      return [col, v == null || !isFinite(v) ? null : signParts(attributionResult, c, Number(col), v)[filter]];
    }))]));
    return { ...model, data, colTotals: columnTotals(data, model.columns, categoryWeights), cellDetails: undefined };
  }, [simulation, lens, selectedYear, categoryWeights, filter, attributionResult]);

  // The KPI strip: the joint portfolio band at the horizon, and the least and
  // the most exposed categories with their own bands; the three range bars
  // share one scale, from the lowest P10 to the highest P90 among them.
  const headline = useMemo(() => {
    if (!simulation) return null;
    const terminal = CATEGORIES.flatMap((c) => {
      const band = getYearPercentiles(simulation.shifts, c.name, HORIZON);
      return band ? [{ name: c.name, band }] : [];
    });
    const categoryTiles = terminal.length ? [
      { label: 'Least exposed category', ...terminal.reduce((a, b) => (b.band.median > a.band.median ? b : a)) },
      { label: 'Most exposed category', ...terminal.reduce((a, b) => (b.band.median < a.band.median ? b : a)) },
    ] : [];
    const portfolio = simulation.totals.portfolio[String(HORIZON)];
    const bands = [portfolio, ...categoryTiles.map((t) => t.band)];
    return {
      portfolio,
      categoryTiles,
      scaleMin: Math.min(...bands.map((b) => b.p10)),
      scaleMax: Math.max(...bands.map((b) => b.p90)),
    };
  }, [simulation]);

  const meta = LENS_META[lens];
  const noRun = simulation ? undefined : noRunReason(apiAvailable, diagnostics);
  const onEstimate = simulation != null && cellWeightsBasis(simulation.cell_weights_source) === 'estimate';
  const showOffline = !loading && !apiAvailable;
  const bandSentence = bandCoverageSentence(onEstimate);

  // ─── Export ───
  const matrixRef = useRef<HTMLDivElement | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const exportTitle = matrixExportTitle(lens, meta.label, selectedYear);
  const exportCsv = () => {
    if (!matrix || !simulation) return;
    const csv = matrixToCsv({
      model: matrix, lens, lensLabel: meta.label, year: selectedYear,
      filterLabel: lens === 'time' && filter !== 'total' ? IMPACT_META[filter].label : undefined,
      simulation, onEstimate,
    });
    const ok = downloadText(safeFilename(`PRISM-shift-matrix-${exportTitle}`, 'csv'), csv);
    setExportStatus(ok ? 'CSV downloaded' : 'This browser cannot save the CSV');
  };
  const exportPng = async () => {
    const node = matrixRef.current;
    if (!node) return;
    setExporting(true);
    setExportStatus('Preparing the image…');
    try {
      await downloadNodeAsPng(node, safeFilename(`PRISM-shift-matrix-${exportTitle}`, 'png'), {
        backgroundColor: S.surface,
      });
      setExportStatus('PNG downloaded');
    } catch (err) {
      const reason = err instanceof Error && err.message ? err.message : 'the renderer failed';
      setExportStatus(`The image could not be made: ${reason}`);
    } finally {
      setExporting(false);
    }
  };

  // The matrix card's toolbar speaks three distinct vocabularies, so its jobs
  // never blur into one strip of look-alike pills: the lens as a segmented
  // control on the left; on the right a labelled contextual control (the
  // impact filter on Time path, the year stepper on the attribution lenses),
  // the peak-stress explainer as an info button and the export menu.
  const matrixToolbar = (
    <>
      <SegControl
        ariaLabel="Matrix lens"
        items={LENSES.map((v) => ({
          id: v,
          label: LENS_META[v].label,
          Icon: LENS_META[v].Icon,
        }))}
        activeId={lens}
        onSelect={(id) => changeLens(id as Lens)}
      />
      <div className="flex flex-wrap items-center justify-end gap-3 min-w-0 max-w-full">
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
          {lens === 'time' ? 'Show' : 'Year'}
        </span>
        {lens === 'time' ? (
          <SegControl
            size="sm"
            ariaLabel="Driver-impact filter"
            items={FILTERS.map((f) => ({
              id: f,
              label: IMPACT_META[f].label,
              Icon: IMPACT_META[f].Icon,
              disabledReason: f !== 'total' && attribution?.missing
                ? `Needs ${attribution.missing}, which did not load; reload the page to try again.`
                : undefined,
            }))}
            activeId={filter}
            onSelect={(id) => changeFilter(id as ImpactFilter)}
          />
        ) : (
          <YearStepper year={selectedYear} onChange={changeYear} />
        )}
        <PeakStressTooltip />
        <ExportMenu
          ariaLabel="Export the matrix"
          busy={exporting}
          items={[
            { id: 'csv', label: 'CSV of this matrix', onSelect: exportCsv },
            { id: 'png', label: 'PNG of this matrix', onSelect: () => { void exportPng(); } },
            { id: 'print', label: 'Print', onSelect: () => { window.print(); } },
          ]}
        />
        {/* The visible status; the announcement is the live region after the
            card, which the capture does not hide. */}
        {exportStatus && (
          <span
            data-print-hide
            aria-hidden
            className="basis-full text-right"
            style={{ fontSize: 11.5, fontWeight: 600, color: S.onSurfaceVariant, fontFamily: BODY_FONT }}
          >
            {exportStatus}
          </span>
        )}
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

  // The subtitle bar of the matrix card: the lens (and its year) as the
  // label, what the cells hold as the sentence after it.
  const subtitleLabel = lens === 'time' ? meta.label : `${meta.label} ${selectedYear}`;
  const subtitleText = lens === 'time' && filter !== 'total'
    ? `${IMPACT_META[filter].label}: ${IMPACT_META[filter].description}`
    : meta.description;

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
      <main className="max-w-[1440px] mx-auto px-4 md:px-8 py-6 md:py-10">

        <AnimatePresence>
          {showOffline && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-6 flex flex-wrap items-center justify-between gap-4 px-5 py-4 rounded-2xl"
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
          {error && apiAvailable && (
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

        <div className="mb-5 pl-4 md:pl-5" style={{ borderLeft: `4px solid ${S.primary}` }}>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] mb-2"
            style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}>
            Profit Pool Shift Analysis
          </div>
          <h1 className="font-extrabold tracking-tight text-[1.9rem] md:text-[2.4rem]"
            style={{ fontFamily: HEADLINE_FONT, color: S.onBg, lineHeight: 1.15 }}>
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

        {/* The three headline numbers, each with its P10 to P90 band in text
            and on a shared range bar; what a band covers is the sentence
            under the strip and, on hover, focus or tap, the tile's own note.
            The portfolio band is the engine's joint percentile of the
            portfolio shift. A band covers what the Monte Carlo iterations
            vary, each driver's size and timing. */}
        {headline && (
          <div className="mb-5">
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}
            >
              <KpiTile
                label={`Portfolio exposure (if no action) · by ${HORIZON}`}
                band={headline.portfolio}
                bandNote="80% of simulated outcomes (joint portfolio; driver size and timing only)"
                scaleMin={headline.scaleMin}
                scaleMax={headline.scaleMax}
              />
              {headline.categoryTiles.map((tile) => (
                <KpiTile
                  key={tile.label}
                  label={tile.label}
                  name={categoryDisplay(tile.name)}
                  band={tile.band}
                  bandNote="80% of simulated outcomes (driver size and timing only)"
                  scaleMin={headline.scaleMin}
                  scaleMax={headline.scaleMax}
                  onOpen={() => openCategory(tile.name)}
                />
              ))}
            </div>
            <p
              data-testid="band-sentence"
              className="mt-2.5 max-w-4xl text-[12.5px]"
              style={{ color: S.onSurfaceVariant, lineHeight: 1.5 }}
            >
              {bandSentence}
            </p>
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
              cardRef={matrixRef}
              exportNotes={[bandSentence, ...(onEstimate ? [ESTIMATE_EXPORT_NOTE] : [])]}
              toolbar={matrixToolbar}
              columns={matrix.columns}
              rows={ROWS}
              data={matrix.data}
              subtitleLabel={subtitleLabel}
              subtitleText={subtitleText}
              caption={`Shift Matrix: ${exportTitle}`}
              rowTotals={matrix.rowTotals}
              colTotals={matrix.colTotals}
              grandTotal={matrix.grandTotal}
              rowTotalLabel={`Total ${selectedYear}`}
              valueLabel={lens !== 'time' ? meta.label
                : filter === 'total' ? 'Median' : `${IMPACT_META[filter].label}’ part`}
              cellDetails={matrix.cellDetails}
              onRowClick={openCategory}
              noBandsNote={
                lens !== 'time'
                  ? 'Switch to Time path for P10 to P90 bands'
                  : 'Ranges unavailable when filtered to expansion or contraction drivers; bands describe the unfiltered distribution'
              }
            />
          ) : noRun ? (
            <NoRunState reason={noRun} isAdmin={isAdmin} diagnostics={diagnostics} requestError={simulationError}
              onRetry={() => { void reload(); }} />
          ) : loadingState}
        </motion.section>
        {/* What the last export did, for a screen reader: outside the card,
            so it is announced while the card renders to an image. */}
        {exportStatus && <span role="status" className="sr-only">{exportStatus}</span>}

        <AnimatePresence>
          {selectedCategory && simulation && attribution && (
            <CategoryDetailPanel
              category={selectedCategory}
              year={lens === 'time' ? HORIZON : selectedYear}
              simulation={simulation}
              drivers={drivers}
              attribution={attribution}
              onClose={closeCategory}
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
