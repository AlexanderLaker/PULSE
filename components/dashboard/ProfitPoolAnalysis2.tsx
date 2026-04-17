/**
 * Profit Pool Analysis 2 — Editorial Intelligence View
 *
 * Alternative visualisation for the Profit Pool Analysis page, harmonised
 * with the "Digital Curator" design language established in Trends 2 and
 * Innovation Explorer (maritime blue palette, Manrope headlines, tonal
 * layering, pill-shaped controls, insight-rail accent header).
 *
 * Design principles applied:
 *   • Maritime blue palette with tonal layering (no 1px borders)
 *   • Manrope headlines + Inter body pairing
 *   • Pill-shaped scenario chips, action buttons, filter controls
 *   • Portfolio stats bar (icon tile + value + label) — Innovation Explorer
 *   • Editorial "insight rail" accent on the page header
 *   • Rounded 2xl cards with soft ambient shadows
 *   • Glassmorphism footer for AI insights
 *
 * Functional parity with ProfitPoolShiftModel.tsx — preserves all data
 * surfaces (KPIs, heatmap, path timeline, force waterfall, allocation,
 * product impact, trend explorer, category drill-down) and all interactions
 * (simulate, scenario switch, region filter, category select, reconnect,
 * AI chat). Reuses the existing data-viz child components so behaviour and
 * numerical outputs are identical to the original page.
 */

'use client';

import React, { useState, useEffect, useMemo, FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, CheckCircle2, Clock, Layers, Activity, Gauge, Target,
  Brain, AlertTriangle, RefreshCw, TrendingUp, TrendingDown,
  ChevronDown, Sparkles, X, Globe, Cpu, Users, Store, Landmark,
  Leaf, Swords, BarChart3, LineChart, Network, Compass,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { CATEGORIES, FORCES, fmtShift, fmtPct } from '@/lib/format';
import usePrism from '@/hooks/usePrism';
import type {
  Trend,
  Scenario,
  ShiftMatrix,
  ForceName,
  AISuggestion,
} from '@/types';

// Reused child components (same functionality as the original page) ─────
import HeadlineKPI from './HeadlineKPI';
import ShiftHeatmap from './Heatmap';
import PathTimeline from './PathTimeline';
import ForceWaterfall from './ForceWaterfall';
import AllocationChart from './AllocationChart';
import TrendExplorer from './TrendExplorer';
import CategoryDetailPanel from './CategoryDetailPanel';
import ConnectionStatus from './ConnectionStatus';
import AIChatPanel from './AIChatPanel';

// ─── Editorial design tokens (mirrors Trends2 / DESIGN.md palette) ──────
const S = {
  bg:                 '#f8f9ff',
  surface:            '#ffffff',
  surfaceLow:         '#eff4ff',
  surfaceContainer:   '#e5eeff',
  surfaceHigh:        '#dce9ff',
  surfaceHighest:     '#d2e4ff',
  primary:            '#005db5',
  primaryDim:         '#0052a0',
  primaryContainer:   '#d6e3ff',
  onPrimary:          '#ffffff',
  onPrimaryContainer: '#00519e',
  onBg:               '#00345e',
  onSurface:          '#00345e',
  onSurfaceVariant:   '#26619d',
  secondaryContainer: '#d5e3fc',
  onSecondaryContainer:'#455367',
  tertiaryContainer:  '#dae2fd',
  onTertiaryContainer:'#4a5167',
  success:            '#2e7d4e',
  successContainer:   '#c7eccf',
  onSuccessContainer: '#0d4723',
  warning:            '#8f5d0b',
  warningContainer:   '#ffe0a8',
  onWarningContainer: '#4f2c00',
  error:              '#9f403d',
  errorContainer:     '#fe8983',
  onErrorContainer:   '#752121',
  outline:            '#477dbb',
  outlineVariant:     '#81b5f6',
  secondary:          '#526074',
};

const HEADLINE_FONT = "'Manrope', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const BODY_FONT     = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO_FONT     = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

// Force → editorial icon + tonal container mapping (re-used from Trends2)
const FORCE_TILE: Record<ForceName, { Icon: LucideIcon; bg: string; fg: string }> = {
  Consumer:      { Icon: Users,    bg: S.primaryContainer,   fg: S.primary },
  Customer:      { Icon: Store,    bg: S.secondaryContainer, fg: S.onSecondaryContainer },
  Technology:    { Icon: Cpu,      bg: S.tertiaryContainer,  fg: S.onTertiaryContainer },
  Government:    { Icon: Landmark, bg: S.surfaceHighest,     fg: S.onSurface },
  Environmental: { Icon: Leaf,     bg: S.surfaceHigh,        fg: S.primary },
  Competitive:   { Icon: Swords,   bg: S.surfaceContainer,   fg: S.primaryDim },
};

type AIInsight = AISuggestion & { text?: string; type?: string };

// ═══════════════════════════════════════════════════════════════════════
//  Small presentational primitives
// ═══════════════════════════════════════════════════════════════════════

/** Section card — surface with soft ambient shadow, rounded 2xl, no border */
const SectionCard: FC<{
  children: React.ReactNode;
  padding?: number | string;
  style?: React.CSSProperties;
}> = ({ children, padding = 24, style }) => (
  <div
    style={{
      backgroundColor: S.surface,
      borderRadius: 24,
      padding,
      boxShadow: '0 4px 60px -15px rgba(0, 52, 94, 0.08)',
      ...style,
    }}
  >
    {children}
  </div>
);

/** Section header with eyebrow + title */
const SectionHeader: FC<{
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}> = ({ eyebrow, title, subtitle, right }) => (
  <div style={{
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 20,
  }}>
    <div>
      {eyebrow && (
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          color: S.onSurfaceVariant,
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
          marginBottom: 6,
        }}>
          {eyebrow}
        </div>
      )}
      <h2 style={{
        fontFamily: HEADLINE_FONT,
        fontWeight: 800,
        fontSize: 22,
        color: S.onBg,
        letterSpacing: '-0.01em',
        margin: 0,
        lineHeight: 1.15,
      }}>
        {title}
      </h2>
      {subtitle && (
        <div style={{
          fontSize: 13,
          color: S.onSurfaceVariant,
          marginTop: 4,
          lineHeight: 1.5,
        }}>
          {subtitle}
        </div>
      )}
    </div>
    {right && <div>{right}</div>}
  </div>
);

