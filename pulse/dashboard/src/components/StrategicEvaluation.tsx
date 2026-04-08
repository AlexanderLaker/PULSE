/**
 * StrategicEvaluation.tsx — Category-Level Strategic Deep-Dive
 *
 * The "So What" page: transforms raw simulation output into structured
 * strategic assessments per category with reasoning chains fully visible.
 *
 * Bain Senior Partner × Apple SVP Design × Goldman Sachs Senior Director
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, TrendingUp, TrendingDown, Shield, AlertTriangle,
  ChevronRight, ArrowUpRight, ArrowDownRight, Minus, Activity,
  Eye, Zap, Users, BarChart3, Layers, Route, Clock,
  CheckCircle2, XCircle, AlertCircle, ArrowRight, Crosshair,
} from 'lucide-react';

import { T, CATEGORIES, YEARS, FORCES, FORCE_COLORS, fmtShift, fmtPct, shiftColorHex } from '../lib/format';
import type {
  Trend, ShiftMatrix, ForceContribution, CausalEdge,
  AllocationRecommendation, ConvergenceDiagnostics, ForceName,
  PercentileDistribution,
} from '../types';

// ─── Types ────────────────────────────────────────────────────────

interface TrendWithSources extends Omit<Trend, 'sources'> {
  sources: Array<{ title: string; url: string; data: string; tier?: string }>;
  category_exposure: Record<string, number>;
  vc_exposure: Record<string, number>;
}

interface StrategicEvaluationProps {
  shifts: ShiftMatrix;
  trends: TrendWithSources[];
  forceContributions: Record<string, ForceContribution[]>;
  dagEdges: CausalEdge[];
  allocation: Array<AllocationRecommendation & { rationale?: string }>;
  convergence: ConvergenceDiagnostics;
  onNavigateToTrend?: (search: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────

function getShiftVal(path: any, year: number): PercentileDistribution | null {
  if (!path) return null;
  const entry = path[year];
  if (!entry) return null;
  if (typeof entry === 'number') return { median: entry };
  return entry as PercentileDistribution;
}

function getMedian(path: any, year: number): number {
  const v = getShiftVal(path, year);
  return v?.median ?? 0;
}

function getP10(path: any, year: number): number {
  const v = getShiftVal(path, year);
  return v?.p10 ?? v?.median ?? 0;
}

function getP90(path: any, year: number): number {
  const v = getShiftVal(path, year);
  return v?.p90 ?? v?.median ?? 0;
}

type Verdict = 'Strong Tailwind' | 'Moderate Tailwind' | 'Neutral / Mixed' | 'Moderate Headwind' | 'Severe Headwind';
type Conviction = 'High Conviction' | 'Moderate Conviction' | 'Low Conviction';
type Velocity = 'Accelerating' | 'Decelerating' | 'Steady';
type PathShape = 'Front-loaded' | 'Back-loaded' | 'Linear' | 'Step-function';
type Posture = 'INVEST' | 'DEFEND' | 'HARVEST' | 'MONITOR';

function deriveVerdict(median2030: number, ciWidth: number): Verdict {
  if (median2030 > 0.02) return 'Strong Tailwind';
  if (median2030 > 0.005) return 'Moderate Tailwind';
  if (median2030 > -0.005) return 'Neutral / Mixed';
  if (median2030 > -0.02) return 'Moderate Headwind';
  return 'Severe Headwind';
}

function deriveConviction(median2030: number, ciWidth: number): Conviction {
  if (Math.abs(median2030) < 0.001) return 'Low Conviction';
  const ratio = ciWidth / Math.max(Math.abs(median2030), 0.001);
  if (ratio < 2) return 'High Conviction';
  if (ratio < 4) return 'Moderate Conviction';
  return 'Low Conviction';
}

function deriveVelocity(path: any): { label: Velocity; direction: 'up' | 'down' | 'flat' } {
  const deltas: number[] = [];
  for (let i = 1; i < YEARS.length; i++) {
    const prev = getMedian(path, YEARS[i - 1]!);
    const curr = getMedian(path, YEARS[i]!);
    deltas.push(curr - prev);
  }
  if (deltas.length < 2) return { label: 'Steady', direction: 'flat' };
  const early = Math.abs(deltas[0] || 0);
  const late = Math.abs(deltas[deltas.length - 1] || 0);
  const median2030 = getMedian(path, 2030);
  const dir = median2030 >= 0 ? 'up' : 'down';
  if (late > early * 1.3) return { label: 'Accelerating', direction: dir };
  if (early > late * 1.3) return { label: 'Decelerating', direction: dir };
  return { label: 'Steady', direction: dir };
}

function derivePathShape(path: any): PathShape {
  const total = Math.abs(getMedian(path, 2030));
  if (total < 0.001) return 'Linear';
  const mid = Math.abs(getMedian(path, 2028));
  const ratio = mid / total;
  if (ratio > 0.65) return 'Front-loaded';
  if (ratio < 0.35) return 'Back-loaded';
  // Check for step-function: any single year jump > 50% of total
  for (let i = 1; i < YEARS.length; i++) {
    const jump = Math.abs(getMedian(path, YEARS[i]!) - getMedian(path, YEARS[i - 1]!));
    if (jump / total > 0.5) return 'Step-function';
  }
  return 'Linear';
}

function derivePosture(median2030: number, conviction: Conviction): Posture {
  if (median2030 > 0.01 && conviction !== 'Low Conviction') return 'INVEST';
  if (median2030 < -0.01 && conviction !== 'Low Conviction') return 'DEFEND';
  if (median2030 < -0.02) return 'HARVEST';
  return 'MONITOR';
}

const VERDICT_CONFIG: Record<Verdict, { color: string; bg: string; icon: any }> = {
  'Strong Tailwind': { color: '#15803d', bg: 'rgba(48,209,88,0.10)', icon: ArrowUpRight },
  'Moderate Tailwind': { color: T.green, bg: T.greenDim, icon: TrendingUp },
  'Neutral / Mixed': { color: T.text2, bg: T.bg3, icon: Minus },
  'Moderate Headwind': { color: T.red, bg: T.redDim, icon: TrendingDown },
  'Severe Headwind': { color: '#991b1b', bg: 'rgba(255,69,58,0.12)', icon: ArrowDownRight },
};

const POSTURE_CONFIG: Record<Posture, { color: string; bg: string; label: string; desc: string }> = {
  'INVEST': { color: '#15803d', bg: 'rgba(48,209,88,0.10)', label: 'INVEST', desc: 'Pool expanding — accelerate category investment' },
  'DEFEND': { color: T.amber, bg: T.amberDim, label: 'DEFEND', desc: 'Pool contracting but defensible — invest in moat' },
  'HARVEST': { color: T.red, bg: T.redDim, label: 'HARVEST', desc: 'Pool contracting — optimize for cash extraction' },
  'MONITOR': { color: T.accent, bg: T.accentDim, label: 'MONITOR', desc: 'Uncertain — maintain allocation, monitor triggers' },
};

// ─── Sparkline ────────────────────────────────────────────────────

function MiniSparkline({ path, color, width = 80, height = 28 }: { path: any; color: string; width?: number; height?: number }) {
  const values = YEARS.map(y => getMedian(path, y));
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = max - min || 0.01;
  const pad = 2;
  const points = values.map((v, i) => {
    const x = pad + (i / (YEARS.length - 1)) * (width - 2 * pad);
    const y = height - pad - ((v - min) / range) * (height - 2 * pad);
    return `${x},${y}`;
  }).join(' ');
  const zeroY = height - pad - ((0 - min) / range) * (height - 2 * pad);

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <line x1={pad} y1={zeroY} x2={width - pad} y2={zeroY} stroke={T.border} strokeWidth={0.5} strokeDasharray="2,2" />
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      {values.map((v, i) => {
        const x = pad + (i / (YEARS.length - 1)) * (width - 2 * pad);
        const y = height - pad - ((v - min) / range) * (height - 2 * pad);
        return <circle key={i} cx={x} cy={y} r={i === values.length - 1 ? 2.5 : 1.5} fill={color} />;
      })}
    </svg>
  );
}

// ─── Net Assessment Bar ───────────────────────────────────────────

function NetAssessmentBar({ tailwindSum, headwindSum }: { tailwindSum: number; headwindSum: number }) {
  const total = Math.abs(tailwindSum) + Math.abs(headwindSum);
  if (total < 0.0001) return null;
  const tailPct = (Math.abs(tailwindSum) / total) * 100;
  const headPct = (Math.abs(headwindSum) / total) * 100;
  const net = tailwindSum + headwindSum;

  return (
    <div style={{ marginTop: 20, padding: '16px 20px', background: T.bg2, borderRadius: 10, border: `1px solid ${T.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: T.green, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Tailwinds {fmtShift(tailwindSum)}
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, fontFamily: T.mono, color: shiftColorHex(net) }}>
          Net: {fmtShift(net)}
        </span>
        <span style={{ fontSize: 10, fontWeight: 600, color: T.red, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Headwinds {fmtShift(headwindSum)}
        </span>
      </div>
      <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: T.bg4 }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${tailPct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ background: `linear-gradient(90deg, ${T.green}80, ${T.green})`, borderRadius: '4px 0 0 4px' }}
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${headPct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
          style={{ background: `linear-gradient(90deg, ${T.red}, ${T.red}80)`, borderRadius: '0 4px 4px 0' }}
        />
      </div>
    </div>
  );
}

// ─── Contributing Trend Card ──────────────────────────────────────

function TrendCard({ trend, contribution, totalContrib, rank, onNavigate }: {
  trend: TrendWithSources;
  contribution: number;
  totalContrib: number;
  rank: number;
  onNavigate?: (search: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isExpansion = trend.direction === 'Expansion';
  const color = isExpansion ? T.green : T.red;
  const bg = isExpansion ? T.greenDim : T.redDim;
  const forceColor = FORCE_COLORS[trend.force] || T.text2;
  const contribPct = totalContrib > 0 ? Math.abs(contribution) / totalContrib : 0;
  const exposure = trend.category_exposure ? Math.max(...Object.values(trend.category_exposure).filter(v => typeof v === 'number') as number[], 0) : 0;
  const sourceTier = trend.sources?.[0]?.tier || '';

  const tierColors: Record<string, { color: string; bg: string }> = {
    'S': { color: '#15803d', bg: 'rgba(48,209,88,0.12)' },
    'A': { color: T.accent, bg: T.accentDim },
    'A-': { color: T.accent, bg: T.accentDim },
    'B+': { color: T.purple, bg: T.purpleDim },
    'B': { color: T.text2, bg: T.bg3 },
    'B-': { color: T.text3, bg: T.bg3 },
    'C': { color: T.text3, bg: T.bg3 },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.04 }}
      onClick={() => setExpanded(!expanded)}
      style={{
        padding: '12px 16px',
        borderRadius: 10,
        border: `1px solid ${rank < 3 ? `${color}30` : T.border}`,
        background: rank < 3 ? bg : T.bg,
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Force badge */}
        <div style={{
          width: 6, height: 6, borderRadius: 3,
          background: forceColor, flexShrink: 0,
        }} />

        {/* Name + force */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.text, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {trend.name}
          </div>
          <div style={{ fontSize: 10, color: T.text3, marginTop: 1 }}>
            {trend.force}
          </div>
        </div>

        {/* Contribution bar */}
        <div style={{ width: 60, flexShrink: 0 }}>
          <div style={{ height: 4, borderRadius: 2, background: T.bg4, overflow: 'hidden' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(contribPct * 100, 100)}%` }}
              transition={{ duration: 0.6, delay: rank * 0.05 }}
              style={{ height: '100%', background: color, borderRadius: 2 }}
            />
          </div>
          <div style={{ fontSize: 9, color: T.text3, marginTop: 2, textAlign: 'right', fontFamily: T.mono }}>
            {(contribPct * 100).toFixed(0)}%
          </div>
        </div>

        {/* Score */}
        <div style={{
          padding: '2px 8px', borderRadius: 12, background: bg,
          fontSize: 11, fontWeight: 700, fontFamily: T.mono, color,
          flexShrink: 0,
        }}>
          {fmtShift(contribution)}
        </div>

        {/* Source tier badge */}
        {sourceTier && (
          <div style={{
            padding: '1px 6px', borderRadius: 8, fontSize: 9, fontWeight: 700,
            color: tierColors[sourceTier]?.color || T.text3,
            background: tierColors[sourceTier]?.bg || T.bg3,
            flexShrink: 0,
          }}>
            {sourceTier}
          </div>
        )}
      </div>

      {/* Expanded description */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ fontSize: 11, color: T.text2, lineHeight: 1.55, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
              {trend.description || 'No description available.'}
            </div>
            {trend.strategic_implication && (
              <div style={{ fontSize: 11, color: T.accent, lineHeight: 1.55, marginTop: 6, fontStyle: 'italic' }}>
                {trend.strategic_implication}
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <span style={{ fontSize: 10, color: T.text3 }}>
                Probability: <strong style={{ color: T.text2 }}>{trend.probability}/5</strong>
              </span>
              <span style={{ fontSize: 10, color: T.text3 }}>
                GP1 Affected: <strong style={{ color: T.text2 }}>{fmtPct(trend.gp1_pct_affected)}</strong>
              </span>
              <span style={{ fontSize: 10, color: T.text3 }}>
                Confidence: <strong style={{ color: T.text2 }}>{trend.confidence || 'Medium'}</strong>
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}


// ─── Section Header ───────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8,
        background: T.accentDim, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={14} color={T.accent} />
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text, letterSpacing: 0.3 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 10, color: T.text3, marginTop: 1 }}>{subtitle}</div>}
      </div>
    </div>
  );
}


// ─── Fact Card ────────────────────────────────────────────────────

function FactCard({ label, value, detail, color, icon: Icon }: {
  label: string; value: string; detail?: string; color?: string; icon?: any;
}) {
  return (
    <div style={{
      padding: '14px 16px', borderRadius: 10,
      border: `1px solid ${T.border}`, background: T.bg,
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {Icon && <Icon size={11} color={T.text3} />}
        <span style={{ fontSize: 10, fontWeight: 600, color: T.text3, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 300, fontFamily: T.mono, color: color || T.text, lineHeight: 1.2 }}>
        {value}
      </div>
      {detail && (
        <div style={{ fontSize: 10, color: T.text3, lineHeight: 1.4 }}>
          {detail}
        </div>
      )}
    </div>
  );
}


// ─── Strategic Text Block ─────────────────────────────────────────

function StrategicText({ label, color, children }: { label: string; color?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: color || T.accent,
        textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6,
      }}>
        {label}
      </div>
      <div style={{ fontSize: 12.5, color: T.text, lineHeight: 1.65 }}>
        {children}
      </div>
    </div>
  );
}


// ─── Action Item ──────────────────────────────────────────────────

function ActionItem({ text, timeHorizon, forces }: {
  text: string; timeHorizon: string; forces: string[];
}) {
  return (
    <div style={{
      display: 'flex', gap: 12, padding: '10px 14px',
      borderRadius: 8, border: `1px solid ${T.border}`, background: T.bg,
      alignItems: 'flex-start',
    }}>
      <ChevronRight size={14} color={T.accent} style={{ marginTop: 1, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, color: T.text, lineHeight: 1.5 }}>{text}</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
            background: T.accentDim, color: T.accent,
          }}>
            {timeHorizon}
          </span>
          {forces.map(f => (
            <span key={f} style={{
              fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
              background: `${FORCE_COLORS[f as ForceName] || T.text3}15`,
              color: FORCE_COLORS[f as ForceName] || T.text3,
            }}>
              {f}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}


// ─── Portfolio Overview Table ─────────────────────────────────────

function PortfolioOverview({ shifts, analyses, onSelectCategory }: {
  shifts: ShiftMatrix;
  analyses: Map<string, CategoryAnalysis>;
  onSelectCategory: (id: string) => void;
}) {
  const rows = CATEGORIES.map(cat => {
    const a = analyses.get(cat.id);
    return { cat, a };
  }).sort((a, b) => {
    const aShift = Math.abs(a.a?.median2030 ?? 0);
    const bShift = Math.abs(b.a?.median2030 ?? 0);
    return bShift - aShift;
  });

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            {['Category', 'Verdict', '2030 Shift', 'Conviction', 'Posture', 'Top Force', '#1 Tailwind', '#1 Headwind'].map(h => (
              <th key={h} style={{
                textAlign: 'left', padding: '10px 12px', fontSize: 10, fontWeight: 700,
                color: T.text3, textTransform: 'uppercase', letterSpacing: 0.8,
                borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap',
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ cat, a }, i) => {
            if (!a) return null;
            const vc = VERDICT_CONFIG[a.verdict];
            const pc = POSTURE_CONFIG[a.posture];
            return (
              <motion.tr
                key={cat.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => onSelectCategory(cat.id)}
                style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = T.bg2)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={{ padding: '10px 12px', borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 4, height: 20, borderRadius: 2, background: cat.color }} />
                    <div>
                      <div style={{ fontWeight: 600, color: T.text }}>{cat.short}</div>
                      <div style={{ fontSize: 10, color: T.text3 }}>{cat.group}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '10px 12px', borderBottom: `1px solid ${T.border}` }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 10,
                    color: vc.color, background: vc.bg,
                  }}>
                    {a.verdict}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', borderBottom: `1px solid ${T.border}`, fontFamily: T.mono, fontWeight: 600, color: shiftColorHex(a.median2030) }}>
                  {fmtShift(a.median2030)}
                </td>
                <td style={{ padding: '10px 12px', borderBottom: `1px solid ${T.border}`, fontSize: 11, color: T.text2 }}>
                  {a.conviction}
                </td>
                <td style={{ padding: '10px 12px', borderBottom: `1px solid ${T.border}` }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 10,
                    color: pc.color, background: pc.bg,
                  }}>
                    {a.posture}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', borderBottom: `1px solid ${T.border}` }}>
                  {a.topForce && (
                    <span style={{ fontSize: 11, color: FORCE_COLORS[a.topForce] || T.text2, fontWeight: 600 }}>
                      {a.topForce}
                    </span>
                  )}
                </td>
                <td style={{ padding: '10px 12px', borderBottom: `1px solid ${T.border}`, fontSize: 11, color: T.green, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.topTailwind || '—'}
                </td>
                <td style={{ padding: '10px 12px', borderBottom: `1px solid ${T.border}`, fontSize: 11, color: T.red, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.topHeadwind || '—'}
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}


// ─── Category Analysis Type ───────────────────────────────────────

interface CategoryAnalysis {
  catId: string;
  catName: string;
  catShort: string;
  catGroup: string;
  catColor: string;
  median2030: number;
  p10_2030: number;
  p90_2030: number;
  ciWidth: number;
  verdict: Verdict;
  conviction: Conviction;
  velocity: { label: Velocity; direction: 'up' | 'down' | 'flat' };
  pathShape: PathShape;
  posture: Posture;
  topForce: ForceName | null;
  topForces: Array<{ force: ForceName; value: number }>;
  tailwinds: Array<{ trend: TrendWithSources; contribution: number }>;
  headwinds: Array<{ trend: TrendWithSources; contribution: number }>;
  tailwindSum: number;
  headwindSum: number;
  trendConcentration: { top3Share: number; totalTrends: number; topCount: number };
  topTailwind: string;
  topHeadwind: string;
}


// ─── Main Component ───────────────────────────────────────────────

export default function StrategicEvaluation({
  shifts, trends, forceContributions, dagEdges, allocation, convergence, onNavigateToTrend,
}: StrategicEvaluationProps) {
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'portfolio' | 'deepdive'>('portfolio');

  // ─── Compute analyses for all categories ───
  const analyses = useMemo(() => {
    const map = new Map<string, CategoryAnalysis>();

    for (const cat of CATEGORIES) {
      const path = shifts[cat.id];
      const median2030 = getMedian(path, 2030);
      const p10_2030 = getP10(path, 2030);
      const p90_2030 = getP90(path, 2030);
      const ciWidth = Math.abs(p90_2030 - p10_2030);

      // Force contributions
      const fcs = forceContributions[cat.id] || [];
      const sortedForces = [...fcs].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
      const topForce = sortedForces[0]?.force || null;

      // Contributing trends
      const catTrends = trends
        .filter(t => t.category_exposure && (t.category_exposure[cat.id] ?? 0) > 0)
        .map(t => {
          const exposure = t.category_exposure?.[cat.id] ?? 0;
          const gp1Shift = t.gp1_shift ?? t.normalized_score ?? 0;
          const contribution = gp1Shift * (exposure / 5);
          return { trend: t, contribution };
        })
        .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

      const tailwinds = catTrends.filter(ct => ct.contribution > 0).sort((a, b) => b.contribution - a.contribution);
      const headwinds = catTrends.filter(ct => ct.contribution < 0).sort((a, b) => a.contribution - b.contribution);
      const tailwindSum = tailwinds.reduce((s, ct) => s + ct.contribution, 0);
      const headwindSum = headwinds.reduce((s, ct) => s + ct.contribution, 0);

      // Trend concentration
      const allContribs = catTrends.map(ct => Math.abs(ct.contribution));
      const totalContrib = allContribs.reduce((s, v) => s + v, 0);
      let cumulative = 0;
      let topCount = 0;
      for (const c of allContribs) {
        cumulative += c;
        topCount++;
        if (cumulative >= totalContrib * 0.8) break;
      }

      const verdict = deriveVerdict(median2030, ciWidth);
      const conviction = deriveConviction(median2030, ciWidth);
      const posture = derivePosture(median2030, conviction);

      map.set(cat.id, {
        catId: cat.id,
        catName: cat.name,
        catShort: cat.short,
        catGroup: cat.group,
        catColor: cat.color,
        median2030,
        p10_2030,
        p90_2030,
        ciWidth,
        verdict,
        conviction,
        velocity: deriveVelocity(path),
        pathShape: derivePathShape(path),
        posture,
        topForce,
        topForces: sortedForces.slice(0, 3).map(f => ({ force: f.force, value: f.value })),
        tailwinds,
        headwinds,
        tailwindSum,
        headwindSum,
        trendConcentration: { top3Share: totalContrib > 0 ? cumulative / totalContrib : 0, totalTrends: catTrends.length, topCount },
        topTailwind: tailwinds[0]?.trend.name || '',
        topHeadwind: headwinds[0]?.trend.name || '',
      });
    }
    return map;
  }, [shifts, trends, forceContributions]);

  // Auto-select highest-impact category if none selected
  const effectiveCatId = selectedCatId || (() => {
    let maxShift = 0;
    let maxId = CATEGORIES[0]?.id || '';
    for (const [id, a] of analyses) {
      if (Math.abs(a.median2030) > maxShift) {
        maxShift = Math.abs(a.median2030);
        maxId = id;
      }
    }
    return maxId;
  })();

  const analysis = analyses.get(effectiveCatId);
  const catDef = CATEGORIES.find(c => c.id === effectiveCatId);

  // ─── Generate strategic actions from trend/force data ───
  const strategicActions = useMemo(() => {
    if (!analysis) return [];
    const actions: Array<{ text: string; timeHorizon: string; forces: string[] }> = [];

    // Derive actions from top contributing trends
    const topTrends = [...analysis.tailwinds.slice(0, 3), ...analysis.headwinds.slice(0, 3)];
    for (const ct of topTrends) {
      const t = ct.trend;
      if (t.strategic_implication) {
        const horizon = t.force === 'Government' ? 'Immediate' :
          t.force === 'Technology' ? '12-24 months' : '6-12 months';
        actions.push({
          text: t.strategic_implication,
          timeHorizon: horizon,
          forces: [t.force],
        });
      }
    }

    // If no strategic implications from trends, generate from posture
    if (actions.length === 0) {
      const posture = analysis.posture;
      if (posture === 'INVEST') {
        actions.push({ text: `Accelerate investment in ${analysis.catShort} to capture expanding pool opportunity.`, timeHorizon: '6-12 months', forces: analysis.topForces.map(f => f.force) });
      } else if (posture === 'DEFEND') {
        actions.push({ text: `Defend market position in ${analysis.catShort} through innovation and shelf-space protection.`, timeHorizon: 'Immediate', forces: analysis.topForces.map(f => f.force) });
      } else if (posture === 'HARVEST') {
        actions.push({ text: `Optimize ${analysis.catShort} for cash generation; reduce discretionary spend.`, timeHorizon: 'Immediate', forces: analysis.topForces.map(f => f.force) });
      } else {
        actions.push({ text: `Maintain current allocation for ${analysis.catShort}; monitor trigger conditions closely.`, timeHorizon: '6-12 months', forces: analysis.topForces.map(f => f.force) });
      }
    }

    return actions.slice(0, 5);
  }, [analysis]);

  // ─── Causal chain narrative ───
  const causalNarrative = useMemo(() => {
    if (!analysis || !analysis.topForce) return null;
    const outEdges = dagEdges.filter(e => e.from === analysis.topForce);
    if (outEdges.length === 0) return null;
    const strongest = outEdges.sort((a, b) => (b.weight || 0) - (a.weight || 0))[0];
    if (!strongest) return null;
    return {
      from: analysis.topForce,
      to: strongest.to,
      weight: strongest.weight,
      lag: strongest.lag ?? 0,
    };
  }, [analysis, dagEdges]);


  // ─── Render ─────────────────────────────────────────────────────

  if (!analysis || !catDef) {
    return <div style={{ padding: 40, color: T.text3 }}>No simulation data available. Run a simulation first.</div>;
  }

  const vc = VERDICT_CONFIG[analysis.verdict];
  const VerdictIcon = vc.icon;
  const pc = POSTURE_CONFIG[analysis.posture];
  const totalContrib = Math.abs(analysis.tailwindSum) + Math.abs(analysis.headwindSum);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ─── View Toggle + Category Selector ─────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        {/* View mode toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          {[
            { key: 'portfolio' as const, label: 'Portfolio Overview', icon: BarChart3 },
            { key: 'deepdive' as const, label: 'Category Deep-Dive', icon: Target },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = viewMode === tab.key;
            return (
              <motion.button
                key={tab.key}
                onClick={() => setViewMode(tab.key)}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 8,
                  border: `1px solid ${isActive ? T.accent : T.border}`,
                  background: isActive ? T.accentDim : 'transparent',
                  color: isActive ? T.accent : T.text2,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.15s',
                } as React.CSSProperties}
              >
                <Icon size={14} />
                {tab.label}
              </motion.button>
            );
          })}
        </div>

        {/* Category pills — only in deep-dive mode */}
        {viewMode === 'deepdive' && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {['Hair', 'LHC'].map(group => (
              <React.Fragment key={group}>
                {group === 'LHC' && <div style={{ width: 8 }} />}
                {CATEGORIES.filter(c => c.group === group).map(cat => {
                  const isActive = cat.id === effectiveCatId;
                  const catA = analyses.get(cat.id);
                  const shiftColor = shiftColorHex(catA?.median2030);
                  return (
                    <motion.button
                      key={cat.id}
                      onClick={() => { setSelectedCatId(cat.id); setViewMode('deepdive'); }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '5px 10px', borderRadius: 8,
                        border: `1px solid ${isActive ? cat.color : T.border}`,
                        background: isActive ? `${cat.color}12` : 'transparent',
                        color: isActive ? T.text : T.text2,
                        fontSize: 11, fontWeight: isActive ? 700 : 500,
                        cursor: 'pointer', transition: 'all 0.15s',
                      } as React.CSSProperties}
                    >
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: shiftColor }} />
                      {cat.short}
                    </motion.button>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* ─── PORTFOLIO OVERVIEW ───────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {viewMode === 'portfolio' && (
          <motion.div
            key="portfolio"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <div style={{
              padding: '20px 24px', borderRadius: 12,
              border: `1px solid ${T.border}`, background: T.bg,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 16, letterSpacing: 0.3 }}>
                Strategic Assessment Matrix — All Categories
              </div>
              <PortfolioOverview
                shifts={shifts}
                analyses={analyses}
                onSelectCategory={(id) => { setSelectedCatId(id); setViewMode('deepdive'); }}
              />
            </div>
          </motion.div>
        )}

        {/* ─── CATEGORY DEEP-DIVE ──────────────────────────────────── */}
        {viewMode === 'deepdive' && (
          <motion.div
            key={`deepdive-${effectiveCatId}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
          >

            {/* ── Section 1: Headline Card ─────────────────────────── */}
            <div style={{
              padding: '24px 28px', borderRadius: 14,
              border: `1px solid ${T.border}`, background: T.bg,
              borderLeft: `4px solid ${catDef.color}`,
              display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 32, alignItems: 'center',
            }}>
              {/* Left: Category + Verdict */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: T.text }}>{catDef.name}</span>
                  <span style={{
                    fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                    background: T.bg3, color: T.text3,
                  }}>
                    {catDef.group}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 10,
                    color: vc.color, background: vc.bg,
                  }}>
                    <VerdictIcon size={13} />
                    {analysis.verdict}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 10,
                    background: analysis.conviction === 'High Conviction' ? T.greenDim :
                      analysis.conviction === 'Moderate Conviction' ? T.amberDim : T.bg3,
                    color: analysis.conviction === 'High Conviction' ? T.green :
                      analysis.conviction === 'Moderate Conviction' ? T.amber : T.text3,
                  }}>
                    {analysis.conviction}
                  </span>
                </div>
                {/* Shift numbers */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 28, fontWeight: 300, fontFamily: T.mono, color: shiftColorHex(analysis.median2030), letterSpacing: -1 }}>
                    {fmtShift(analysis.median2030)}
                  </span>
                  <span style={{ fontSize: 11, color: T.text3, fontFamily: T.mono }}>
                    ({fmtShift(analysis.p10_2030)} to {fmtShift(analysis.p90_2030)})
                  </span>
                </div>
              </div>

              {/* Center: Velocity */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: T.text3, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
                  Velocity
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: analysis.velocity.direction === 'up' ? T.green : analysis.velocity.direction === 'down' ? T.red : T.text2 }}>
                  {analysis.velocity.label} {analysis.velocity.direction === 'up' ? '↑' : analysis.velocity.direction === 'down' ? '↓' : '→'}
                </div>
              </div>

              {/* Right: Sparkline */}
              <div style={{ textAlign: 'center' }}>
                <MiniSparkline path={shifts[effectiveCatId]} color={catDef.color} width={100} height={36} />
                <div style={{ fontSize: 9, color: T.text3, marginTop: 4 }}>2026 → 2030</div>
              </div>
            </div>

            {/* ── Section 2: Key Facts ─────────────────────────────── */}
            <div>
              <SectionHeader icon={BarChart3} title="Key Facts" subtitle="Data points for strategic assessment" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <FactCard
                  icon={TrendingDown}
                  label="Net Pool Shift (2030)"
                  value={fmtShift(analysis.median2030)}
                  detail={`80% CI: ${fmtShift(analysis.p10_2030)} to ${fmtShift(analysis.p90_2030)}`}
                  color={shiftColorHex(analysis.median2030)}
                />
                <FactCard
                  icon={Activity}
                  label="Path Shape"
                  value={analysis.pathShape}
                  detail={
                    analysis.pathShape === 'Front-loaded' ? 'Most impact arrives by 2027-2028' :
                    analysis.pathShape === 'Back-loaded' ? 'Impact ramps post-2028' :
                    analysis.pathShape === 'Step-function' ? 'Sudden jump at a single year' :
                    'Steady progression through 2030'
                  }
                />
                <FactCard
                  icon={Shield}
                  label="Force Dominance"
                  value={analysis.topForce || '—'}
                  detail={analysis.topForces.slice(0, 3).map(f => `${f.force}: ${fmtShift(f.value)}`).join(' · ')}
                  color={FORCE_COLORS[analysis.topForce as ForceName] || T.text}
                />
                <FactCard
                  icon={Layers}
                  label="Trend Concentration"
                  value={`${analysis.trendConcentration.topCount} of ${analysis.trendConcentration.totalTrends}`}
                  detail={`${analysis.trendConcentration.topCount} trends drive ${(analysis.trendConcentration.top3Share * 100).toFixed(0)}% of shift — ${analysis.trendConcentration.topCount <= 3 ? 'HIGH' : analysis.trendConcentration.topCount <= 6 ? 'MODERATE' : 'LOW'} concentration`}
                />
                <FactCard
                  icon={Users}
                  label="Competitive Exposure"
                  value={analysis.posture === 'DEFEND' || analysis.posture === 'HARVEST' ? 'High' : 'Moderate'}
                  detail={`Market ${analysis.median2030 > 0 ? 'expansion attracts entry' : 'contraction intensifies rivalry'}`}
                />
                <FactCard
                  icon={AlertTriangle}
                  label="Model Quality"
                  value={convergence?.r_hat ? `R̂ ${convergence.r_hat.toFixed(3)}` : '—'}
                  detail={convergence?.converged ? 'Converged — results reliable' : 'Not converged — interpret with caution'}
                />
              </div>
            </div>

            {/* ── Section 3: Contributing Trends ───────────────────── */}
            <div>
              <SectionHeader icon={Layers} title="Contributing Trends" subtitle="Evidence base driving the assessment" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Tailwinds */}
                <div>
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: T.green,
                    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <ArrowUpRight size={12} /> Tailwinds ({analysis.tailwinds.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {analysis.tailwinds.length === 0 && (
                      <div style={{ fontSize: 11, color: T.text3, padding: 12 }}>No expansion trends with exposure to this category.</div>
                    )}
                    {analysis.tailwinds.map((ct, i) => (
                      <TrendCard
                        key={ct.trend.id}
                        trend={ct.trend}
                        contribution={ct.contribution}
                        totalContrib={totalContrib}
                        rank={i}
                        onNavigate={onNavigateToTrend}
                      />
                    ))}
                  </div>
                </div>

                {/* Headwinds */}
                <div>
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: T.red,
                    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <ArrowDownRight size={12} /> Headwinds ({analysis.headwinds.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {analysis.headwinds.length === 0 && (
                      <div style={{ fontSize: 11, color: T.text3, padding: 12 }}>No contraction trends with exposure to this category.</div>
                    )}
                    {analysis.headwinds.map((ct, i) => (
                      <TrendCard
                        key={ct.trend.id}
                        trend={ct.trend}
                        contribution={ct.contribution}
                        totalContrib={totalContrib}
                        rank={i}
                        onNavigate={onNavigateToTrend}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Net Assessment Bar */}
              <NetAssessmentBar tailwindSum={analysis.tailwindSum} headwindSum={analysis.headwindSum} />
            </div>

            {/* ── Section 4: Strategic Assessment ──────────────────── */}
            <div style={{
              padding: '24px 28px', borderRadius: 14,
              border: `1px solid ${T.border}`, background: T.bg,
            }}>
              <SectionHeader icon={Crosshair} title="Strategic Assessment" subtitle="Structured synthesis of simulation output" />

              <StrategicText label="Situation Summary" color={T.accent}>
                Category <strong>{analysis.catShort}</strong> faces a <strong style={{ color: shiftColorHex(analysis.median2030) }}>{analysis.verdict.toLowerCase()}</strong> of{' '}
                <strong style={{ fontFamily: T.mono }}>{fmtShift(analysis.median2030)}</strong> by 2030, driven primarily by{' '}
                <strong style={{ color: FORCE_COLORS[analysis.topForces[0]?.force as ForceName] }}>{analysis.topForces[0]?.force}</strong>
                {analysis.topForces[1] && <> and <strong style={{ color: FORCE_COLORS[analysis.topForces[1]?.force as ForceName] }}>{analysis.topForces[1]?.force}</strong></>}.
                {' '}The shift path is <strong>{analysis.pathShape.toLowerCase()}</strong>, meaning{' '}
                {analysis.pathShape === 'Front-loaded' ? 'the majority of impact arrives by 2027-2028, requiring immediate strategic response' :
                 analysis.pathShape === 'Back-loaded' ? 'the window for strategic response extends to 2028, but preparation should begin now' :
                 analysis.pathShape === 'Step-function' ? 'a sudden shift is expected at a specific trigger point — early warning monitoring is critical' :
                 'impact accumulates steadily, allowing phased strategic adjustment'}.
                {' '}Conviction is <strong>{analysis.conviction.toLowerCase().replace(' conviction', '')}</strong> based on{' '}
                {analysis.conviction === 'High Conviction' ? 'narrow confidence intervals' :
                 analysis.conviction === 'Moderate Conviction' ? 'moderate uncertainty in the projections' :
                 'wide confidence intervals — the outcome range is substantial'}.
              </StrategicText>

              <StrategicText label="Key Uncertainties" color={T.amber}>
                The assessment is most sensitive to{' '}
                {analysis.tailwinds[0] && <strong>{analysis.tailwinds[0].trend.name}</strong>}
                {analysis.headwinds[0] && <> and <strong>{analysis.headwinds[0].trend.name}</strong></>}.
                {' '}{analysis.trendConcentration.topCount <= 3 ?
                  `Only ${analysis.trendConcentration.topCount} trends drive ${(analysis.trendConcentration.top3Share * 100).toFixed(0)}% of the shift — the assessment is fragile and a single trend re-scoring could change the verdict.` :
                  `The shift is distributed across ${analysis.trendConcentration.topCount} trends — the assessment is relatively robust to individual trend changes.`
                }
                {' '}The 80% confidence interval spans {fmtShift(analysis.p10_2030)} to {fmtShift(analysis.p90_2030)}, a range of{' '}
                <strong style={{ fontFamily: T.mono }}>{(Math.abs(analysis.ciWidth) * 100).toFixed(1)}pp</strong>.
              </StrategicText>

              {causalNarrative && (
                <StrategicText label="Causal Chain" color={T.purple}>
                  The primary transmission mechanism is: <strong style={{ color: FORCE_COLORS[causalNarrative.from] }}>{causalNarrative.from}</strong>
                  {' '}<ArrowRight size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />{' '}
                  <strong style={{ color: FORCE_COLORS[causalNarrative.to] }}>{causalNarrative.to}</strong> → category impact,
                  with a <strong>{causalNarrative.lag}-year</strong> lag (propagation weight: {(causalNarrative.weight * 100).toFixed(0)}%).
                  {' '}This means leading indicators in {causalNarrative.from} serve as a{' '}
                  <strong>{causalNarrative.lag > 0 ? `${causalNarrative.lag * 4}-quarter` : 'real-time'}</strong> early warning signal for {analysis.catShort}.
                </StrategicText>
              )}

              <StrategicText label="Competitive Dynamics" color={T.red}>
                In the current base scenario, the{' '}
                {analysis.median2030 < -0.01 ? 'contracting pool is likely to intensify competitive rivalry as incumbents fight for shrinking share. Expect aggressive pricing and innovation responses from key competitors.' :
                 analysis.median2030 > 0.01 ? 'expanding pool creates opportunity for share capture, but will also attract new entrants and increased competitor investment. First-mover advantage in emerging segments is critical.' :
                 'flat pool dynamics mean competitive positioning depends primarily on execution quality and brand strength rather than market tailwinds.'
                }
                {' '}Given the {analysis.pathShape.toLowerCase()} trajectory, the strategic window for response is{' '}
                {analysis.pathShape === 'Front-loaded' ? 'narrow — action is needed within 12 months.' :
                 analysis.pathShape === 'Back-loaded' ? 'moderate — 18-24 months to establish position.' :
                 'standard — phased response over 12-24 months is appropriate.'}
              </StrategicText>
            </div>

            {/* ── Section 5: Strategic Implications & Actions ──────── */}
            <div style={{
              padding: '24px 28px', borderRadius: 14,
              border: `1px solid ${T.border}`, background: T.bg,
            }}>
              <SectionHeader icon={Target} title="Strategic Implications" subtitle="Recommended actions and monitoring framework" />

              {/* Investment Posture */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px',
                borderRadius: 10, border: `1px solid ${pc.color}30`, background: pc.bg,
                marginBottom: 20,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: `${pc.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {analysis.posture === 'INVEST' ? <ArrowUpRight size={20} color={pc.color} /> :
                   analysis.posture === 'DEFEND' ? <Shield size={20} color={pc.color} /> :
                   analysis.posture === 'HARVEST' ? <TrendingDown size={20} color={pc.color} /> :
                   <Eye size={20} color={pc.color} />}
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: pc.color, letterSpacing: 1 }}>{pc.label}</div>
                  <div style={{ fontSize: 12, color: T.text2, marginTop: 2 }}>{pc.desc}</div>
                </div>
              </div>

              {/* Priority Actions */}
              <div style={{ marginBottom: 20 }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: T.text2,
                  textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
                }}>
                  Priority Actions
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {strategicActions.map((action, i) => (
                    <ActionItem key={i} text={action.text} timeHorizon={action.timeHorizon} forces={action.forces} />
                  ))}
                </div>
              </div>

              {/* Monitoring Framework */}
              <div>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: T.text2,
                  textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
                }}>
                  Monitoring Framework
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {analysis.topForces.slice(0, 3).map((f, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 14px', borderRadius: 8,
                      border: `1px solid ${T.border}`, background: T.bg2,
                      fontSize: 11, color: T.text2,
                    }}>
                      <Clock size={12} color={T.text3} />
                      <span>
                        Track <strong style={{ color: FORCE_COLORS[f.force] }}>{f.force}</strong> force indicators —{' '}
                        if score changes by &gt;1 point, trigger re-assessment of{' '}
                        <strong style={{ color: T.text }}>{analysis.catShort}</strong> posture
                      </span>
                    </div>
                  ))}
                  {analysis.pathShape === 'Front-loaded' && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 14px', borderRadius: 8,
                      border: `1px solid ${T.amber}30`, background: T.amberDim,
                      fontSize: 11, color: T.amber,
                    }}>
                      <AlertTriangle size={12} />
                      <span>Front-loaded path — monitor 2026-2027 actuals closely for early confirmation or disconfirmation</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
