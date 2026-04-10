/**
 * SettingsPage — Full-page PRISM model configuration editor.
 *
 * Replaces the slide-over AdminConfigPanel with a dedicated full-page layout.
 * Contains:
 *   - Attenuation factor
 *   - Force weights
 *   - Value chain weights
 *   - Region weights
 *   - Copula parameters (within_force_rho, t_copula_df)
 *   - Editable 6×6 Force Correlation Matrix
 *   - Simulation settings (iterations)
 *
 * Dark theme matching PRISM spec.
 */

import { useState, useEffect, useCallback, type FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Save, RotateCcw } from 'lucide-react';
import { T } from '../lib/format';

type ForceName = 'Consumer' | 'Customer' | 'Technology' | 'Government' | 'Environmental' | 'Competitive';
const FORCES: ForceName[] = ['Consumer', 'Customer', 'Technology', 'Government', 'Environmental', 'Competitive'];
const VC_STEPS: string[] = ['Raw Materials', 'Formulation', 'Manufacturing', 'Packaging', 'Supply Chain', 'Marketing', 'Commercial', 'Consumer'];
type RegionKey = 'Europe' | 'North America' | 'Asia' | 'High Growth';
const REGIONS: RegionKey[] = ['Europe', 'North America', 'Asia', 'High Growth'];

/* Force colors for the matrix header */
const FORCE_COLORS: Record<ForceName, string> = {
  Consumer: '#3B82F6',
  Customer: '#8B5CF6',
  Technology: '#06B6D4',
  Government: '#F59E0B',
  Environmental: '#22C55E',
  Competitive: '#EF4444',
};

/* Short labels for tight matrix header */
const FORCE_SHORT: Record<ForceName, string> = {
  Consumer: 'Cons',
  Customer: 'Cust',
  Technology: 'Tech',
  Government: 'Gov',
  Environmental: 'Env',
  Competitive: 'Comp',
};

interface SettingsPageProps {
  onBack: () => void;
}

