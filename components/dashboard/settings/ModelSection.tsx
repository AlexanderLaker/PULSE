/**
 * The Model section of the Settings sheet, read-only: the parameters from
 * GET /api/v1/config and the served run's cell weights with their marginals,
 * basis and derivation. The configuration is code (prism/config.py).
 */
import type { CSSProperties, FC } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import usePrism from '@/hooks/usePrism';
import SectionCard from '@/components/dashboard/SectionCard';
import { S, BODY_FONT, FIGURES } from '@/lib/theme';
import { BASE_YEAR, CATEGORY_NAMES, FORCES, NO_VALUE, REGIONS, categoryFullName } from '@/lib/format';
import { cellWeightsBasis, matchesEstimate } from '@/lib/cellWeights';
import { categoryShares } from '@/lib/shiftMatrix';
import { UNCERTAINTY_PEAK_JITTER } from '@/lib/uncertainty';
import type { ForceName, ModelConfig, SimulationResult } from '@/types';
import {
  CELL_LABEL, CELL_NUM, CELL_SUM, CELL_TH, LABEL_STYLE, Muted, ROW_LABEL, StatusBanner, SubBlock,
  TableScroller,
} from './parts';
import { CellWeightProvenance } from './CellWeightProvenance';

/** A column headed by a force, in full; a long name wraps rather than widening the table. */
const FORCE_TH: CSSProperties = { ...CELL_TH, whiteSpace: 'normal', minWidth: 72, verticalAlign: 'bottom' };

/** A number to fixed digits; the missing-value mark when there is none. */
const fixed = (v: number | undefined, digits: number): string =>
  typeof v === 'number' && Number.isFinite(v) ? v.toFixed(digits) : NO_VALUE;

/** A share in percent with two decimals: several cells hold less than 0.1 %. */
const pct2 = (share: number): string => (share * 100).toFixed(2);

/** The rank correlation of two Gaussian-copula draws whose latent correlation
 *  is rho: (6 / pi) asin(rho / 2), whatever their marginals (the QA workbook
 *  states the same, prism/workbook.py). */
const rankCorrelation = (rho: number): number => (6 / Math.PI) * Math.asin(rho / 2);

/** Per-force values: one row per parameter, one column per force. */
const ForceRowsTable: FC<{
  label: string;
  rows: Array<{ name: string; values: Record<ForceName, number> }>;
}> = ({ label, rows }) => (
  <TableScroller label={label}>
    <thead>
      <tr>
        <th scope="col" style={{ ...CELL_LABEL, backgroundColor: S.surfaceContainer }}>
          <span className="sr-only">Parameter</span>
        </th>
        {FORCES.map((f) => <th key={f} scope="col" style={FORCE_TH}>{f}</th>)}
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
        <th scope="col" style={{ ...CELL_LABEL, backgroundColor: S.surfaceContainer, textTransform: 'none', letterSpacing: 0 }}>
          row \ col
        </th>
        {FORCES.map((f) => <th key={f} scope="col" style={FORCE_TH}>{f}</th>)}
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
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, margin: 0,
};

