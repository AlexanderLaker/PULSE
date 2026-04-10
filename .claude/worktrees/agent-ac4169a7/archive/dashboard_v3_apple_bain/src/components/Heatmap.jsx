/**
 * ShiftHeatmap — Category × Year shift matrix visualization.
 * Apple design: monospace data, diverging colors (green/red), subtle transitions.
 * Core War Room view showing 12 categories × 5 years of % shifts with percentiles.
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { T, CATEGORIES, YEARS, fmtShift, heatColor, shiftColorHex } from '../lib/format';

/**
 * Extract shift value from nested path structure.
 * Handles multiple data formats: direct number, nested by year, nested percentiles.
 */
function extractVal(path, year) {
  if (!path) return 0;
  if (typeof path === 'number') return path;
  // Direct year key (expected format)
  if (path[year] != null) {
    const val = path[year];
    return typeof val === 'object' ? val.median ?? val.p50 ?? 0 : val;
  }
  // Nested: p50 or mean → year
  if (path.p50?.[year] != null) return path.p50[year];
  if (path.mean?.[year] != null) return path.mean[year];
  if (path.median?.[year] != null) return path.median[year];
  if (path.percentiles?.p50?.[year] != null) return path.percentiles.p50[year];
  return 0;
}

export default function ShiftHeatmap({ shifts, selectedCategory, onSelectCategory }) {
  const [hoveredCell, setHoveredCell] = useState(null);

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
        }}
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
      }}
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
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = `${T.border}`;
                  }
                }}
                onMouseLeave={(e) => {
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
                    {catId}
                  </div>
                </td>

                {/* Year Value Cells */}
                {YEARS.map(year => {
                  const val = extractVal(shifts[catId], year);
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
                        }}
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
                              }}
                            >
                              {catId} · {year} · {fmtShift(val, 2)}
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
}