const SettingsPage: FC<SettingsPageProps> = ({ onBack }) => {
  /* ── State ─────────────────────────────────────────────────── */
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const [attenuation, setAttenuation] = useState(0.5);
  const [attenuationSource, setAttenuationSource] = useState<string>('assumed');
  const [forceWeights, setForceWeights] = useState<Record<ForceName, number>>(
    () => Object.fromEntries(FORCES.map(f => [f, 1 / 6])) as Record<ForceName, number>
  );
  const [vcWeights, setVCWeights] = useState<Record<string, number>>(
    () => Object.fromEntries(VC_STEPS.map(s => [s, 1 / 8]))
  );
  const [regionWeights, setRegionWeights] = useState<Record<RegionKey, number>>(
    () => Object.fromEntries(REGIONS.map(r => [r, 0.25])) as Record<RegionKey, number>
  );
  const [withinForceRho, setWithinForceRho] = useState(0.3);
  const [tCopulaDf, setTCopulaDf] = useState(4);
  const [iterations, setIterations] = useState(10000);
  const [categoryWeights, setCategoryWeights] = useState<Record<string, number>>(
    () => {
      const cats = ['Hair: Color', 'Hair: Care', 'Hair: Styling', 'Hair: Body',
        'LHC: FCN', 'LHC: FCA', 'LHC: FFI', 'LHC: LAD',
        'LHC: HDW', 'LHC: ADW', 'LHC: HSC', 'LHC: IC'];
      return Object.fromEntries(cats.map(c => [c, 1 / cats.length]));
    }
  );
  const [correlationMatrix, setCorrelationMatrix] = useState<Record<string, Record<string, number>>>({});

  /* ── Toast auto-dismiss ────────────────────────────────────── */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  /* ── Fetch config ──────────────────────────────────────────── */
  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('pulse_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/v1/config', { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.attenuation != null) setAttenuation(data.attenuation);
      if (data.attenuation_source) setAttenuationSource(data.attenuation_source);
      if (data.force_weights) setForceWeights(data.force_weights);
      if (data.vc_weights) setVCWeights(data.vc_weights);
      if (data.region_weights) setRegionWeights(data.region_weights);
      if (data.within_force_rho != null) setWithinForceRho(data.within_force_rho);
      if (data.t_copula_df != null) setTCopulaDf(data.t_copula_df);
      if (data.iterations != null) setIterations(data.iterations);
      if (data.category_weights) setCategoryWeights(data.category_weights);
      if (data.force_correlation_matrix) setCorrelationMatrix(data.force_correlation_matrix);
    } catch (e: any) {
      setToast({ msg: e.message || 'Failed to load config', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  /* ── Normalize helpers ─────────────────────────────────────── */
  const normalize = (w: Record<string, number>) => {
    const sum = Object.values(w).reduce((a, b) => a + b, 0);
    if (sum === 0) return w;
    return Object.fromEntries(Object.entries(w).map(([k, v]) => [k, +(v / sum).toFixed(4)]));
  };

  /* ── Correlation matrix helpers ────────────────────────────── */
  const handleCorrelationChange = (row: ForceName, col: ForceName, value: number) => {
    if (row === col) return; // diagonal always 1.0
    const clamped = Math.max(0, Math.min(1, value));
    setCorrelationMatrix(prev => ({
      ...prev,
      [row]: { ...prev[row], [col]: clamped },
      [col]: { ...prev[col], [row]: clamped }, // symmetric
    }));
  };

  /* ── Save ───────────────────────────────────────────────────── */
  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('pulse_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const payload: any = {
        attenuation: +attenuation.toFixed(4),
        attenuation_source: attenuationSource,
        force_weights: normalize(forceWeights),
        vc_weights: normalize(vcWeights),
        region_weights: normalize(regionWeights),
        category_weights: normalize(categoryWeights),
        within_force_rho: +withinForceRho.toFixed(2),
        t_copula_df: Math.round(tCopulaDf),
        iterations: Math.round(iterations),
      };
      if (Object.keys(correlationMatrix).length > 0) {
        payload.force_correlation_matrix = correlationMatrix;
      }

      const res = await fetch('/api/v1/config', { method: 'PUT', headers, body: JSON.stringify(payload) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }

      setForceWeights(normalize(forceWeights) as Record<ForceName, number>);
      setVCWeights(normalize(vcWeights));
      setRegionWeights(normalize(regionWeights) as Record<RegionKey, number>);
      setCategoryWeights(normalize(categoryWeights));
      setToast({ msg: 'Configuration saved. Press Simulate in Profit Pool Analysis to apply.', type: 'success' });

      // Notify dashboard of config change (no auto-simulation)
      window.dispatchEvent(new CustomEvent('pulse:config-updated'));
    } catch (e: any) {
      setToast({ msg: e.message || 'Failed to save', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  /* ── Helpers ────────────────────────────────────────────────── */
  const sumOf = (w: Record<string, number>) => Object.values(w).reduce((a, b) => a + b, 0);

  /* ── Render ─────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.text3, fontFamily: T.sans }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 8, animation: 'spin 1s linear infinite' }}>⟳</div>
          <div style={{ fontSize: 14 }}>Loading configuration…</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: T.sans, color: T.text }}>
      {/* ── Top Bar ──────────────────────────────────────────── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(16px)',
        borderBottom: `1px solid ${T.border}`,
        padding: '12px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={onBack} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', color: T.text2, cursor: 'pointer',
            fontSize: 13, fontWeight: 500, fontFamily: T.sans, padding: '6px 10px',
            borderRadius: 8, transition: 'all 0.15s',
          }}
            onMouseOver={e => { e.currentTarget.style.color = T.accent; e.currentTarget.style.background = T.accentDim; }}
            onMouseOut={e => { e.currentTarget.style.color = T.text2; e.currentTarget.style.background = 'none'; }}
          >
            <ArrowLeft size={16} /> Back to Profit Pool Analysis
          </button>
          <div style={{ width: 1, height: 20, background: T.border }} />
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>
            Model Configuration
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={fetchConfig} disabled={saving} style={{
            padding: '7px 14px', borderRadius: 8, border: `1px solid ${T.border}`,
            background: T.bg1, color: T.text2, fontSize: 13, fontWeight: 500,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: T.sans,
          }}
            onMouseOver={e => { e.currentTarget.style.borderColor = T.accent; }}
            onMouseOut={e => { e.currentTarget.style.borderColor = T.border; }}
          >
            <RotateCcw size={14} /> Reset
          </button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: '7px 20px', borderRadius: 8, border: 'none',
            background: T.accent, color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
            display: 'flex', alignItems: 'center', gap: 6, fontFamily: T.sans,
            boxShadow: '0 2px 8px rgba(0, 113, 227, 0.25)',
          }}>
            <Save size={14} /> {saving ? 'Saving…' : 'Save Configuration'}
          </button>
        </div>
      </div>

      {/* ── Content Grid ─────────────────────────────────────── */}
      <div style={{
        maxWidth: 1200, margin: '0 auto', padding: '28px 24px 60px',
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24,
      }}>
        {/* ── Left Column ────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Attenuation */}
          <Card title="Attenuation Factor">
            <SliderInput label="Attenuation (multiplicative decay)" value={attenuation} onChange={setAttenuation} min={0.05} max={1.0} step={0.05} />
            <SelectInput label="Source" value={attenuationSource}
              onChange={setAttenuationSource}
              options={[
                { value: 'assumed', label: 'Assumed (default 0.5)' },
                { value: 'backtested', label: 'Backtested (calibrated)' },
                { value: 'admin_override', label: 'Admin Override' },
              ]}
            />
            <Hint>Controls multiplicative decay. Lower (0.2–0.5) = conservative, higher (0.7–1.0) = aggressive.</Hint>
          </Card>

          {/* Force Weights */}
          <Card title="Force Weights">
            {FORCES.map(f => (
              <SliderInput key={f} label={f} value={forceWeights[f] ?? 0}
                onChange={v => setForceWeights(prev => ({ ...prev, [f]: Math.max(0, v) }))}
                min={0} max={1} step={0.01} color={FORCE_COLORS[f]}
              />
            ))}
            <SumIndicator value={sumOf(forceWeights)} />
            <Hint>Auto-normalizes to 1.0 on save. Allocate more to forces you expect to drive pool shifts.</Hint>
          </Card>

          {/* Region Weights */}
          <Card title="Region Weights">
            {REGIONS.map(r => (
              <SliderInput key={r} label={r} value={regionWeights[r] ?? 0}
                onChange={v => setRegionWeights(prev => ({ ...prev, [r]: Math.max(0, v) }) as Record<RegionKey, number>)}
                min={0} max={1} step={0.01}
              />
            ))}
            <SumIndicator value={sumOf(regionWeights)} />
            <Hint>Scales each trend by its regional exposure overlap with these weights.</Hint>
          </Card>

          {/* Category Weights */}
          <Card title="Category Weights" subtitle="How categories are weighted in portfolio-level aggregation.">
            {Object.keys(categoryWeights).filter(c => c.startsWith('Hair')).length > 0 && (
              <div style={{ fontSize: 10, fontWeight: 700, color: T.text3, letterSpacing: '0.5px', margin: '0 0 6px' }}>BEAUTY</div>
            )}
            {Object.keys(categoryWeights).filter(c => c.startsWith('Hair')).map(c => (
              <SliderInput key={c} label={c.replace('Hair: ', '')} value={categoryWeights[c] ?? 0}
                onChange={v => setCategoryWeights(prev => ({ ...prev, [c]: Math.max(0, v) }))}
                min={0} max={1} step={0.01}
              />
            ))}
            {Object.keys(categoryWeights).filter(c => c.startsWith('LHC')).length > 0 && (
              <div style={{ fontSize: 10, fontWeight: 700, color: T.text3, letterSpacing: '0.5px', margin: '10px 0 6px' }}>LHC</div>
            )}
            {Object.keys(categoryWeights).filter(c => c.startsWith('LHC')).map(c => (
              <SliderInput key={c} label={c.replace('LHC: ', '')} value={categoryWeights[c] ?? 0}
                onChange={v => setCategoryWeights(prev => ({ ...prev, [c]: Math.max(0, v) }))}
                min={0} max={1} step={0.01}
              />
            ))}
            <SumIndicator value={sumOf(categoryWeights)} />
            <Hint>Auto-normalizes to 1.0 on save. Higher weight = more influence on portfolio-level metrics.</Hint>
          </Card>

          {/* Simulation Settings */}
          <Card title="Simulation Settings">
            <NumberInput label="Monte Carlo Iterations" value={iterations} onChange={setIterations} min={1000} max={100000} step={1000} />
            <Hint>50k–100k for final runs, 10k for interactive workflows.</Hint>
          </Card>
        </div>

        {/* ── Right Column ───────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Force Correlation Matrix — star of the show */}
          <Card title="Force Correlation Matrix" subtitle="Cross-force correlations for copula sampling. Symmetric, diagonal = 1.0.">
            <CorrelationMatrixEditor
              matrix={correlationMatrix}
              forces={FORCES}
              onChange={handleCorrelationChange}
            />
            <div style={{ marginTop: 12 }}>
              <Hint>
                Controls how forces co-move in Monte Carlo simulation. Higher values mean forces tend to shift together.
                Low values (0.05) = nearly independent. High values (0.4+) = strong co-movement.
              </Hint>
            </div>
          </Card>

          {/* Copula Parameters */}
          <Card title="Copula Parameters">
            <SliderInput label="Within-Force Correlation (ρ)" value={withinForceRho} onChange={setWithinForceRho} min={0} max={0.9} step={0.05} />
            <NumberInput label="Student-t Degrees of Freedom" value={tCopulaDf} onChange={setTCopulaDf} min={2} max={30} step={1} />
            <Hint>
              <strong style={{ color: T.text2 }}>ρ:</strong> Correlation between trends in the same force. Higher = tighter coupling.<br />
              <strong style={{ color: T.text2 }}>t-df:</strong> 2–4 = heavier tails (crisis correlation). Higher = normal dependence.
            </Hint>
          </Card>

          {/* Value Chain Weights */}
          <Card title="Value Chain Weights" subtitle="Post-hoc decomposition — allocates resulting shift across VC steps.">
            {VC_STEPS.map(s => (
              <SliderInput key={s} label={s} value={vcWeights[s] ?? 0}
                onChange={v => setVCWeights(prev => ({ ...prev, [s]: Math.max(0, v) }))}
                min={0} max={1} step={0.01}
              />
            ))}
            <SumIndicator value={sumOf(vcWeights)} />
          </Card>
        </div>
      </div>

      {/* ── Toast ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            style={{
              position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
              zIndex: 10000, padding: '10px 20px', borderRadius: 10,
              background: toast.type === 'success' ? 'rgba(48, 209, 88, 0.95)' : 'rgba(255, 69, 58, 0.95)',
              color: '#fff', fontSize: 13, fontWeight: 600,
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)', fontFamily: T.sans,
            }}
          >
            {toast.type === 'success' ? '✓' : '✕'} {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════════ */

const Card: FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <div style={{
    background: T.bg1, borderRadius: 14, border: `1px solid ${T.border}`,
    padding: '20px 22px', transition: 'border-color 0.2s',
  }}>
    <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: T.text, letterSpacing: '-0.01em' }}>{title}</h3>
    {subtitle && <p style={{ margin: '0 0 14px', fontSize: 12, color: T.text3, lineHeight: 1.4 }}>{subtitle}</p>}
    {!subtitle && <div style={{ marginBottom: 14 }} />}
    {children}
  </div>
);

const Hint: FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    marginTop: 10, padding: '8px 10px', borderRadius: 8,
    background: T.bg, border: `1px solid ${T.border}`,
    fontSize: 11, color: T.text3, lineHeight: 1.5,
  }}>
    {children}
  </div>
);

const SumIndicator: FC<{ value: number }> = ({ value }) => (
  <div style={{
    marginTop: 8, padding: '8px 10px', borderRadius: 8,
    background: T.bg, border: `1px solid ${T.border}`,
    display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600,
  }}>
    <span style={{ color: T.text2 }}>Sum</span>
    <span style={{ color: Math.abs(value - 1.0) < 0.02 ? T.green : T.red, fontFamily: T.mono }}>
      {value.toFixed(3)}
    </span>
  </div>
);

const SliderInput: FC<{
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; color?: string;
}> = ({ label, value, onChange, min, max, step, color }) => {
  const decimals = step < 0.001 ? 4 : step < 0.01 ? 3 : step < 0.1 ? 2 : 1;
  const pct = ((value - min) / (max - min)) * 100;
  const barColor = color || T.accent;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: T.text2 }}>{label}</label>
        <input type="number" value={value.toFixed(decimals)}
          onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v))); }}
          min={min} max={max} step={step}
          style={{
            width: 68, padding: '2px 6px', borderRadius: 6,
            border: `1px solid ${T.border}`, background: T.bg,
            color: barColor, fontSize: 12, fontWeight: 600, fontFamily: T.mono,
            textAlign: 'right', outline: 'none',
          }}
          onFocus={e => { e.target.style.borderColor = T.accent; }}
          onBlur={e => { e.target.style.borderColor = T.border; }}
        />
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{
          width: '100%', height: 5, borderRadius: 3, cursor: 'pointer',
          WebkitAppearance: 'none', appearance: 'none',
          background: `linear-gradient(to right, ${barColor} 0%, ${barColor} ${pct}%, rgba(0,0,0,0.06) ${pct}%, rgba(0,0,0,0.06) 100%)`,
        } as React.CSSProperties}
      />
    </div>
  );
};

