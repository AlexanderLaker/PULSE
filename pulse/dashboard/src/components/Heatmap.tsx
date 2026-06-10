/**
 * ShiftHeatmap — Category × Year shift matrix visualization.
 * Apple design: monospace data, diverging colors (green/red), subtle transitions.
 * Core Profit Pool Shift Model view showing 12 categories × 5 years of % shifts with percentiles.
 */

import { useState, useMemo, FC, MouseEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ShiftMatrix, PercentileDistribution, CategoryId } from '../types';
import { T, CATEGORIES, YEARS, fmtShift, heatColor, shiftColorHex, shortCat } from '../lib/format';

interface HeatmapProps {
  shifts: ShiftMatrix | null;
  selectedCategory?: string | null;
  onSelectCategory?: (categoryId: string) => void;
  onDoubleClickCategory?: (categoryId: string) => void;
}

interface HoveredCell {
  cat: string;
  year: number;
}

/**
 * Extract shift value from nested path structure.
 * Handles multiple data formats: direct number, nested by year, nested percentiles.
 */
interface CellDist {
  median: number;
  p10: number;
  p90: number;
  hasCI: boolean;
}

function extractVal(path: unknown, year: number): number {
  return extractDist(path, year).median;
}

/**
 * Extract full percentile distribution for a cell.
 */
function extractDist(path: unknown, year: number): CellDist {
  const none: CellDist = { median: 0, p10: 0, p90: 0, hasCI: false };
  if (!path) return none;
  if (typeof path === 'number') return { median: path, p10: path, p90: path, hasCI: false };

  const pathObj = path as Record<string, unknown>;

  // Direct year key (expected format)
  if (pathObj[year] != null) {
    const val = pathObj[year];
    if (typeof val === 'object' && val !== null) {
      const obj = val as Record<string, unknown>;
      const med = (obj.median ?? obj.p50 ?? 0) as number;
      const p10 = (obj.p10 ?? med) as number;
      const p90 = (obj.p90 ?? med) as number;
      return { median: med, p10, p90, hasCI: obj.p10 != null && obj.p90 != null };
    }
    const v = val as number;
    return { median: v, p10: v, p90: v, hasCI: false };
  }

  // Nested: p50 or mean → year
  if (
    pathObj.p50 &&
    typeof pathObj.p50 === 'object' &&
    (pathObj.p50 as Record<string, unknown>)[year] != null
  ) {
    const med = ((pathObj.p50 as Record<string, number>)[year] as number) || 0;
    return { median: med, p10: med, p90: med, hasCI: false };
  }

  if (
    pathObj.mean &&
    typeof pathObj.mean === 'object' &&
    (pathObj.mean as Record<string, unknown>)[year] != null
  ) {
    const med = ((pathObj.mean as Record<string, number>)[year] as number) || 0;
    return { median: med, p10: med, p90: med, hasCI: false };
  }

  if (
    pathObj.median &&
    typeof pathObj.median === 'object' &&
    (pathObj.median as Record<string, unknown>)[year] != null
  ) {
    const med = ((pathObj.median as Record<string, number>)[year] as number) || 0;
    return { median: med, p10: med, p90: med, hasCI: false };
  }

  if (
    pathObj.percentiles &&
    typeof pathObj.percentiles === 'object' &&
    (pathObj.percentiles as Record<string, unknown>).p50
  ) {
    const p50Obj = (pathObj.percentiles as Record<string, Record<string, number> | undefined>).p50;
    if (p50Obj && p50Obj[year] != null) {
      return { median: p50Obj[year], p10: p50Obj[year], p90: p50Obj[year], hasCI: false };
    }
  }

  return none;
}