/** Editorial pill button — primary or tonal */
const PillButton: FC<{
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'tonal' | 'ghost';
  icon?: React.ReactNode;
  title?: string;
}> = ({ children, onClick, disabled, variant = 'tonal', icon, title }) => {
  const palette = variant === 'primary'
    ? { bg: S.primary, fg: S.onPrimary, hover: S.primaryDim }
    : variant === 'ghost'
      ? { bg: 'transparent', fg: S.onSurfaceVariant, hover: S.surfaceLow }
      : { bg: S.surfaceLow, fg: S.onPrimaryContainer, hover: S.surfaceContainer };

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      title={title}
      whileHover={disabled ? {} : { scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.97 }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 18px',
        borderRadius: 999,
        border: 'none',
        background: palette.bg,
        color: palette.fg,
        fontSize: 13,
        fontWeight: 600,
        fontFamily: BODY_FONT,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.25s ease',
      }}
    >
      {icon}
      {children}
    </motion.button>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  Product Impact (editorial re-skin) — benefiting / declining split
// ═══════════════════════════════════════════════════════════════════════

interface ProductImpactProps {
  shifts: ShiftMatrix | null;
  trends: Trend[];
}

const ProductImpactAnalysis: FC<ProductImpactProps> = ({ shifts, trends }) => {
  const { benefiting, declining, expansionTrends, contractionTrends } = useMemo(() => {
    if (!shifts || Object.keys(shifts).length === 0) {
      return { benefiting: [], declining: [], expansionTrends: [], contractionTrends: [] };
    }

    const categoryImpacts = Object.entries(shifts).map(([catId, pathData]) => {
      const pathObj = typeof pathData === 'object' && pathData !== null ? pathData as Record<string, unknown> : { 2030: pathData };
      const val2030Entry = (pathObj as Record<string, unknown>)[2030];
      const val2030 =
        typeof val2030Entry === 'object' && val2030Entry !== null && 'median' in val2030Entry
          ? (val2030Entry as { median: number }).median
          : (typeof val2030Entry === 'number' ? val2030Entry : 0);
      const catDef = CATEGORIES.find(c => c.id === catId);
      return {
        id: catId,
        name: catDef?.name || catId,
        shift: val2030 as number,
        group: catDef?.group || '',
      };
    });

    const sorted = [...categoryImpacts].sort((a, b) => b.shift - a.shift);

    return {
      benefiting: sorted.filter(c => c.shift > 0).slice(0, 3),
      declining: [...sorted].reverse().filter(c => c.shift < 0).slice(0, 3),
      expansionTrends: trends
        .filter(t => t.direction === 'Expansion')
        .sort((a, b) => ((b.impact || 0) * (b.probability || 0)) - ((a.impact || 0) * (a.probability || 0)))
        .slice(0, 3),
      contractionTrends: trends
        .filter(t => t.direction === 'Contraction')
        .sort((a, b) => ((b.impact || 0) * (b.probability || 0)) - ((a.impact || 0) * (a.probability || 0)))
        .slice(0, 3),
    };
  }, [shifts, trends]);

  if (!shifts || Object.keys(shifts).length === 0) return null;

  const renderPanel = (
    title: string,
    eyebrow: string,
    Icon: LucideIcon,
    tone: 'positive' | 'negative',
    categories: Array<{ id: string; name: string; shift: number }>,
    driverTrends: Trend[],
    driverLabel: string,
  ) => {
    const palette = tone === 'positive'
      ? { ringBg: S.successContainer, ringFg: S.success, chipFg: S.onSuccessContainer, driverBg: S.surfaceLow, driverFg: S.success }
      : { ringBg: S.errorContainer, ringFg: S.error, chipFg: S.onErrorContainer, driverBg: S.surfaceLow, driverFg: S.error };

    return (
      <SectionCard padding={28}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: palette.ringBg,
            color: palette.ringFg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Icon size={20} />
          </div>
          <div>
            <div style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: S.onSurfaceVariant,
            }}>
              {eyebrow}
            </div>
            <div style={{
              fontFamily: HEADLINE_FONT,
              fontSize: 17,
              fontWeight: 800,
              color: S.onBg,
              lineHeight: 1.2,
            }}>
              {title}
            </div>
          </div>
        </div>

        {categories.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {categories.map(cat => (
              <div
                key={cat.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: S.surfaceLow,
                  borderRadius: 12,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: S.onBg }}>{cat.name}</span>
                <span style={{
                  fontFamily: MONO_FONT,
                  fontSize: 13,
                  fontWeight: 700,
                  color: palette.ringFg,
                }}>
                  {fmtShift(cat.shift)}
                </span>
              </div>
            ))}
            {driverTrends.length > 0 && (
              <div style={{
                marginTop: 10,
                padding: '14px 16px',
                background: S.surfaceLow,
                borderRadius: 12,
                borderLeft: `3px solid ${palette.ringFg}`,
              }}>
                <div style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: palette.ringFg,
                  marginBottom: 8,
                }}>
                  {driverLabel}
                </div>
                {driverTrends.map(t => (
                  <div key={t.id} style={{
                    fontSize: 11,
                    color: S.onSurfaceVariant,
                    lineHeight: 1.55,
                    marginBottom: 3,
                  }}>
                    • <strong style={{ color: S.onBg }}>{t.name}</strong>{' '}
                    <span style={{ color: S.outline }}>({t.force}, {t.impact}×{t.probability})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: S.onSurfaceVariant, padding: '12px 0' }}>
            {tone === 'positive' ? 'No expanding categories detected.' : 'No contracting categories detected.'}
          </div>
        )}
      </SectionCard>
    );
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      {renderPanel(
        'Growth Opportunities & Innovation Needs',
        'AI Insight',
        TrendingUp,
        'positive',
        benefiting,
        expansionTrends,
        'Innovation Drivers',
      )}
      {renderPanel(
        'Highest Negative Impact',
        'AI Insight',
        TrendingDown,
        'negative',
        declining,
        contractionTrends,
        'Risk Drivers',
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  Editorial AI Insights Footer Bar
// ═══════════════════════════════════════════════════════════════════════

const InsightsFooter: FC<{ insights: AIInsight[] }> = ({ insights }) => {
  if (insights.length === 0) return null;
  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(255,255,255,0.8)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: '0 -8px 40px rgba(0, 52, 94, 0.06)',
        padding: '14px 48px',
        zIndex: 30,
      }}
    >
      <div style={{
        maxWidth: 1440,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          fontWeight: 700,
          color: S.onSurfaceVariant,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
        }}>
          <Sparkles size={13} style={{ color: S.primary }} />
          AI Intelligence
        </div>
        {insights.slice(0, 4).map(insight => (
          <motion.button
            key={insight.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 999,
              border: 'none',
              background: insight.type === 'trigger' ? S.warningContainer : S.primaryContainer,
              color: insight.type === 'trigger' ? S.onWarningContainer : S.onPrimaryContainer,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: BODY_FONT,
              cursor: 'pointer',
            }}
          >
            <Brain size={12} />
            <span style={{
              maxWidth: 360,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {insight.text}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  Main page component
// ═══════════════════════════════════════════════════════════════════════

const ProfitPoolAnalysis2: FC = () => {
  const {
    loading, simulating, error, activeScenario, setActiveScenario,
    simulate, connectionState, reconnect,
    simulation, trends, scenarios,
    aiSuggestions, updateTrend,
  } = usePrism();

  // ── Responsive breakpoints ──────────────────────────────────────
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1440,
  );

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isIPad = windowWidth <= 1024;

  // ── Local UI state ──────────────────────────────────────────────
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [, setHoveredCategory] = useState<string | null>(null);
  const [forceFilter, setForceFilter] = useState<string | undefined>(undefined);
  const [selectedRegion, setSelectedRegion] = useState<string>('Global');
  const [showTrends, setShowTrends] = useState<boolean>(false);
  const [aiChatOpen, setAIChatOpen] = useState<boolean>(false);

  // ── Derived data ────────────────────────────────────────────────
  const shifts: ShiftMatrix | null = simulation?.shifts ?? null;
  const convergence = simulation?.convergence;
  const allocation = simulation?.allocation_recommendation ?? null;
  const scenarioOptions: Scenario[] = scenarios ?? [];
  const aiInsights: AIInsight[] = (aiSuggestions ?? []).map(s => ({
    ...s,
    text: s.content ?? '',
    type: s.suggestion_type ?? 'info',
  }));

  // Portfolio stats (editorial stats bar)
  const portfolioStats = useMemo(() => {
    if (!shifts || Object.keys(shifts).length === 0) {
      return {
        netShift: 0,
        catsPositive: 0,
        catsNegative: 0,
        confidence: convergence?.r_hat,
      };
    }
    let total = 0;
    let pos = 0;
    let neg = 0;
    Object.values(shifts).forEach((pathData) => {
      const pathObj = typeof pathData === 'object' && pathData !== null ? pathData as Record<string, unknown> : { 2030: pathData };
      const entry = (pathObj as Record<string, unknown>)[2030];
      const val = typeof entry === 'object' && entry !== null && 'median' in entry
        ? (entry as { median: number }).median
        : (typeof entry === 'number' ? entry : 0);
      total += val;
      if (val > 0) pos += 1;
      if (val < 0) neg += 1;
    });
    const n = Object.keys(shifts).length;
    return {
      netShift: n > 0 ? total / n : 0,
      catsPositive: pos,
      catsNegative: neg,
      confidence: convergence?.r_hat,
    };
  }, [shifts, convergence]);

  const handleSimulate = async (): Promise<void> => { await simulate(); };

  // ═══════════════════════════════════════════════════════════════
  //  Loading state — editorial spinner
  // ═══════════════════════════════════════════════════════════════
  if (loading) {
    return (
      <div style={{
        minHeight: 'calc(100vh - 64px)',
        background: S.bg,
        fontFamily: BODY_FONT,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
      }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
          style={{ color: S.primary }}
        >
          <RefreshCw size={36} />
        </motion.div>
        <div style={{ fontSize: 13, color: S.onSurfaceVariant, fontWeight: 600 }}>
          Connecting to PRISM engine…
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  //  Empty state — no shifts / backend offline
  // ═══════════════════════════════════════════════════════════════
  if (!shifts || Object.keys(shifts).length === 0) {
    const isOffline = connectionState === 'offline';
    return (
      <div style={{
        minHeight: 'calc(100vh - 64px)',
        background: S.bg,
        fontFamily: BODY_FONT,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
      }}>
        <SectionCard padding={40} style={{ maxWidth: 520, width: '100%', textAlign: 'center' }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            margin: '0 auto 20px',
            background: isOffline ? S.warningContainer : S.primaryContainer,
            color: isOffline ? S.warning : S.primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {isOffline ? <AlertTriangle size={26} /> : <Sparkles size={26} />}
          </div>
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: S.onSurfaceVariant,
            marginBottom: 8,
          }}>
            {isOffline ? 'Connection Required' : 'Ready to Simulate'}
          </div>
          <h2 style={{
            fontFamily: HEADLINE_FONT,
            fontSize: 24,
            fontWeight: 800,
            color: S.onBg,
            letterSpacing: '-0.01em',
            marginBottom: 10,
          }}>
            {isOffline ? 'Backend Unavailable' : 'No Simulation Data'}
          </h2>
          <p style={{
            fontSize: 14,
            color: S.onSurfaceVariant,
            lineHeight: 1.6,
            marginBottom: 24,
          }}>
            {isOffline
              ? 'The PRISM engine is not reachable. Check that the backend is running and try reconnecting.'
              : 'Run a Bayesian Monte Carlo simulation with 10,000 iterations to generate the shift matrix across 12 categories and 11 years.'}
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            {isOffline && (
              <PillButton onClick={reconnect} variant="tonal" icon={<RefreshCw size={14} />}>
                Reconnect
              </PillButton>
            )}
            <PillButton
              onClick={handleSimulate}
              disabled={simulating || isOffline}
              variant="primary"
              icon={<Zap size={14} />}
            >
              {simulating ? 'Simulating…' : 'Run Simulation'}
            </PillButton>
          </div>
        </SectionCard>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  //  Main layout
  // ═══════════════════════════════════════════════════════════════
  const panelOpen = selectedCategory !== undefined;

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 64px)',
        background: S.bg,
        color: S.onBg,
        fontFamily: BODY_FONT,
      }}
    >
      <div style={{
        display: 'grid',
        gridTemplateColumns: panelOpen && !isIPad ? '1fr 420px' : '1fr',
        transition: 'grid-template-columns 0.3s cubic-bezier(0.25,0.1,0.25,1)',
      }}>
        {/* ═════════════════════════════════════════════════════════════
            LEFT / MAIN COLUMN
            ═════════════════════════════════════════════════════════════ */}
        <div style={{ minWidth: 0 }}>
          <main style={{
            maxWidth: 1440,
            margin: '0 auto',
            padding: '40px 48px 120px',
          }}>
            {/* ─── EDITORIAL HEADER ────────────────────────────── */}
            <header style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 32,
              marginBottom: 32,
            }}>
              <div
                style={{
                  paddingLeft: 20,
                  borderLeft: `4px solid ${S.primary}`,
                  flex: 1,
                }}
              >
                <div style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: S.onSurfaceVariant,
                  textTransform: 'uppercase',
                  letterSpacing: '0.18em',
                  marginBottom: 8,
                }}>
                  Strategic Intelligence · Editorial View
                </div>
                <h1 style={{
                  fontFamily: HEADLINE_FONT,
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  fontSize: 40,
                  color: S.onBg,
                  lineHeight: 1.05,
                  margin: 0,
                }}>
                  Profit Pool Shift Model
                </h1>
                <p style={{
                  marginTop: 10,
                  maxWidth: 640,
                  fontSize: 15,
                  color: S.onSurfaceVariant,
                  lineHeight: 1.55,
                }}>
                  A probabilistic view of how the {Object.keys(shifts).length} Hair &amp; LHC categories
                  will reallocate through 2030 — driven by {trends?.length ?? 0} signals across
                  six forces, modelled with Bayesian Monte Carlo and copula dependencies.
                </p>
              </div>

              {/* Connection + Convergence quick-read */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                minWidth: 220,
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  borderRadius: 999,
                  background: S.surfaceLow,
                }}>
                  <ConnectionStatus state={connectionState} onReconnect={reconnect} />
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  borderRadius: 999,
                  background: convergence?.converged ? S.successContainer : S.warningContainer,
                }}>
                  <CheckCircle2 size={14} style={{ color: convergence?.converged ? S.success : S.warning }} />
                  <span style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: convergence?.converged ? S.onSuccessContainer : S.onWarningContainer,
                    fontFamily: MONO_FONT,
                  }}>
                    R̂ {convergence?.r_hat?.toFixed(3) ?? '1.030'} ·{' '}
                    {(convergence?.iterations ?? 10000).toLocaleString()} iter
                  </span>
                </div>
              </div>
            </header>

            {/* ─── PORTFOLIO STATS BAR ──────────────────────────── */}
            <section style={{
              display: 'flex',
              gap: 28,
              flexWrap: 'wrap',
              marginBottom: 28,
              padding: '18px 28px',
              background: S.surface,
              borderRadius: 20,
              boxShadow: '0 4px 60px -15px rgba(0, 52, 94, 0.08)',
            }}>
              <StatTile
                Icon={Activity}
                label="Net Shift · 2030"
                value={fmtShift(portfolioStats.netShift)}
                tint={portfolioStats.netShift >= 0 ? 'positive' : 'negative'}
              />
              <StatDivider />
              <StatTile
                Icon={TrendingUp}
                label="Categories Expanding"
                value={`${portfolioStats.catsPositive}/${Object.keys(shifts).length}`}
                tint="neutral"
              />
              <StatDivider />
              <StatTile
                Icon={TrendingDown}
                label="Categories Contracting"
                value={`${portfolioStats.catsNegative}/${Object.keys(shifts).length}`}
                tint="neutral"
              />
              <StatDivider />
              <StatTile
                Icon={Gauge}
                label="Convergence R̂"
                value={convergence?.r_hat?.toFixed(3) ?? '1.030'}
                tint="neutral"
              />
              <StatDivider />
              <StatTile
                Icon={Layers}
                label="Active Trends"
                value={String(trends?.length ?? 0)}
                tint="neutral"
              />
              <StatDivider />
              <StatTile
                Icon={Clock}
                label="Horizon"
                value="2026–2036"
                tint="neutral"
              />
            </section>

            {/* ─── ACTION ROW · Simulate + Scenarios + Region ─── */}
            <section style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              flexWrap: 'wrap',
              marginBottom: 28,
            }}>
              <PillButton
                onClick={handleSimulate}
                disabled={simulating}
                variant="primary"
                icon={<Zap size={14} />}
              >
                {simulating ? 'Simulating…' : 'Run Simulation'}
              </PillButton>

              <div style={{ width: 1, height: 22, background: S.outlineVariant, opacity: 0.4 }} />

              {/* Scenario chips */}
              <div style={{
                display: 'flex',
                gap: 6,
                flexWrap: 'wrap',
              }}>
                {scenarioOptions.slice(0, 5).map(scenario => {
                  const id = scenario.id || scenario.name || '';
                  const isActive = activeScenario === id;
                  return (
                    <motion.button
                      key={id}
                      onClick={() => setActiveScenario(id)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      style={{
                        padding: '7px 16px',
                        borderRadius: 999,
                        border: 'none',
                        background: isActive ? S.primary : S.primaryContainer,
                        color: isActive ? S.onPrimary : S.onPrimaryContainer,
                        fontSize: 12,
                        fontWeight: 600,
                        fontFamily: BODY_FONT,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.25s ease',
                      }}
                    >
                      {scenario.name || scenario.id}
                    </motion.button>
                  );
                })}
              </div>

              {/* Region selector pill */}
              <div style={{
                marginLeft: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px 6px 14px',
                borderRadius: 999,
                background: S.surfaceLow,
              }}>
                <Globe size={14} style={{ color: S.onSurfaceVariant }} />
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: S.onSurfaceVariant,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}>
                  Region
                </span>
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  style={{
                    padding: '4px 28px 4px 8px',
                    borderRadius: 999,
                    border: 'none',
                    background: 'transparent',
                    color: S.onBg,
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: BODY_FONT,
                    cursor: 'pointer',
                    outline: 'none',
                    appearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2326619d' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 8px center',
                  }}
                >
                  <option value="Global">Global (Total)</option>
                  <option value="Europe">Europe</option>
                  <option value="North America">North America</option>
                  <option value="Asia Pacific">Asia Pacific</option>
                  <option value="Latin America">Latin America</option>
                  <option value="Middle East & Africa">Middle East &amp; Africa</option>
                  <option value="Emerging Markets">Emerging Markets</option>
                </select>
              </div>
            </section>

            {/* ─── TRUST / METADATA STRIP ────────────────────── */}
            <section style={{
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              padding: '12px 20px',
              marginBottom: 32,
              background: S.surfaceLow,
              borderRadius: 14,
              fontSize: 11,
              fontFamily: MONO_FONT,
              color: S.onSurfaceVariant,
              flexWrap: 'wrap',
            }}>
              <MetaItem label="Model" value="Bayesian MC v2.4" />
              <MetaDivider />
              <MetaItem label="Copula" value="Gaussian + t-tails" />
              <MetaDivider />
              <MetaItem label="Data Vintage" value="March 2026" />
              <MetaDivider />
              <MetaItem label="Iterations" value={(convergence?.iterations ?? 10000).toLocaleString()} />
              <MetaDivider />
              <MetaItem
                label="Convergence"
                value={convergence?.converged ? `R̂ ${convergence.r_hat?.toFixed(3)}` : 'Pending'}
                valueColor={convergence?.converged ? S.success : S.warning}
              />
              <MetaDivider />
              <MetaItem label="Region" value={selectedRegion} valueColor={S.primary} />
            </section>

            {/* ─── ERROR BANNER ───────────────────────────────── */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  padding: '14px 18px',
                  borderRadius: 16,
                  background: S.errorContainer,
                  color: S.onErrorContainer,
                  fontSize: 13,
                  marginBottom: 24,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontWeight: 600,
                }}
              >
                <AlertTriangle size={16} />
                {error}
              </motion.div>
            )}

            {/* ═════ ROW 1 · Headline KPIs ═════════════════════ */}
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              style={{ marginBottom: 28 }}
            >
              <SectionCard padding={28}>
                <SectionHeader
                  eyebrow="Headline Metrics"
                  title="Portfolio Snapshot"
                  subtitle="Aggregate shift, expansion leader, contraction risk and convergence health at a glance."
                />
                <HeadlineKPI
                  shifts={shifts}
                  convergence={convergence ?? null}
                  selectedCategory={selectedCategory}
                />
              </SectionCard>
            </motion.section>

            {/* ═════ ROW 2 · Heatmap + Path Timeline ═════════ */}
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.05 }}
              style={{
                display: 'grid',
                gridTemplateColumns: isIPad ? '1fr' : '1.15fr 1fr',
                gap: 20,
                marginBottom: 28,
              }}
            >
              <SectionCard padding={28}>
                <SectionHeader
                  eyebrow="Spatial View"
                  title="Force × Category Heatmap"
                  subtitle="Per-category shift intensity across the 2026–2030 horizon. Click a category to drill down."
                  right={<HeaderIcon Icon={Network} />}
                />
                <div style={{ minHeight: 320 }}>
                  <ShiftHeatmap
                    shifts={shifts}
                    selectedCategory={selectedCategory}
                    onSelectCategory={setSelectedCategory}
                    onHoverCategory={setHoveredCategory}
                  />
                </div>
              </SectionCard>

              <SectionCard padding={28}>
                <SectionHeader
                  eyebrow="Temporal View"
                  title="Continuous Path Timeline"
                  subtitle="Year-over-year shift trajectories with p10–p90 confidence bands."
                  right={<HeaderIcon Icon={LineChart} />}
                />
                <div style={{ minHeight: 320 }}>
                  <PathTimeline shifts={shifts} selectedCategory={selectedCategory} />
                </div>
              </SectionCard>
            </motion.section>

            {/* ═════ ROW 3 · Force Waterfall + Allocation ═════ */}
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.1 }}
              style={{
                display: 'grid',
                gridTemplateColumns: isIPad ? '1fr' : '1fr 1fr',
                gap: 20,
                marginBottom: 28,
              }}
            >
              <SectionCard padding={28}>
                <SectionHeader
                  eyebrow="Attribution"
                  title="Force Contribution Waterfall"
                  subtitle="Which of the six forces drives the most signal into the portfolio?"
                  right={<HeaderIcon Icon={BarChart3} />}
                />
                <ForceLegend />
                <div style={{ marginTop: 8 }}>
                  <ForceWaterfall selectedCategory={selectedCategory} />
                </div>
              </SectionCard>

              <SectionCard padding={28}>
                <SectionHeader
                  eyebrow="Allocation"
                  title="Recommended Category Weights"
                  subtitle="Mean-variance optimiser · risk-adjusted allocation vs. current mix."
                  right={<HeaderIcon Icon={Target} />}
                />
                <AllocationChart allocation={allocation ?? undefined} />
              </SectionCard>
            </motion.section>

            {/* ═════ ROW 4 · Product Impact ══════════════════ */}
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.15 }}
              style={{ marginBottom: 28 }}
            >
              <div style={{ marginBottom: 20 }}>
                <div style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: S.onSurfaceVariant,
                  textTransform: 'uppercase',
                  letterSpacing: '0.15em',
                  marginBottom: 6,
                }}>
                  AI Product Intelligence
                </div>
                <h2 style={{
                  fontFamily: HEADLINE_FONT,
                  fontWeight: 800,
                  fontSize: 22,
                  color: S.onBg,
                  letterSpacing: '-0.01em',
                  margin: 0,
                  lineHeight: 1.15,
                }}>
                  Where the pool is moving
                </h2>
                <div style={{
                  fontSize: 13,
                  color: S.onSurfaceVariant,
                  marginTop: 4,
                  lineHeight: 1.5,
                }}>
                  The top three categories gaining and losing share, with the trend signals driving each side.
                </div>
              </div>
              <ProductImpactAnalysis shifts={shifts} trends={trends} />
            </motion.section>

            {/* ═════ ROW 5 · Trend Explorer (collapsible) ════ */}
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.2 }}
              style={{ marginBottom: 28 }}
            >
              <SectionCard padding={0}>
                <button
                  onClick={() => setShowTrends(v => !v)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '22px 28px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: BODY_FONT,
                  }}
                >
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: S.primaryContainer,
                    color: S.primary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Compass size={20} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.15em',
                      textTransform: 'uppercase',
                      color: S.onSurfaceVariant,
                      marginBottom: 3,
                    }}>
                      Deep Dive
                    </div>
                    <div style={{
                      fontFamily: HEADLINE_FONT,
                      fontSize: 18,
                      fontWeight: 800,
                      color: S.onBg,
                      lineHeight: 1.2,
                    }}>
                      Trend Explorer
                    </div>
                  </div>
                  <div style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: S.onSurfaceVariant,
                    marginRight: 12,
                  }}>
                    {trends?.length || 0} trends · {showTrends ? 'Collapse' : 'Expand'}
                  </div>
                  <motion.div
                    animate={{ rotate: showTrends ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ color: S.onSurfaceVariant }}
                  >
                    <ChevronDown size={20} />
                  </motion.div>
                </button>
                <AnimatePresence>
                  {showTrends && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div style={{ padding: '0 28px 28px', borderTop: `1px solid ${S.surfaceLow}` }}>
                        <TrendExplorer
                          data={{ trends: trends as any }}
                          forceFilter={forceFilter || ''}
                          onForceFilter={setForceFilter}
                          onUpdateTrend={(trendId: string, updates: any) =>
                            void updateTrend(trendId, updates)
                          }
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </SectionCard>
            </motion.section>

            {/* ═════ AI ASSISTANT CTA ═════════════════════════ */}
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.25 }}
            >
              <SectionCard padding={28} style={{
                background: `linear-gradient(135deg, ${S.primaryContainer} 0%, ${S.surface} 100%)`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                  <div style={{
                    width: 52,
                    height: 52,
                    borderRadius: 16,
                    background: S.primary,
                    color: S.onPrimary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Brain size={24} />
                  </div>
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.15em',
                      textTransform: 'uppercase',
                      color: S.onSurfaceVariant,
                      marginBottom: 4,
                    }}>
                      Conversational Intelligence
                    </div>
                    <div style={{
                      fontFamily: HEADLINE_FONT,
                      fontSize: 18,
                      fontWeight: 800,
                      color: S.onBg,
                      lineHeight: 1.2,
                      marginBottom: 4,
                    }}>
                      Ask PRISM about the Shift Matrix
                    </div>
                    <div style={{ fontSize: 13, color: S.onSurfaceVariant, lineHeight: 1.5 }}>
                      Natural-language queries on scenario comparisons, force attributions, and allocation logic.
                    </div>
                  </div>
                  <PillButton
                    onClick={() => setAIChatOpen(true)}
                    variant="primary"
                    icon={<Sparkles size={14} />}
                  >
                    Open AI Chat
                  </PillButton>
                </div>
              </SectionCard>
            </motion.section>
          </main>
        </div>

        {/* ═════════════════════════════════════════════════════════════
            RIGHT COLUMN · Category Detail Panel (when selected)
            ═════════════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {panelOpen && !isIPad && (
            <motion.aside
              initial={{ x: 420, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 420, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              style={{
                background: `linear-gradient(180deg, ${S.surface} 0%, ${S.surfaceLow} 100%)`,
                borderLeft: `1px solid ${S.surfaceHigh}`,
                padding: 24,
                position: 'relative',
                minHeight: '100vh',
              }}
            >
              <motion.button
                onClick={() => setSelectedCategory(undefined)}
                whileHover={{ background: S.surfaceContainer }}
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  border: 'none',
                  background: S.surfaceLow,
                  color: S.onSurfaceVariant,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 10,
                }}
                aria-label="Close panel"
              >
                <X size={16} />
              </motion.button>
              <CategoryDetailPanel
                categoryId={selectedCategory || ''}
                data={{
                  shifts_path: shifts as any,
                  force_decomposition: simulation?.force_attribution as any,
                  contributing_trends: { [selectedCategory || '']: trends },
                }}
                onClose={() => setSelectedCategory(undefined)}
              />
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* ─── Mobile/tablet backdrop for category panel ─────── */}
      <AnimatePresence>
        {panelOpen && isIPad && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedCategory(undefined)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 52, 94, 0.35)',
              backdropFilter: 'blur(6px)',
              zIndex: 40,
            }}
          >
            <motion.aside
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                maxHeight: '90vh',
                background: S.surface,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                padding: 24,
                overflowY: 'auto',
              }}
            >
              <motion.button
                onClick={() => setSelectedCategory(undefined)}
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  border: 'none',
                  background: S.surfaceLow,
                  color: S.onSurfaceVariant,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 10,
                }}
                aria-label="Close panel"
              >
                <X size={16} />
              </motion.button>
              <CategoryDetailPanel
                categoryId={selectedCategory || ''}
                data={{
                  shifts_path: shifts as any,
                  force_decomposition: simulation?.force_attribution as any,
                  contributing_trends: { [selectedCategory || '']: trends },
                }}
                onClose={() => setSelectedCategory(undefined)}
              />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Sticky AI Insights Footer ───────────────────── */}
      <InsightsFooter insights={aiInsights} />

      {/* ─── AI Chat Panel (bottom slide-up) ─────────────── */}
      <AIChatPanel
        isOpen={aiChatOpen}
        onClose={() => setAIChatOpen(false)}
        onSendMessage={async (message) => {
          return `Analysis: ${
            message.includes('shift')
              ? 'The portfolio shows a net negative shift driven primarily by Government and Environmental forces.'
              : 'I can help with shift projections, force analysis, allocation recommendations, and scenario comparisons.'
          }`;
        }}
      />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  Small helpers
