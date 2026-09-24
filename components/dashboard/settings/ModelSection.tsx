/**
 * The Model section of the Settings sheet, read-only: the parameters from
 * GET /api/v1/config and the served run's cell weights with their marginals,
 * basis and derivation. The configuration is code (prism/config.py).
 */
import type { CSSProperties, FC } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import usePrism from '@/hooks/usePrism';
import SectionCard from '@/components/dashboard/SectionCard';
import { S, MONO_FONT } from '@/lib/theme';
import { BASE_YEAR, CATEGORY_NAMES, FORCES, NO_VALUE, REGIONS, categoryFullName } from '@/lib/format';
import { cellMarginals, cellWeightsBasis } from '@/lib/cellWeights';
import type { ForceName, ModelConfig, SimulationResult } from '@/types';
import {
  CELL_LABEL, CELL_NUM, CELL_SUM, CELL_TH, LABEL_STYLE, Muted, ROW_LABEL, StatusBanner, SubBlock,
  TableScroller, VALUE_STYLE,
} from './parts';
import { CellWeightProvenance } from './CellWeightProvenance';

const FORCE_ABBR: Record<ForceName, string> = {
  Consumer: 'Cons.', Customer: 'Cust.', Technology: 'Tech.',
  Government: 'Gov.', Environmental: 'Env.', Competitive: 'Comp.',
};

/** A number to fixed digits; the missing-value mark when there is none. */
const fixed = (v: number | undefined, digits: number): string =>
  typeof v === 'number' && Number.isFinite(v) ? v.toFixed(digits) : NO_VALUE;

/** A share in percent with two decimals: several cells hold less than 0.1 %. */
const pct2 = (share: number): string => (share * 100).toFixed(2);

/** Per-force values: one row per parameter, one column per force. */
const ForceRowsTable: FC<{
  label: string;
  rows: Array<{ name: string; values: Record<ForceName, number> }>;
}> = ({ label, rows }) => (
  <TableScroller label={label}>
    <thead>
      <tr>
        <th style={{ ...CELL_LABEL, backgroundColor: S.surfaceContainer }} aria-label="Parameter" />
        {FORCES.map((f) => <th key={f} style={CELL_TH} title={f}>{FORCE_ABBR[f]}</th>)}
      </tr>
    </thead>
    <tbody>
      {rows.map(({ name, values }) => (
        <tr key={name}>
          <th scope="row" style={ROW_LABEL}>{name}</th>
          {FORCES.map((f) => <td key={f} style={CELL_NUM}>{fixed(values[f], 3)}</td>)}
        </tr>
      ))}
    </tbody>
  </TableScroller>
);

