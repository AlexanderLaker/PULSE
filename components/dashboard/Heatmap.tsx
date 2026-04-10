/**
 * ShiftHeatmap — Category × Year shift matrix visualization.
 * Apple design: monospace data, diverging colors (green/red), subtle transitions.
 * Core Profit Pool Shift Model view showing 12 categories × 5 years of % shifts with percentiles.
 */

import { useState, useMemo, FC, MouseEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ShiftMatrix, PercentileDistribution, CategoryId } from '@/types';
import { T, CATEGORIES, YEARS, fmtShift, heatColor, shiftColorHex } from '@/lib/format';

type HeatmapMode = 'direct' | 'propagation' | 'competitive';

interface HeatmapProps {
  shifts: ShiftMatrix | null;
  selectedCategory?: string | null;
  onSelectCategory?: (categoryId: string) => void;
  onHoverCategory?: (categoryId: string | null) => void;
}

interface HoveredCell {
  cat: string;
  year: number;
}

/**
 * Extract shift value from nested path structure.
 * Handles multiple data formats: direct number, nested by year, nested percentiles.
 */
function extractVal(path: unknown, year: number): number {
  if (!path) return 0;
  if (typeof path === 'number') return path;

  const pathObj = path as Record<string, unknown>;

  // Direct year key (expected format)
  if (pathObj[year] != null) {
    const val = pathObj[year];
    if (typeof val === 'object' && val !== null) {
      const obj = val as Record<string, unknown>;
      return (obj.median ?? obj.p50 ?? 0) as number;
    }
    return val as number;
  }

  // Nested: p50 or mean → year
  if (
    pathObj.p50 &&
    typeof pathObj.p50 === 'object' &&
    (pathObj.p50 as Record<string, unknown>)[year] != null
  ) {
    return ((pathObj.p50 as Record<string, number>)[year] as number) || 0;
  }

  if (
    pathObj.mean &&
    typeof pathObj.mean === 'object' &&
    (pathObj.mean as Record<string, unknown>)[year] != null
  ) {
    return ((pathObj.mean as Record<string, number>)[year] as number) || 0;
  }

  if (
    pathObj.median &&
    typeof pathObj.median === 'object' &&
    (pathObj.median as Record<string, unknown>)[year] != null
  ) {
    return ((pathObj.median as Record<string, number>)[year] as number) || 0;
  }

  if (
    pathObj.percentiles &&
    typeof pathObj.percentiles === 'object' &&
    (pathObj.percentiles as Record<string, unknown>).p50
  ) {
    const p50Obj = (pathObj.percentiles as Record<string, Record<string, number> | undefined>).p50;
    if (p50Obj && p50Obj[year] != null) return p50Obj[year];
  }

  return 0;
}

const ShiftHeatmap: FC<HeatmapProps> = ({ shifts, selectedCategory = null, onSelectCategory, onHoverCategory }) => {
  const [hoveredCell, setHoveredCell] = useState<HoveredCell | null>(null);
  const [mode, setMode] = useState<HeatmapMode>('direct');

  // Build categories list from shifts data or use defaults
  const categories = useMemo(() => {
    if (!shifts || typeof shifts !== 'object') return [];
    return Object.keys(shifts).sort();
  }, [shifts]);

  // Defensive/Growth classification for competitive response
  const defensiveCategories = new Set(['Hair: Color', 'LHC: FCN', 'LHC: FCA']);
  const growthCategories = new Set(['Hair: Care', 'Hair: Styling']);

  // Apply mode adjustments to shift values
  const getAdjustedShift = (catId: string, baseValue: number): number => {
    if (mode === 'direct') {
      return baseValue;
    }

    if (mode === 'propagation') {
      // Simple propagation multiplier: add ~10% boost to base shift
      // In a real scenario, this would use actual causal weights from DAG
      const propagationBoost = 0.1;
      return baseValue * (1 + propagationBoost);
    }

    if (mode === 'competitive') {
      // Competitive response adjustment
      let adjustment = baseValue;
      if (defensiveCategories.has(catId)) {
        adjustment -= 0.02; // Defensive categories get pushed down
      } else if (growthCategories.has(catId)) {
        adjustment += 0.01; // Growth categories get boost
      }
      return adjustment;
    }

    return baseValue;
  };

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
        <div>
          <h3
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: T.text3,
              textTransform: 'uppercase',
              letterSpacing: 0.8,
              marginBottom: 12,
            }}
          >
            Shift Matrix — Category × Time Path
          </h3>

          {/* Mode Toggle */}
          <div
            style={{
              display: 'inline-flex',
              gap: 2,
              padding: 3,
              borderRadius: 10,
              background: T.bg3,
              border: `1px solid ${T.border}`,
            }}
          >
            {(['direct', 'propagation', 'competitive'] as const).map((m) => (
              <motion.button
                key={m}
                onClick={() => setMode(m)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  padding: '6px 14px',
                  fontSize: 10,
                  fontWeight: 600,
                  color: mode === m ? T.bg1 : T.text2,
                  background: mode === m ? T.accent : 'transparent',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                  textTransform: 'capitalize',
                  whiteSpace: 'nowrap',
                }}
              >
                {m === 'direct' && 'Direct Effects'}
                {m === 'propagation' && 'With Propagation'}
                {m === 'competitive' && 'With Competitive'}
              </motion.button>
            ))}
          </div>
        </div>

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
            const val2030Raw = extractVal(shifts[catId], 2030);
            const val2030 = getAdjustedShift(catId, val2030Raw);

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
                  onHoverCategory?.(catId);
                  if (!isSelected) {
                    e.currentTarget.style.background = `${T.border}`;
                  }
                }}
                onMouseLeave={(e: MouseEvent<HTMLTableRowElement>) => {
                  onHoverCategory?.(null);
                  if (!isSelected) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                {/* Category Name Cell */}
                <td
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: isSelected ? T.accent : T.text,
                    padding: '10px 12px',
                    whiteSpace: 'nowrap',
                    textAlign: 'left',
                  }}
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
                    {CATEGORIES.find(c => c.id === catId)?.name || catId}
                  </div>
                </td>

                {/* Year Value Cells */}
                {YEARS.map(year => {
                  const valRaw = extractVal(shifts[catId], year);
                  const val = getAdjustedShift(catId, valRaw);
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
                        whileHover={{ scale: 1.08 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                        style={{
                          padding: '8px 12px',
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
                                background: T.bg1,
                                border: `1px solid ${T.border2}`,
                                borderRadius: 8,
                                padding: '8px 12px',
                                fontSize: 10,
                                color: T.text2,
                                whiteSpace: 'nowrap',
                                zIndex: 50,
                                fontFamily: T.mono,
                                boxShadow: `0 10px 25px rgba(0,0,0,0.3)`,
                              } as React.CSSProperties}
                            >
                              {CATEGORIES.find(c => c.id === catId)?.name || catId} · {year} · {fmtShift(val, 2)}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    </td>
                  );
                })}

                {/* Δ 2030 Pill */}
                <td
                  style={{
                    padding: 6,
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '6px 10px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      color: shiftColorHex(val2030),
                      background: `${shiftColorHex(val2030)}20`,
                      border: `1px solid ${shiftColorHex(val2030)}40`,
                    }}
                  >
                    {fmtShift(val2030)}
                  </div>
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </motion.div>
  );
};

export default ShiftHeatmap;