// ═══════════════════════════════════════════════════════════════════════

const StatTile: FC<{
  Icon: LucideIcon;
  label: string;
  value: string;
  tint: 'positive' | 'negative' | 'neutral';
}> = ({ Icon, label, value, tint }) => {
  const ring = tint === 'positive'
    ? { bg: S.successContainer, fg: S.success }
    : tint === 'negative'
      ? { bg: S.errorContainer, fg: S.error }
      : { bg: S.primaryContainer, fg: S.primary };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        background: ring.bg,
        color: ring.fg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Icon size={16} />
      </div>
      <div>
        <div style={{
          fontFamily: HEADLINE_FONT,
          fontSize: 18,
          fontWeight: 800,
          color: S.onBg,
          lineHeight: 1.1,
        }}>
          {value}
        </div>
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          color: S.onSurfaceVariant,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginTop: 2,
        }}>
          {label}
        </div>
      </div>
    </div>
  );
};

const StatDivider: FC = () => (
  <div style={{ width: 1, alignSelf: 'stretch', background: S.surfaceHigh, opacity: 0.5 }} />
);

const MetaItem: FC<{ label: string; value: string; valueColor?: string }> = ({
  label, value, valueColor,
}) => (
  <span>
    {label}:{' '}
    <strong style={{ color: valueColor || S.onBg, fontWeight: 700 }}>
      {value}
    </strong>
  </span>
);

const MetaDivider: FC = () => (
  <span style={{ color: S.outlineVariant, opacity: 0.6 }}>·</span>
);

const HeaderIcon: FC<{ Icon: LucideIcon }> = ({ Icon }) => (
  <div style={{
    width: 36,
    height: 36,
    borderRadius: 12,
    background: S.surfaceLow,
    color: S.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }}>
    <Icon size={18} />
  </div>
);

/** Compact force legend — tonal chips echoing the heatmap attribution */
const ForceLegend: FC = () => (
  <div style={{
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 14,
  }}>
    {(Object.keys(FORCES) as ForceName[]).map(force => {
      const tile = FORCE_TILE[force] ?? FORCE_TILE.Consumer;
      const { Icon } = tile;
      return (
        <div
          key={force}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 999,
            background: tile.bg,
            color: tile.fg,
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          <Icon size={11} strokeWidth={2.5} />
          {force}
        </div>
      );
    })}
  </div>
);

export default ProfitPoolAnalysis2;
