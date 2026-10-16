/**
 * The Shift Matrix table: one row per category, one column per year or
 * attribution share, the totals, the hover card with each cell's band, and
 * the peak-stress explainer of the toolbar.
 */
import React, { useId, useMemo, useState, type FC } from 'react';
import { Info } from 'lucide-react';
import {
  BASE_YEAR, HORIZON, NO_VALUE, fmtShift, fmtPct, shiftArrow, shiftColor, heatFill, heatText, heatScaleFor,
} from '@/lib/format';
import {
  S, SHADOW, EXPANSION_RGB, CONTRACTION_RGB, HEADLINE_FONT, BODY_FONT, FIGURES,
} from '@/lib/theme';
import type { PercentileDistribution } from '@/types';
import type { CellMap, MatrixRow } from './matrixModel';

interface MatrixProps {
  columns: string[];
  rows: MatrixRow[];
  data: CellMap;
  /** The lens, as the small uppercase label of the subtitle bar. */
  subtitleLabel: string;
  /** What the lens shows, in a sentence after the label. */
  subtitleText: string;
  /** The table's caption for screen readers: the lens and the year. */
  caption: string;
  /** The card, for an image export. */
  cardRef?: React.Ref<HTMLDivElement>;
  /** What an image export or a print of the card must carry with its figures
   *  (what the bands cover; the cell-weight estimate): the page shows the
   *  same sentences above the card, so on screen they stay hidden here. */
  exportNotes?: string[];
  /** With row totals the matrix gets a total column and a grand total. */
  rowTotals?: Record<string, number | null>;
  colTotals: Record<string, number | null>;
  grandTotal: number | null;
  /** Header of the total column; it names the lens year, e.g. "Total 2035". */
  rowTotalLabel: string;
  /** What a cell's value is, as the hover card names it: "Median" only where
   *  the cell is the simulated median (the unfiltered Time path). */
  valueLabel: string;
  /** Per-cell distributions; with them the hover shows the P10 and P90 band. */
  cellDetails?: Record<string, Record<string, PercentileDistribution | null>>;
  /** Opens the drill-down of a row; any cell of the row does. */
  onRowClick: (rowId: string) => void;
  /** Shown in the hover where a cell has no band. */
  noBandsNote?: string;
  /** The controls, drawn as the card's top bar so they sit on the evidence they change. */
  toolbar: React.ReactNode;
}

