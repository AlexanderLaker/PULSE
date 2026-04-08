/**
 * ValueChainShiftMatrix — Profit Pool Impact by Category × Value Chain Step (2030)
 * Apple × Bain design: displays how each VC step contributes to category shifts.
 *
 * Matrix structure:
 * - Rows: 12 categories (Hair × 4, LHC × 8)
 * - Columns: 8 VC steps (Raw Materials → Consumer)
 * - Values: VC step contribution to 2030 category shift
 *
 * Data source: vc_decomposition from Bayesian MC simulation.
 * Color-coded by direction (green expansion, red contraction).
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { FlaskConical, TestTubes, Factory, Package, Truck, Megaphone, Handshake, User } from 'lucide-react';
import type { ShiftMatrix, Trend } from '../types';
import type { VCDecomposition } from '../types/simulation';
import { T, CATEGORIES, fmtShift, shiftColorHex, shiftCellColors, shortCat } from '../lib/format';
import ShiftPill from './ShiftPill';

/** The 8 value chain steps (must match backend pulse/config.py VC_STEPS) */
const VC_STEPS = [
  { id: 'Raw Materials',  short: 'Raw Mat',    icon: <FlaskConical size={12} /> },
  { id: 'Formulation',    short: 'Formula',    icon: <TestTubes size={12} /> },
  { id: 'Manufacturing',  short: 'Mfg',        icon: <Factory size={12} /> },
  { id: 'Packaging',      short: 'Pkg',        icon: <Package size={12} /> },
  { id: 'Supply Chain',   short: 'Supply',     icon: <Truck size={12} /> },
  { id: 'Marketing',      short: 'Mktg',       icon: <Megaphone size={12} /> },
  { id: 'Commercial',     short: 'Comm',       icon: <Handshake size={12} /> },
  { id: 'Consumer',       short: 'Cons',       icon: <User size={12} /> },
];

interface ValueChainShiftMatrixProps {
  shifts: ShiftMatrix | null;
  trends: Trend[];
  vcDecomposition?: VCDecomposition | null;
  onSelectCategory?: (catId: string) => void;
}

/**
 * Case-insensitive key lookup for VC decomposition data.
 * Backend uses "Hair: Color" keys, frontend uses "hair_color".
 */
function findVCData(
  vcDecomp: VCDecomposition,
  catId: string,
  catName: string
): Record<string, number> | null {
  // Try exact catId match
  if (vcDecomp[catId]) return vcDecomp[catId];
  // Try category name match (backend uses "Hair: Color")
  if (vcDecomp[catName]) return vcDecomp[catName];
  // Try normalized name match
  const normId = catId.toLowerCase().replace(/\s+/g, '_');
  for (const [key, val] of Object.entries(vcDecomp)) {
    const normKey = key.toLowerCase().replace(/^(hair|lhc):\s*/, (_, g) => g + '_').replace(/\s+/g, '_');
    if (normKey === normId) return val;
  }
  return null;
}

/**
 * Compute VC step contributions from trends when no backend vc_decomposition is available.
 * Fallback: weight-proportional allocation based on trend VC exposures.
 */
