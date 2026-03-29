/**
 * AdminConfigPanel — PULSE model configuration editor.
 * Slide-over panel for admins to adjust:
 *   - Attenuation factor (0.05 to 1.0)
 *   - Force weights (6 forces, sum to 1.0)
 *   - Value chain weights (8 VC steps, sum to 1.0)
 *   - Copula parameters (within_force_rho, t_copula_df)
 *   - Simulation settings (iterations)
 *
 * Dark theme matching PULSE spec:
 *   bg: #0F172A | surface: #1E293B | accent: #D4A847 | text: #F8FAFC/#94A3B8
 */

import { useState, useEffect, useCallback, type FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ModelConfig, ForceName, ValueChainStep } from '../types';

/* ── Design tokens (Dark theme) ───────────────────────────────────────── */
const T = {
  bg: '#0F172A',        /* Deep navy — main background */
  bg1: '#1E293B',       /* Elevated surface */
  bg2: '#334155',       /* Tertiary surface */
  border: 'rgba(71, 85, 105, 0.5)',
  border2: 'rgba(71, 85, 105, 0.8)',
  accent: '#D4A847',    /* Gold accent */
  accentDim: 'rgba(212, 168, 71, 0.1)',
  text: '#F8FAFC',      /* Primary text */
  text2: '#94A3B8',     /* Secondary text */
  text3: '#64748B',     /* Tertiary text */
  sans: "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', monospace",
};

const FORCES: ForceName[] = ['Consumer', 'Customer', 'Technology', 'Government', 'Environmental', 'Competitive'];
const VC_STEPS: ValueChainStep[] = ['raw_materials', 'formulation', 'packaging', 'manufacturing', 'logistics', 'marketing', 'trade', 'after_sales'];

const VC_LABELS: Record<ValueChainStep, string> = {
  raw_materials: 'Raw Materials',
  formulation: 'Formulation',
  packaging: 'Packaging',
  manufacturing: 'Manufacturing',
  logistics: 'Logistics',
  marketing: 'Marketing',
  trade: 'Trade',
  after_sales: 'After Sales',
};

type RegionKey = 'Europe' | 'North America' | 'Asia' | 'High Growth';
const REGIONS: RegionKey[] = ['Europe', 'North America', 'Asia', 'High Growth'];

