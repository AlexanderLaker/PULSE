/**
 * ForceShiftMatrix — Profit Pool Impact by Force × Category (2030)
 * Apple × Bain design: displays how each of the 6 forces drives category shifts.
 *
 * Matrix structure:
 * - Rows: 13 categories (Hair × 4, LHC × 8)
 * - Columns: 6 forces (Consumer, Customer, Technology, Government, Environmental, Competitive)
 * - Values: force contribution to 2030 category shift, computed from trends
 *
 * Color-coded by direction (green expansion, red contraction).
 * Row/cell interactive: click to drill into causal decomposition.
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { User, Store, Cpu, Landmark, Leaf, Swords } from 'lucide-react';
import type { ShiftMatrix, Trend, ForceName } from '../types';
import { T, CATEGORIES, FORCES, FORCE_COLORS, FORCE_ICONS, fmtShift, shiftColorHex, shiftCellColors, shortCat } from '../lib/format';
import ShiftPill from './ShiftPill';

const FORCE_LUCIDE: Record<ForceName, React.ReactNode> = {
  Consumer:      <User size={13} />,
  Customer:      <Store size={13} />,
  Technology:    <Cpu size={13} />,
  Government:    <Landmark size={13} />,
  Environmental: <Leaf size={13} />,
  Competitive:   <Swords size={13} />,
};

interface ForceShiftMatrixProps {
  shifts: ShiftMatrix | null;
  trends: Trend[];
  onSelectCategory?: (catId: string) => void;
}

/**
 * Compute force-level contribution to a category's 2030 shift.
 *
 * For each trend affecting the category:
 * 1. Get trend.gp1_shift (normalized score = impact × probability × direction × gp1_pct_affected)
 * 2. Get category_exposure[catId] (0-5 scale)
 * 3. Contribution = gp1_shift × (category_exposure / 5)
 * 4. Sum by force
 */