/** One read-only parameter of the definition list: its name, its value and what it means. */
const Parameter: FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <dt style={LABEL_STYLE}>{label}</dt>
    <dd style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontFamily: BODY_FONT, fontSize: 14, fontWeight: 600, color: S.onSurface, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
      {hint && <span style={{ fontSize: 11, lineHeight: 1.55, color: S.mutedText }}>{hint}</span>}
    </dd>
  </div>
);

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
        <dl style={PARAM_GRID}>
          <Parameter label="Path horizon" value={horizon} hint="Relative-shift paths over these years." />
          <Parameter label="Base year" value={String(BASE_YEAR)} hint="Materialisation anchor." />
          <Parameter
            label="Peak-year jitter"
            value={jitter ? 'On' : 'Off'}
            hint={jitter
              ? `Each iteration moves every driver's peak year by up to the width its uncertainty score sets, ${Math.min(...UNCERTAINTY_PEAK_JITTER)} to ${Math.max(...UNCERTAINTY_PEAK_JITTER)} years.`
              : 'Every driver peaks in its scored year in every iteration.'}
          />
        </dl>
      </SectionCard>

      <SectionCard size="regular"
        title="Copula dependence (Gaussian)"
        icon={SlidersHorizontal}
        description={`Drivers do not land independently: when one happens, related ones are more likely to happen too, and these settings say how strongly. How driver correlations flow through the Monte Carlo. The correlations are latent-scale: they set the co-movement of the underlying Gaussian variables, not of the Beta-distributed probability draws, whose rank correlation is a little lower (${fixed(rankCorrelation(config.within_force_rho), 2)} for a latent ${fixed(config.within_force_rho, 2)} within a force). They lie between 0 and 1, so negative dependence cannot be expressed. The production run refuses a setting that is not positive definite on the loaded drivers rather than repairing it silently.`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <dl style={PARAM_GRID}>
            <Parameter
              label="Within-force correlation (rho)"
              value={fixed(config.within_force_rho, 2)}
              hint="Drivers of the same force tend to happen together; this number says how strongly. Correlation between two drivers of the same force."
            />
          </dl>
          <SubBlock
            label="Force correlation matrix"
            hint="How strongly drivers of two different forces happen together. Correlation between drivers of two forces; positive definite as entered on the current drivers."
          >
            <ForceMatrixTable matrix={config.force_correlation_matrix} digits={2} label="Force correlation matrix" />
          </SubBlock>
        </div>
      </SectionCard>

      <SectionCard size="regular"
        title="Attenuation & overlap"
        icon={SlidersHorizontal}
        description={`Two drivers can describe the same mechanism, so adding their effects would count it twice; the engine trims that double counting. It dampens each force's combined driver effect with a per-force attenuation, 0.5 × (1 − mean between-force overlap of that force's row), and dampens the drivers within a force by their within-force overlap, for the mechanisms they share. Source: ${config.overlap_correction_source}, a structured-judgment overlap correction built on the drivers' category exposures.`}
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
            hint="How much of one force's story another force already tells. The input the attenuation is derived from; the engine reads the attenuation. Read row → column: the share of the row force's signal already captured by the column force. Asymmetric by design (a narrow force is covered by a broad one more than the other way round), bounded 0–0.45. The within-force overlap above covers the diagonal."
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
      ...FIGURES, fontSize: 10.5, fontWeight: 700,
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
  // The run's own marginals: its category shares (row sums) and region shares (column sums).
  const categoryShare = categoryShares(run.category_weights_used, CATEGORY_NAMES);
  const total = categoryShare.reduce((sum, w) => sum + w, 0);
  // The run's own label says what the weights are; the graded derivation
  // below documents the current estimate, so it shows only when the run's
  // shares are that estimate.
  const estimate = cellWeightsBasis(run.cell_weights_source) === 'estimate';
  const documented = estimate && matchesEstimate(run.cell_weights_used);
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
            <th scope="col" style={CELL_LABEL}>Category</th>
            {REGIONS.map((r) => <th key={r} scope="col" style={CELL_TH}>{r}</th>)}
            <th scope="col" style={CELL_TH} title="Row sum: the category's share of the pool">Σ category</th>
          </tr>
        </thead>
        <tbody>
          {CATEGORY_NAMES.map((c, i) => (
            <tr key={c}>
              <th scope="row" style={{ ...CELL_LABEL, borderTop: `1px solid ${S.cardBorder}` }}>{categoryFullName(c)}</th>
              {REGIONS.map((r) => <td key={r} style={CELL_NUM}>{pct2(run.cell_weights_used[c]![r]!)}</td>)}
              <td style={CELL_SUM}>{pct2(categoryShare[i]!)}%</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" style={{ ...CELL_LABEL, borderTop: `1px solid ${S.cardBorder}` }} title="Column sum: the region's share of the pool">
              Σ region
            </th>
            {REGIONS.map((r) => <td key={r} style={CELL_SUM}>{pct2(run.region_weights_used[r]!)}%</td>)}
            <td style={{ ...CELL_SUM, fontWeight: 800 }}>{pct2(total)}%</td>
          </tr>
        </tfoot>
      </TableScroller>
      <div style={{ fontSize: 11, lineHeight: 1.55, color: S.mutedText }}>
        Σ category is the row sum: the category's share of the pool. Σ region is the column sum: the region's share
        of the pool.
      </div>
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
        description="A bigger share of gross profit counts for more: these weights say how much each force, and each category and region, counts in the result. Force weights scale each force's contribution before the forces compound. A run rolls its category × region cells up with one matrix of gross-profit shares: a category's shift is the share-weighted mean of its row, the portfolio's the share-weighted sum of all cells. Row sums are the category shares, column sums the region shares. The value-chain lens carries no weights: it assigns each driver wholly to its epicentre stage."
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
