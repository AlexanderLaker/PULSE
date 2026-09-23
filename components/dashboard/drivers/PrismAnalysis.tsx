/**
 * The PRISM Analysis card: the per-driver reading, authored prose around
 * figures that come from the model's attribution at the score means,
 * reconciled to the portfolio median the basis line names
 * (docs/DRIVER_ANALYSIS.md).
 *
 * Paragraphs are separated by a blank line. A paragraph that opens with one
 * of the four labels gets the label as a small heading, the basis line
 * ("Figures: ...") is set small and muted, and any other paragraph renders
 * as plain prose.
 */
import React, { type FC } from 'react';
import usePrism from '@/hooks/usePrism';
import { fmtShift } from '@/lib/format';
import { S, HEADLINE_FONT } from '@/lib/theme';

const ANALYSIS_LABELS = ['Weight in the answer', 'Where it lands', 'When it lands', 'What the band hinges on'];
const ANALYSIS_BASIS_LABEL = 'Figures';
export const ANALYSIS_FOOTNOTE =
  'Attribution at the score means, reconciled to the portfolio median in the basis line; a reading authored on those figures. Read as exposure if nobody acts, not as a forecast.';

export function splitAnalysis(text: string): { label: string | null; body: string }[] {
  const labels = [...ANALYSIS_LABELS, ANALYSIS_BASIS_LABEL];
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const label = labels.find((l) => p.startsWith(`${l}:`));
      return label ? { label, body: p.slice(label.length + 1).trim() } : { label: null, body: p };
    });
}

/** The portfolio median a reading's basis line was reconciled to: {year, percent}; null without one. */
export function basisMedian(text: string): { year: string; percent: number } | null {
  const m = /(\d{4}) portfolio median of (-?\d+(?:\.\d+)?) percent/.exec(text);
  return m ? { year: m[1]!, percent: Number(m[2]) } : null;
}

export const PrismAnalysisReading: FC<{ text: string }> = ({ text }) => {
  const { simulation } = usePrism();
  const paragraphs = splitAnalysis(text);
  // The figures of a reading belong to the run its basis line names. When the
  // served run's median differs at the shown precision, the reading says so.
  const basis = basisMedian(text);
  const served = basis ? simulation?.totals.portfolio[basis.year]?.median : undefined;
  const stale = basis != null && served != null && (served * 100).toFixed(1) !== basis.percent.toFixed(1);
  if (paragraphs.length === 0) {
    return (
      <span style={{ color: S.mutedText, fontWeight: 400, fontStyle: 'italic' }}>
        No PRISM Analysis available for this driver.
      </span>
    );
  }
  return (
    <div data-testid="prism-analysis" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {paragraphs.map(({ label, body }, i) => (
        label === ANALYSIS_BASIS_LABEL ? (
          <React.Fragment key={i}>
            <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5, color: S.mutedText, fontWeight: 500 }}>
              <span style={{ fontWeight: 700 }}>{ANALYSIS_BASIS_LABEL}:</span> {body}
            </p>
            {stale && (
              <p role="note" style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5, color: S.onAmberContainer,
                backgroundColor: S.amberContainer, padding: '6px 10px', borderRadius: 8 }}>
                The run shown in the Shift Analysis has a {basis!.year} portfolio median of {fmtShift(served)}, so
                the figures in this reading come from an earlier run. They are brought up to date with the next
                analysis build.
              </p>
            )}
          </React.Fragment>
        ) : (
          <div key={i}>
            {label && (
              <div style={{
                fontFamily: HEADLINE_FONT, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: S.primary, marginBottom: 4,
              }}>
                {label}
              </div>
            )}
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: S.onSurface, fontWeight: 450 }}>
              {body}
            </p>
          </div>
        )
      ))}
    </div>
  );
};
