/**
 * RegionShiftMatrix — Profit Pool Impact by Region × Category (2030)
 * Apple × Bain design: displays how each of the 4 regions drives category shifts.
 *
 * Matrix structure:
 * - Rows: 13 categories (Hair × 4, LHC × 8)
 * - Columns: 4 regions (Europe, North America, Asia, High Growth)
 * - Values: region-weighted contribution to 2030 category shift, computed from trends
 *
 * Color-coded by direction (green expansion, red contraction).
 * Row/cell interactive: click to drill into category detail.
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { ShiftMatrix, Trend } from '../types';
import type { Region } from '../types/trends';
import { T, CATEGORIES, fmtShift, shiftColorHex, shortCat } from '../lib/format';

const REGIONS: Region[] = ['Europe', 'North America', 'Asia', 'High Growth'];

const REGION_EMOJIS: Record<Region, string> = {
  'Europe': '🇪🇺',
  'North America': '🇺🇸',
  'Asia': '🌏',
  'High Growth': '🚀',
};

const REGION_SHORT: Record<Region, string> = {
  'Europe': 'Europe',
  'North America': 'N. America',
  'Asia': 'Asia',
  'High Growth': 'High Growth',
};

interface RegionShiftMatrixProps {
  shifts: ShiftMatrix | null;
  trends: Trend[];
  onSelectCategory?: (catId: string) => void;
}

/**
 * Compute region-level contribution to a category's 2030 shift.
 *
 * For each trend affecting the category:
 * 1. Get trend.gp1_shift (normalized score)
 * 2. Get category_exposure[catId] (0-5 scale)
 * 3. Get regional_exposure[region] (0-5 scale)
 * 4. Contribution = gp1_shift × (category_exposure / 5) × (regional_exposure / 5)
 * 5. Sum by region
 */
function computeRegionContributions(
  catId: string,
  trends: Trend[]
): Record<Region, number> {
  const result: Record<Region, number> = {
    'Europe': 0,
    'North America': 0,
    'Asia': 0,
    'High Growth': 0,
  };

  trends.forEach(trend => {
    const gp1Shift = (trend as any).gp1_shift ?? (trend as any).normalized_score ?? 0;
    const categoryExposure = (trend as any).category_exposure?.[catId] ?? 0;
    const exposureWeight = Math.max(0, Math.min(5, categoryExposure)) / 5;
    const regionalExposure = (trend as any).regional_exposure ?? {};

    REGIONS.forEach(region => {
      const regionScore = regionalExposure[region] ?? 0;
      const regionWeight = Math.max(0, Math.min(5, regionScore)) / 5;
      const contribution = gp1Shift * exposureWeight * regionWeight;
      result[region] += contribution;
    });
  });

  return result;
}

/**
 * Extract 2030 shift value from nested path structure.
 */
function extract2030Shift(pathData: unknown): number {
  if (!pathData) return 0;
  if (typeof pathData === 'number') return pathData;

  const pathObj = pathData as Record<string, unknown>;

  if (pathObj[2030]) {
    const val = pathObj[2030];
    if (typeof val === 'object' && val !== null) {
      const obj = val as Record<string, unknown>;
      return (obj.median ?? obj.p50 ?? 0) as number;
    }
    return val as number;
  }

  if (pathObj.median && typeof pathObj.median === 'object') {
    const medianObj = pathObj.median as Record<string, unknown>;
    if (medianObj[2030] != null) {
      return (medianObj[2030] as number) ?? 0;
    }
  }

  return 0;
}