const ShiftHeatmap: FC<HeatmapProps> = ({ shifts, selectedCategory = null, onSelectCategory, onDoubleClickCategory }) => {
  const [hoveredCell, setHoveredCell] = useState<HoveredCell | null>(null);

  // Build grouped categories (Beauty / LHC) like Force Matrix
  const categoryGroups = useMemo(() => {
    const beautyCats = CATEGORIES.filter(c => c.group === 'Beauty');
    const lhcCats = CATEGORIES.filter(c => c.group === 'LHC');
    return [
      { group: 'Beauty', categories: beautyCats },
      { group: 'LHC', categories: lhcCats },
    ];
  }, []);

  const categories = useMemo(() => {
    if (!shifts || typeof shifts !== 'object') return [];
    return Object.keys(shifts).sort();
  }, [shifts]);

  // Fallback message if no data
  if (!shifts || categories.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          padding: 32,
          borderRadius: 12,
          border: `1px solid ${T.border}`,
          background: `linear-gradient(135deg, ${T.bg2}88 0%, ${T.bg3}44 100%)`,
          textAlign: 'center',
        } as React.CSSProperties}
      >
        <div style={{ fontSize: 13, color: T.text3 }}>
          Run a simulation to see the shift matrix heatmap
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        padding: 20,
        paddingTop: 24,
        borderRadius: 12,
        border: `1px solid ${T.border}`,
        background: `linear-gradient(135deg, ${T.bg2}88 0%, ${T.bg3}44 100%)`,
        backdropFilter: 'blur(10px)',
        overflow: 'visible',
      } as React.CSSProperties}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
        <h3
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: T.text3,
            textTransform: 'uppercase',
            letterSpacing: 0.8,
          }}
        >
          Category × Time Path
        </h3>
        <div style={{ fontSize: 10, color: T.text4, display: 'flex', gap: 16 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: T.green,
              }}
            />
            Expansion
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: T.red,
              }}
            />
            Contraction
          </span>
        </div>
      </div>

      {/* Table */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'separate',
          borderSpacing: '2px',
          fontFamily: T.mono,
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                textAlign: 'left',
                fontSize: 11,
                fontWeight: 600,
                color: T.text3,
                padding: 8,
                paddingLeft: 12,
                minWidth: 120,
              }}
            >
              Category
            </th>
            {YEARS.map(year => (
              <th
                key={year}
                style={{
                  textAlign: 'center',
                  fontSize: 11,
                  fontWeight: 600,
                  color: T.text3,
                  padding: 8,
                  minWidth: 70,
                }}
              >
                {year}
              </th>
            ))}
            <th
              style={{
                textAlign: 'center',
                fontSize: 11,
                fontWeight: 600,
                color: T.text3,
                padding: 8,
                minWidth: 60,
              }}
            >
              Δ 2030
            </th>
          </tr>
        </thead>
        <tbody>
          {categoryGroups.map(group => {
            // Group header row
            const groupHeader = (
              <tr
                key={`group-${group.group}`}
                style={{
                  background: T.bg1,
                  borderBottom: `1px solid ${T.border}`,
                }}
              >
                <td
                  colSpan={YEARS.length + 2}
                  style={{
                    padding: '5px 12px',
                    fontSize: 9,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    color: T.text3,
                  }}
                >
                  {group.group}
                </td>
              </tr>
            );

            // Category rows within this group
            const catRows = group.categories.map((cat, idx) => {
            const catId = cat.id;
            const isSelected = selectedCategory === catId;
            const val2030 = extractVal(shifts[catId], 2030);

            return (
              <motion.tr
                key={catId}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.02, duration: 0.2 }}
                onClick={() => onSelectCategory?.(catId)}
                style={{
                  background: isSelected ? T.accentDim : 'transparent',
                  borderRadius: 8,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                } as React.CSSProperties}
                onMouseEnter={(e: MouseEvent<HTMLTableRowElement>) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = `${T.border}`;
                  }
                }}
                onMouseLeave={(e: MouseEvent<HTMLTableRowElement>) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                {/* Category Name Cell */}
                <td
                  onDoubleClick={() => onDoubleClickCategory?.(catId)}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: isSelected ? T.accent : T.text,
                    padding: '10px 12px',
                    whiteSpace: 'nowrap',
                    textAlign: 'left',
                    cursor: 'pointer',
                    position: 'relative',
                  } as React.CSSProperties}
                  title="Double-click for deep dive"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      style={{
                        width: 3,
                        height: 20,
                        borderRadius: 1,
                        background: cat.color || T.text3,
                      }}
                    />
                    {cat.short}
                  </div>
                </td>

                {/* Year Value Cells */}
                {YEARS.map(year => {
                  const dist = extractDist(shifts[catId], year);
                  const val = dist.median;
                  const isHovered = hoveredCell?.cat === catId && hoveredCell?.year === year;

                  return (
                    <td
                      key={year}
                      style={{
                        padding: 6,
                        textAlign: 'center',
                      }}
                    >
                      <motion.div
                        onMouseEnter={() => setHoveredCell({ cat: catId, year })}
                        onMouseLeave={() => setHoveredCell(null)}
                        whileHover={{ scale: 1.06 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                        style={{
                          padding: '4px 8px',
                          borderRadius: 6,
                          fontSize: 10,
                          fontWeight: 600,
                          fontFamily: T.mono,
                          color: shiftColorHex(val),
                          background: heatColor(val),
                          cursor: 'default',
                          position: 'relative',
                          lineHeight: 1.2,
                          letterSpacing: '-0.01em',
                          fontVariantNumeric: 'tabular-nums',
                        } as React.CSSProperties}
                      >
                        {fmtShift(val)}

                        {/* Hover Tooltip — enlarged numbers + P10-P90 explanation */}
                        <AnimatePresence>
                          {isHovered && (
                            <motion.div
                              initial={{ opacity: 0, y: -4, scale: 0.97 }}
                              animate={{ opacity: 1, y: -10, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.97 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                              style={{
                                position: 'absolute',
                                bottom: '100%',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                background: '#F5F5F7',
                                border: '1px solid rgba(0,0,0,0.12)',
                                borderRadius: 10,
                                padding: '12px 16px',
                                zIndex: 50,
                                fontFamily: T.mono,
                                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                                minWidth: 160,
                                pointerEvents: 'none',
                              } as React.CSSProperties}
                            >
                              {/* Category · Year header */}
                              <div style={{
                                fontSize: 10, fontWeight: 600, color: '#64748B',
                                marginBottom: 8, letterSpacing: 0.2,
                                display: 'flex', alignItems: 'center', gap: 6,
                              }}>
                                <div style={{
                                  width: 3, height: 12, borderRadius: 2,
                                  background: CATEGORIES.find(c => c.id === catId)?.color || T.accent,
                                }} />
                                {catId} <span style={{ color: '#94A3B8', fontWeight: 400 }}>·</span> <span style={{ color: '#334155' }}>{year}</span>
                              </div>

                              {/* Big median number */}
                              <div style={{
                                fontSize: 24, fontWeight: 300, letterSpacing: -0.5,
                                color: shiftColorHex(val), lineHeight: 1, marginBottom: 4,
                              }}>
                                {fmtShift(val, 2)}
                              </div>
                              <div style={{ fontSize: 9, color: '#64748B', marginBottom: dist.hasCI ? 10 : 0 }}>
                                Median projected GP1 pool shift
                              </div>

                              {/* P10-P90 range */}
                              {dist.hasCI && (
                                <>
                                  <div style={{
                                    borderTop: '1px solid rgba(0,0,0,0.08)',
                                    paddingTop: 10,
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                                    gap: 10,
                                  }}>
                                    <div style={{ textAlign: 'left' }}>
                                      <div style={{ fontSize: 8, color: '#64748B', marginBottom: 3, fontFamily: 'Inter, sans-serif' }}>P10 (downside)</div>
                                      <div style={{ fontSize: 14, fontWeight: 500, color: shiftColorHex(dist.p10) }}>
                                        {fmtShift(dist.p10, 2)}
                                      </div>
                                    </div>
                                    <div style={{ fontSize: 12, color: '#94A3B8', alignSelf: 'center', marginTop: 8 }}>…</div>
                                    <div style={{ textAlign: 'right' }}>
                                      <div style={{ fontSize: 8, color: '#64748B', marginBottom: 3, fontFamily: 'Inter, sans-serif' }}>P90 (upside)</div>
                                      <div style={{ fontSize: 14, fontWeight: 500, color: shiftColorHex(dist.p90) }}>
                                        {fmtShift(dist.p90, 2)}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Explanation */}
                                  <div style={{
                                    fontSize: 8, color: '#64748B', marginTop: 8, lineHeight: 1.4,
                                    fontFamily: 'Inter, sans-serif',
                                  }}>
                                    80% CI from Monte Carlo. P10 = pessimistic, P90 = optimistic.
                                  </div>
                                </>
                              )}

                              {/* Tooltip arrow */}
                              <div style={{
                                position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)',
                                width: 12, height: 6, overflow: 'hidden',
                              }}>
                                <div style={{
                                  width: 10, height: 10, background: '#F5F5F7',
                                  border: '1px solid rgba(0,0,0,0.12)',
                                  transform: 'rotate(45deg)', transformOrigin: 'top left',
                                  marginLeft: 1, marginTop: -5,
                                }} />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    </td>
                  );
                })}

                {/* Δ 2030 Pill with hover tooltip */}
                {(() => {
                  const dist2030 = extractDist(shifts[catId], 2030);
                  const isDeltaHovered = hoveredCell?.cat === catId && hoveredCell?.year === 9999;
                  return (
                    <td
                      style={{
                        padding: 6,
                        textAlign: 'center',
                      }}
                    >
                      <div
                        onMouseEnter={() => setHoveredCell({ cat: catId, year: 9999 })}
                        onMouseLeave={() => setHoveredCell(null)}
                        style={{
                          display: 'inline-flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '4px 8px',
                          borderRadius: 6,
                          fontSize: 10,
                          fontWeight: 700,
                          fontFamily: T.mono,
                          color: shiftColorHex(val2030),
                          background: `${shiftColorHex(val2030)}20`,
                          border: `1px solid ${shiftColorHex(val2030)}40`,
                          cursor: 'default',
                          position: 'relative',
                          lineHeight: 1.2,
                          fontVariantNumeric: 'tabular-nums',
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {fmtShift(val2030)}

                        {/* Δ 2030 Hover Tooltip */}
                        <AnimatePresence>
                          {isDeltaHovered && (
                            <motion.div
                              initial={{ opacity: 0, y: -4, scale: 0.97 }}
                              animate={{ opacity: 1, y: -10, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.97 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                              style={{
                                position: 'absolute',
                                bottom: '100%',
                                right: 0,
                                background: '#F5F5F7',
                                border: '1px solid rgba(0,0,0,0.12)',
                                borderRadius: 10,
                                padding: '12px 16px',
                                zIndex: 50,
                                fontFamily: T.mono,
                                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                                minWidth: 160,
                                pointerEvents: 'none',
                              } as React.CSSProperties}
                            >
                              {/* Category · Δ 2030 header */}
                              <div style={{
                                fontSize: 10, fontWeight: 600, color: '#64748B',
                                marginBottom: 8, letterSpacing: 0.2,
                                display: 'flex', alignItems: 'center', gap: 6,
                              }}>
                                <div style={{
                                  width: 3, height: 12, borderRadius: 2,
                                  background: CATEGORIES.find(c => c.id === catId)?.color || T.accent,
                                }} />
                                {catId} <span style={{ color: '#94A3B8', fontWeight: 400 }}>·</span> <span style={{ color: '#334155' }}>Δ 2030</span>
                              </div>

                              {/* Big median number */}
                              <div style={{
                                fontSize: 24, fontWeight: 300, letterSpacing: -0.5,
                                color: shiftColorHex(val2030), lineHeight: 1, marginBottom: 4,
                              }}>
                                {fmtShift(val2030, 2)}
                              </div>
                              <div style={{ fontSize: 9, color: '#64748B', marginBottom: dist2030.hasCI ? 10 : 0 }}>
                                Cumulative GP1 pool shift by 2030
                              </div>

                              {/* P10-P90 range */}
                              {dist2030.hasCI && (
                                <>
                                  <div style={{
                                    borderTop: '1px solid rgba(0,0,0,0.08)',
                                    paddingTop: 10,
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                                    gap: 10,
                                  }}>
                                    <div style={{ textAlign: 'left' }}>
                                      <div style={{ fontSize: 8, color: '#64748B', marginBottom: 3, fontFamily: 'Inter, sans-serif' }}>P10 (downside)</div>
                                      <div style={{ fontSize: 14, fontWeight: 500, color: shiftColorHex(dist2030.p10) }}>
                                        {fmtShift(dist2030.p10, 2)}
                                      </div>
                                    </div>
                                    <div style={{ fontSize: 12, color: '#94A3B8', alignSelf: 'center', marginTop: 8 }}>…</div>
                                    <div style={{ textAlign: 'right' }}>
                                      <div style={{ fontSize: 8, color: '#64748B', marginBottom: 3, fontFamily: 'Inter, sans-serif' }}>P90 (upside)</div>
                                      <div style={{ fontSize: 14, fontWeight: 500, color: shiftColorHex(dist2030.p90) }}>
                                        {fmtShift(dist2030.p90, 2)}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Explanation */}
                                  <div style={{
                                    fontSize: 8, color: '#64748B', marginTop: 8, lineHeight: 1.4,
                                    fontFamily: 'Inter, sans-serif',
                                  }}>
                                    80% CI from Monte Carlo. P10 = pessimistic, P90 = optimistic.
                                  </div>
                                </>
                              )}

                              {/* Tooltip arrow */}
                              <div style={{
                                position: 'absolute', bottom: -6, right: 14,
                                width: 12, height: 6, overflow: 'hidden',
                              }}>
                                <div style={{
                                  width: 10, height: 10, background: '#F5F5F7',
                                  border: '1px solid rgba(0,0,0,0.12)',
                                  transform: 'rotate(45deg)', transformOrigin: 'top left',
                                  marginLeft: 1, marginTop: -5,
                                }} />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </td>
                  );
                })()}
              </motion.tr>
            );
            });

            return [groupHeader, ...catRows];
          })}
        </tbody>
      </table>
    </motion.div>
  );
};

export default ShiftHeatmap;
