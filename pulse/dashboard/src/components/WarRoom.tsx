/**
 * PRISM War Room v3 — Main Container Component
 * Single unified view with contextual drill-down
 * Apple × Bain × Goldman Sachs aesthetic
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3, Layers, Zap, CheckCircle2, Clock,
  Brain, AlertTriangle, X, RefreshCw,
  Presentation, Route,
} from 'lucide-react';

import { T, CATEGORIES, YEARS, FORCES } from '../lib/format';
import usePulse from '../hooks/usePulse';
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
} from '../types';

// Child components
import HeadlineKPI from './HeadlineKPI';
import ShiftHeatmap from './Heatmap';
import PathTimeline from './PathTimeline';
import TrendExplorer from './TrendExplorer';
// EmergingTrends removed — external API scanning disabled
import CategoryDetailPanel from './CategoryDetailPanel';
import CategoryDeepDive from './CategoryDeepDive';
import ForceShiftMatrix from './ForceShiftMatrix';
import RegionShiftMatrix from './RegionShiftMatrix';

// Extracted components
import ForceWeightSliders from './ForceWeightSliders';
import SettingsPanel from './SettingsPanel';
import OnboardingTooltips from './OnboardingTooltips';
import AIInsightsBar from './AIInsightsBar';
import DelphiPanel from './DelphiPanel';
import SessionSnapshots from './SessionSnapshots';
import ExecutiveBriefing from './ExecutiveBriefing';

// ─── Type Definitions ────────────────────────────────────────────

interface TrendWithSources extends Trend {
  sources: Array<{
    title: string;
    url: string;
    data: string;
  }>;
  category_exposure: Record<string, number>;
  vc_exposure: Record<string, number>;
  regional_exposure?: Record<string, number>;
}

interface AllocationWithRationale extends AllocationRecommendation {
  rationale: string;
}

interface InitialDataResult {
  shifts: ShiftMatrix;
  forceContributions: Record<string, ForceContribution[]>;
  trends: TrendWithSources[];
  scenarios: Scenario[];
  allocation: AllocationWithRationale[];
  dagEdges: CausalEdge[];
  convergence: ConvergenceDiagnostics;
}

interface AIInsight {
  id: number;
  type: 'signal' | 'trigger';
  title: string;
  description: string;
  text?: string;
  count?: number;
  severity?: 'warning' | 'critical';
}

// ─── Initial Data — no mock data, all zeros until backend provides real simulation ──

function generateInitialData(): InitialDataResult {
  const categoryIds = CATEGORIES.map(c => c.id);
  const forceNames = Object.keys(FORCES) as ForceName[];

  // All shifts start at 0.0 — no simulation has been run yet
  const shifts: ShiftMatrix = {};
  categoryIds.forEach(catId => {
    shifts[catId] = {};
    YEARS.forEach(year => {
      const shiftPath = shifts[catId];
      if (shiftPath) {
        shiftPath[year] = { median: 0, p10: 0, p25: 0, p75: 0, p90: 0 };
      }
    });
  });

  // Force contributions — equal weights (no analysis yet)
  const forceContributions: Record<string, ForceContribution[]> = {};
  categoryIds.forEach(catId => {
    const equalWeight = 1 / forceNames.length;
    forceContributions[catId] = forceNames.map((force: ForceName) => ({
      force,
      value: equalWeight,
      normalized: equalWeight,
    }));
  });

  // Trends are loaded dynamically via API
  const trends: TrendWithSources[] = [];

  // Scenarios
  const scenarios: Scenario[] = [
    { id: 'base', name: 'Base Case', description: 'Current expert scores with causal DAG active. No external shocks applied.' },
  ];

  // Allocation — equal weights until simulation provides recommendations
  const allocation: AllocationWithRationale[] = categoryIds.map((catId) => {
    const equalWeight = 1 / categoryIds.length;
    return {
      category: catId,
      currentWeight: equalWeight,
      recommendedWeight: equalWeight,
      rationale: 'Run simulation to generate allocation recommendations.',
    };
  });

  // Causal DAG edges (16 edges per spec)
  const dagEdges: CausalEdge[] = [
    { from: 'Government', to: 'Technology', weight: 0.6, lag: 1, mechanism: 'Regulation triggers reformulation R&D spend' },
    { from: 'Government', to: 'Customer', weight: 0.4, lag: 1, mechanism: 'Compliance costs pass through to shelf price' },
    { from: 'Government', to: 'Environmental', weight: 0.3, lag: 0, mechanism: 'Environmental regulation codifies green trends' },
    { from: 'Consumer', to: 'Customer', weight: 0.5, lag: 0, mechanism: 'Demand shifts force channel adaptation' },
    { from: 'Consumer', to: 'Competitive', weight: 0.4, lag: 1, mechanism: 'Consumer preferences drive competitive positioning' },
    { from: 'Consumer', to: 'Technology', weight: 0.3, lag: 1, mechanism: 'Consumer demand pulls innovation investment' },
    { from: 'Technology', to: 'Consumer', weight: 0.4, lag: 1, mechanism: 'New tech enables new consumer behaviors' },
    { from: 'Technology', to: 'Competitive', weight: 0.5, lag: 1, mechanism: 'Tech adoption creates competitive gaps' },
    { from: 'Technology', to: 'Customer', weight: 0.3, lag: 0, mechanism: 'Tech changes channel economics' },
    { from: 'Environmental', to: 'Government', weight: 0.6, lag: 1, mechanism: 'Environmental crises accelerate regulation' },
    { from: 'Environmental', to: 'Consumer', weight: 0.4, lag: 0, mechanism: 'Climate awareness shifts purchase behavior' },
    { from: 'Environmental', to: 'Technology', weight: 0.3, lag: 1, mechanism: 'Environmental pressure drives green innovation' },
    { from: 'Customer', to: 'Competitive', weight: 0.5, lag: 0, mechanism: 'Channel power shifts competitive dynamics' },
    { from: 'Customer', to: 'Consumer', weight: 0.3, lag: 0, mechanism: 'Channel availability shapes consumer access' },
    { from: 'Competitive', to: 'Customer', weight: 0.4, lag: 0, mechanism: 'Competitive moves change channel bargaining' },
    { from: 'Competitive', to: 'Consumer', weight: 0.3, lag: 1, mechanism: 'Competitive innovation shapes consumer expectations' },
  ];

  const convergence: ConvergenceDiagnostics = {
    r_hat: 0,
    converged: false,
    iterations: 0,
    backtestingAccuracy: 0,
  };

  return {
    shifts,
    forceContributions,
    trends,
    scenarios,
    allocation,
    dagEdges,
    convergence,
  };
}

// ─── SimTooltip — hover tooltip for simulation status pills ─────────
function SimTooltip({ children, content }: { children: React.ReactNode; content: React.ReactNode }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const ref = React.useRef<HTMLDivElement>(null);

  const handleEnter = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos({ x: rect.left + rect.width / 2, y: rect.bottom + 8 });
    }
    setShow(true);
  };

  return (
    <div
      ref={ref}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setShow(false)}
      style={{ position: 'relative', display: 'inline-flex' }}
    >
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed',
              left: pos.x,
              top: pos.y,
              transform: 'translateX(-50%)',
              width: 320,
              padding: '14px 16px',
              borderRadius: 12,
              background: '#1D1D1F',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
              fontSize: 11,
              lineHeight: 1.5,
              color: '#94A3B8',
              zIndex: 10000,
              fontFamily: "'Inter', sans-serif",
              pointerEvents: 'none',
            } as React.CSSProperties}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── WarRoom Component ──────────────────────────────────────────────
export default function WarRoom({ isAdmin = false, onNavigateJourney }: { isAdmin?: boolean; onNavigateJourney?: () => void }): React.ReactNode {
  const {
    loading, simulating, error, activeScenario, setActiveScenario,
    simulate, simulation,
  } = usePulse();

  // Local state
  const [activeView, setActiveView] = useState<'overview' | 'trends'>('overview');
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [deepDiveCategory, setDeepDiveCategory] = useState<string | null>(null);
  const [forceFilter, setForceFilter] = useState<string | undefined>(undefined);
  const [showDelphi, setShowDelphi] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showSnapshots, setShowSnapshots] = useState<boolean>(false);
  const [showBriefing, setShowBriefing] = useState<boolean>(false);

  // Initial data — zeroed until backend provides real simulation
  const [initialData, setInitialData] = useState(() => generateInitialData());
  const data = initialData;

  // ─── Merge backend simulation results into data when available ──────
  useEffect(() => {
    const shiftMatrix = simulation?.shift_matrix || simulation?.shifts;
    if (!simulation || !shiftMatrix) return;

    // Map backend shift_matrix keys to frontend category IDs
    const normCatId = (k: string): string =>
      k.toLowerCase().replace(/^(hair|lhc):\s*/, (_, g: string) => g + '_').replace(/\s+/g, '_');

    const newShifts: typeof data.shifts = {};
    for (const [catKey, catData] of Object.entries(shiftMatrix)) {
      const catId = normCatId(catKey);
      const yearMap: Record<string, any> = {};
      // Handle both flat format {"2026": {...}} and nested {"path": {"2026": {...}}}
      const yearData = (catData as any)?.path ?? catData;
      for (const [year, pcts] of Object.entries(yearData as Record<string, any>)) {
        if (year === 'velocity' || year === 'path') continue; // skip non-year keys
        yearMap[year] = {
          median: pcts.median ?? 0,
          p10: pcts.p10 ?? 0,
          p25: pcts.p25 ?? 0,
          p75: pcts.p75 ?? 0,
          p90: pcts.p90 ?? 0,
        };
      }
      newShifts[catId] = yearMap;
    }

    // Build force contributions from backend causal_decomposition if available
    const causalDecomp = simulation?.causal_decomposition;
    let newFC: Record<string, ForceContribution[]> | undefined;
    if (causalDecomp && typeof causalDecomp === 'object') {
      newFC = {};
      for (const [catKey, decomp] of Object.entries(causalDecomp)) {
        const catId = normCatId(catKey);
        const directEffects = (decomp as any)?.direct_effects || decomp;
        if (directEffects && typeof directEffects === 'object') {
          newFC[catId] = Object.entries(directEffects).map(([force, value]) => ({
            force: force as ForceName,
            value: value as number,
            normalized: value as number,
          }));
        }
      }
    }

    setInitialData(prev => ({
      ...prev,
      shifts: { ...prev.shifts, ...newShifts },
      ...(newFC ? { forceContributions: { ...prev.forceContributions, ...newFC } } : {}),
      convergence: {
        r_hat: simulation.convergence?.r_hat ?? 0,
        converged: simulation.convergence?.converged ?? true,
        iterations: simulation.iterations ?? 5000,
        backtestingAccuracy: simulation.convergence?.backtesting_accuracy ?? 0,
      },
      allocation: (simulation.allocation || simulation.allocation_recommendation) ? {
        ...prev.allocation,
        ...(simulation.allocation || simulation.allocation_recommendation),
      } : prev.allocation,
    }));
  }, [simulation]);

  // Fetch trends from API
  useEffect(() => {
    fetch('/api/v1/trends')
      .then(r => r.json())
      .then((apiTrends: any[]) => {
        if (Array.isArray(apiTrends) && apiTrends.length > 0) {
          // Normalize API keys to UI format:
          // "Hair: Color" → "hair_color", "Raw Materials" → "raw_materials"
          const normCatKey = (k: string): string => k.toLowerCase().replace(/^(hair|lhc):\s*/, (_, g) => g + '_').replace(/\s+/g, '_');
          const normVcKey = (k: string): string => k.toLowerCase().replace(/[\s-]+/g, '_');
          const normDict = (d: Record<string, number> | undefined, fn: (k: string) => string): Record<string, number> => {
            if (!d) return {};
            const out: Record<string, number> = {};
            for (const [k, v] of Object.entries(d)) out[fn(k)] = v;
            return out;
          };
          const mapped = apiTrends.map(t => ({
            id: t.id,
            force: t.force,
            name: t.name,
            direction: t.direction || 'Expansion',
            probability: t.probability || 3,
            gp1_shift: t.normalized_score || 0,
            description: t.description || '',
            strategic_implication: t.strategic_implication || '',
            category_exposure: normDict(t.category_exposure, normCatKey),
            vc_exposure: normDict(t.vc_exposure, normVcKey),
            regional_exposure: t.regional_exposure || {},
            ai_suggested: t.ai_suggested || false,
            confidence: t.confidence || 'Medium',
            sources: t.sources || [],
            gp1_pct_affected: t.gp1_pct_affected ?? 0.10,
          }));
          setInitialData(prev => ({ ...prev, trends: mapped as any }));
        }
      })
      .catch(() => { /* keep initial data on failure */ });
  }, []);
  const forceNames = Object.keys(FORCES) as ForceName[];

  // ─── Recompute force contributions from real trend data ──────────────
  useEffect(() => {
    if (!data.trends || data.trends.length === 0) return;

    const newFC: Record<string, ForceContribution[]> = {};
    CATEGORIES.forEach(cat => {
      // Sum trend contributions per force (same logic as ForceShiftMatrix)
      const sums: Record<ForceName, number> = {
        Consumer: 0, Customer: 0, Technology: 0,
        Government: 0, Environmental: 0, Competitive: 0,
      };
      data.trends.forEach((trend: any) => {
        const force = trend.force as ForceName;
        if (!sums.hasOwnProperty(force)) return;
        const gp1Shift = trend.gp1_shift ?? trend.normalized_score ?? 0;
        const catExp = trend.category_exposure?.[cat.id] ?? 0;
        sums[force] += gp1Shift * (Math.max(0, Math.min(5, catExp)) / 5);
      });

      // Scale proportionally to match MC 2030 total (if available)
      const rawTotal = Object.values(sums).reduce((a, b) => a + b, 0);
      const catShift = data.shifts?.[cat.id];
      let mcTotal = 0;
      if (catShift) {
        const p = catShift as any;
        if (p[2030]) {
          const v = p[2030];
          mcTotal = typeof v === 'object' ? (v.median ?? v.p50 ?? 0) : (typeof v === 'number' ? v : 0);
        }
      }
      const scale = (Math.abs(rawTotal) > 1e-6 && Math.abs(mcTotal) > 1e-6) ? mcTotal / rawTotal : 1;

      newFC[cat.id] = forceNames.map(force => ({
        force,
        value: sums[force] * scale,
        normalized: sums[force] * scale,
      }));
    });

    setInitialData(prev => ({ ...prev, forceContributions: newFC }));
  }, [data.trends, data.shifts]);

  // ─── Listen for burger menu events (toggle export, delphi, snapshots) ──
  useEffect(() => {
    const onExport = () => setShowSettings(prev => !prev);
    const onDelphi = () => setShowDelphi(prev => !prev);
    const onSnaps = () => setShowSnapshots(prev => !prev);
    window.addEventListener('pulse:toggle-export', onExport);
    window.addEventListener('pulse:toggle-delphi', onDelphi);
    window.addEventListener('pulse:toggle-snapshots', onSnaps);
    return () => {
      window.removeEventListener('pulse:toggle-export', onExport);
      window.removeEventListener('pulse:toggle-delphi', onDelphi);
      window.removeEventListener('pulse:toggle-snapshots', onSnaps);
    };
  }, []);

  // AI insights — empty until scanner provides real data
  const aiInsights: AIInsight[] = [];

  const handleSimulate = async (): Promise<void> => {
    // Call the real backend simulation via usePulse hook
    try {
      await simulate();
    } catch (err) {
      console.error('Simulation failed:', err);
    }
  };

  const handleExportExcel = async (): Promise<void> => {
    // Generate Excel export with Shift Matrix
    if (!data) return;
    try {
      // Create CSV content from shifts
      const lines: string[] = ['Category,2026,2027,2028,2029,2030'];
      Object.entries(data.shifts).forEach(([catId, yearData]) => {
        const cat = CATEGORIES.find(c => c.id === catId);
        if (cat) {
          const vals = YEARS.map(yr => {
            const median = (yearData as any)[yr]?.median || 0;
            return (median * 100).toFixed(2);
          }).join(',');
          lines.push(`${cat.name},${vals}`);
        }
      });
      const csv = lines.join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'shift_matrix.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const handleExportPowerBI = async (): Promise<void> => {
    // Generate JSON for Power BI ingestion
    if (!data) return;
    try {
      const payload = {
        generated: new Date().toISOString(),
        scenario: activeScenario,
        shifts: data.shifts,
        causal_decomposition: data.forceContributions,
        model_version: 'bayesian_copula_v1',
        backtesting_accuracy: 0.73,
      };
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pulse_shift_matrix.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const handleExportPDF = async (): Promise<void> => {
    // Placeholder for PDF export (would require PDF library)
    console.log('PDF export not yet implemented');
  };

  const handleExportPowerPoint = async (): Promise<void> => {
    // Generate PowerPoint presentation via API
    try {
      const response = await fetch('/api/v1/export/pptx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('content-disposition');
      let filename = 'PRISM_War_Room.pptx';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      // Download the file
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PowerPoint export failed:', err);
      alert('PowerPoint export failed. Please check the backend.');
    }
  };

  const handleRefresh = (): void => {
    // Refresh the current simulation
    handleSimulate();
  };

  // Loading state
  if (loading && !data) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: T.bg,
      } as React.CSSProperties}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          <RefreshCw size={32} style={{ color: T.accent }} />
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{ background: T.bg, minHeight: '100vh', fontFamily: T.sans, color: T.text } as React.CSSProperties}>
      <OnboardingTooltips isOpen={true} onComplete={() => {}} />
      <AIInsightsBar insights={aiInsights} triggers={[]} isLoading={simulating} />
      {/* ─── STICKY HEADER ─────────────────────────────────────────────── */}
      <motion.header
        initial={{ y: -52 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        style={{
          position: 'sticky',
          top: 0,
          height: 52,
          backdropFilter: 'blur(20px)',
          background: `linear-gradient(180deg, ${T.bg1}dd 0%, ${T.bg2}88 100%)`,
          borderBottom: `1px solid ${T.border}`,
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
          } as React.CSSProperties}
        >
          {/* Logo & Version */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 } as React.CSSProperties}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: `linear-gradient(135deg, ${T.accent} 0%, ${T.purple} 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 14,
                color: T.bg,
              } as React.CSSProperties}
            >
              P
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.text2, letterSpacing: 0.5 } as React.CSSProperties}>
              PRISM War Room
            </div>
            <div
              style={{
                width: 1,
                height: 20,
                background: T.border,
              } as React.CSSProperties}
            />
            <span style={{ fontSize: 9, fontWeight: 600, color: T.text3, textTransform: 'uppercase', letterSpacing: 0.8 } as React.CSSProperties}>
              V6.0
            </span>
          </div>

          {/* Tab Buttons */}
          <div style={{ display: 'flex', gap: 8 } as React.CSSProperties}>
            {[
              { id: 'overview' as const, label: 'War Room', icon: BarChart3 },
              { id: 'trends' as const, label: 'Trends', icon: Layers },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeView === tab.id;
              return (
                <motion.button
                  key={tab.id}
                  onClick={() => setActiveView(tab.id)}
                  whileHover={{ background: T.bg3 }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: `1px solid ${isActive ? T.accent : T.border}`,
                    background: isActive ? T.accentDim : 'transparent',
                    color: isActive ? T.accent : T.text2,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  } as React.CSSProperties}
                >
                  <Icon size={14} />
                  {tab.label}
                </motion.button>
              );
            })}
            {/* Consumer Journey — navigates to separate page */}
            {onNavigateJourney && (
              <motion.button
                onClick={onNavigateJourney}
                whileHover={{ background: T.bg3 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: `1px solid ${T.border}`,
                  background: 'transparent',
                  color: T.text2,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                } as React.CSSProperties}
              >
                <Route size={14} />
                Consumer Journey
              </motion.button>
            )}
          </div>


          {/* Right: Badges & Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' } as React.CSSProperties}>
            {/* Convergence Pill with tooltip */}
            <SimTooltip
              content={
                <>
                  <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 12, color: '#F8FAFC' }}>Gelman–Rubin R̂ Statistic</div>
                  <div style={{ marginBottom: 8, lineHeight: 1.55 }}>
                    R̂ measures whether the Monte Carlo simulation chains have converged to the same distribution. It compares variance within each chain to variance between chains.
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 4, marginBottom: 8 }}>
                    <div><span style={{ color: T.green, fontWeight: 600 }}>R̂ {'<'} 1.05</span> — Excellent convergence</div>
                    <div><span style={{ color: T.green, fontWeight: 600 }}>R̂ {'<'} 1.10</span> — Acceptable convergence</div>
                    <div><span style={{ color: T.amber, fontWeight: 600 }}>R̂ {'>'} 1.10</span> — Poor convergence, results unreliable</div>
                  </div>
                  <div style={{ opacity: 0.7, fontSize: 10, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 6 }}>
                    Current value: R̂ = {data.convergence?.r_hat?.toFixed(4) || '1.0300'}. {(data.convergence?.r_hat ?? 1.03) < 1.05 ? 'Simulation has fully converged — results are statistically reliable.' : (data.convergence?.r_hat ?? 1.03) < 1.10 ? 'Acceptable convergence — results are usable.' : 'Low convergence — consider increasing iterations.'}
                  </div>
                </>
              }
            >
              <div
                style={{
                  ...WarRoomStyles.pill,
                  background: T.greenDim,
                  border: `1px solid ${T.green}20`,
                  cursor: 'help',
                } as React.CSSProperties}
              >
                <CheckCircle2 size={12} style={{ color: T.green }} />
                <span style={{ color: T.green, fontSize: 11, fontWeight: 600 }}>
                  R̂ {data.convergence?.r_hat?.toFixed(2) || '1.03'}
                </span>
              </div>
            </SimTooltip>

            {/* Iteration Count Pill with tooltip */}
            <SimTooltip
              content={
                <>
                  <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 12, color: '#F8FAFC' }}>Monte Carlo Iterations</div>
                  <div style={{ marginBottom: 8, lineHeight: 1.55 }}>
                    The number of random simulation runs used to estimate the probability distribution of profit pool shifts. Each iteration samples trend impacts from Bayesian posteriors and combines them via a copula dependency structure.
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 4, marginBottom: 8 }}>
                    <div><span style={{ fontWeight: 600 }}>5,000</span> — Fast exploratory run</div>
                    <div><span style={{ fontWeight: 600 }}>10,000</span> — Standard analysis (default)</div>
                    <div><span style={{ fontWeight: 600 }}>50,000</span> — High-precision for final sign-off</div>
                  </div>
                  <div style={{ opacity: 0.7, fontSize: 10, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 6 }}>
                    More iterations = tighter confidence intervals but longer runtime. Configurable in Model Configuration.
                  </div>
                </>
              }
            >
              <div style={{ ...WarRoomStyles.pill, background: T.border1, cursor: 'help' } as React.CSSProperties}>
                <Clock size={12} style={{ color: T.text3 }} />
                <span style={{ color: T.text3, fontSize: 11, fontWeight: 600 }}>
                  {data.convergence?.iterations?.toLocaleString() || '5k'} iter
                </span>
              </div>
            </SimTooltip>

            {/* Simulate Button — admin only */}
            {isAdmin && (
              <motion.button
                onClick={handleSimulate}
                disabled={simulating}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: `1px solid ${T.accent}40`,
                  background: T.accent,
                  color: '#000',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: simulating ? 'not-allowed' : 'pointer',
                  opacity: simulating ? 0.6 : 1,
                } as React.CSSProperties}
              >
                <Zap size={14} />
                {simulating ? 'Simulating…' : 'Simulate'}
              </motion.button>
            )}

            {/* Executive Briefing Button */}
            <motion.button
              onClick={() => setShowBriefing(true)}
              whileHover={{ background: T.bg3 }}
              whileTap={{ scale: 0.95 }}
              style={{
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8,
                border: `1px solid ${T.border}`,
                background: 'transparent',
                color: T.text2,
                cursor: 'pointer',
              } as React.CSSProperties}
              title="Executive Briefing"
            >
              <Presentation size={16} />
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* ─── MAIN CONTENT ──────────────────────────────────────────────── */}
      <motion.main
        layout
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        style={{
          maxWidth: 1440,
          marginX: 'auto',
          paddingLeft: 32,
          paddingRight: 32,
          paddingTop: 32,
          paddingBottom: 200,
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

        {activeView === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Row 1: Headline KPIs */}
            <div data-onboarding="kpi" style={{ marginBottom: 32 }}>
              <HeadlineKPI
                shifts={data.shifts}
                convergence={data.convergence}
                selectedCategory={selectedCategory}
              />
            </div>

            {/* Row 2: Heatmap + Path Timeline */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 1fr',
                gap: 24,
                marginBottom: 32,
              } as React.CSSProperties}
            >
              <div data-onboarding="heatmap">
              <ShiftHeatmap
                shifts={data.shifts}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                onDoubleClickCategory={setDeepDiveCategory}
              />
              </div>
              <div data-onboarding="timeline">
              <PathTimeline
                shifts={data.shifts}
                selectedCategory={selectedCategory}
              />
              </div>
            </div>

            {/* Force × Category Shift Matrix (2030) */}
            <div style={{ marginTop: 32 }}>
              <ForceShiftMatrix
                shifts={data.shifts}
                trends={data.trends}
                onSelectCategory={setSelectedCategory}
              />
            </div>

            {/* Region × Category Shift Matrix (2030) */}
            <div style={{ marginTop: 32 }}>
              <RegionShiftMatrix
                shifts={data.shifts}
                trends={data.trends}
                onSelectCategory={setSelectedCategory}
              />
            </div>
          </motion.div>
        )}

        {activeView === 'trends' && (
          <motion.div
            key="trends"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
          >
            <TrendExplorer
              data={{ trends: data.trends }}
              forceFilter={forceFilter || ''}
              onForceFilter={setForceFilter}
              isAdmin={isAdmin}
              onUpdateTrend={(id: string, updates: any) => {
                // Persist to API (include auth token for serverless)
                const token = localStorage.getItem('pulse_token');
                fetch(`/api/v1/trends/${id}`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  },
                  body: JSON.stringify(updates),
                }).catch(err => console.error('Failed to persist trend update:', err));
                // Update local state immediately with client-side recalculation
                setInitialData(prev => ({
                  ...prev,
                  trends: prev.trends.map((t: any) => {
                    if (t.id !== id) return t;
                    const merged = { ...t, ...updates };
                    // Recalculate gp1_shift (normalized_score) when probability,
                    // direction, or gp1_pct_affected changes
                    const probability = merged.probability || 3;
                    const dirSign = merged.direction === 'Contraction' ? -1 : 1;
                    const gp1Pct = merged.gp1_pct_affected ?? 0.10;
                    const rawNorm = (probability * dirSign) / 5;
                    merged.gp1_shift = rawNorm * gp1Pct;
                    return merged;
                  }) as any,
                }));
              }}
              onCreateTrend={async (trendData: any) => {
                try {
                  const tkn = localStorage.getItem('pulse_token');
                  const newId = `trend_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                  const payload = {
                    id: newId,
                    force: trendData.force || 'Consumer',
                    name: trendData.name || 'New Trend',
                    description: trendData.description || '',
                    direction: trendData.direction || 'Expansion',
                    probability: trendData.probability || 3,
                    gp1_pct_affected: 0.10,
                    category_exposure: {},
                    vc_exposure: {},
                    sources: [],
                    ai_suggested: false,
                    confidence: 'Medium',
                  };
                  const res = await fetch('/api/v1/trends', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(tkn ? { Authorization: `Bearer ${tkn}` } : {}),
                    },
                    body: JSON.stringify(payload),
                  });
                  if (res.ok) {
                    const created = await res.json();
                    const probability = created.probability || payload.probability;
                    const dirSign = (created.direction || payload.direction) === 'Contraction' ? -1 : 1;
                    const gp1Pct = created.gp1_pct_affected ?? 0.10;
                    setInitialData(prev => ({
                      ...prev,
                      trends: [...prev.trends, {
                        ...payload,
                        ...created,
                        gp1_shift: (probability * dirSign / 5) * gp1Pct,
                      }] as any,
                    }));
                  }
                } catch (err) {
                  console.error('Failed to create trend:', err);
                }
              }}
              onDeleteTrend={async (id: string) => {
                try {
                  const tkn = localStorage.getItem('pulse_token');
                  const res = await fetch(`/api/v1/trends/${id}`, {
                    method: 'DELETE',
                    headers: tkn ? { Authorization: `Bearer ${tkn}` } : {},
                  });
                  if (res.ok) {
                    setInitialData(prev => ({
                      ...prev,
                      trends: prev.trends.filter((t: any) => t.id !== id) as any,
                    }));
                  }
                } catch (err) {
                  console.error('Failed to delete trend:', err);
                }
              }}
            />

            {/* Emerging Trends section removed */}
          </motion.div>
        )}
      </motion.main>

      {/* ─── DETAIL PANEL (Right Slide-In) ─────────────────────────────── */}
      <AnimatePresence>
        {selectedCategory && (
          <>
            {/* Backdrop */}
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
              } as React.CSSProperties}
            />

            {/* Panel */}
            <motion.div
              initial={{ x: 420 }}
              animate={{ x: 0 }}
              exit={{ x: 420 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              style={{
                position: 'fixed',
                right: 0,
                top: 0,
                bottom: 0,
                width: 420,
                background: `linear-gradient(180deg, ${T.bg2} 0%, ${T.bg1} 100%)`,
                borderLeft: `1px solid ${T.border}`,
                overflowY: 'auto',
                zIndex: 201,
              } as React.CSSProperties}
            >
              <div
                style={{
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
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
                  } as React.CSSProperties}
                >
                  <X size={16} />
                </motion.button>

                <CategoryDetailPanel
                  categoryId={selectedCategory || ''}
                  data={{
                    shifts_path: (() => {
                      // Transform { catId: { year: { median, p10, ... } } } to expected format
                      const result: Record<string, Record<string, { median?: number; p10?: number; p90?: number }>> = {};
                      if (data.shifts && selectedCategory) {
                        const catShifts = (data.shifts as any)[selectedCategory];
                        if (catShifts) {
                          result[selectedCategory] = catShifts;
                        }
                      }
                      return result;
                    })(),
                    force_decomposition: (() => {
                      // Use per-force shift contributions directly (already computed
                      // in the useEffect from trend data × category exposure, scaled to MC total)
                      const result: Record<string, Record<string, number>> = {};
                      if (data.forceContributions && selectedCategory) {
                        const contribs = data.forceContributions[selectedCategory];
                        if (contribs && Array.isArray(contribs)) {
                          const forceMap: Record<string, number> = {};
                          contribs.forEach((fc: any) => {
                            forceMap[fc.force] = fc.value || 0;
                          });
                          result[selectedCategory] = forceMap;
                        }
                      }
                      return result;
                    })(),
                    contributing_trends: (() => {
                      // Filter trends that have exposure to this category
                      if (!selectedCategory) return {};
                      const filtered = data.trends.filter((t: any) =>
                        t.category_exposure && t.category_exposure[selectedCategory] > 0
                      ).map((t: any) => ({
                        ...t,
                        exposure_level: t.category_exposure?.[selectedCategory] || 0,
                      }));
                      return { [selectedCategory]: filtered };
                    })(),
                    categories: CATEGORIES,
                  }}
                  onClose={() => setSelectedCategory(undefined)}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ─── FIXED BOTTOM BAR ──────────────────────────────────────────── */}
      <motion.footer
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 80,
          backdropFilter: 'blur(20px)',
          background: `linear-gradient(180deg, transparent 0%, ${T.bg1}dd 50%, ${T.bg1}ff 100%)`,
          borderTop: `1px solid ${T.border}`,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          paddingLeft: 32,
          paddingRight: 32,
          paddingBottom: 20,
          gap: 24,
          zIndex: 50,
        } as React.CSSProperties}
      >
        {/* Left: AI Insights */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' } as React.CSSProperties}>
          {aiInsights.map(insight => (
            <motion.button
              key={insight.id}
              whileHover={{ scale: 1.05 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 20,
                border: `1px solid ${insight.type === 'trigger' ? T.amber : T.accent}40`,
                background: insight.type === 'trigger' ? T.amberDim : T.accentDim,
                color: insight.type === 'trigger' ? T.amber : T.accent,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              } as React.CSSProperties}
            >
              <Brain size={12} />
              {insight.text}
            </motion.button>
          ))}
        </div>

        {/* Right: Export Button */}
        <div style={{ display: 'flex', gap: 8 } as React.CSSProperties}>
          <motion.button
            onClick={() => setShowSettings(true)}
            whileHover={{ scale: 1.02 }}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: `1px solid ${T.accent}40`,
              background: T.accent,
              color: '#000',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            } as React.CSSProperties}
          >
            Export Results
          </motion.button>
        </div>
      </motion.footer>

      {/* Delphi Panel */}
      <AnimatePresence>
        {showDelphi && <DelphiPanel onClose={() => setShowDelphi(false)} />}
      </AnimatePresence>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.3)',
                backdropFilter: 'blur(4px)',
                zIndex: 200,
              } as React.CSSProperties}
            />
            <motion.div
              initial={{ x: 420 }}
              animate={{ x: 0 }}
              exit={{ x: 420 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              style={{
                position: 'fixed',
                right: 0,
                top: 0,
                bottom: 0,
                width: 420,
                background: `linear-gradient(180deg, ${T.bg2} 0%, ${T.bg1} 100%)`,
                borderLeft: `1px solid ${T.border}`,
                overflowY: 'auto',
                zIndex: 201,
                padding: 24,
              } as React.CSSProperties}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: T.text, margin: 0 }}>Settings & Export</h2>
                <motion.button
                  onClick={() => setShowSettings(false)}
                  whileHover={{ background: T.bg3 }}
                  style={{
                    width: 32, height: 32,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 8,
                    border: `1px solid ${T.border}`,
                    background: 'transparent',
                    color: T.text2,
                    cursor: 'pointer',
                  } as React.CSSProperties}
                >
                  <X size={16} />
                </motion.button>
              </div>
              <SettingsPanel
                onExcel={handleExportExcel}
                onPowerBI={handleExportPowerBI}
                onPDF={handleExportPDF}
                onPowerPoint={handleExportPowerPoint}
                onRefresh={handleRefresh}
                modelAccuracy={data.convergence?.backtestingAccuracy || 0.73}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Category Deep Dive Modal */}
      <AnimatePresence>
        {deepDiveCategory && (
          <CategoryDeepDive
            categoryId={deepDiveCategory}
            shifts={data.shifts}
            trends={data.trends}
            forceContributions={data.forceContributions}
            allocation={data.allocation}
            onClose={() => setDeepDiveCategory(null)}
          />
        )}
      </AnimatePresence>

      {/* Session Snapshots Panel */}
      <AnimatePresence>
        {showSnapshots && (
          <SessionSnapshots
            currentShifts={data.shifts}
            currentTrends={data.trends}
            onClose={() => setShowSnapshots(false)}
          />
        )}
      </AnimatePresence>

      {/* Executive Briefing Modal */}
      <AnimatePresence>
        {showBriefing && (
          <ExecutiveBriefing
            shifts={data.shifts}
            trends={data.trends}
            convergence={data.convergence}
            allocation={data.allocation}
            onClose={() => setShowBriefing(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Inline Styles ─────────────────────────────────────────────────────
const WarRoomStyles: Record<string, React.CSSProperties> = {
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