/** A 6 x 6 force matrix, read row by column. */
const ForceMatrixTable: FC<{
  matrix: Record<ForceName, Record<ForceName, number>>;
  digits: number;
  /** The overlap matrix has no diagonal of its own: the within-force overlap covers it. */
  hideDiagonal?: boolean;
  label: string;
}> = ({ matrix, digits, hideDiagonal = false, label }) => (
  <TableScroller label={label}>
    <thead>
      <tr>
        <th style={{ ...CELL_LABEL, backgroundColor: S.surfaceContainer, textTransform: 'none', letterSpacing: 0 }}>
          row \ col
        </th>
        {FORCES.map((f) => <th key={f} style={CELL_TH} title={f}>{FORCE_ABBR[f]}</th>)}
      </tr>
    </thead>
    <tbody>
      {FORCES.map((row) => (
        <tr key={row}>
          <th scope="row" style={{ ...CELL_LABEL, borderTop: `1px solid ${S.cardBorder}` }}>{row}</th>
          {FORCES.map((col) => (
            <td key={col} style={{ ...CELL_NUM, color: row === col ? S.mutedText : S.onSurface }}>
              {row === col && hideDiagonal ? NO_VALUE : fixed(matrix[row]?.[col], digits)}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  </TableScroller>
);

const PARAM_GRID: CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12,
};

/** The code's parameters, from GET /api/v1/config. */
const ParameterCards: FC<{ config: ModelConfig }> = ({ config }) => {
  const years = config.path_years;
  const horizon = years.length
    ? `${years[0]}–${years[years.length - 1]} · ${years.length} years`
    : NO_VALUE;
  const jitter = config.peak_year_jitter;
  return (
    <>
      <SectionCard size="regular"
        title="Simulation parameters"
        icon={SlidersHorizontal}
        description="The engine's defaults, as the code sets them."
      >
        <div style={PARAM_GRID}>
          <SubBlock label="Path horizon" hint="Relative-shift paths over these years.">
            <div style={VALUE_STYLE}>{horizon}</div>
          </SubBlock>
          <SubBlock label="Base year" hint="Materialisation anchor.">
            <div style={VALUE_STYLE}>{BASE_YEAR}</div>
          </SubBlock>
          <SubBlock
            label="Peak-year jitter"
            hint={jitter
              ? "Each iteration moves every driver's peak year by up to the width its uncertainty score sets, 0 to 4 years."
              : 'Every driver peaks in its scored year in every iteration.'}
          >
            <div style={VALUE_STYLE}>{jitter ? 'On' : 'Off'}</div>
          </SubBlock>
        </div>
      </SectionCard>

      <SectionCard size="regular"
        title="Copula dependence (Gaussian)"
        icon={SlidersHorizontal}
        description="How driver correlations flow through the Monte Carlo. The correlations are latent-scale: they set the co-movement of the underlying Gaussian variables, not of the delivered Beta scores, so the realised score-to-score correlation is a little lower (about 0.28 for a latent 0.30). They lie between 0 and 1, so negative dependence cannot be expressed. The production run refuses a setting that is not positive definite on the loaded drivers rather than repairing it silently."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={PARAM_GRID}>
            <SubBlock label="Within-force ρ" hint="Correlation between two drivers of the same force.">
              <div style={VALUE_STYLE}>{fixed(config.within_force_rho, 2)}</div>
            </SubBlock>
          </div>
          <SubBlock
            label="Force correlation matrix"
            hint="Correlation between drivers of two forces; positive definite as entered on the current drivers."
          >
            <ForceMatrixTable matrix={config.force_correlation_matrix} digits={2} label="Force correlation matrix" />
          </SubBlock>
        </div>
      </SectionCard>

      <SectionCard size="regular"
        title="Attenuation & overlap"
        icon={SlidersHorizontal}
        description={`The engine dampens each force's combined driver effect with a per-force attenuation, 0.5 × (1 − mean between-force overlap of that force's row), and dampens the drivers within a force by their within-force overlap, for the mechanisms they share. Source: ${config.overlap_correction_source}, a structured-judgment overlap correction built on the drivers' category exposures.`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <ForceRowsTable
            label="Per-force attenuation and within-force overlap"
            rows={[
              { name: 'Attenuation', values: config.per_force_attenuation },
              { name: 'Within-force overlap', values: config.within_force_overlap },
            ]}
          />
          <SubBlock
            label="Between-force overlap matrix"
            hint="The input the attenuation is derived from; the engine reads the attenuation. Read row → column: the share of the row force's signal already captured by the column force. Asymmetric by design (a narrow force is covered by a broad one more than the other way round), bounded 0–0.45. The within-force overlap above covers the diagonal."
          >
            <ForceMatrixTable matrix={config.force_overlap_matrix} digits={3} hideDiagonal label="Between-force overlap matrix" />
          </SubBlock>
        </div>
      </SectionCard>
    </>
  );
};

const BasisBadge: FC<{ estimate: boolean }> = ({ estimate }) => (
  <span
    title={estimate
      ? 'An estimate of the HCB gross-profit mix from public reporting, not Henkel P&L'
      : 'The shares of the file the production run was given; its label says where they come from'}
    style={{
      fontFamily: MONO_FONT, fontSize: 10.5, fontWeight: 700,
      padding: '2px 8px', borderRadius: 999,
      backgroundColor: estimate ? S.amberContainer : S.surfaceLow,
      color: estimate ? S.onAmberContainer : S.onSurfaceVariant,
    }}
  >
    {estimate ? 'Estimated HCB mix' : 'From a weights file'}
  </span>
);

/** The served run's cell weights with their marginals and where they come from. */
const RunCellWeights: FC<{ run: SimulationResult }> = ({ run }) => {
  const m = cellMarginals(run.cell_weights_used);
  // The run's own label says what the weights are; the graded derivation
  // below documents the current estimate, so it shows only when the run's
  // shares are that estimate.
  const estimate = cellWeightsBasis(run.cell_weights_source) === 'estimate';
  const documented = estimate && m.matchesEstimate;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ ...LABEL_STYLE, fontWeight: 800, letterSpacing: '0.08em' }}>
          Cell weights of run #{run.run_meta.run_id}: share of HCB gross profit per category × region (%)
        </span>
        <BasisBadge estimate={estimate} />
      </div>
      {!estimate && (
        <div style={{ fontSize: 11.5, lineHeight: 1.55, color: S.onSurfaceVariant }}>
          Source: {run.cell_weights_source}
        </div>
      )}
      <TableScroller label="Cell weights: share of HCB gross profit per category and region">
        <thead>
          <tr>
            <th style={CELL_LABEL}>Category</th>
            {REGIONS.map((r) => <th key={r} style={CELL_TH}>{r}</th>)}
            <th style={CELL_TH} title="Row sum: the category's share of the pool">Σ category</th>
          </tr>
        </thead>
        <tbody>
          {CATEGORY_NAMES.map((c) => (
            <tr key={c}>
              <th scope="row" style={{ ...CELL_LABEL, borderTop: `1px solid ${S.cardBorder}` }}>{categoryFullName(c)}</th>
              {REGIONS.map((r) => <td key={r} style={CELL_NUM}>{pct2(run.cell_weights_used[c]![r]!)}</td>)}
              <td style={CELL_SUM}>{pct2(m.rowSums[c]!)}%</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" style={{ ...CELL_LABEL, borderTop: `1px solid ${S.cardBorder}` }} title="Column sum: the region's share of the pool">
              Σ region
            </th>
            {REGIONS.map((r) => <td key={r} style={CELL_SUM}>{pct2(m.colSums[r]!)}%</td>)}
            <td style={{ ...CELL_SUM, fontWeight: 800 }}>{pct2(m.total)}%</td>
          </tr>
        </tfoot>
      </TableScroller>
      <div style={{ fontSize: 11.5, color: S.mutedText, lineHeight: 1.55 }}>
        {estimate ? (
          <>
            <strong>An estimate from public reporting, not Henkel P&amp;L.</strong> A finance file passed
            to <code>scripts/run_production.py --cell-weights</code> replaces it.
            {!documented && ' This run used a version of the estimate other than the one this dashboard documents, so its derivation is not shown here; the QA workbook of that run holds it.'}
          </>
        ) : (
          <>These shares come from the file the production run was given (<code>scripts/run_production.py --cell-weights</code>); the source above says what it holds.</>
        )}{' '}
        Only shares enter PRISM, never euro figures. A cell with share 0 contributes nothing to the roll-up
        however exposed its drivers are: HCB's presence in a region enters here, not through the exposures.
      </div>
      {documented && <CellWeightProvenance />}
    </div>
  );
};

export const ModelSection: FC = () => {
  const { config, configError, simulation, simulationError, loading } = usePrism();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <StatusBanner kind="info">
        Read-only: a parameter change is a code change followed by a production run.
      </StatusBanner>

      {config ? <ParameterCards config={config} /> : (
        <SectionCard size="regular" title="Simulation parameters" icon={SlidersHorizontal}>
          <Muted>
            {loading ? 'Loading the configuration…'
              : configError ? `The model configuration could not be loaded: ${configError}`
                : 'No model configuration is available yet.'}
          </Muted>
        </SectionCard>
      )}

      <SectionCard size="regular"
        title="Aggregation weights"
        icon={SlidersHorizontal}
        description="Force weights scale each force's contribution before the forces compound. A run rolls its category × region cells up with one matrix of gross-profit shares: a category's shift is the share-weighted mean of its row, the portfolio's the share-weighted sum of all cells. Row sums are the category shares, column sums the region shares. The value-chain lens carries no weights: it assigns each driver wholly to its epicentre stage."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {config && (
            <SubBlock label="Force weights">
              <ForceRowsTable label="Force weights" rows={[{ name: 'Weight', values: config.force_weights }]} />
            </SubBlock>
          )}
          {simulation ? <RunCellWeights run={simulation} /> : (
            <Muted>
              {loading ? 'Loading the run…'
                : simulationError ? `The run could not be loaded, so its cell weights cannot be shown: ${simulationError}`
                  : 'There is no run yet, so there are no cell weights to show.'}
            </Muted>
          )}
        </div>
      </SectionCard>
    </div>
  );
};