export const Matrix: FC<MatrixProps> = ({
  columns, rows, data, subtitleLabel, subtitleText, caption, cardRef, exportNotes,
  rowTotals, colTotals, grandTotal, rowTotalLabel,
  valueLabel, cellDetails, onRowClick, noBandsNote, toolbar,
}) => {
  const grouped = useMemo(() => {
    const map: Record<string, MatrixRow[]> = {};
    rows.forEach((r) => {
      (map[r.group] ??= []).push(r);
    });
    return map;
  }, [rows]);

  // The hovered cell and its anchor (top centre). The tooltip is
  // fixed-positioned, so the horizontally scrolling table cannot clip it.
  const [hover, setHover] = useState<{
    rowId: string;
    colId: string;
    rowLabel: string;
    x: number;
    y: number;
  } | null>(null);

  const onCellEnter = (e: React.MouseEvent<HTMLTableCellElement>, rowId: string, colId: string, rowLabel: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHover({ rowId, colId, rowLabel, x: rect.left + rect.width / 2, y: rect.top });
  };
  const onCellLeave = () => setHover(null);

  // The hovered row: any of its cells opens the drill-down, so the whole row
  // lights up.
  const [hoverRow, setHoverRow] = useState<string | null>(null);

  // The heat ramp saturates at the 95th percentile of |value| in this view
  // (at least 2%), so structure within the view stays visible; the legend
  // states the scale.
  const viewScale = useMemo(
    () => heatScaleFor(rows.flatMap((r) => columns.map((c) => data[r.id]?.[c] ?? null))),
    [rows, columns, data],
  );

  const showTotalCol = !!rowTotals && Object.values(rowTotals).some((v) => v != null);
  /** The value's name inside a sentence, for the cells' accessible labels. */
  const valueName = valueLabel.charAt(0).toLowerCase() + valueLabel.slice(1);
  const totalColSpan = columns.length + (showTotalCol ? 1 : 0) + 1;

  return (
    <div
      ref={cardRef}
      className="rounded-2xl"
      style={{
        backgroundColor: S.surface,
        boxShadow: SHADOW.card,
      }}
    >
      {/* The controls are chrome: left out of print and of the image export. */}
      <div
        data-print-hide
        className="rounded-t-2xl px-4 md:px-6 py-4 flex items-center justify-between gap-x-6 gap-y-3 flex-wrap"
        style={{
          backgroundColor: S.surface,
          borderBottom: `1px solid ${S.cardBorder}`,
        }}
      >
        {toolbar}
      </div>
      {/* The subtitle bar: the lens as a short label, what it shows as a
          sentence. It tops the card in print and in the image export, where
          the toolbar is left out. */}
      <div
        className="px-4 md:px-6 py-3.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 print:rounded-t-2xl [[data-exporting]_&]:rounded-t-2xl"
        style={{ backgroundColor: S.surfaceLow, color: S.onSurfaceVariant }}
      >
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            fontFamily: HEADLINE_FONT,
            whiteSpace: 'nowrap',
          }}
        >
          {subtitleLabel}
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 500, lineHeight: 1.5, fontFamily: BODY_FONT }}>
          {subtitleText}
        </span>
      </div>

      <div className="overflow-x-auto relative">
        <table
          className="w-full"
          style={{
            borderCollapse: 'separate',
            borderSpacing: 0,
            fontFamily: BODY_FONT,
          }}
        >
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th
                className="text-left px-6 py-4 text-[11px] font-bold uppercase tracking-[0.12em] sticky left-0 z-10"
                style={{
                  backgroundColor: S.surface,
                  color: S.onSurfaceVariant,
                  minWidth: 180,
                }}
              >
                Category
              </th>
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-3 py-4 text-[11px] font-bold uppercase tracking-[0.08em] text-center"
                  style={{ color: S.onSurfaceVariant, minWidth: 96 }}
                >
                  {col}
                </th>
              ))}
              {showTotalCol && (
                <th
                  className="px-3 py-4 text-[11px] font-bold uppercase tracking-[0.12em] text-center"
                  style={{
                    color: S.onSurface,
                    minWidth: 104,
                    backgroundColor: S.surfaceContainer,
                    borderLeft: `2px solid ${S.cardBorderStrong}`,
                  }}
                >
                  {rowTotalLabel}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {Object.entries(grouped).map(([groupName, groupRows], gIdx) => (
              <React.Fragment key={groupName}>
                <tr>
                  <td
                    colSpan={totalColSpan}
                    className="px-6 py-1 text-[11px] font-bold uppercase tracking-[0.14em]"
                    style={{
                      backgroundColor: gIdx === 0 ? S.surfaceLow : S.surfaceContainer,
                      color: S.onSurfaceVariant,
                      fontFamily: HEADLINE_FONT,
                    }}
                  >
                    {groupName}
                  </td>
                </tr>
                {groupRows.map((row) => {
                  const isRowHover = hoverRow === row.id;
                  const rt = rowTotals?.[row.id] ?? null;
                  return (
                  <tr
                    key={row.id}
                    onClick={() => onRowClick(row.id)}
                    onMouseEnter={() => setHoverRow(row.id)}
                    onMouseLeave={() => setHoverRow(null)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td
                      className="px-6 py-1 text-[13px] font-semibold sticky left-0 z-10"
                      style={{
                        backgroundColor: isRowHover ? S.surfaceLow : S.surface,
                        color: S.primary,
                        fontFamily: BODY_FONT,
                        transition: 'color 0.15s ease, background-color 0.15s ease',
                        boxShadow: isRowHover ? `inset 3px 0 0 ${S.primary}` : 'none',
                      }}
                    >
                      <span style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8 }}>
                        {/* The keyboard and screen-reader entry to the drill-down
                            is a real button in the first cell, so the row keeps
                            its table semantics; the mouse can click anywhere on
                            the row. */}
                        <button
                          type="button"
                          className="shift-row-open"
                          onClick={(e) => { e.stopPropagation(); onRowClick(row.id); }}
                          onFocus={() => setHoverRow(row.id)}
                          onBlur={() => setHoverRow(null)}
                          aria-label={`Open ${row.label} detail: fan chart and contributing drivers`}
                          style={{
                            all: 'unset', cursor: 'pointer',
                            textDecoration: isRowHover ? 'underline' : 'none',
                            textUnderlineOffset: '3px',
                          }}
                        >
                          {row.label}
                        </button>
                        {row.code && (
                          <span
                            style={{
                              ...FIGURES,
                              fontSize: 11, fontWeight: 600, letterSpacing: '0.02em',
                              color: S.mutedText, backgroundColor: S.surfaceLow,
                              padding: '1px 6px', borderRadius: 5, whiteSpace: 'nowrap',
                            }}
                          >
                            {row.code}
                          </span>
                        )}
                        {/* An always-visible chevron, so the drill-down is discoverable without hovering. */}
                        <span
                          aria-hidden
                          style={{
                            marginLeft: 'auto', color: S.primary,
                            fontWeight: 800, fontSize: 16, lineHeight: 1,
                            opacity: isRowHover ? 1 : 0.4, transition: 'opacity 0.15s ease',
                          }}
                        >
                          ›
                        </span>
                      </span>
                    </td>
                    {columns.map((col) => {
                      const v = data[row.id]?.[col] ?? null;
                      const isCellHover = hover?.rowId === row.id && hover?.colId === col;
                      // Screen readers get the cell as one sentence, the band
                      // included, read during table navigation without a tab
                      // stop per cell: visually hidden text around the visible
                      // figure, so nothing is read twice; keyboard users reach
                      // the same band in the drill-down.
                      const band = cellDetails?.[row.id]?.[col] ?? null;
                      const bandText = band ? `, P10 ${fmtShift(band.p10, 1)}, P90 ${fmtShift(band.p90, 1)}` : '';
                      return (
                        <td
                          key={col}
                          className="px-3 py-1 text-center text-[13px] tabular-nums"
                          style={{
                            backgroundColor: heatFill(v, viewScale),
                            color: heatText(v),
                            fontWeight: v != null && Math.abs(v) > 0.02 ? 700 : 600,
                            ...FIGURES,
                            transition: 'background-color 0.25s ease, box-shadow 0.15s ease',
                            boxShadow: isCellHover ? `inset 0 0 0 2px ${S.primary}` : 'none',
                          }}
                          onMouseEnter={v != null ? (e) => onCellEnter(e, row.id, col, row.label) : undefined}
                          onMouseLeave={v != null ? onCellLeave : undefined}
                        >
                          {v == null ? NO_VALUE : (
                            <>
                              <span className="sr-only">{`${row.label}, ${col}: ${valueName} `}</span>
                              {fmtShift(v, 1)}
                              {bandText && <span className="sr-only">{bandText}</span>}
                            </>
                          )}
                        </td>
                      );
                    })}
                    {showTotalCol && (
                        <td
                          className="px-3 py-1 text-center text-[13px] tabular-nums"
                          style={{
                            backgroundColor: S.surfaceContainer,
                            color: shiftColor(rt),
                            fontWeight: 700,
                            ...FIGURES,
                            borderLeft: `2px solid ${S.cardBorderStrong}`,
                          }}
                          title={rt != null ? `${row.label}, row total (MC median): ${fmtShift(rt, 1)}` : undefined}
                        >
                          {rt == null ? NO_VALUE : `${shiftArrow(rt)} ${fmtShift(rt, 1)}`.trim()}
                        </td>
                    )}
                  </tr>
                  );
                })}
              </React.Fragment>
            ))}
            {/* Totals are labelled figures without heat shading: the arrow and
                sign carry direction, and colour intensity stays reserved for
                the grid cells. */}
            <tr>
              <td
                className="px-6 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] sticky left-0 z-10"
                style={{
                  backgroundColor: S.surfaceContainer,
                  color: S.onSurface,
                  fontFamily: HEADLINE_FONT,
                  borderTop: `2px solid ${S.cardBorderStrong}`,
                }}
              >
                Total
              </td>
              {columns.map((col) => {
                const ct = colTotals[col] ?? null;
                return (
                  <td
                    key={col}
                    className="px-3 py-1.5 text-center text-[13px] tabular-nums"
                    style={{
                      backgroundColor: S.surfaceContainer,
                      color: shiftColor(ct),
                      fontWeight: 700,
                      ...FIGURES,
                      borderTop: `2px solid ${S.cardBorderStrong}`,
                    }}
                    title={ct != null ? `${col}, column total: ${fmtShift(ct, 1)}` : undefined}
                  >
                    {ct == null ? NO_VALUE : `${shiftArrow(ct)} ${fmtShift(ct, 1)}`.trim()}
                  </td>
                );
              })}
              {showTotalCol && (
                <td
                  className="px-3 py-1.5 text-center text-[13px] tabular-nums"
                  style={{
                    backgroundColor: S.surfaceHigh,
                    color: shiftColor(grandTotal),
                    fontWeight: 800,
                    ...FIGURES,
                    borderLeft: `2px solid ${S.cardBorderStrong}`,
                    borderTop: `2px solid ${S.cardBorderStrong}`,
                  }}
                  title={grandTotal != null ? `Grand total: ${fmtShift(grandTotal, 1)}` : undefined}
                >
                  {grandTotal == null ? NO_VALUE : `${shiftArrow(grandTotal)} ${fmtShift(grandTotal, 1)}`.trim()}
                </td>
              )}
            </tr>
          </tbody>
        </table>
      </div>

      {/* The legend gives the short read; the aggregation rules are in "About this model". */}
      <div
        className="rounded-b-2xl flex items-center justify-between px-4 md:px-6 py-4 flex-wrap gap-3"
        style={{ backgroundColor: S.surfaceLow, color: S.onSurfaceVariant, fontSize: 11 }}
      >
        <span style={{ fontFamily: BODY_FONT }}>
          Signed % vs {BASE_YEAR}: positive is expansion, negative is contraction. Totals are
          category-weighted averages, labelled rather than shaded.
        </span>
        <div className="flex items-center gap-3">
          <span title="Shading scaled to the values in this view">−{fmtPct(viewScale, 1)}</span>
          {/* Swatches from lib/format's shift colours; the alphas follow
              heatFill's 0.42 cap. The hairline in the middle marks zero. */}
          <div className="relative flex h-2 rounded-full overflow-hidden" style={{ width: 120 }} aria-hidden>
            <div style={{ flex: 1, background: `rgba(${CONTRACTION_RGB}, 0.42)` }} />
            <div style={{ flex: 1, background: `rgba(${CONTRACTION_RGB}, 0.22)` }} />
            <div style={{ flex: 0.2, background: S.surfaceLow }} />
            <div style={{ flex: 1, background: `rgba(${EXPANSION_RGB}, 0.22)` }} />
            <div style={{ flex: 1, background: `rgba(${EXPANSION_RGB}, 0.42)` }} />
            <div
              className="absolute top-0 bottom-0"
              style={{ left: 'calc(50% - 0.5px)', width: 1, backgroundColor: S.onSurface, opacity: 0.6 }}
            />
          </div>
          <span title="Shading scaled to the values in this view">+{fmtPct(viewScale, 1)}</span>
          <span style={{ fontSize: 11 }}>zero at the centre; shading scaled to this view</span>
        </div>
        {exportNotes && exportNotes.length > 0 && (
          <p data-print-only data-testid="matrix-export-notes" className="basis-full"
            style={{ margin: 0, fontFamily: BODY_FONT, fontSize: 11, lineHeight: 1.5 }}>
            {exportNotes.join(' ')}
          </p>
        )}
      </div>

      {/* The cell tooltip: the cell's value under its own name, and the P10
          and P90 band where the cell has one (the unfiltered Time path); the
          attribution lenses and the filters carry one number per cell. */}
      {hover && (() => {
        const v = data[hover.rowId]?.[hover.colId];
        if (v == null) return null;
        const band = cellDetails?.[hover.rowId]?.[hover.colId] ?? null;
        return (
          <div
            data-print-hide
            className="fixed z-50 pointer-events-none rounded-xl"
            style={{
              left: hover.x,
              top: hover.y - 10,
              transform: 'translate(-50%, -100%)',
              backgroundColor: S.surface,
              color: S.onSurface,
              border: `1px solid ${S.cardBorderStrong}`,
              padding: '10px 14px',
              fontFamily: BODY_FONT,
              fontSize: 12,
              minWidth: 176,
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
              {hover.rowLabel} · {hover.colId}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                columnGap: 14,
                rowGap: 2,
                alignItems: 'baseline',
              }}
            >
              <span style={{ opacity: 0.7, fontSize: 11 }}>{valueLabel}</span>
              <span
                style={{
                  ...FIGURES,
                  fontWeight: 700,
                  textAlign: 'right',
                }}
              >
                {fmtShift(v, 1)}
              </span>
              {band && (
                <>
                  <span style={{ opacity: 0.7, fontSize: 11 }}>P10</span>
                  <span
                    style={{
                      ...FIGURES,
                      fontWeight: 600,
                      textAlign: 'right',
                    }}
                  >
                    {fmtShift(band.p10, 1)}
                  </span>
                  <span style={{ opacity: 0.7, fontSize: 11 }}>P90</span>
                  <span
                    style={{
                      ...FIGURES,
                      fontWeight: 600,
                      textAlign: 'right',
                    }}
                  >
                    {fmtShift(band.p90, 1)}
                  </span>
                </>
              )}
            </div>
            {band && (
              <div style={{ opacity: 0.55, fontSize: 11, marginTop: 6, lineHeight: 1.4 }}>
                Band = magnitude and timing uncertainty of the listed drivers only.
              </div>
            )}
            {!band && noBandsNote && (
              <div style={{ opacity: 0.55, fontSize: 11, marginTop: 6 }}>
                {noBandsNote}
              </div>
            )}
            <div style={{ opacity: 0.6, fontSize: 11, marginTop: 6, fontWeight: 600 }}>
              Click → {hover.rowLabel} drill-down
            </div>
            {/* The pointer: light fill with a border on its two lower edges, so
                it reads as one piece with the card. */}
            <div
              style={{
                position: 'absolute',
                left: '50%',
                bottom: -6,
                width: 10,
                height: 10,
                backgroundColor: S.surface,
                borderRight: `1px solid ${S.cardBorderStrong}`,
                borderBottom: `1px solid ${S.cardBorderStrong}`,
                transform: 'translateX(-50%) rotate(45deg)',
              }}
            />
          </div>
        );
      })()}
    </div>
  );
};

