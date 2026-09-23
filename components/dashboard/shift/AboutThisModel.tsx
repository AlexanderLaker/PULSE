/**
 * "About this model", the page's footer, closed until opened: the served
 * run's provenance and integrity events, a glossary, how to read a cell's
 * level with the structural pass-through per force, what a probability score
 * means as a Beta prior, what the model holds constant, and the methodology.
 */
import { useState, type FC } from 'react';
import { ChevronDown, Info } from 'lucide-react';
import { BASE_YEAR, FORCES, YEARS, fmtDateUtc, fmtPct } from '@/lib/format';
import { S, HEADLINE_FONT, BODY_FONT, MONO_FONT } from '@/lib/theme';
import { UNCERTAINTY_KAPPA, UNCERTAINTY_PEAK_JITTER } from '@/lib/uncertainty';
import type { ForceName, ModelConfig, SimulationResult } from '@/types';
import { RunDetails } from './RunDetails';

/** The glossary: a term and what it means here. */
const GLOSSARY: Array<[string, string]> = [
  ['GP1', 'Gross Profit 1 (contribution after cost of goods): the profit layer whose shifts the model projects.'],
  ['MC median', 'The middle outcome of all simulated Monte Carlo paths: the central estimate shown in every cell.'],
  ['P10 to P90', 'The range covering 80% of simulated outcomes: 10% of runs land below P10, 10% above P90.'],
  ['Category codes', 'LHC = Laundry & Home Care. FCN Fabric Clean · FCA Fabric Care · FFI Fabric Finishers · LAD Laundry Additives · HDW Hand Dishwash · ADW Auto Dishwash · HSC Hard-Surface Cleaner · TOI Toilet Care · IC Insect Control.'],
  ['Attenuation', 'Dampening factor applied to overlapping drivers so co-occurring effects are not double-counted.'],
  ['Cumulative shift', `Each cell is the compounded level vs ${BASE_YEAR} at that year, not a year-on-year change.`],
];

/** Score k as the Beta(k, 6 - k) prior at uncertainty score 3: its mean and
 *  its 10th and 90th percentiles (scipy.stats.beta). */
const BETA_PRIORS: string[][] = [
  ['1', '(1,5)', '0.167', '0.021', '0.369'],
  ['2', '(2,4)', '0.333', '0.112', '0.584'],
  ['3', '(3,3)', '0.500', '0.247', '0.753'],
  ['4', '(4,2)', '0.667', '0.416', '0.888'],
  ['5', '(5,1)', '0.833', '0.631', '0.979'],
];

/** Force weight x attenuation per force, largest first: how much of a
 *  driver's signal reaches a category before probability, materialisation,
 *  exposure and overlap. */
function passThrough(config: ModelConfig): Array<[ForceName, number]> {
  return FORCES
    .map((f): [ForceName, number] => [f, config.force_weights[f] * config.per_force_attenuation[f]])
    .sort((a, b) => b[1] - a[1]);
}