function computeVCFromTrends(
  catId: string,
  trends: Trend[],
  mc2030: number
): Record<string, number> {
  const stepScores: Record<string, number> = {};
  VC_STEPS.forEach(step => { stepScores[step.id] = 0; });

  const normVcKey = (k: string): string => k.toLowerCase().replace(/[\s-]+/g, '_');

  trends.forEach(trend => {
    const catExp = trend.category_exposure?.[catId] ?? 0;
    if (catExp <= 0) return;
    const gp1Shift = Math.abs(trend.gp1_shift ?? trend.normalized_score ?? 0);
    const vcExp: Record<string, number> = (trend.vc_exposure ?? {}) as Record<string, number>;

    VC_STEPS.forEach(step => {
      // Try exact match first, then normalized match
      let vcVal: number = vcExp[step.id] ?? 0;
      if (vcVal === 0) {
        const normStep = normVcKey(step.id);
        for (const [k, v] of Object.entries(vcExp)) {
          if (normVcKey(k) === normStep) { vcVal = v; break; }
        }
      }
      stepScores[step.id] = (stepScores[step.id] ?? 0) + gp1Shift * (catExp / 5.0) * (vcVal / 5.0);
    });
  });

  // Normalize to proportions, then allocate the MC 2030 shift
  const total = Object.values(stepScores).reduce((a, b) => a + b, 0);
  if (total > 1e-10 && Math.abs(mc2030) > 1e-10) {
    return Object.fromEntries(
      Object.entries(stepScores).map(([k, v]) => [k, (v / total) * mc2030])
    );
  }
  // Equal split fallback
  const n = VC_STEPS.length;
  return Object.fromEntries(VC_STEPS.map(s => [s.id, mc2030 / n]));
}

/**
 * Extract 2030 median shift from nested path structure.
 */
function extract2030Shift(pathData: unknown): number {
  if (!pathData) return 0;
  if (typeof pathData === 'number') return pathData;
  const pathObj = pathData as Record<string, unknown>;
  if (pathObj[2030]) {
    const val = pathObj[2030];
    if (typeof val === 'object' && val !== null) {
      return ((val as Record<string, unknown>).median ?? 0) as number;
    }
    return val as number;
  }
  return 0;
}