interface AdminConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const AdminConfigPanel: FC<AdminConfigPanelProps> = ({ isOpen, onClose }) => {
  /* ── Form state ──────────────────────────────────────────────────── */
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  /* ── Collapsible sections ────────────────────────────────────────── */
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    attenuation: true,
    forceWeights: true,
    vcWeights: false,
    regionWeights: false,
    copula: false,
    simulation: false,
  });

  /* ── Configuration values ───────────────────────────────────────── */
  const [config, setConfig] = useState<ModelConfig>({});
  const [attenuation, setAttenuation] = useState(0.5);
  const [attenuationSource, setAttenuationSource] = useState<'assumed' | 'backtested' | 'admin_override'>('assumed');
  const [forceWeights, setForceWeights] = useState<Record<ForceName, number>>({
    Consumer: 0.2,
    Customer: 0.15,
    Technology: 0.25,
    Government: 0.15,
    Environmental: 0.15,
    Competitive: 0.1,
  });
  const [vcWeights, setVCWeights] = useState<Record<ValueChainStep, number>>({
    raw_materials: 0.15,
    formulation: 0.15,
    packaging: 0.12,
    manufacturing: 0.12,
    logistics: 0.12,
    marketing: 0.18,
    trade: 0.1,
    after_sales: 0.06,
  });
  const [regionWeights, setRegionWeights] = useState<Record<RegionKey, number>>({
    'Europe': 0.25,
    'North America': 0.25,
    'Asia': 0.25,
    'High Growth': 0.25,
  });
  const [withinForceRho, setWithinForceRho] = useState(0.3);
  const [tCopulaDf, setTCopulaDf] = useState(4);
  const [iterations, setIterations] = useState(10000);

  /* ── Auto-dismiss toast ──────────────────────────────────────────– */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  /* ── Fetch current config ────────────────────────────────────────── */
  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const BASE = '/api/v1';
      const token = localStorage.getItem('pulse_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${BASE}/config`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ModelConfig = await res.json();
      setConfig(data);

      if (data.attenuation) setAttenuation(data.attenuation);
      if (data.force_weights) setForceWeights(data.force_weights as Record<ForceName, number>);
      if (data.vc_weights) setVCWeights(data.vc_weights as Record<ValueChainStep, number>);
      if ((data as any).region_weights) setRegionWeights((data as any).region_weights as Record<RegionKey, number>);
      if ((data as any).within_force_rho) setWithinForceRho((data as any).within_force_rho);
      if ((data as any).t_copula_df) setTCopulaDf((data as any).t_copula_df);
      if (data.iterations) setIterations(data.iterations);
    } catch (e: any) {
      setError(e.message || 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) fetchConfig();
  }, [isOpen, fetchConfig]);

  /* ── Toggle collapsible section ──────────────────────────────────– */
  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  /* ── Calculate sum and remaining for weights ──────────────────────– */
  const sumForceWeights = Object.values(forceWeights).reduce((a, b) => a + b, 0);
  const sumVCWeights = Object.values(vcWeights).reduce((a, b) => a + b, 0);
  const sumRegionWeights = Object.values(regionWeights).reduce((a, b) => a + b, 0);

  /* ── Auto-normalize weights on change ────────────────────────────– */
  const normalizeForceWeights = (weights: Record<ForceName, number>) => {
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    if (sum === 0) return weights;
    return Object.entries(weights).reduce((acc, [k, v]) => {
      acc[k as ForceName] = Number((v / sum).toFixed(4));
      return acc;
    }, {} as Record<ForceName, number>);
  };

  const normalizeVCWeights = (weights: Record<ValueChainStep, number>) => {
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    if (sum === 0) return weights;
    return Object.entries(weights).reduce((acc, [k, v]) => {
      acc[k as ValueChainStep] = Number((v / sum).toFixed(4));
      return acc;
    }, {} as Record<ValueChainStep, number>);
  };

  const normalizeRegionWeights = (weights: Record<RegionKey, number>) => {
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    if (sum === 0) return weights;
    return Object.entries(weights).reduce((acc, [k, v]) => {
      acc[k as RegionKey] = Number((v / sum).toFixed(4));
      return acc;
    }, {} as Record<RegionKey, number>);
  };

  const handleForceWeightChange = (force: ForceName, value: number) => {
    const updated = { ...forceWeights, [force]: Math.max(0, value) };
    setForceWeights(updated);
  };

  const handleVCWeightChange = (step: ValueChainStep, value: number) => {
    const updated = { ...vcWeights, [step]: Math.max(0, value) };
    setVCWeights(updated);
  };

  const handleRegionWeightChange = (region: RegionKey, value: number) => {
    const updated = { ...regionWeights, [region]: Math.max(0, value) };
    setRegionWeights(updated);
  };

  /* ── Save configuration ──────────────────────────────────────────– */
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const BASE = '/api/v1';
      const token = localStorage.getItem('pulse_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const normalized_force_weights = normalizeForceWeights(forceWeights);
      const normalized_vc_weights = normalizeVCWeights(vcWeights);
      const normalized_region_weights = normalizeRegionWeights(regionWeights);

      const payload = {
        attenuation: Number(attenuation.toFixed(4)),
        attenuation_source: attenuationSource,
        force_weights: normalized_force_weights,
        vc_weights: normalized_vc_weights,
        region_weights: normalized_region_weights,
        within_force_rho: Number(withinForceRho.toFixed(2)),
        t_copula_df: Math.round(tCopulaDf),
        iterations: Math.round(iterations),
      };

      const res = await fetch(`${BASE}/config`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP ${res.status}`);
      }

      setToast({ msg: 'Configuration saved. Re-simulating model…', type: 'success' });
      // Update the local config with normalized values
      setForceWeights(normalized_force_weights);
      setVCWeights(normalized_vc_weights);
      setRegionWeights(normalized_region_weights);
      setAttenuationSource('admin_override');

      // Auto-trigger re-simulation with new config
      try {
        await fetch(`${BASE}/simulate`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ scenario: 'base', iterations: Math.round(iterations), include_allocation: true }),
        });
        // Notify the War Room to refresh data
        window.dispatchEvent(new CustomEvent('pulse:config-updated'));
      } catch {
        // Simulation may take long on serverless, non-blocking
      }
    } catch (e: any) {
      setToast({ msg: e.message || 'Failed to save configuration', type: 'error' });
      setError(e.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  /* ── Section component ──────────────────────────────────────────– */
  const Section: FC<{
    id: string;
    title: string;
    children: React.ReactNode;
  }> = ({ id, title, children }) => {
    const isExpanded = expandedSections[id];
    return (
      <div style={{ marginBottom: 12 }}>
        <button
          onClick={() => toggleSection(id)}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 10,
            border: `1px solid ${T.border}`,
            background: T.bg1,
            color: T.text,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            transition: 'all 0.2s',
            fontFamily: T.sans,
            letterSpacing: '-0.01em',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.borderColor = T.accent;
            e.currentTarget.style.background = 'rgba(212, 168, 71, 0.05)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.borderColor = T.border;
            e.currentTarget.style.background = T.bg1;
          }}
        >
          <span>{title}</span>
          <span style={{ fontSize: 12, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
            ▼
          </span>
        </button>
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden' }}
            >
              <div
                style={{
                  padding: '14px 16px',
                  background: 'rgba(212, 168, 71, 0.04)',
                  borderLeft: `3px solid ${T.accent}`,
                  marginTop: 1,
                }}
              >
                {children}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  /* ── Slider component with typeable input ──────────────────────– */
  const SliderInput: FC<{
    label: string;
    value: number;
    onChange: (v: number) => void;
    min: number;
    max: number;
    step: number;
    showValue?: boolean;
    suffix?: string;
  }> = ({ label, value, onChange, min, max, step, showValue = true, suffix = '' }) => {
    const decimals = step < 0.001 ? 4 : step < 0.01 ? 3 : step < 0.1 ? 2 : 1;
    const pct = ((value - min) / (max - min)) * 100;
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: T.text2 }}>
            {label}
          </label>
          {showValue && (
            <input
              type="number"
              value={value.toFixed(decimals)}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
              }}
              min={min}
              max={max}
              step={step}
              style={{
                width: 72,
                padding: '2px 6px',
                borderRadius: 6,
                border: `1px solid ${T.border}`,
                background: T.bg,
                color: T.accent,
                fontSize: 12,
                fontWeight: 600,
                fontFamily: T.mono,
                textAlign: 'right',
                outline: 'none',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = T.accent;
                e.target.style.boxShadow = '0 0 0 2px rgba(212, 168, 71, 0.15)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = T.border;
                e.target.style.boxShadow = 'none';
              }}
            />
          )}
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={{
            width: '100%',
            height: 6,
            borderRadius: 3,
            background: `linear-gradient(to right, ${T.accent} 0%, ${T.accent} ${pct}%, rgba(148, 163, 184, 0.2) ${pct}%, rgba(148, 163, 184, 0.2) 100%)`,
            cursor: 'pointer',
            WebkitAppearance: 'none',
            appearance: 'none',
          } as React.CSSProperties}
        />
      </div>
    );
  };

  /* ── Number input component ──────────────────────────────────────– */
  const NumberInput: FC<{
    label: string;
    value: number;
    onChange: (v: number) => void;
    min: number;
    max: number;
    step: number;
  }> = ({ label, value, onChange, min, max, step }) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: T.text2, display: 'block', marginBottom: 6 }}>
        {label}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          onChange(Math.max(min, Math.min(max, v)));
        }}
        min={min}
        max={max}
        step={step}
        style={{
          width: '100%',
          padding: '8px 12px',
          borderRadius: 8,
          border: `1px solid ${T.border}`,
          background: T.bg,
          color: T.text,
          fontSize: 13,
          outline: 'none',
          boxSizing: 'border-box',
          fontFamily: T.mono,
          transition: 'border-color 0.2s, box-shadow 0.2s',
        }}
        onFocus={(e) => {
          e.target.style.borderColor = T.accent;
          e.target.style.boxShadow = `0 0 0 2px rgba(212, 168, 71, 0.2)`;
        }}
        onBlur={(e) => {
          e.target.style.borderColor = T.border;
          e.target.style.boxShadow = 'none';
        }}
      />
    </div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9998,
              background: 'rgba(0, 0, 0, 0.4)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ type: 'spring', stiffness: 350, damping: 32 }}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              zIndex: 9999,
              width: Math.min(480, window.innerWidth - 40),
              background: T.bg,
              borderLeft: `1px solid ${T.border}`,
              boxShadow: '-20px 0 60px rgba(0, 0, 0, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              fontFamily: T.sans,
              overflow: 'hidden',
            }}
          >
            {/* ─── Header ─── */}
            <div
              style={{
                padding: '20px 24px 16px',
                borderBottom: `1px solid ${T.border}`,
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: 20,
                      fontWeight: 700,
                      color: T.text,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    Model Configuration
                  </h2>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: T.text2 }}>
                    Adjust simulation parameters and weights
                  </p>
                </div>
                <button
                  onClick={onClose}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    border: 'none',
                    background: T.bg1,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: T.text2,
                    fontSize: 16,
                    transition: 'all 0.15s',
                    fontFamily: T.sans,
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'rgba(212, 168, 71, 0.1)';
                    e.currentTarget.style.color = T.accent;
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = T.bg1;
                    e.currentTarget.style.color = T.text2;
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* ─── Content ─── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 24px' }}>
              {loading && (
                <div style={{ textAlign: 'center', padding: 40, color: T.text3 }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>⟳</div>
                  <div style={{ fontSize: 13 }}>Loading configuration...</div>
                </div>
              )}

              {error && !loading && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: 10,
                    marginBottom: 16,
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: `1px solid rgba(239, 68, 68, 0.3)`,
                    color: '#FCA5A5',
                    fontSize: 12,
                    lineHeight: 1.5,
                  }}
                >
                  {error}
                </div>
              )}

              {!loading && (
                <>
                  {/* ─── Attenuation Factor ─── */}
                  <Section id="attenuation" title="Attenuation Factor">
                    <SliderInput
                      label="Attenuation (multiplicative decay)"
                      value={attenuation}
                      onChange={setAttenuation}
                      min={0.05}
                      max={1.0}
                      step={0.05}
                    />
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: T.text2, display: 'block', marginBottom: 6 }}>
                        Source
                      </label>
                      <select
                        value={attenuationSource}
                        onChange={(e) => setAttenuationSource(e.target.value as 'assumed' | 'backtested' | 'admin_override')}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: 8,
                          border: `1px solid ${T.border}`,
                          background: T.bg,
                          color: T.text,
                          fontSize: 13,
                          outline: 'none',
                          fontFamily: T.sans,
                          cursor: 'pointer',
                        }}
                      >
                        <option value="assumed">Assumed (default 0.5)</option>
                        <option value="backtested">Backtested (calibrated from history)</option>
                        <option value="admin_override">Admin Override</option>
                      </select>
                    </div>
                    <div
                      style={{
                        padding: 10,
                        borderRadius: 8,
                        background: T.bg,
                        border: `1px solid ${T.border}`,
                        fontSize: 11,
                        color: T.text3,
                        lineHeight: 1.5,
                      }}
                    >
                      Controls the multiplicative decay of force impacts across categories.
                      Lower values (0.2–0.5) = conservative. Higher values (0.7–1.0) = aggressive.
                    </div>
                  </Section>

                  {/* ─── Force Weights ─── */}
                  <Section id="forceWeights" title="Force Weights (Strategic)">
                    {FORCES.map((force) => (
                      <SliderInput
                        key={force}
                        label={force}
                        value={forceWeights[force]}
                        onChange={(v) => handleForceWeightChange(force, v)}
                        min={0}
                        max={1}
                        step={0.01}
                      />
                    ))}
                    <div
                      style={{
                        padding: 10,
                        borderRadius: 8,
                        background: T.bg,
                        border: `1px solid ${T.border}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      <span style={{ color: T.text2 }}>Sum</span>
                      <span
                        style={{
                          color: Math.abs(sumForceWeights - 1.0) < 0.01 ? '#22C55E' : '#EF4444',
                          fontFamily: T.mono,
                        }}
                      >
                        {sumForceWeights.toFixed(3)}
                      </span>
                    </div>
                    <div
                      style={{
                        marginTop: 10,
                        padding: 8,
                        fontSize: 10,
                        color: T.text3,
                        borderRadius: 6,
                        background: 'rgba(212, 168, 71, 0.04)',
                        lineHeight: 1.4,
                      }}
                    >
                      Weights auto-normalize to sum to 1.0 on save. Allocate more weight to forces
                      you expect to drive pool shifts.
                    </div>
                  </Section>

                  {/* ─── Value Chain Weights ─── */}
                  <Section id="vcWeights" title="Value Chain Weights">
                    {VC_STEPS.map((step) => (
                      <SliderInput
                        key={step}
                        label={VC_LABELS[step]}
                        value={vcWeights[step]}
                        onChange={(v) => handleVCWeightChange(step, v)}
                        min={0}
                        max={1}
                        step={0.01}
                      />
                    ))}
                    <div
                      style={{
                        padding: 10,
                        borderRadius: 8,
                        background: T.bg,
                        border: `1px solid ${T.border}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      <span style={{ color: T.text2 }}>Sum</span>
                      <span
                        style={{
                          color: Math.abs(sumVCWeights - 1.0) < 0.01 ? '#22C55E' : '#EF4444',
                          fontFamily: T.mono,
                        }}
                      >
                        {sumVCWeights.toFixed(3)}
                      </span>
                    </div>
                  </Section>

                  {/* ─── Region Weights ─── */}
                  <Section id="regionWeights" title="Region Weights">
                    {REGIONS.map((region) => (
                      <SliderInput
                        key={region}
                        label={region}
                        value={regionWeights[region]}
                        onChange={(v) => handleRegionWeightChange(region, v)}
                        min={0}
                        max={1}
                        step={0.01}
                      />
                    ))}
                    <div
                      style={{
                        padding: 10,
                        borderRadius: 8,
                        background: T.bg,
                        border: `1px solid ${T.border}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      <span style={{ color: T.text2 }}>Sum</span>
                      <span
                        style={{
                          color: Math.abs(sumRegionWeights - 1.0) < 0.01 ? '#22C55E' : '#EF4444',
                          fontFamily: T.mono,
                        }}
                      >
                        {sumRegionWeights.toFixed(3)}
                      </span>
                    </div>
                    <div
                      style={{
                        marginTop: 10,
                        padding: 8,
                        fontSize: 10,
                        color: T.text3,
                        borderRadius: 6,
                        background: 'rgba(212, 168, 71, 0.04)',
                        lineHeight: 1.4,
                      }}
                    >
                      Region weights proportionally scale each trend's impact based on its regional exposure.
                      A trend affecting only North America will have its impact scaled by that region's weight.
                    </div>
                  </Section>

                  {/* ─── Copula Parameters ─── */}
                  <Section id="copula" title="Copula Parameters">
                    <SliderInput
                      label="Within-Force Correlation (ρ)"
                      value={withinForceRho}
                      onChange={setWithinForceRho}
                      min={0.0}
                      max={0.9}
                      step={0.05}
                    />
                    <NumberInput
                      label="Student t-Copula Degrees of Freedom"
                      value={tCopulaDf}
                      onChange={setTCopulaDf}
                      min={2}
                      max={30}
                      step={1}
                    />
                    <div
                      style={{
                        padding: 10,
                        borderRadius: 8,
                        background: T.bg,
                        border: `1px solid ${T.border}`,
                        fontSize: 11,
                        color: T.text3,
                        lineHeight: 1.5,
                      }}
                    >
                      <strong style={{ color: T.text2 }}>Within-force ρ:</strong> Controls correlation between
                      forces within the same strategic pillar. Higher = tighter coupling.
                      <br />
                      <strong style={{ color: T.text2, marginTop: 4, display: 'block' }}>t-df:</strong> Lower values
                      (2–4) = heavier tails, more "crisis correlation". Higher values = normal dependence.
                    </div>
                  </Section>

                  {/* ─── Simulation Settings ─── */}
                  <Section id="simulation" title="Simulation Settings">
                    <NumberInput
                      label="Monte Carlo Iterations"
                      value={iterations}
                      onChange={setIterations}
                      min={1000}
                      max={100000}
                      step={1000}
                    />
                    <div
                      style={{
                        padding: 10,
                        borderRadius: 8,
                        background: T.bg,
                        border: `1px solid ${T.border}`,
                        fontSize: 11,
                        color: T.text3,
                        lineHeight: 1.5,
                      }}
                    >
                      Larger iteration counts (50k–100k) improve accuracy but increase computation time.
                      Default 10k is suitable for interactive workflows.
                    </div>
                  </Section>
                </>
              )}
            </div>

            {/* ─── Footer / Actions ─── */}
            <div
              style={{
                padding: '14px 20px',
                borderTop: `1px solid ${T.border}`,
                display: 'flex',
                gap: 10,
                justifyContent: 'flex-end',
                flexShrink: 0,
              }}
            >
              <button
                onClick={onClose}
                disabled={saving}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: `1px solid ${T.border}`,
                  background: T.bg1,
                  color: T.text2,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  fontFamily: T.sans,
                  opacity: saving ? 0.5 : 1,
                }}
                onMouseOver={(e) => {
                  if (!saving) {
                    e.currentTarget.style.background = 'rgba(212, 168, 71, 0.1)';
                    e.currentTarget.style.color = T.accent;
                  }
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = T.bg1;
                  e.currentTarget.style.color = T.text2;
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || loading}
                style={{
                  padding: '8px 24px',
                  borderRadius: 8,
                  border: 'none',
                  background: T.accent,
                  color: '#000',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: saving || loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s',
                  opacity: saving || loading ? 0.6 : 1,
                  boxShadow: '0 2px 8px rgba(212, 168, 71, 0.2)',
                  fontFamily: T.sans,
                }}
                onMouseOver={(e) => {
                  if (!saving && !loading) {
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(212, 168, 71, 0.3)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(212, 168, 71, 0.2)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </motion.div>

          {/* ─── Toast Notification ─── */}
          <AnimatePresence>
            {toast && (
              <motion.div
                initial={{ opacity: 0, y: 20, x: '-50%' }}
                animate={{ opacity: 1, y: 0, x: '-50%' }}
                exit={{ opacity: 0, y: 20, x: '-50%' }}
                style={{
                  position: 'fixed',
                  bottom: 24,
                  left: '50%',
                  zIndex: 10000,
                  padding: '10px 20px',
                  borderRadius: 10,
                  background: toast.type === 'success' ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontFamily: T.sans,
                }}
              >
                <span>{toast.type === 'success' ? '✓' : '✕'}</span>
                {toast.msg}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
};

export default AdminConfigPanel;