// ─── Peak-stress explainer ───────────────────────────────────────────────

export const PeakStressTooltip: FC = () => {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div className="relative inline-flex items-center" data-print-hide>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => { if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); } }}
        className="inline-flex items-center justify-center transition-all"
        style={{
          width: 28,
          height: 28,
          color: open ? S.primary : S.onSurfaceVariant,
          backgroundColor: open ? S.surfaceLow : S.surface,
          border: `1px solid ${open ? S.cardBorderStrong : S.cardBorder}`,
          borderRadius: 999,
          cursor: 'help',
          fontFamily: BODY_FONT,
        }}
        aria-label="Why aren't the worst years at the end?"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
      >
        <Info size={15} strokeWidth={2.3} />
      </button>
      {open && (
        <div
          id={panelId}
          className="absolute top-full right-0 mt-2 z-20 rounded-xl p-4"
          style={{
            backgroundColor: S.surface,
            border: `1px solid ${S.cardBorderStrong}`,
            boxShadow: SHADOW.popover,
            width: 'max-content',
            maxWidth: 'min(360px, calc(100vw - 48px))',
            fontSize: 12,
            lineHeight: 1.55,
            color: S.onSurface,
            fontFamily: BODY_FONT,
          }}
        >
          <div
            className="text-[11px] font-bold uppercase tracking-[0.12em] mb-2"
            style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}
          >
            Peak stress is not always terminal
          </div>
          <p className="mb-2">
            Each driver has its own diffusion curve (<em>s_curve, linear, front-loaded,
            back-loaded, step-function</em>) and its own peak year, and the drivers&rsquo;
            peak years spread across the horizon.
          </p>
          <p className="mb-2">
            So a category&rsquo;s total need not move in one direction: headwinds that
            arrive early can be offset later by tailwinds that peak towards the end of
            the horizon, and the path can <strong>flatten or turn back</strong> before{' '}
            {HORIZON}.
          </p>
          <p className="mb-0" style={{ color: S.onSurfaceVariant }}>
            Read a cell as the <strong>cumulative level vs {BASE_YEAR}</strong> at that
            year: the compounded impact up to that measurement point, not a
            year-on-year change.
          </p>
        </div>
      )}
    </div>
  );
};
