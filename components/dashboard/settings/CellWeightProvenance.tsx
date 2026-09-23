/**
 * How the estimated cell-weight mix is built: the graded derivation from
 * lib/cellWeightProvenance.ts, block by block, with every input's grade
 * (B public reporting, E defensible but unverified, G low-confidence guess).
 */
import type { CSSProperties, FC } from 'react';
import { S, HEADLINE_FONT, MONO_FONT } from '@/lib/theme';
import { CATEGORY_NAMES, fmtPct } from '@/lib/format';
import {
  BLOCK_SPLIT, CATEGORY_MIX, ESTIMATE_MARGINALS, ESTIMATE_VERSION, GRADE_LEGEND, MARGIN_INDEX,
  MARGIN_INDEX_NOTE, REGION_MIX, REGION_MIX_NOTE, type Grade,
} from '@/lib/cellWeightProvenance';
import { CELL_TH, TableScroller } from './parts';

// ── How the estimated mix is built ──────────────────────────────────
// Every number comes from the generated record (lib/cellWeightProvenance.ts);
// none is repeated here.

const GRADE_COLOR: Record<Grade, { bg: string; fg: string }> = {
  B: { bg: S.successContainer, fg: S.success },
  E: { bg: S.amberContainer, fg: S.onAmberContainer },
  G: { bg: S.errorContainer, fg: S.onErrorContainer },
};

/** The grade of one input of the cell-weight estimate (B, E or G). */
const InputGradeChip: FC<{ grade: Grade }> = ({ grade }) => (
  <span
    title={`${grade}: ${GRADE_LEGEND[grade]}`}
    style={{
      display: 'inline-block', minWidth: 10, textAlign: 'center',
      fontFamily: MONO_FONT, fontSize: 10, fontWeight: 700,
      padding: '1px 7px', borderRadius: 999,
      backgroundColor: GRADE_COLOR[grade].bg, color: GRADE_COLOR[grade].fg,
    }}
  >
    {grade}
  </span>
);

const PROV_TEXT: CSSProperties = { fontSize: 11.5, lineHeight: 1.6, color: S.mutedText };
const PROV_HEAD: CSSProperties = {
  fontFamily: HEADLINE_FONT, fontSize: 10.5, fontWeight: 800,
  letterSpacing: '0.06em', textTransform: 'uppercase', color: S.onSurfaceVariant,
};
const PROV_TH_LEFT: CSSProperties = { ...CELL_TH, textAlign: 'left' };
const PROV_TH_MID: CSSProperties = { ...CELL_TH, textAlign: 'center' };
const PROV_GROUP_ROW: CSSProperties = {
  ...CELL_TH, textAlign: 'left', textTransform: 'none', letterSpacing: '0.03em',
  fontSize: 11, borderTop: `1px solid ${S.cardBorder}`,
};
const PROV_NUM: CSSProperties = {
  fontFamily: MONO_FONT, fontSize: 11.5, color: S.onSurface,
  padding: '5px 10px', textAlign: 'right', whiteSpace: 'nowrap',
  fontVariantNumeric: 'tabular-nums', borderTop: `1px solid ${S.cardBorder}`,
};
const PROV_ROW_LABEL: CSSProperties = {
  fontFamily: HEADLINE_FONT, fontSize: 11, fontWeight: 700, color: S.onSurface,
  padding: '5px 10px', textAlign: 'left', whiteSpace: 'nowrap',
  borderTop: `1px solid ${S.cardBorder}`,
};
const PROV_GRADE_CELL: CSSProperties = {
  padding: '5px 10px', textAlign: 'center', borderTop: `1px solid ${S.cardBorder}`,
};
const PROV_NOTE_CELL: CSSProperties = {
  fontSize: 10.5, lineHeight: 1.5, color: S.mutedText,
  padding: '5px 10px', textAlign: 'left', minWidth: 210,
  borderTop: `1px solid ${S.cardBorder}`,
};

/** `obj`'s keys in the given order first, then any others. */
const orderedKeys = (obj: Record<string, unknown>, order: string[]): string[] => [
  ...order.filter((k) => k in obj),
  ...Object.keys(obj).filter((k) => !order.includes(k)),
];

const BLOCK_SHARES: Record<string, number> = BLOCK_SPLIT.shares;
const PROV_CATEGORIES = orderedKeys(CATEGORY_MIX, CATEGORY_NAMES);
const PROV_REGION_CATEGORIES = orderedKeys(REGION_MIX, CATEGORY_NAMES);
const PROV_REGIONS = Object.keys(ESTIMATE_MARGINALS.region);
const PROV_CELL_COUNT = PROV_CATEGORIES.length * PROV_REGIONS.length;
const PROV_REGION_LINE = Object.entries(ESTIMATE_MARGINALS.region)
  .map(([r, w]) => `${r} ${fmtPct(w)}`).join(' · ');
const PROV_TOP_CATEGORIES = Object.entries(ESTIMATE_MARGINALS.category)
  .sort((a, b) => b[1] - a[1]).slice(0, 3)
  .map(([c, w]) => `${c} ${fmtPct(w)}`).join(' · ');