const NumberInput: FC<{
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number;
}> = ({ label, value, onChange, min, max, step }) => (
  <div style={{ marginBottom: 10 }}>
    <label style={{ fontSize: 12, fontWeight: 600, color: T.text2, display: 'block', marginBottom: 5 }}>{label}</label>
    <input type="number" value={value}
      onChange={e => { const v = parseFloat(e.target.value); onChange(Math.max(min, Math.min(max, v))); }}
      min={min} max={max} step={step}
      style={{
        width: '100%', padding: '8px 12px', borderRadius: 8,
        border: `1px solid ${T.border}`, background: T.bg,
        color: T.text, fontSize: 13, fontFamily: T.mono,
        outline: 'none', boxSizing: 'border-box',
      }}
      onFocus={e => { e.target.style.borderColor = T.accent; }}
      onBlur={e => { e.target.style.borderColor = T.border; }}
    />
  </div>
);

const SelectInput: FC<{
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}> = ({ label, value, onChange, options }) => (
  <div style={{ marginBottom: 10 }}>
    <label style={{ fontSize: 12, fontWeight: 600, color: T.text2, display: 'block', marginBottom: 5 }}>{label}</label>
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{
        width: '100%', padding: '8px 12px', borderRadius: 8,
        border: `1px solid ${T.border}`, background: T.bg,
        color: T.text, fontSize: 13, fontFamily: T.sans,
        outline: 'none', cursor: 'pointer',
      }}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