export const AboutThisModel: FC<{ simulation: SimulationResult | null; config: ModelConfig | null }> = ({
  simulation, config,
}) => {
  const [open, setOpen] = useState(false);
  const run = simulation?.run_meta ?? null;
  return (
    <footer className="mt-8">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 px-5 py-3.5 rounded-2xl text-left"
        style={{ backgroundColor: S.surface, border: `1px solid ${S.cardBorder}`, cursor: 'pointer' }}>
        <span className="flex items-center gap-3">
          <Info size={14} style={{ color: S.primary }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: S.onSurface, fontFamily: HEADLINE_FONT }}>About this model</span>
          <span className="hidden sm:inline" style={{ fontSize: 12, color: S.mutedText }}>
            Monte Carlo with Beta priors · {run
              ? `${run.iterations.toLocaleString('en-US')} iterations × ${run.chains} chains · ${run.driver_count} drivers · `
              : ''}run details &amp; methodology
          </span>
        </span>
        <span className="flex items-center gap-3">
          {run && (
            <span className="hidden sm:inline" style={{ fontSize: 12, color: S.mutedText }}>
              Run #{run.run_id} · {fmtDateUtc(run.run_date)}
            </span>
          )}
          <ChevronDown size={16} style={{ color: S.onSurfaceVariant,
            transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
        </span>
      </button>
      {open && (
        <div className="mt-2 px-5 py-5 rounded-2xl" style={{ backgroundColor: S.surface, border: `1px solid ${S.cardBorder}` }}>
          {simulation && <RunDetails simulation={simulation} />}
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] mb-3"
            style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}>Glossary</div>
          <div className="grid gap-2 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
            {GLOSSARY.map(([term, text]) => (
              <div key={term} className="rounded-xl px-4 py-3" style={{ backgroundColor: S.surfaceLow }}>
                <div className="text-[11px] font-bold mb-1" style={{ color: S.onSurface, fontFamily: HEADLINE_FONT }}>{term}</div>
                <div className="text-[11.5px]" style={{ color: S.onSurfaceVariant, lineHeight: 1.5 }}>{text}</div>
              </div>
            ))}
          </div>
          {/* Why a cell is much smaller than a driver's elicited GP1 share:
              the structural scale chain, so a reader comparing a cell with
              intuition about one driver understands the gap. */}
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] mb-2"
            style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}>Reading the level</div>
          <p className="text-[12px] mb-2" style={{ color: S.mutedText, lineHeight: 1.6, fontFamily: BODY_FONT }}>
            Each driver&rsquo;s elicited &ldquo;share of GP1 it could touch&rdquo; is deliberately
            scaled down before it reaches a category: a driver belongs to 1 of 6 forces
            (&divide;6 averaging) and each force is attenuated (~0.4&ndash;0.5) so overlapping
            drivers aren&rsquo;t double-counted. Net <strong>structural pass-through &asymp; 7%</strong>.
            So a near-certain driver that could touch 20% of a category&rsquo;s GP1 moves that
            category <strong>&asymp;1.4%</strong> at full materialisation, not 20%. Read cells as a
            conservative, comparable index and apply them with the formula
            (GP1<sub>projected</sub> = GP1<sub>actual</sub> &times; (1 + shift)); don&rsquo;t read one cell
            as the raw elicited magnitude. The impact is applied per <strong>category &times; region</strong>:
            a driver only moves the categories and regions it is scored on, and the category
            number is the roll-up of its regions by gross-profit share (weights above).
          </p>
          <div className="rounded-xl px-4 py-3 mb-5" style={{ backgroundColor: S.surfaceLow }}>
            <div className="text-[11px] font-bold mb-1.5" style={{ color: S.onSurface, fontFamily: HEADLINE_FONT }}>
              Structural pass-through per force <span style={{ fontWeight: 400, color: S.mutedText }}>(force weight &times; attenuation; before probability, materialisation, exposure &amp; overlap)</span>
            </div>
            {config && (
              <div className="flex flex-wrap gap-x-5 gap-y-1">
                {passThrough(config).map(([f, v]) => (
                  <span key={f} className="inline-flex items-baseline gap-1.5">
                    <span style={{ fontSize: 11.5, color: S.onSurfaceVariant }}>{f}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: S.onSurface, fontFamily: MONO_FONT }}>{fmtPct(v, 1)}</span>
                  </span>
                ))}
              </div>
            )}
            <div className="text-[11px] mt-1.5" style={{ color: S.mutedText, lineHeight: 1.5 }}>
              These are the values production runs use; changing them is a code change followed by a new production run. Timing: P10 to P90 bands are magnitude uncertainty from the Monte&nbsp;Carlo, with each driver&rsquo;s spread set by its uncertainty score; a per-iteration peak-year jitter of up to &plusmn;{Math.max(...UNCERTAINTY_PEAK_JITTER)} years, also set by that score, gives velocity bands their timing spread. Confidence describes the evidence and is shown with the driver; it does not drive the bands.
            </div>
          </div>
          {/* What a 1–5 probability score means as a Beta prior: the scale
              deliberately shrinks against overconfidence (a "5" is about
              five in six, not certainty). */}
          <div className="rounded-xl px-4 py-3 mb-5" style={{ backgroundColor: S.surfaceLow }}>
            <div className="text-[11px] font-bold mb-1.5" style={{ color: S.onSurface, fontFamily: HEADLINE_FONT }}>
              What a probability score means <span style={{ fontWeight: 400, color: S.mutedText }}>(1&ndash;5 &rarr; Beta prior)</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="text-[11.5px]" style={{ borderCollapse: 'collapse', fontFamily: MONO_FONT, minWidth: 300 }}>
                <thead>
                  <tr style={{ color: S.mutedText }}>
                    {['Score', 'Beta(α,β)', 'Mean', 'P10', 'P90'].map((h) => (
                      <th key={h} style={{ textAlign: 'right', padding: '2px 10px 4px', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody style={{ color: S.onSurface }}>
                  {BETA_PRIORS.map((row) => (
                    <tr key={row[0]}>
                      {row.map((v, i) => (
                        <td key={i} style={{ textAlign: 'right', padding: '2px 10px' }}>{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-[11px] mt-1.5" style={{ color: S.mutedText, lineHeight: 1.5 }}>
              The scale never reaches 0 or 1: a deliberate shrinkage against overconfidence (a &ldquo;5&rdquo; materialises at mean 0.83, not certainty). The table shows the prior at uncertainty score 3 (&alpha;+&beta;={UNCERTAINTY_KAPPA[3]}). Other uncertainty scores keep the mean and narrow or widen the band, from &alpha;+&beta;={UNCERTAINTY_KAPPA[0]} at score 0 to {UNCERTAINTY_KAPPA[5]} at score 5.
            </div>
          </div>
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] mb-2"
            style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}>What the model holds constant</div>
          {/* The ceteris-paribus design of docs/adr/0002-relative-shifts-ceteris-paribus.md. */}
          <p className="text-[12px] mb-4" style={{ color: S.mutedText, lineHeight: 1.6, fontFamily: BODY_FONT }}>
            PRISM holds strategy constant. The simulation propagates external drivers only and
            deliberately excludes management response: price increases, innovation launches,
            mix shifts, competitive reaction. A negative total therefore means &ldquo;headwind to
            today&rsquo;s business if nothing changes&rdquo;, not &ldquo;this pool will shrink&rdquo;.
            Strategic response belongs to the reader, not the engine.
          </p>
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] mb-2"
            style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}>Methodology</div>
          {/* A three-line plain read first, so the curious reader gets the gist before the technical prose. */}
          <ul className="text-[12px] mb-3" style={{ color: S.onSurfaceVariant, lineHeight: 1.55, fontFamily: BODY_FONT, margin: '0 0 12px', paddingLeft: 18 }}>
            <li style={{ marginBottom: 3 }}>Each cell is the cumulative % shift vs {BASE_YEAR} at that year: a compounded level, not a year-on-year change.</li>
            <li style={{ marginBottom: 3 }}>Totals are category-weighted averages (not sums), so the portfolio number reads as one interpretable shift.</li>
            <li>The model holds Henkel and competitor strategy constant: it propagates external drivers only.</li>
          </ul>
          <p className="text-[12px]" style={{ color: S.mutedText, lineHeight: 1.6, fontFamily: BODY_FONT }}>
            <span style={{ fontWeight: 600, color: S.onSurfaceVariant }}>Methodology:</span>{' '}
            All cell values in this matrix are produced by the Monte Carlo engine
            {run ? (
              <>
                {' '}(<code style={{ fontFamily: MONO_FONT }}>{run.engine_name}</code>,{' '}
                {run.iterations.toLocaleString('en-US')} iterations &times; {run.chains} chains, Gaussian-copula
                dependencies, {run.driver_count} drivers)
              </>
            ) : ' (Gaussian-copula dependencies)'}. The driver
            probability priors are <strong>structured expert judgment</strong> (Beta shapes set
            from analyst 1&ndash;5 scores); the model expresses uncertainty in those judgments and
            does not learn or update from data. Each cell is a{' '}
            <strong>cumulative shift level vs {BASE_YEAR}</strong> at that measurement year, i.e. the
            compounded impact from {YEARS[0]} up to that year, not a year-on-year change.
            The Force, Value Chain and Region lenses are per-year decompositions written by
            the engine. <strong>Region is a dimension of the simulation, not only a lens</strong>: the engine solves
            a category &times; region &times; year tensor (each driver weighted by category
            exposure &times; regional exposure) and rolls a category&rsquo;s regional shifts up
            with its own row of the cell weights, so a regionally concentrated driver only
            moves its regions&rsquo; slice of the pool; each category&rsquo;s drill-down shows
            its regional shifts. The Force and Region shares use the drivers&rsquo; 0&ndash;5
            exposure scores with the force weights and the run&rsquo;s cell weights; the{' '}
            <strong>Value Chain lens is a categorical epicentre partition</strong>: each
            driver&rsquo;s contribution is assigned wholly to the single stage where experts
            located its impact epicentre, with no split across stages and no modelled
            propagation up or down the chain (holding responses constant, propagation would
            be a management or market story, not a driver property). Every row total equals
            the MC median shift for that (category, year) and is therefore identical across
            all four lenses. <strong>Column and grand totals are category-weighted
            averages</strong> of the per-category values, using the run&rsquo;s category
            shares (the row sums of its cell weights), so totals reflect the portfolio mix
            rather than simple sums of 13 categories. Because the decomposition shares sum
            to 1 per category, the grand total for any given year is identical across Time
            Path, Force, Value Chain and Region views. The dashboard neither calibrates nor
            anchors any cell; it computes only the portfolio-weighted totals, from the
            run&rsquo;s own weights.
          </p>
        </div>
      )}
    </footer>
  );
};