/** The graded derivation of the estimated mix. */
export const CellWeightProvenance: FC = () => (
  <details style={{
    border: `1px solid ${S.cardBorder}`, borderRadius: 10,
    backgroundColor: S.surfaceLow, padding: '10px 12px',
  }}>
    <summary style={{
      cursor: 'pointer', fontFamily: HEADLINE_FONT, fontSize: 11.5,
      fontWeight: 700, color: S.onSurfaceVariant,
    }}>
      How these {PROV_CELL_COUNT} shares were built: {PROV_CATEGORIES.length} category mixes,{' '}
      {Object.keys(MARGIN_INDEX).length} margin indices, {PROV_REGION_CATEGORIES.length} regional mixes, each graded
    </summary>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
      <div style={PROV_TEXT}>
        These {PROV_CELL_COUNT} shares are an <strong>estimate</strong> of the HCB gross-profit mix, built from
        public reporting and category knowledge. They are not Henkel P&amp;L: a finance file passed
        to <code>scripts/run_production.py --cell-weights</code> replaces them. Each cell is the category's share
        of its block, times the block's share of HCB, times a GP1 margin index, times that category's own
        regional mix, normalised to 1.
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        {(Object.keys(GRADE_LEGEND) as Grade[]).map((g) => (
          <span key={g} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <InputGradeChip grade={g} />
            <span style={{ fontSize: 10.5, lineHeight: 1.5, color: S.mutedText }}>{GRADE_LEGEND[g]}</span>
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={PROV_HEAD}>Block split</span>
        <TableScroller label="Block split: each block's share of HCB gross profit">
          <thead>
            <tr>
              {Object.keys(BLOCK_SHARES).map((b) => <th key={b} style={CELL_TH}>{b}</th>)}
              <th style={PROV_TH_MID}>Grade</th>
              <th style={PROV_TH_LEFT}>Basis</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              {Object.entries(BLOCK_SHARES).map(([b, w]) => <td key={b} style={PROV_NUM}>{fmtPct(w)}</td>)}
              <td style={PROV_GRADE_CELL}><InputGradeChip grade={BLOCK_SPLIT.grade} /></td>
              <td style={PROV_NOTE_CELL}>{BLOCK_SPLIT.note}</td>
            </tr>
          </tbody>
        </TableScroller>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={PROV_HEAD}>Category mix and GP1 margin index</span>
        <span style={PROV_TEXT}>{MARGIN_INDEX_NOTE}</span>
        <TableScroller label="Category mix: each category's share of its block and its GP1 margin index">
          <thead>
            <tr>
              <th style={PROV_TH_LEFT}>Category</th>
              <th style={CELL_TH} title="The category's share of its block, before the margin index and the regional mix">
                Share of block
              </th>
              <th style={PROV_TH_MID}>Grade</th>
              <th style={CELL_TH} title="GP1 gross margin relative to the HCB average (1.00 = average)">
                GP1 index
              </th>
              <th style={PROV_TH_MID}>Grade</th>
              <th style={PROV_TH_LEFT}>Basis</th>
            </tr>
          </thead>
          {Object.keys(BLOCK_SHARES).map((b) => (
            <tbody key={b}>
              <tr>
                <td colSpan={6} style={PROV_GROUP_ROW}>
                  {b} · {fmtPct(BLOCK_SHARES[b])} of HCB gross profit
                </td>
              </tr>
              {PROV_CATEGORIES.filter((c) => CATEGORY_MIX[c].block === b).map((c) => {
                const mix = CATEGORY_MIX[c];
                const margin = MARGIN_INDEX[c];
                return (
                  <tr key={c}>
                    <td style={PROV_ROW_LABEL}>{c}</td>
                    <td style={PROV_NUM}>{fmtPct(mix.shareOfBlock)}</td>
                    <td style={PROV_GRADE_CELL}><InputGradeChip grade={mix.grade} /></td>
                    <td style={PROV_NUM}>{margin ? margin.index.toFixed(2) : ''}</td>
                    <td style={PROV_GRADE_CELL}>{margin ? <InputGradeChip grade={margin.grade} /> : null}</td>
                    <td style={PROV_NOTE_CELL}>{mix.note}</td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </TableScroller>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={PROV_HEAD}>Regional mix inside each category</span>
        <span style={PROV_TEXT}>{REGION_MIX_NOTE}</span>
        <TableScroller label="Region mix: each category's own regional split, the reason the matrix is not separable">
          <thead>
            <tr>
              <th style={PROV_TH_LEFT}>Category</th>
              {PROV_REGIONS.map((r) => <th key={r} style={CELL_TH}>{r}</th>)}
              <th style={PROV_TH_MID}>Grade</th>
              <th style={PROV_TH_LEFT}>Basis</th>
            </tr>
          </thead>
          <tbody>
            {PROV_REGION_CATEGORIES.map((c) => {
              const rm = REGION_MIX[c];
              return (
                <tr key={c}>
                  <td style={PROV_ROW_LABEL}>{c}</td>
                  {PROV_REGIONS.map((r) => <td key={r} style={PROV_NUM}>{fmtPct(rm.mix[r] ?? 0)}</td>)}
                  <td style={PROV_GRADE_CELL}><InputGradeChip grade={rm.grade} /></td>
                  <td style={PROV_NOTE_CELL}>{rm.note}</td>
                </tr>
              );
            })}
          </tbody>
        </TableScroller>
      </div>

      <div style={PROV_TEXT}>
        Normalised, the estimate lands on {PROV_REGION_LINE} of the gross-profit pool. Europe's share is the
        number that matters most, because each category is rolled up on its own regional mix, so the region
        split is what moves the category results. The heaviest categories are {PROV_TOP_CATEGORIES}.
      </div>
      <div style={{ fontFamily: MONO_FONT, fontSize: 10, color: S.mutedText }}>
        estimate version {ESTIMATE_VERSION}
      </div>
    </div>
  </details>
);
