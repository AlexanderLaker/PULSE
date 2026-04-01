/**
 * HeadlineKPI — Top-level metric cards for the War Room.
 * Apple × Bain design: 4 KPI cards showing portfolio shift, expansions, contractions, model quality.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, CheckCircle2 } from 'lucide-react';
import React, { useState } from 'react';
import type { ShiftMatrix, ConvergenceDiagnostics } from '../types';
import { T, fmtShift, shiftColorHex } from '../lib/format';

interface KPICardProps {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  label: string;
  value: string;
  detail?: string;
  subDetail?: React.ReactNode;
  color?: string;
  delay?: number;
  bg?: string;
  bgIcon?: string;
  tooltip?: React.ReactNode;
}

/**
 * KPICard — Single metric display with icon, label, value, sublabel.
 * Subtle border, generous whitespace, monospace data.
 */
function KPICard({
  icon: Icon,
  label,
  value,
  detail,
  subDetail,
  color,
  delay = 0,
  bg,
  bgIcon,
  tooltip
}: KPICardProps) {
  const [showTip, setShowTip] = useState(false);
  const cardStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 18,
    paddingTop: 20,
    paddingBottom: 20,
    borderRadius: 12,
    border: `1px solid ${T.border}`,
    background: bg || `linear-gradient(135deg, ${T.bg2}88 0%, ${T.bg3}44 100%)`,
    backdropFilter: 'blur(10px)',
    flex: 1,
    minWidth: 180,
  };

  const labelContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  };

  const iconContainerStyle: React.CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: bgIcon || T.accentDim,
  };

  const labelTextStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: T.text3,
  };

  const valueStyle: React.CSSProperties = {
    fontSize: 28,
    fontWeight: 300,
    fontFamily: T.mono,
    color: color || T.text,
    letterSpacing: -0.5,
  };

  const detailStyle: React.CSSProperties = {
    fontSize: 11,
    color: T.text3,
    lineHeight: 1.4,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
      style={{ ...cardStyle, position: 'relative' as const, cursor: tooltip ? 'help' : undefined }}
      onMouseEnter={() => tooltip && setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
    >
      {/* Label + Icon */}
      <div style={labelContainerStyle}>
        <div style={iconContainerStyle}>
          <Icon size={14} style={{ color: color || T.text3 }} />
        </div>
        <div style={labelTextStyle}>
          {label}
        </div>
      </div>

      {/* Big Value */}
      <div style={valueStyle}>
        {value}
      </div>

      {/* Detail Line */}
      {detail && (
        <div style={detailStyle}>
          {detail}
        </div>
      )}

      {/* Sub-detail (p10–p90 range) */}
      {subDetail}

      {/* Tooltip */}
      <AnimatePresence>
        {showTip && tooltip && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              padding: '10px 12px',
              borderRadius: 12,
              background: 'rgba(29,29,31,0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
              fontSize: 10,
              lineHeight: 1.45,
              color: '#94A3B8',
              zIndex: 10000,
              pointerEvents: 'none',
              overflow: 'auto',
            } as React.CSSProperties}
          >
            {tooltip}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface HeadlineKPIProps {
  shifts: ShiftMatrix | null;
  convergence: ConvergenceDiagnostics | null;
  selectedCategory?: string;
}

export default function HeadlineKPI({
  shifts,
  convergence,
  selectedCategory
}: HeadlineKPIProps) {
  // Helper to extract percentile distribution from a path entry
  function getDist(entry: unknown): { median: number; p10: number; p90: number } {
    if (typeof entry === 'object' && entry !== null && 'median' in entry) {
      const d = entry as { median: number; p10?: number; p90?: number };
      return { median: d.median, p10: d.p10 ?? d.median, p90: d.p90 ?? d.median };
    }
    const v = typeof entry === 'number' ? entry : 0;
    return { median: v, p10: v, p90: v };
  }

  // Compute portfolio average shift at 2030 + top 3 expansions & contractions
  let avgShift = 0;
  let avgP10 = 0;
  let avgP90 = 0;
  let catCount = 0;

  type CatShift = { name: string; val: number; p10: number; p90: number };
  const allCatShifts: CatShift[] = [];

  if (shifts && typeof shifts === 'object') {
    Object.entries(shifts).forEach(([catId, pathData]) => {
      const pathObj = typeof pathData === 'object' && pathData !== null ? pathData : { 2030: pathData };
      const dist = getDist(pathObj[2030]);

      avgShift += dist.median;
      avgP10 += dist.p10;
      avgP90 += dist.p90;
      catCount += 1;

      allCatShifts.push({ name: catId, val: dist.median, p10: dist.p10, p90: dist.p90 });
    });

    if (catCount > 0) {
      avgShift /= catCount;
      avgP10 /= catCount;
      avgP90 /= catCount;
    }
  }

  // Top 3 expansions (highest median shifts) and top 3 contractions (most negative median shifts)
  const sortedDesc = [...allCatShifts].sort((a, b) => b.val - a.val);
  const top3Expansions = sortedDesc.slice(0, 3);
  const top3Contractions = [...allCatShifts].sort((a, b) => a.val - b.val).slice(0, 3);

  const hasConverged = convergence?.converged ?? false;
  const rHat = convergence?.r_hat?.toFixed(2) ?? '—';
  const iterations = convergence?.iterations ?? 50000;

  // Format confidence interval as subtle sub-detail
  const ciStyle: React.CSSProperties = {
    fontSize: 10,
    color: T.text4,
    fontFamily: T.mono,
    marginTop: 2,
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 16,
  };

  return (
    <div style={gridStyle}>
      {/* KPI 1: Net Portfolio Shift */}
      <KPICard
        icon={TrendingUp}
        label="Portfolio Shift 2030"
        value={fmtShift(avgShift)}
        detail={`${catCount} categories analyzed`}
        subDetail={<div style={ciStyle}>p10 {fmtShift(avgP10)}  ·  p90 {fmtShift(avgP90)}</div>}
        color={shiftColorHex(avgShift)}
        bgIcon={avgShift >= 0 ? T.greenDim : T.redDim}
        delay={0}
      />

      {/* KPI 2: Top 3 Expansions — numbered table */}
      <KPICard
        icon={TrendingUp}
        label="Top Expansions"
        value=""
        subDetail={
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: T.mono, fontSize: 10, marginTop: -4 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                <th style={{ textAlign: 'left', padding: '0 0 4px 0', fontWeight: 600, color: T.text3, fontSize: 9 }}>#</th>
                <th style={{ textAlign: 'left', padding: '0 0 4px 0', fontWeight: 600, color: T.text3, fontSize: 9 }}>Category</th>
                <th style={{ textAlign: 'right', padding: '0 0 4px 0', fontWeight: 600, color: T.text3, fontSize: 9 }}>Shift</th>
                <th style={{ textAlign: 'right', padding: '0 0 4px 0', fontWeight: 600, color: T.text3, fontSize: 9 }}>p10–p90</th>
              </tr>
            </thead>
            <tbody>
              {top3Expansions.map((cat, i) => (
                <tr key={cat.name} style={{ borderBottom: i < top3Expansions.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                  <td style={{ padding: '5px 4px 5px 0', color: T.text4, fontWeight: 600 }}>{i + 1}.</td>
                  <td style={{ padding: '5px 4px', color: T.text2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 90 }}>{cat.name}</td>
                  <td style={{ padding: '5px 0 5px 4px', textAlign: 'right', fontWeight: 700, color: shiftColorHex(cat.val) }}>{fmtShift(cat.val)}</td>
                  <td style={{ padding: '5px 0 5px 4px', textAlign: 'right', color: T.text4 }}>{fmtShift(cat.p10)}–{fmtShift(cat.p90)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
        color={top3Expansions[0]?.val !== undefined && top3Expansions[0].val > 0 ? T.green : T.text3}
        bgIcon={top3Expansions[0]?.val !== undefined && top3Expansions[0].val > 0 ? T.greenDim : T.redDim}
        delay={0.08}
      />

      {/* KPI 3: Top 3 Contractions — numbered table */}
      <KPICard
        icon={TrendingDown}
        label="Top Contractions"
        value=""
        subDetail={
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: T.mono, fontSize: 10, marginTop: -4 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                <th style={{ textAlign: 'left', padding: '0 0 4px 0', fontWeight: 600, color: T.text3, fontSize: 9 }}>#</th>
                <th style={{ textAlign: 'left', padding: '0 0 4px 0', fontWeight: 600, color: T.text3, fontSize: 9 }}>Category</th>
                <th style={{ textAlign: 'right', padding: '0 0 4px 0', fontWeight: 600, color: T.text3, fontSize: 9 }}>Shift</th>
                <th style={{ textAlign: 'right', padding: '0 0 4px 0', fontWeight: 600, color: T.text3, fontSize: 9 }}>p10–p90</th>
              </tr>
            </thead>
            <tbody>
              {top3Contractions.map((cat, i) => (
                <tr key={cat.name} style={{ borderBottom: i < top3Contractions.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                  <td style={{ padding: '5px 4px 5px 0', color: T.text4, fontWeight: 600 }}>{i + 1}.</td>
                  <td style={{ padding: '5px 4px', color: T.text2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 90 }}>{cat.name}</td>
                  <td style={{ padding: '5px 0 5px 4px', textAlign: 'right', fontWeight: 700, color: shiftColorHex(cat.val) }}>{fmtShift(cat.val)}</td>
                  <td style={{ padding: '5px 0 5px 4px', textAlign: 'right', color: T.text4 }}>{fmtShift(cat.p10)}–{fmtShift(cat.p90)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
        color={T.red}
        bgIcon={T.redDim}
        delay={0.16}
      />

      {/* KPI 4: Simulation Status */}
      <KPICard
        icon={CheckCircle2}
        label="Simulation Status"
        value={hasConverged ? 'Converged' : 'Running'}
        detail={`R̂ ${rHat} · ${iterations.toLocaleString()} iterations`}
        color={hasConverged ? T.green : T.amber}
        bgIcon={hasConverged ? T.greenDim : T.amberDim}
        delay={0.24}
        tooltip={
          <>
            <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 12, color: '#F8FAFC' }}>
              Bayesian Monte Carlo Simulation
            </div>
            <div style={{ marginBottom: 10, lineHeight: 1.55 }}>
              PRISM runs {iterations.toLocaleString()} Monte Carlo iterations, each sampling trend impacts from Bayesian posterior distributions and combining them via a t-copula dependency structure to estimate profit pool shifts.
            </div>
            <div style={{ fontWeight: 600, marginBottom: 4, color: '#F8FAFC' }}>R̂ (Gelman–Rubin Statistic)</div>
            <div style={{ marginBottom: 10, lineHeight: 1.55 }}>
              Measures whether simulation chains have converged to a stable distribution. R̂ {'<'} 1.05 = excellent, R̂ {'<'} 1.10 = acceptable, R̂ {'>'} 1.10 = results may be unreliable.
            </div>
            <div style={{ fontWeight: 600, marginBottom: 4, color: '#F8FAFC' }}>"{hasConverged ? 'Converged' : 'Running'}" means</div>
            <div style={{ lineHeight: 1.55 }}>
              {hasConverged
                ? 'All parameter chains have stabilized (R̂ < 1.10). The shift percentiles (p10, p25, median, p75, p90) are statistically reliable and safe to use for strategic decisions.'
                : 'The simulation chains have not yet stabilized. Consider increasing iterations in Model Configuration for more reliable results.'}
            </div>
          </>
        }
      />
    </div>
  );
}