const RegionShiftMatrix: React.FC<RegionShiftMatrixProps> = ({
  shifts,
  trends,
  onSelectCategory,
}) => {
  // Compute region contributions for all categories, scaled to match MC 2030 total
  const regionContributions = useMemo(() => {
    const result: Record<string, Record<Region, number>> = {};
    CATEGORIES.forEach(cat => {
      const raw = computeRegionContributions(cat.id, trends);
      const rawTotal = Object.values(raw).reduce((a, b) => a + b, 0);
      const mcTotal = shifts?.[cat.id] ? extract2030Shift(shifts[cat.id]) : 0;

      // Scale region contributions proportionally so they sum to the MC 2030 shift
      if (Math.abs(rawTotal) > 1e-6 && Math.abs(mcTotal) > 1e-6) {
        const scale = mcTotal / rawTotal;
        const scaled: Record<Region, number> = {} as Record<Region, number>;
        for (const [r, v] of Object.entries(raw)) {
          scaled[r as Region] = v * scale;
        }
        result[cat.id] = scaled;
      } else {
        result[cat.id] = raw;
      }
    });
    return result;
  }, [trends, shifts]);

  // Group categories by group (Hair / LHC)
  const categoryGroups = useMemo(() => {
    const hairCats = CATEGORIES.filter(c => c.group === 'Hair');
    const lhcCats = CATEGORIES.filter(c => c.group === 'LHC');
    return [
      { group: 'Hair', categories: hairCats },
      { group: 'LHC', categories: lhcCats },
    ];
  }, []);

  // Compute averages by region (average across all categories)
  const totalsByRegion = useMemo(() => {
    const sums: Record<Region, number> = {
      'Europe': 0,
      'North America': 0,
      'Asia': 0,
      'High Growth': 0,
    };

    const catCount = CATEGORIES.length || 1;
    CATEGORIES.forEach(cat => {
      const contributions = regionContributions[cat.id] ?? {};
      Object.entries(contributions).forEach(([region, val]) => {
        sums[region as Region] += (val as number);
      });
    });

    const avgs: Record<Region, number> = {} as Record<Region, number>;
    for (const [region, sum] of Object.entries(sums)) {
      avgs[region as Region] = sum / catCount;
    }
    return avgs;
  }, [regionContributions]);

  // Fallback if no data
  if (!shifts || Object.keys(shifts).length === 0) {
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
          Run a simulation to see the region shift matrix
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
          marginBottom: 24,
        }}
      >
        <h3
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: T.text3,
            textTransform: 'uppercase',
            letterSpacing: 0.8,
            margin: 0,
          }}
        >
          Shift Matrix — Category × Region (2030)
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
        {/* Header Row */}
        <thead>
          <tr>
            <th
              style={{
                textAlign: 'left',
                fontSize: 11,
                fontWeight: 600,
                color: T.text3,
                padding: 10,
                paddingLeft: 12,
                minWidth: 120,
              }}
            >
              Category
            </th>
            {REGIONS.map(region => (
              <th
                key={region}
                style={{
                  textAlign: 'center',
                  fontSize: 10,
                  fontWeight: 600,
                  color: T.text3,
                  padding: 10,
                  minWidth: 100,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span style={{ fontSize: 14 }}>{REGION_EMOJIS[region]}</span>
                  <span>{REGION_SHORT[region]}</span>
                </div>
              </th>
            ))}
            <th
              style={{
                textAlign: 'center',
                fontSize: 11,
                fontWeight: 600,
                color: T.text3,
                padding: 10,
                minWidth: 80,
              }}
            >
              Total
            </th>
          </tr>
        </thead>

        {/* Body Rows */}
        <tbody>
          {categoryGroups.map(group => {
            const groupHeaderRows = [
              <tr
                key={`group-${group.group}`}
                style={{
                  background: T.bg1,
                  borderBottom: `1px solid ${T.border}`,
                }}
              >
                <td
                  colSpan={6}
                  style={{
                    padding: 8,
                    paddingLeft: 12,
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    color: T.text3,
                  }}
                >
                  {group.group}
                </td>
              </tr>,
            ];

            const categoryRows = group.categories.map((cat, idx) => {
              const contributions = regionContributions[cat.id] ?? {};
              const catTotal2030 = shifts[cat.id]
                ? extract2030Shift(shifts[cat.id])
                : 0;

              return (
                <motion.tr
                  key={cat.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.01, duration: 0.2 }}
                  onClick={() => onSelectCategory?.(cat.id)}
                  style={{
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  } as React.CSSProperties}
                  onMouseEnter={(e: React.MouseEvent<HTMLTableRowElement>) => {
                    e.currentTarget.style.background = `${T.border}`;
                  }}
                  onMouseLeave={(e: React.MouseEvent<HTMLTableRowElement>) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {/* Category Name */}
                  <td
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: T.text,
                      padding: '10px 12px',
                      whiteSpace: 'nowrap',
                      textAlign: 'left',
                    } as React.CSSProperties}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div
                        style={{
                          width: 3,
                          height: 20,
                          borderRadius: 1,
                          background: cat.color,
                        }}
                      />
                      {shortCat(cat.name)}
                    </div>
                  </td>

                  {/* Region Contribution Cells */}
                  {REGIONS.map(region => {
                    const val = (contributions as Record<Region, number>)[region] ?? 0;
                    return (
                      <td
                        key={`${cat.id}-${region}`}
                        style={{
                          padding: 6,
                          textAlign: 'center',
                        }}
                      >
                        <motion.div
                          whileHover={{ scale: 1.08 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                          style={{
                            padding: '8px 12px',
                            borderRadius: 8,
                            fontSize: 11,
                            fontWeight: 600,
                            color: shiftColorHex(val),
                            background:
                              Math.abs(val) < 0.001
                                ? 'transparent'
                                : val > 0
                                  ? 'rgba(48, 209, 88, 0.12)'
                                  : 'rgba(255, 69, 58, 0.12)',
                            border: `1px solid ${
                              Math.abs(val) < 0.001
                                ? 'transparent'
                                : val > 0
                                  ? 'rgba(48, 209, 88, 0.3)'
                                  : 'rgba(255, 69, 58, 0.3)'
                            }`,
                            cursor: 'default',
                            position: 'relative',
                            lineHeight: 1,
                          } as React.CSSProperties}
                        >
                          {fmtShift(val)}
                        </motion.div>
                      </td>
                    );
                  })}

                  {/* Total Column */}
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
                        padding: '8px 12px',
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: 600,
                        color: shiftColorHex(catTotal2030),
                        background:
                          Math.abs(catTotal2030) < 0.001
                            ? 'transparent'
                            : catTotal2030 > 0
                              ? 'rgba(48, 209, 88, 0.2)'
                              : 'rgba(255, 69, 58, 0.2)',
                        border: `1px solid ${
                          Math.abs(catTotal2030) < 0.001
                            ? 'transparent'
                            : catTotal2030 > 0
                              ? 'rgba(48, 209, 88, 0.4)'
                              : 'rgba(255, 69, 58, 0.4)'
                        }`,
                      }}
                    >
                      {fmtShift(catTotal2030)}
                    </div>
                  </td>
                </motion.tr>
              );
            });

            return [...groupHeaderRows, ...categoryRows];
          })}

          {/* Total Row */}
          <tr
            style={{
              borderTop: `2px solid ${T.border}`,
              background: T.bg1,
              fontWeight: 600,
            }}
          >
            <td
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: T.text,
                padding: '12px 12px',
                textAlign: 'left',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Portfolio
            </td>

            {REGIONS.map(region => {
              const val = totalsByRegion[region] ?? 0;
              return (
                <td
                  key={`total-${region}`}
                  style={{
                    padding: 8,
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '8px 12px',
                      borderRadius: 8,
                      fontSize: 11,
                      fontWeight: 600,
                      color: shiftColorHex(val),
                      background:
                        Math.abs(val) < 0.001
                          ? 'transparent'
                          : val > 0
                            ? 'rgba(48, 209, 88, 0.15)'
                            : 'rgba(255, 69, 58, 0.15)',
                      border: `1px solid ${
                        Math.abs(val) < 0.001
                          ? 'transparent'
                          : val > 0
                            ? 'rgba(48, 209, 88, 0.4)'
                            : 'rgba(255, 69, 58, 0.4)'
                      }`,
                    }}
                  >
                    {fmtShift(val)}
                  </div>
                </td>
              );
            })}

            {/* Portfolio Total */}
            <td
              style={{
                padding: 8,
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px 12px',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  color: shiftColorHex(
                    (Object.values(totalsByRegion) as number[]).reduce((a, b) => a + b, 0)
                  ),
                  background:
                    Math.abs((Object.values(totalsByRegion) as number[]).reduce((a, b) => a + b, 0)) <
                    0.001
                      ? 'transparent'
                      : (Object.values(totalsByRegion) as number[]).reduce((a, b) => a + b, 0) > 0
                        ? 'rgba(48, 209, 88, 0.25)'
                        : 'rgba(255, 69, 58, 0.25)',
                  border: `1px solid ${
                    Math.abs(
                      (Object.values(totalsByRegion) as number[]).reduce((a, b) => a + b, 0)
                    ) < 0.001
                      ? 'transparent'
                      : (Object.values(totalsByRegion) as number[]).reduce((a, b) => a + b, 0) > 0
                        ? 'rgba(48, 209, 88, 0.5)'
                        : 'rgba(255, 69, 58, 0.5)'
                  }`,
                }}
              >
                {fmtShift(
                  (Object.values(totalsByRegion) as number[]).reduce((a, b) => a + b, 0)
                )}
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Footer Note */}
      <div
        style={{
          marginTop: 16,
          fontSize: 10,
          color: T.text3,
          lineHeight: 1.5,
        }}
      >
        <strong>Values represent 2030 shift contribution by region:</strong> Each region's impact is calculated from
        trend scores weighted by category exposure and regional exposure, scaled to match the Monte Carlo total.
        Portfolio row shows the average across categories. Click a category row to see details.
      </div>
    </motion.div>
  );
};

export default RegionShiftMatrix;