const ValueChainShiftMatrix: React.FC<ValueChainShiftMatrixProps> = ({
  shifts,
  trends,
  vcDecomposition,
  onSelectCategory,
}) => {
  // Resolve VC contributions per category: prefer backend data, fall back to trend-based calc
  const vcContributions = useMemo(() => {
    const result: Record<string, Record<string, number>> = {};
    CATEGORIES.forEach(cat => {
      const mc2030 = shifts?.[cat.id] ? extract2030Shift(shifts[cat.id]) : 0;

      if (vcDecomposition) {
        const backendData = findVCData(vcDecomposition, cat.id, cat.name);
        if (backendData) {
          result[cat.id] = backendData;
          return;
        }
      }
      // Fallback: compute from trends
      result[cat.id] = computeVCFromTrends(cat.id, trends, mc2030);
    });
    return result;
  }, [shifts, trends, vcDecomposition]);

  // Group categories by division
  const categoryGroups = useMemo(() => [
    { group: 'Hair', categories: CATEGORIES.filter(c => c.group === 'Hair') },
    { group: 'LHC', categories: CATEGORIES.filter(c => c.group === 'LHC') },
  ], []);

  // Portfolio average per VC step
  const totalsByStep = useMemo(() => {
    const sums: Record<string, number> = {};
    VC_STEPS.forEach(s => { sums[s.id] = 0; });
    const n = CATEGORIES.length || 1;
    CATEGORIES.forEach(cat => {
      const contrib = vcContributions[cat.id] ?? {};
      VC_STEPS.forEach(step => {
        sums[step.id] = (sums[step.id] ?? 0) + (contrib[step.id] ?? 0);
      });
    });
    return Object.fromEntries(Object.entries(sums).map(([k, v]) => [k, v / n]));
  }, [vcContributions]);

  // Compute max absolute value across all cells for magnitude scaling
  const maxCellVal = useMemo(() => {
    let mx = 0;
    CATEGORIES.forEach(cat => {
      const contrib = vcContributions[cat.id] ?? {};
      Object.values(contrib).forEach(v => { mx = Math.max(mx, Math.abs(v)); });
    });
    return mx || 0.01;
  }, [vcContributions]);

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
          Run a simulation to see the value chain shift matrix
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h3 style={{
          fontSize: 12, fontWeight: 600, color: T.text3,
          textTransform: 'uppercase', letterSpacing: 0.8, margin: 0,
        }}>
          Category × Value Chain (2030)
        </h3>
        <div style={{ fontSize: 10, color: T.text4, display: 'flex', gap: 16 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: T.green }} />
            Expansion
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: T.red }} />
            Contraction
          </span>
        </div>
      </div>

      {/* Table */}
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '2px', fontFamily: T.mono }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', fontSize: 11, fontWeight: 600, color: T.text3, padding: 10, paddingLeft: 12, minWidth: 120 }}>
              Category
            </th>
            {VC_STEPS.map(step => (
              <th key={step.id} style={{ textAlign: 'center', fontSize: 9, fontWeight: 600, color: T.text3, padding: '6px 4px', minWidth: 52 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <span style={{ color: T.text3, display: 'flex' }}>{step.icon}</span>
                  <span>{step.short}</span>
                </div>
              </th>
            ))}
            <th style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: T.text3, padding: 10, minWidth: 80 }}>
              Total
            </th>
          </tr>
        </thead>

        <tbody>
          {categoryGroups.map(group => {
            const groupHeaderRows = [
              <tr key={`group-${group.group}`} style={{ background: T.bg1, borderBottom: `1px solid ${T.border}` }}>
                <td colSpan={10} style={{
                  padding: 8, paddingLeft: 12, fontSize: 10, fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: 0.5, color: T.text3,
                }}>
                  {group.group}
                </td>
              </tr>,
            ];

            const categoryRows = group.categories.map((cat, idx) => {
              const contrib = vcContributions[cat.id] ?? {};
              const catTotal2030 = shifts[cat.id] ? extract2030Shift(shifts[cat.id]) : 0;

              return (
                <motion.tr
                  key={cat.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.01, duration: 0.2 }}
                  onClick={() => onSelectCategory?.(cat.id)}
                  style={{ borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s' } as React.CSSProperties}
                  onMouseEnter={(e: React.MouseEvent<HTMLTableRowElement>) => { e.currentTarget.style.background = `${T.border}`; }}
                  onMouseLeave={(e: React.MouseEvent<HTMLTableRowElement>) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  {/* Category Name */}
                  <td style={{ fontSize: 12, fontWeight: 600, color: T.text, padding: '10px 12px', whiteSpace: 'nowrap', textAlign: 'left' } as React.CSSProperties}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 3, height: 20, borderRadius: 1, background: cat.color }} />
                      {shortCat(cat.name)}
                    </div>
                  </td>

                  {/* VC Step Cells */}
                  {VC_STEPS.map(step => {
                    const val = contrib[step.id] ?? 0;
                    return (
                      <td key={`${cat.id}-${step.id}`} style={{ padding: 4, textAlign: 'center' }}>
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

          {/* Portfolio Average Row */}
          <tr style={{ borderTop: `2px solid ${T.border}`, background: T.bg1, fontWeight: 600 }}>
            <td style={{
              fontSize: 11, fontWeight: 700, color: T.text, padding: '12px 12px',
              textAlign: 'left', textTransform: 'uppercase', letterSpacing: 0.5,
            }}>
              Portfolio
            </td>
            {VC_STEPS.map(step => {
              const val = totalsByStep[step.id] ?? 0;
              return (
                <td key={`total-${step.id}`} style={{ padding: 4, textAlign: 'center' }}>
                  <ShiftPill value={val} maxVal={maxCellVal} bold />
                </td>
              );
            })}
            {/* Portfolio Total */}
            {(() => {
              const portfolioTotal = Object.values(totalsByStep).reduce((a, b) => a + b, 0);
              return (
                <td style={{ padding: 4, textAlign: 'center' }}>
                  <ShiftPill value={portfolioTotal} maxVal={maxCellVal} bold />
                </td>
              );
            })()}
          </tr>
        </tbody>
      </table>

      {/* Footer */}
      <div style={{ marginTop: 10, fontSize: 9, color: T.text4 }}>
        2030 shift contribution by VC step · Portfolio = category average · Click row to drill down
      </div>
    </motion.div>
  );
};

export default ValueChainShiftMatrix;