function computeForceContributions(
  catId: string,
  trends: Trend[]
): Record<ForceName, number> {
  const result: Record<ForceName, number> = {
    Consumer: 0,
    Customer: 0,
    Technology: 0,
    Government: 0,
    Environmental: 0,
    Competitive: 0,
  };

  trends.forEach(trend => {
    const force = trend.force as ForceName;

    // Get gp1_shift (should already be normalized)
    const gp1Shift = trend.gp1_shift ?? trend.normalized_score ?? 0;

    // Get category exposure for this category (0-5 scale)
    const categoryExposure = trend.category_exposure?.[catId] ?? 0;

    // Normalize exposure (0-5) to (0-1)
    const exposureWeight = Math.max(0, Math.min(5, categoryExposure)) / 5;

    // Force contribution = trend's gp1 shift × exposure weight
    const contribution = gp1Shift * exposureWeight;

    result[force] += contribution;
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

  // Try direct year key with percentile structure
  if (pathObj[2030]) {
    const val = pathObj[2030];
    if (typeof val === 'object' && val !== null) {
      const obj = val as Record<string, unknown>;
      return (obj.median ?? obj.p50 ?? 0) as number;
    }
    return val as number;
  }

  // Try nested median.2030
  if (pathObj.median && typeof pathObj.median === 'object') {
    const medianObj = pathObj.median as Record<string, unknown>;
    if (medianObj[2030] != null) {
      return (medianObj[2030] as number) ?? 0;
    }
  }

  return 0;
}

const ForceShiftMatrix: React.FC<ForceShiftMatrixProps> = ({
  shifts,
  trends,
  onSelectCategory,
}) => {
  // Compute force contributions for all categories, scaled to match MC 2030 total
  const forceContributions = useMemo(() => {
    const result: Record<string, Record<ForceName, number>> = {};
    CATEGORIES.forEach(cat => {
      const raw = computeForceContributions(cat.id, trends);
      const rawTotal = Object.values(raw).reduce((a, b) => a + b, 0);
      const mcTotal = shifts?.[cat.id] ? extract2030Shift(shifts[cat.id]) : 0;

      // Scale force contributions proportionally so they sum to the MC 2030 shift
      if (Math.abs(rawTotal) > 1e-6 && Math.abs(mcTotal) > 1e-6) {
        const scale = mcTotal / rawTotal;
        const scaled: Record<ForceName, number> = {} as Record<ForceName, number>;
        for (const [f, v] of Object.entries(raw)) {
          scaled[f as ForceName] = v * scale;
        }
        result[cat.id] = scaled;
      } else {
        result[cat.id] = raw;
      }
    });
    return result;
  }, [trends, shifts]);

  // Group categories by group (Beauty / LHC)
  const categoryGroups = useMemo(() => {
    const beautyCats = CATEGORIES.filter(c => c.group === 'Beauty');
    const lhcCats = CATEGORIES.filter(c => c.group === 'LHC');
    return [
      { group: 'Beauty', categories: beautyCats },
      { group: 'LHC', categories: lhcCats },
    ];
  }, []);

  // Compute averages by force (average across all categories)
  const totalsByForce = useMemo(() => {
    const sums: Record<ForceName, number> = {
      Consumer: 0,
      Customer: 0,
      Technology: 0,
      Government: 0,
      Environmental: 0,
      Competitive: 0,
    };

    const catCount = CATEGORIES.length || 1;
    CATEGORIES.forEach(cat => {
      const contributions = forceContributions[cat.id] ?? {};
      Object.entries(contributions).forEach(([force, val]) => {
        sums[force as ForceName] += (val as number);
      });
    });

    // Return average, not sum
    const avgs: Record<ForceName, number> = {} as Record<ForceName, number>;
    for (const [force, sum] of Object.entries(sums)) {
      avgs[force as ForceName] = sum / catCount;
    }
    return avgs;
  }, [forceContributions]);

  // Compute max absolute value across all cells for magnitude scaling
  const maxCellVal = useMemo(() => {
    let mx = 0;
    CATEGORIES.forEach(cat => {
      const contributions = forceContributions[cat.id] ?? {};
      Object.values(contributions).forEach(v => { mx = Math.max(mx, Math.abs(v as number)); });
    });
    return mx || 0.01;
  }, [forceContributions]);

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
          Run a simulation to see the force shift matrix
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
        padding: 16,
        paddingTop: 18,
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
          marginBottom: 14,
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
          Category × Force (2030)
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
                fontSize: 10,
                fontWeight: 600,
                color: T.text3,
                padding: '6px 8px',
                minWidth: 90,
              }}
            >
              Category
            </th>
            {(Object.entries(FORCES) as [ForceName, typeof FORCES[ForceName]][]).map(
              ([forceName, forceDef]) => (
                <th
                  key={forceName}
                  style={{
                    textAlign: 'center',
                    fontSize: 9,
                    fontWeight: 600,
                    color: T.text3,
                    padding: '6px 4px',
                    minWidth: 56,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 3,
                    }}
                  >
                    <span style={{ color: T.text3, display: 'flex' }}>{FORCE_LUCIDE[forceName]}</span>
                    <span>{forceName}</span>
                  </div>
                </th>
              )
            )}
            <th
              style={{
                textAlign: 'center',
                fontSize: 10,
                fontWeight: 600,
                color: T.text3,
                padding: '6px 4px',
                minWidth: 56,
              }}
            >
              Total
            </th>
          </tr>
        </thead>

        {/* Body Rows */}
        <tbody>
          {categoryGroups.map(group => {
            // Group header row
            const groupHeaderRows = [
              <tr
                key={`group-${group.group}`}
                style={{
                  background: T.bg1,
                  borderBottom: `1px solid ${T.border}`,
                }}
              >
                <td
                  colSpan={8}
                  style={{
                    padding: '5px 8px',
                    fontSize: 9,
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

            // Category rows
            const categoryRows = group.categories.map((cat, idx) => {
              const contributions = forceContributions[cat.id] ?? {};
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
                      fontSize: 11,
                      fontWeight: 600,
                      color: T.text,
                      padding: '6px 8px',
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

                  {/* Force Contribution Cells */}
                  {(Object.keys(FORCES) as ForceName[]).map((forceName: ForceName) => {
                    const val = (contributions as Record<ForceName, number>)[forceName] ?? 0;
                    return (
                      <td
                        key={`${cat.id}-${forceName}`}
                        style={{
                          padding: 4,
                          textAlign: 'center',
                        }}
                      >
                        <ShiftPill value={val} maxVal={maxCellVal} />
                      </td>
                    );
                  })}

                  {/* Total Column */}
                  <td style={{ padding: 4, textAlign: 'center' }}>
                    <ShiftPill value={catTotal2030} maxVal={maxCellVal} bold />
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
                fontSize: 10,
                fontWeight: 700,
                color: T.text,
                padding: '8px 8px',
                textAlign: 'left',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Portfolio
            </td>

            {(Object.keys(FORCES) as ForceName[]).map(forceName => {
              const val = totalsByForce[forceName] ?? 0;
              return (
                <td
                  key={`total-${forceName}`}
                  style={{
                    padding: 4,
                    textAlign: 'center',
                  }}
                >
                  <ShiftPill value={val} maxVal={maxCellVal} bold />
                </td>
              );
            })}

            {/* Portfolio Total */}
            <td style={{ padding: 4, textAlign: 'center' }}>
              <ShiftPill
                value={(Object.values(totalsByForce) as number[]).reduce((a, b) => a + b, 0)}
                maxVal={maxCellVal}
                bold
              />
            </td>
          </tr>
        </tbody>
      </table>

      {/* Footer */}
      <div style={{ marginTop: 10, fontSize: 9, color: T.text4 }}>
        2030 shift contribution by force · Portfolio = category average · Click row to drill down
      </div>
    </motion.div>
  );
};

export default ForceShiftMatrix;
