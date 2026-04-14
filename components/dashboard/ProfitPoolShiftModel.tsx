/**
 * PRISM Profit Pool Shift Model v3 — Main Container Component
 * Single unified view with contextual drill-down
 * Apple × Bain × Goldman Sachs aesthetic
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, CheckCircle2, Clock,
  Brain, AlertTriangle, FileDown, Settings, X, RefreshCw, Users,
  Download, Presentation, MessageCircle,
} from 'lucide-react';

import { T, CATEGORIES, YEARS, FORCES } from '@/lib/format';
import usePrism from '@/hooks/usePrism';
import type {
  Trend,
  Scenario,
  CausalEdge,
  CausalDAG,
  ShiftMatrix,
  ConvergenceDiagnostics,
  AllocationRecommendation,
  ForceContribution,
  ForceName,
  AISuggestion,
} from '@/types';

// AIInsight type for footer bar (matches AISuggestion shape)
type AIInsight = AISuggestion & { text?: string; type?: string };

// Child components
import HeadlineKPI from './HeadlineKPI';
import ShiftHeatmap from './Heatmap';
import PathTimeline from './PathTimeline';
import CausalFlow from './CausalFlow';
import ForceWaterfall from './ForceWaterfall';
import AllocationChart from './AllocationChart';
import TrendExplorer from './TrendExplorer';
import CategoryDetailPanel from './CategoryDetailPanel';

// Extracted components
import ScenarioSelectorPanel from './ScenarioSelectorPanel';
import ForceWeightSliders from './ForceWeightSliders';
import SettingsPanel from './SettingsPanel';
// OnboardingTooltips removed — outdated tour steps
import AIInsightsBar from './AIInsightsBar';
import ConnectionStatus from './ConnectionStatus';
import AIChatPanel from './AIChatPanel';

// ─── Type Definitions ────────────────────────────────────────────

// ─── ProductImpactAnalysis Component ────────────────────────────────
interface ProductImpactProps {
  shifts: ShiftMatrix | null;
  trends: Trend[];
}

function ProductImpactAnalysis({ shifts, trends }: ProductImpactProps) {
  if (!shifts || Object.keys(shifts).length === 0) return null;

  // Compute category impacts at 2030
  const categoryImpacts = Object.entries(shifts).map(([catId, pathData]) => {
    const pathObj = typeof pathData === 'object' && pathData !== null ? pathData : { 2030: pathData };
    const val2030Entry = pathObj[2030];
    const val2030 = typeof val2030Entry === 'object' && val2030Entry !== null && 'median' in val2030Entry
      ? (val2030Entry as any).median : (typeof val2030Entry === 'number' ? val2030Entry : 0);
    const catDef = CATEGORIES.find(c => c.id === catId);
    return { id: catId, name: catDef?.name || catId, shift: val2030 as number, group: catDef?.group || '' };
  });

  const sorted = [...categoryImpacts].sort((a, b) => b.shift - a.shift);
  const benefiting = sorted.filter(c => c.shift > 0).slice(0, 3);
  const declining = [...sorted].reverse().filter(c => c.shift < 0).slice(0, 3);

  // Derive innovation insights from trends
  const expansionTrends = trends.filter(t => t.direction === 'Expansion').sort((a, b) => ((b.impact || 0) * (b.probability || 0)) - ((a.impact || 0) * (a.probability || 0))).slice(0, 3);
  const contractionTrends = trends.filter(t => t.direction === 'Contraction').sort((a, b) => ((b.impact || 0) * (b.probability || 0)) - ((a.impact || 0) * (a.probability || 0))).slice(0, 3);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 16,
      }}
    >
      {/* Benefiting Products */}
      <div style={{
        padding: '20px',
        borderRadius: 12,
        border: `1px solid ${T.border}`,
        background: `linear-gradient(135deg, ${T.greenDim} 0%, ${T.bg2} 100%)`,
      }}>
        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: T.green, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14 }}>🚀</span> AI Insight: Growth Opportunities & Innovation Needs
        </div>
        {benefiting.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {benefiting.map(cat => (
              <div key={cat.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: T.bg1, borderRadius: 8, border: `1px solid ${T.border}` }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: T.text }}>{cat.name}</span>
                <span style={{ fontSize: 12, fontWeight: 700, fontFamily: T.mono, color: T.green }}>{((cat.shift * 100).toFixed(1))}%</span>
              </div>
            ))}
            {expansionTrends.length > 0 && (
              <div style={{ marginTop: 8, padding: '10px 12px', background: `${T.accent}06`, borderRadius: 8, border: `1px solid ${T.accent}15` }}>
                <div style={{ fontSize: 9, fontWeight: 600, color: T.accent, marginBottom: 6, letterSpacing: 0.5 }}>INNOVATION DRIVERS</div>
                {expansionTrends.map(t => (
                  <div key={t.id} style={{ fontSize: 10, color: T.text2, lineHeight: 1.5, marginBottom: 2 }}>
                    • <strong style={{ color: T.text }}>{t.name}</strong> ({t.force}, {t.impact}×{t.probability})
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: T.text3 }}>No expanding categories detected.</div>
        )}
      </div>

      {/* Declining Products */}
      <div style={{
        padding: '20px',
        borderRadius: 12,
        border: `1px solid ${T.border}`,
        background: `linear-gradient(135deg, ${T.redDim} 0%, ${T.bg2} 100%)`,
      }}>
        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: T.red, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14 }}>⚠️</span> AI Insight: Highest Negative Impact
        </div>
        {declining.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {declining.map(cat => (
              <div key={cat.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: T.bg1, borderRadius: 8, border: `1px solid ${T.border}` }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: T.text }}>{cat.name}</span>
                <span style={{ fontSize: 12, fontWeight: 700, fontFamily: T.mono, color: T.red }}>{((cat.shift * 100).toFixed(1))}%</span>
              </div>
            ))}
            {contractionTrends.length > 0 && (
              <div style={{ marginTop: 8, padding: '10px 12px', background: `${T.red}06`, borderRadius: 8, border: `1px solid ${T.red}15` }}>
                <div style={{ fontSize: 9, fontWeight: 600, color: T.red, marginBottom: 6, letterSpacing: 0.5 }}>RISK DRIVERS</div>
                {contractionTrends.map(t => (
                  <div key={t.id} style={{ fontSize: 10, color: T.text2, lineHeight: 1.5, marginBottom: 2 }}>
                    • <strong style={{ color: T.text }}>{t.name}</strong> ({t.force}, {t.impact}×{t.probability})
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: T.text3 }}>No contracting categories detected.</div>
        )}
      </div>
    </motion.div>
  );
}

