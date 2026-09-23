/**
 * The served run's notices and provenance: what the run does not show yet,
 * and its audit metadata and integrity events.
 */
import type { FC } from 'react';
import { Info, Database } from 'lucide-react';
import { fmtPct, fmtDateTimeUtc } from '@/lib/format';
import { S, HEADLINE_FONT, MONO_FONT } from '@/lib/theme';
import { cellMarginals, cellWeightsBasis } from '@/lib/cellWeights';
import { codeForDriverId } from '@/data/driverCodeMap';
import type { SimulationResult } from '@/types';

// ─── What the served run does not show yet ──────────────────────────────

/**
 * Notes above the matrix when the served run no longer matches the drivers or
 * the engine: drivers edited since the run (their effect shows after the next
 * production run) and a run computed by another engine version.
 */
export const RunNotices: FC<{ simulation: SimulationResult; serviceVersion: string | null }> = ({
  simulation, serviceVersion,
}) => {
  const since = simulation.inputs_since_run;
  const touched = [...since.changed, ...since.added, ...since.removed];
  const version = simulation.run_meta.model_version;
  const notes: string[] = [];
  if (touched.length) {
    const codes = touched.map((id) => codeForDriverId(id) ?? id);
    const shown = codes.slice(0, 8).join(', ') + (codes.length > 8 ? ` and ${codes.length - 8} more` : '');
    notes.push(`${touched.length === 1 ? 'One driver has' : `${touched.length} drivers have`} changed since this run `
      + `(${shown}). The numbers below show the drivers as they were; the next production run takes the changes in.`);
  }
  if (serviceVersion && serviceVersion !== version) {
    notes.push(`This run was computed by engine ${version}; the service runs ${serviceVersion}. `
      + 'The numbers follow the current engine after the next production run.');
  }
  if (!notes.length) return null;
  return (
    <div role="status" className="mb-5 flex items-start gap-2.5 rounded-xl px-4 py-3"
      style={{ backgroundColor: S.amberContainer, color: S.onAmberContainer, fontSize: 13, lineHeight: 1.5 }}>
      <Info size={15} strokeWidth={2.4} style={{ flexShrink: 0, marginTop: 2 }} />
      <div>{notes.map((n) => <p key={n} style={{ margin: 0 }}>{n}</p>)}</div>
    </div>
  );
};

// ─── The run's provenance ────────────────────────────────────────────

/** The served run's provenance and audit metadata, and the integrity events recorded with it. */
export const RunDetails: FC<{ simulation: SimulationResult }> = ({ simulation }) => {
  const m = simulation.run_meta;
  const ss = simulation.seed_stability;
  const events = simulation.integrity_events;
  const cells = cellMarginals(simulation.cell_weights_used);
  // The largest bootstrap standard error of a terminal-year category median.
  const maxSe = Math.max(0, ...Object.values(simulation.mc_standard_error).map((e) => e.median_se_pp));
  const rows: Array<[string, string]> = [
    ['Iterations', `${(m.iterations / 1000).toFixed(0)}k × ${m.chains} chains`],
    ['Seed', String(m.seed)],
    // Both measure Monte Carlo sampling noise only, never model error: the
    // largest standard error of a terminal-year category median, and the
    // spread of the terminal-year portfolio median across the independently
    // seeded chains.
    ['MC standard error', `at most ${maxSe.toFixed(3)} pp (${ss.terminal_year} category medians)`],
    ['Seed stability', `${ss.spread_pp.toFixed(3)} pp spread across ${ss.n_chains} seeds (${ss.terminal_year} portfolio median)`],
    ['Numerics', m.numerics_backend],
    // The run's own label says whether it stands on the estimated HCB mix or
    // on a file given to the production run.
    ['Cell weights', cellWeightsBasis(simulation.cell_weights_source) === 'estimate'
      ? `estimated HCB mix, not Henkel P&L (${cells.cellCount} cells)`
      : `from the file given to the run (${cells.cellCount} cells)`],
    ['Weights source', simulation.cell_weights_source],
    ['Region shares', Object.entries(simulation.region_weights_used)
      .map(([r, w]) => `${r} ${fmtPct(w, 0)}`).join(' · ')],
    ['Category shares', 'row sums of the cell weights'],
    ['Driver base', `${m.driver_count} drivers`],
    ['Calibration', m.attenuation_source],
    ['Engine', m.engine_name],
    ['Model', m.model_version],
  ];
  return (
    <div className="mb-5 pb-5" style={{ borderBottom: `1px solid ${S.cardBorder}` }}>
      <div className="text-[11px] font-bold uppercase tracking-[0.14em] mb-2"
        style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}>This run</div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
          style={{ backgroundColor: S.surfaceContainer, color: S.onPrimaryContainer,
            fontSize: 11, fontWeight: 600, letterSpacing: '0.04em' }}>
          <Database size={12} />
          <span>Run #{m.run_id}</span>
        </span>
        <span style={{ color: S.mutedText, fontSize: 11.5 }}>
          {fmtDateTimeUtc(m.run_date)}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1.5">
        {rows.map(([k, v]) => (
          <span key={k} className="inline-flex items-baseline gap-2">
            <span style={{ fontSize: 11.5, color: S.mutedText }}>{k}</span>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: S.onSurface,
              fontFamily: MONO_FONT }}>{v}</span>
          </span>
        ))}
      </div>
      {events.length > 0 && (
        <div className="mt-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] mb-1.5"
            style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}>
            Run integrity · {events.length} {events.length === 1 ? 'event' : 'events'}
          </div>
          <ul style={{ display: 'grid', rowGap: 6, margin: 0, padding: 0, listStyle: 'none' }}>
            {events.map((e, i) => (
              <li key={`${e.type}-${i}`} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ marginTop: 4, width: 6, height: 6, flexShrink: 0, borderRadius: 9999,
                  backgroundColor: e.severity === 'warning' || e.severity === 'error' ? S.amber : S.primary }} />
                <span style={{ fontSize: 11.5, lineHeight: 1.5, color: S.onSurface }}>{e.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