/* ── Correlation Matrix Editor ───────────────────────────────── */
const CorrelationMatrixEditor: FC<{
  matrix: Record<string, Record<string, number>>;
  forces: ForceName[];
  onChange: (row: ForceName, col: ForceName, value: number) => void;
}> = ({ matrix, forces, onChange }) => {
  // Color scale: 0 → neutral, 0.3+ → accent glow
  const cellBg = (val: number, isDiag: boolean) => {
    if (isDiag) return 'rgba(0, 113, 227, 0.08)';
    if (val >= 0.3) return `rgba(0, 113, 227, ${0.04 + val * 0.12})`;
    if (val >= 0.15) return `rgba(0, 113, 227, ${0.02 + val * 0.08})`;
    return 'transparent';
  };

  const cellSize = 64;
  const labelW = 48;

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'inline-block', minWidth: 'fit-content' }}>
        {/* Header row */}
        <div style={{ display: 'flex', marginLeft: labelW, marginBottom: 4 }}>
          {forces.map(f => (
            <div key={f} style={{
              width: cellSize, textAlign: 'center',
              fontSize: 11, fontWeight: 700, color: FORCE_COLORS[f],
              letterSpacing: '-0.02em',
            }}>
              {FORCE_SHORT[f]}
            </div>
          ))}
        </div>

        {/* Matrix rows */}
        {forces.map((row, ri) => (
          <div key={row} style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
            {/* Row label */}
            <div style={{
              width: labelW, fontSize: 11, fontWeight: 700,
              color: FORCE_COLORS[row], textAlign: 'right', paddingRight: 8,
              letterSpacing: '-0.02em',
            }}>
              {FORCE_SHORT[row]}
            </div>

            {/* Cells */}
            {forces.map((col, ci) => {
              const isDiag = ri === ci;
              const val = isDiag ? 1.0 : (matrix[row]?.[col] ?? 0.05);
              return (
                <div key={col} style={{
                  width: cellSize, height: 36,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: cellBg(val, isDiag),
                  borderRadius: 6, margin: 1,
                  border: isDiag ? `1px solid rgba(0, 113, 227, 0.2)` : `1px solid transparent`,
                  transition: 'all 0.15s',
                }}>
                  {isDiag ? (
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.accent, fontFamily: T.mono }}>1.00</span>
                  ) : (
                    <input
                      type="number"
                      value={val.toFixed(2)}
                      onChange={e => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v)) onChange(row, col, v);
                      }}
                      min={0} max={1} step={0.05}
                      style={{
                        width: 48, padding: '3px 4px',
                        background: 'transparent', border: 'none',
                        color: val >= 0.25 ? T.accent : T.text2,
                        fontSize: 12, fontWeight: 500, fontFamily: T.mono,
                        textAlign: 'center', outline: 'none',
                        borderRadius: 4,
                      }}
                      onFocus={e => { e.target.style.background = 'rgba(0, 113, 227, 0.06)'; }}
                      onBlur={e => { e.target.style.background = 'transparent'; }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SettingsPage;