// Data sourced from usePrism() hook — real API data only

// ─── ProfitPoolShiftModel Component ──────────────────────────────────────────────
type PanelType = 'category' | 'settings' | 'delphi' | 'scenario' | null;
type ModalType = 'export' | 'briefing' | null;

export default function ProfitPoolShiftModel(): React.ReactNode {
  const {
    loading, simulating, error, activeScenario, setActiveScenario,
    simulate, connectionState, reconnect,
    simulation, trends, forces, scenarios, dag, analytics,
    aiSuggestions, triggers, health, updateTrend,
  } = usePrism();

  // Responsive breakpoints
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1920);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isIPad = windowWidth <= 1024;
  const isLaptop = windowWidth <= 1366;

  // Local state
  const [showTrends, setShowTrends] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [shockedForce, setShockedForce] = useState<ForceName | null>(null);
  const [forceFilter, setForceFilter] = useState<string | undefined>(undefined);
  const [selectedRegion, setSelectedRegion] = useState<string>('Global');
  const [presentationMode, setPresentationMode] = useState(false);

  // Panel stack manager
  const [activePanel, setActivePanel] = useState<PanelType>(null);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [aiChatOpen, setAIChatOpen] = useState<boolean>(false);

  // Real data from API via usePrism hook
  const shifts: ShiftMatrix | null = simulation?.shifts ?? null;
  const convergence: ConvergenceDiagnostics | undefined = simulation?.convergence;
  const allocation = simulation?.allocation_recommendation ?? null;
  const dagEdges: CausalEdge[] = dag?.edges ?? [];
  const forceNames = Object.keys(FORCES) as ForceName[];
  const scenarioOptions: Scenario[] = scenarios ?? [];
  const aiInsights: AIInsight[] = (aiSuggestions ?? []).map(s => ({
    ...s,
    text: s.content ?? '',
    type: s.suggestion_type ?? 'info',
  }));

  const handleSimulate = async (): Promise<void> => {
    await simulate();
  };

  // Loading state
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: T.bg,
        flexDirection: 'column',
        gap: 16,
      } as React.CSSProperties}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          <RefreshCw size={32} style={{ color: T.accent }} />
        </motion.div>
        <span style={{ fontSize: 13, color: T.text3 }}>Connecting to PRISM engine…</span>
      </div>
    );
  }

  // No data state — backend unavailable or no simulation run yet
  if (!shifts || Object.keys(shifts).length === 0) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: T.bg,
        flexDirection: 'column',
        gap: 16,
      } as React.CSSProperties}>
        <AlertTriangle size={32} style={{ color: T.amber ?? '#EAB308' }} />
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 8 }}>
            {connectionState === 'offline' ? 'Backend Unavailable' : 'No Simulation Data'}
          </div>
          <div style={{ fontSize: 13, color: T.text3, lineHeight: 1.6 }}>
            {connectionState === 'offline'
              ? 'The PRISM engine is not reachable. Check that the backend is running and try reconnecting.'
              : 'Run a simulation to generate shift matrix data. Click "Simulate" to start a Bayesian Monte Carlo run with 10,000 iterations.'}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
            {connectionState === 'offline' && (
              <motion.button
                onClick={reconnect}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                style={{
                  padding: '8px 20px', borderRadius: 999, border: `1px solid ${T.border}`,
                  background: 'transparent', color: T.text, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                <RefreshCw size={13} style={{ marginRight: 6 }} />
                Reconnect
              </motion.button>
            )}
            <motion.button
              onClick={handleSimulate}
              disabled={simulating || connectionState === 'offline'}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              style={{
                padding: '8px 20px', borderRadius: 999, border: 'none',
                background: connectionState === 'offline' ? T.text3 : T.text, color: '#fff',
                fontSize: 12, fontWeight: 600, cursor: connectionState === 'offline' ? 'not-allowed' : 'pointer',
                opacity: connectionState === 'offline' ? 0.5 : 1,
              }}
            >
              <Zap size={13} style={{ marginRight: 6 }} />
              Run Simulation
            </motion.button>
          </div>
        </div>
      </div>
    );
  }

  const panelOpen = selectedCategory !== undefined;

  return (
    <div
      style={{
        background: T.bg,
        fontFamily: T.sans,
        color: T.text,
        display: 'grid',
        gridTemplateColumns: panelOpen ? '1fr 400px' : '1fr',
        gridTemplateRows: '52px 56px 1fr 64px',
        gridTemplateAreas: panelOpen
          ? `"header header"
             "trust trust"
             "main panel"
             "footer footer"`
          : `"header"
             "trust"
             "main"
             "footer"`,
        height: '100vh',
        transition: 'grid-template-columns 0.3s cubic-bezier(0.25,0.1,0.25,1)',
      } as React.CSSProperties}
    >
      {/* OnboardingTooltips removed — outdated tour steps */}
      <AIInsightsBar insights={aiInsights} triggers={[]} isLoading={simulating} />

      {/* ─── STICKY HEADER ─────────────────────────────────────────────── */}
      <motion.header
        initial={{ y: -52 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="nav-glass"
        style={{
          gridArea: 'header',
          height: 52,
          zIndex: 100,
        } as React.CSSProperties}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingLeft: 32,
            paddingRight: 32,
            height: '100%',
            gap: 24,
            maxWidth: 1440,
            margin: '0 auto',
          } as React.CSSProperties}
        >
          {/* Logo & Version */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 } as React.CSSProperties}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: T.text,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 14,
                color: '#fff',
              } as React.CSSProperties}
            >
              P
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text, letterSpacing: -0.01 } as React.CSSProperties}>
              PRISM
            </div>
            <span style={{ fontSize: 10, fontWeight: 500, color: T.text3, padding: '2px 8px', background: T.bg1, borderRadius: 999 } as React.CSSProperties}>
              v4.0
            </span>
          </div>

          {/* Primary Action Buttons — Simulate, Scenario, Export, Briefing */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 } as React.CSSProperties}>
            {/* Simulate Button — primary action pill */}
            <motion.button
              onClick={handleSimulate}
              disabled={simulating}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 18px',
                borderRadius: 999,
                border: 'none',
                background: T.text,
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                cursor: simulating ? 'not-allowed' : 'pointer',
                opacity: simulating ? 0.6 : 1,
                transition: 'all 0.3s cubic-bezier(0.25,0.1,0.25,1)',
              } as React.CSSProperties}
            >
              <Zap size={13} />
              {simulating ? 'Simulating…' : 'Simulate'}
            </motion.button>

            {/* Scenario Selector Button */}
            <motion.button
              onClick={() => setActiveModal('export')}
              whileHover={{ background: T.bg1, borderColor: 'rgba(0,0,0,0.12)' }}
              whileTap={{ scale: 0.95 }}
              style={{
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 10,
                border: '1px solid rgba(0,0,0,0.08)',
                background: 'transparent',
                color: T.text2,
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.25,0.1,0.25,1)',
              } as React.CSSProperties}
              title="Scenario Analysis"
            >
              <AlertTriangle size={16} />
            </motion.button>

            {/* Export Button */}
            <motion.button
              data-onboarding="export"
              onClick={() => setActiveModal('export')}
              whileHover={{ background: T.bg1, borderColor: 'rgba(0,0,0,0.12)' }}
              whileTap={{ scale: 0.95 }}
              className="btn-icon"
              title="Export Results"
            >
              <Download size={16} />
            </motion.button>

            {/* Briefing / Presentation Mode Button */}
            <motion.button
              onClick={() => setActiveModal('briefing')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 10,
                border: `1px solid ${presentationMode ? T.accent : 'rgba(0,0,0,0.08)'}`,
                background: presentationMode ? `${T.accent}15` : 'transparent',
                color: presentationMode ? T.accent : T.text2,
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.25,0.1,0.25,1)',
              } as React.CSSProperties}
              title="Briefing Mode"
            >
              <Presentation size={16} />
            </motion.button>

            {/* AI Chat Button */}
            <motion.button
              onClick={() => setAIChatOpen(!aiChatOpen)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 10,
                border: `1px solid ${aiChatOpen ? T.accent : 'rgba(0,0,0,0.08)'}`,
                background: aiChatOpen ? `${T.accent}15` : 'transparent',
                color: aiChatOpen ? T.accent : T.text2,
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.25,0.1,0.25,1)',
              } as React.CSSProperties}
              title="AI Chat"
            >
              <MessageCircle size={16} />
            </motion.button>
          </div>

          {/* Region Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: T.text3, textTransform: 'uppercase', letterSpacing: 0.5 }}>Region</span>
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: `1px solid ${T.border2}`,
                background: T.bg,
                color: T.text,
                fontSize: 12,
                fontWeight: 500,
                fontFamily: T.sans,
                cursor: 'pointer',
                outline: 'none',
                appearance: 'none',
                paddingRight: 28,
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 8px center',
              }}
            >
              <option value="Global">Global (Total)</option>
              <option value="Europe">Europe</option>
              <option value="North America">North America</option>
              <option value="Asia Pacific">Asia Pacific</option>
              <option value="Latin America">Latin America</option>
              <option value="Middle East & Africa">Middle East & Africa</option>
              <option value="Emerging Markets">Emerging Markets</option>
            </select>
          </div>

          {/* Scenario Selector — pill buttons */}
          <div data-onboarding="scenario" style={{ display: 'flex', gap: 4, flex: 1, justifyContent: 'center' } as React.CSSProperties}>
            {scenarioOptions.slice(0, 5).map(scenario => {
              const isActive = activeScenario === (scenario.id || scenario.name);
              return (
                <motion.button
                  key={scenario.id || scenario.name}
                  onClick={() => setActiveScenario(scenario.id || scenario.name)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 999,
                    border: 'none',
                    background: isActive ? T.text : T.bg1,
                    color: isActive ? '#fff' : T.text3,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s cubic-bezier(0.22,1,0.36,1)',
                  } as React.CSSProperties}
                >
                  {scenario.name || scenario.id}
                </motion.button>
              );
            })}
          </div>

          {/* Right: Badges & Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto', position: 'relative' } as React.CSSProperties}>
            {/* Connection Status Indicator */}
            <ConnectionStatus state={connectionState} onReconnect={reconnect} />

            {/* Convergence Pill */}
            <div
              style={{
                ...ProfitPoolShiftModelStyles.pill,
                background: T.greenDim,
                border: `1px solid ${T.green}20`,
              } as React.CSSProperties}
            >
              <CheckCircle2 size={12} style={{ color: T.green }} />
              <span style={{ color: T.green, fontSize: 11, fontWeight: 600 }}>
                R̂ {convergence?.r_hat?.toFixed(2) || '1.03'}
              </span>
            </div>

            {/* Iteration Count Pill */}
            <div style={{ ...ProfitPoolShiftModelStyles.pill, background: T.border1 } as React.CSSProperties}>
              <Clock size={12} style={{ color: T.text3 }} />
              <span style={{ color: T.text3, fontSize: 11, fontWeight: 600 }}>
                {convergence?.iterations?.toLocaleString() || '5k'} iter
              </span>
            </div>
          </div>
        </div>
      </motion.header>

      {/* ─── INSTITUTIONAL TRUST BAR ──────────────────────────────────── */}
      <div style={{
        gridArea: 'trust',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '8px 32px',
        borderRadius: 0,
        background: T.bg3,
        border: `1px solid ${T.border}`,
        fontSize: 10,
        fontFamily: T.mono,
        color: T.text3,
        flexWrap: 'wrap',
        borderBottom: `1px solid ${T.border}`,
      }}>
        <span>Model: <strong style={{ color: T.text2 }}>Bayesian MC v2.1</strong></span>
        <span style={{ color: T.border2 }}>|</span>
        <span>Data Vintage: <strong style={{ color: T.text2 }}>March 2026</strong></span>
        <span style={{ color: T.border2 }}>|</span>
        <span>Iterations: <strong style={{ color: T.text2 }}>{convergence?.iterations ? '10,000' : '—'}</strong></span>
        <span style={{ color: T.border2 }}>|</span>
        <span>Convergence: <strong style={{ color: convergence?.converged ? T.green : T.amber }}>{convergence?.converged ? `R̂ ${convergence.r_hat?.toFixed(2)}` : 'Pending'}</strong></span>
        <span style={{ color: T.border2 }}>|</span>
        <span>Model: <strong style={{ color: T.text2 }}>Bayesian MC + t-copula</strong></span>
        <span style={{ color: T.border2 }}>|</span>
        <span>Region: <strong style={{ color: T.accent }}>{selectedRegion || 'Global'}</strong></span>
      </div>

      {/* ─── MAIN CONTENT ──────────────────────────────────────────────── */}
      <motion.main
        layout
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        style={{
          gridArea: 'main',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          paddingLeft: presentationMode ? 40 : 32,
          paddingRight: presentationMode ? 40 : 32,
          paddingTop: presentationMode ? 40 : 32,
          paddingBottom: 32,
          fontSize: presentationMode ? '120%' : undefined,
          maxWidth: 1440,
          margin: '0 auto',
          width: '100%',
        } as React.CSSProperties}
      >
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              padding: 16,
              borderRadius: 12,
              border: `1px solid ${T.red}40`,
              background: T.redDim,
              color: T.red,
              fontSize: 13,
              marginBottom: 24,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            } as React.CSSProperties}
          >
            <AlertTriangle size={16} />
            {error}
          </motion.div>
        )}

        <motion.div
          key="overview"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}
        >
          {/* Row 1: Headline KPIs */}
          <div data-onboarding="kpi" style={{ flex: '0 0 auto' }}>
            <HeadlineKPI
              shifts={shifts}
              convergence={convergence}
              selectedCategory={selectedCategory}
            />
          </div>

          {/* Row 2: Heatmap + Path Timeline (Responsive Grid) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isIPad ? '1fr' : '1.2fr 1fr',
              gap: 24,
              flex: 1,
              minHeight: 0,
            } as React.CSSProperties}
          >
            {/* Heatmap */}
            <div
              data-onboarding="heatmap"
              style={{
                flex: '0 0 auto',
                minHeight: 0,
                overflow: 'hidden',
              }}
            >
              <ShiftHeatmap
                shifts={shifts}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                onHoverCategory={setHoveredCategory}
              />
            </div>

            {/* Path Timeline */}
            <div
              data-onboarding="timeline"
              style={{
                flex: '0 0 auto',
                minHeight: 0,
                overflow: 'hidden',
              }}
            >
              <PathTimeline
                shifts={shifts}
                selectedCategory={selectedCategory}
              />
            </div>
          </div>

          {/* Row 3: Causal + Forces + Allocation (Responsive Grid) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isIPad ? '1fr' : isLaptop ? '1fr 1fr' : '1.1fr 0.9fr 1fr',
              gap: 24,
              flex: '0 0 auto',
            } as React.CSSProperties}
          >
            <CausalFlow
              dag={{ edges: dagEdges, forces: forceNames as ForceName[] }}
              shockedForce={shockedForce}
              onShockForce={setShockedForce}
            />
            <ForceWaterfall
              selectedCategory={selectedCategory}
            />
            <AllocationChart
              allocation={allocation ?? undefined}
            />
          </div>

          {/* Row 4: Product Impact Analysis */}
          <div style={{ flex: '0 0 auto' }}>
            <ProductImpactAnalysis shifts={shifts} trends={trends} />
          </div>

          {/* Row 5: Collapsible Trends Section */}
          <motion.div
            style={{ marginTop: 24 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <button
              onClick={() => setShowTrends(!showTrends)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '12px 16px', background: T.bg2, border: `1px solid ${T.border1}`,
                borderRadius: 12, cursor: 'pointer', transition: 'all 0.15s ease',
              } as React.CSSProperties}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: T.text2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Trend Explorer
              </span>
              <span style={{ fontSize: 11, color: T.text3, marginLeft: 'auto' }}>
                {trends?.length || 0} trends · {showTrends ? 'Collapse' : 'Expand'}
              </span>
              <motion.span
                animate={{ rotate: showTrends ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'flex', alignItems: 'center' }}
              >
                ▾
              </motion.span>
            </button>
            <AnimatePresence>
              {showTrends && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  style={{ overflow: 'hidden', marginTop: 8 }}
                >
                  <TrendExplorer
                    data={{ trends: trends }}
                    forceFilter={forceFilter || ''}
                    onForceFilter={setForceFilter}
                    onUpdateTrend={(trendId: string, updates: any) => void updateTrend(trendId, updates)}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </motion.main>

      {/* ─── DETAIL PANEL (Right Slide-In Grid Column) ─────────────────────────────── */}
      <AnimatePresence>
        {selectedCategory && (
          <>
            {/* Backdrop - only show on mobile/responsive */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCategory(undefined)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.3)',
                backdropFilter: 'blur(4px)',
                zIndex: 200,
                display: 'none',
              } as React.CSSProperties}
            />
          </>
        )}
      </AnimatePresence>

      {/* Panel - integrated into grid */}
      <AnimatePresence>
        {selectedCategory && (
          <motion.div
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              gridArea: 'panel',
              background: `linear-gradient(180deg, ${T.bg2} 0%, ${T.bg1} 100%)`,
              borderLeft: `1px solid ${T.border}`,
              overflowY: 'auto',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
            } as React.CSSProperties}
          >
            <div
              style={{
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                flex: 1,
                position: 'relative',
              } as React.CSSProperties}
            >
              {/* Close Button */}
              <motion.button
                onClick={() => setSelectedCategory(undefined)}
                whileHover={{ background: T.bg3 }}
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 8,
                  border: `1px solid ${T.border}`,
                  background: 'transparent',
                  color: T.text2,
                  cursor: 'pointer',
                  zIndex: 10,
                } as React.CSSProperties}
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── FIXED BOTTOM BAR ──────────────────────────────────────────── */}
      <motion.footer
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="nav-glass"
        style={{
          gridArea: 'footer',
          height: 64,
          borderTop: '1px solid rgba(0,0,0,0.06)',
          borderBottom: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: 32,
          paddingRight: 32,
          gap: 24,
          zIndex: 50,
        } as React.CSSProperties}
      >
        {/* Left: AI Insights */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' } as React.CSSProperties}>
          {aiInsights.map(insight => (
            <motion.button
              key={insight.id}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className={insight.type === 'trigger' ? 'pill pill-amber' : 'pill pill-blue'}
              style={{
                padding: '5px 12px',
                cursor: 'pointer',
                border: 'none',
                fontSize: 11,
              } as React.CSSProperties}
            >
              <Brain size={11} />
              {insight.text}
            </motion.button>
          ))}
        </div>

        {/* Right: Export Button */}
        <div style={{ display: 'flex', gap: 8 } as React.CSSProperties}>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            style={{
              padding: '8px 20px',
              borderRadius: 999,
              border: 'none',
              background: T.text,
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.25,0.1,0.25,1)',
            } as React.CSSProperties}
          >
            Export Results
          </motion.button>
        </div>
      </motion.footer>

      {/* AI Chat Panel (Bottom slide-up) */}
      <AIChatPanel
        isOpen={aiChatOpen}
        onClose={() => setAIChatOpen(false)}
        onSendMessage={async (message) => {
          // Mock response - integrate with real API later
          return `Analysis: ${message.includes('shift') ? 'The portfolio shows a net negative shift driven primarily by Government and Environmental forces.' : 'I can help with shift projections, force analysis, allocation recommendations, and scenario comparisons.'}`;
        }}
      />
    </div>
  );
}

// ─── Inline Styles ─────────────────────────────────────────────────────
const ProfitPoolShiftModelStyles: Record<string, React.CSSProperties> = {
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 16,
    fontSize: 11,
    fontWeight: 600,
    fontFamily: T.mono,
    whiteSpace: 'nowrap',
    lineHeight: 1,
  },
};
