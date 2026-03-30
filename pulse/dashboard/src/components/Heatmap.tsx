/**
 * ShiftHeatmap — Category × Year shift matrix visualization.
 * Apple design: monospace data, diverging colors (green/red), subtle transitions.
 * Core War Room view showing 12 categories × 5 years of % shifts with percentiles.
 */

import { useState, useMemo, FC, MouseEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ShiftMatrix, PercentileDistribution, CategoryId } from '../types';
import { T, CATEGORIES, YEARS, fmtShift, heatColor, shiftColorHex } from '../lib/format';

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

  // Build categories list from shifts data or use defaults
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
        overflowX: 'auto',
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
          Shift Matrix — Category × Time Path
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
          {categories.map((catId, idx) => {
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
                        background: CATEGORIES.find(c => c.id === catId)?.color || T.text3,
                      }}
                    />
                    {catId}
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
                        whileHover={{ scale: 1.05 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                        style={{
                          padding: dist.hasCI ? '6px 10px 5px' : '8px 12px',
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 600,
                          color: shiftColorHex(val),
                          background: heatColor(val),
                          cursor: 'default',
                          position: 'relative',
                          lineHeight: 1,
                        } as React.CSSProperties}
                      >
                        {fmtShift(val)}
                        {/* p10–p90 confidence range, subtle */}
                        {dist.hasCI && (
                          <div style={{
                            fontSize: 8,
                            fontWeight: 400,
                            color: T.text4,
                            marginTop: 3,
                            letterSpacing: -0.2,
                            lineHeight: 1,
                          }}>
                            {fmtShift(dist.p10)} … {fmtShift(dist.p90)}
                          </div>
                        )}

                        {/* Hover Tooltip */}
                        <AnimatePresence>
                          {isHovered && (
                            <motion.div
                              initial={{ opacity: 0, y: -8 }}
                              animate={{ opacity: 1, y: -12 }}
                              exit={{ opacity: 0 }}
                              style={{
                                position: 'absolute',
                                bottom: '100%',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                background: '#1D1D1F',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 8,
                                padding: '8px 12px',
                                fontSize: 10,
                                color: '#94A3B8',
                                whiteSpace: 'nowrap',
                                zIndex: 50,
                                fontFamily: T.mono,
                                boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
                              } as React.CSSProperties}
                            >
                              <div style={{ color: '#F8FAFC', fontWeight: 600, marginBottom: 3 }}>{catId} · {year}</div>
                              <div>Median {fmtShift(val, 2)}</div>
                              {dist.hasCI && (
                                <div style={{ marginTop: 2 }}>p10 {fmtShift(dist.p10, 2)}  ·  p90 {fmtShift(dist.p90, 2)}</div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    </td>
                  );
                })}

                {/* Δ 2030 Pill */}
                {(() => {
                  const dist2030 = extractDist(shifts[catId], 2030);
                  return (
                    <td
                      style={{
                        padding: 6,
                        textAlign: 'center',
                      }}
                    >
                      <div
                        style={{
                          display: 'inline-flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: dist2030.hasCI ? '5px 10px 4px' : '6px 10px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          color: shiftColorHex(val2030),
                          background: `${shiftColorHex(val2030)}20`,
                          border: `1px solid ${shiftColorHex(val2030)}40`,
                        }}
                      >
                        {fmtShift(val2030)}
                        {dist2030.hasCI && (
                          <div style={{
                            fontSize: 8,
                            fontWeight: 400,
                            color: T.text4,
                            marginTop: 2,
                            lineHeight: 1,
                          }}>
                            {fmtShift(dist2030.p10)} … {fmtShift(dist2030.p90)}
                          </div>
                        )}
                      </div>
                    </td>
                  );
                })()}
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </motion.div>
  );
};

export default ShiftHeatmap;
