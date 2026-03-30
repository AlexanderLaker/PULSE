/**
 * TrendExplorer — Goldman-grade sortable/filterable table of all 60 trends.
 * Full inline editing: Impact, Probability, Category Exposure (0-5), Value Chain Exposure (0-5), GP1 Impact %.
 * Click trend name to expand detail view with all fields.
 * Real-time API updates via onUpdateTrend.
 *
 * Apple × Bain × Goldman Sachs design: glass cards, generous whitespace, silk transitions.
 */
import React, { useState, useMemo, useEffect, FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, ChevronUp, Search, Sparkles, ExternalLink, Clock,
  Globe, Newspaper, FileText, TrendingUp, BarChart3, AlertTriangle, Trash2, Plus,
} from 'lucide-react';
import { T, FORCES, FORCE_COLORS, FORCE_ICONS, CATEGORIES, fmtShift, fmtPct, shortCat, shiftColorHex } from '../lib/format';
import type { ForceName, CategoryId } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────

interface TrendData {
  id: string;
  force: ForceName;
  name: string;
  direction: 'Expansion' | 'Contraction';
  probability?: number;
  gp1_shift?: number;
  gp1_pct_affected?: number;
  description?: string;
  strategic_implication?: string;
  category_exposure?: Record<CategoryId, number>;
  vc_exposure?: Record<string, number>;
  regional_exposure?: Record<string, number>;
  sources?: Array<{ url?: string; title?: string; data?: string }>;
  ai_suggested?: boolean;
  peak_year?: number;
  diffusion_curve?: string;
}

interface TrendExplorerData {
  trends?: TrendData[];
}

interface TrendExplorerProps {
  data: TrendExplorerData;
  forceFilter: string;
  onForceFilter: (force: string) => void;
  onUpdateTrend: (id: string, updates: Partial<TrendData>) => void;
  onDeleteTrend?: (id: string) => void;
  onCreateTrend?: (trend: Partial<TrendData>) => void;
  isAdmin?: boolean;
  initialSearchQuery?: string;
}

// ─── Source Icons ─────────────────────────────────────────────────────────

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  GDELT: <Globe size={10} />,
  GNews: <Newspaper size={10} />,
  RSS: <FileText size={10} />,
  'Google Trends': <TrendingUp size={10} />,
  ECHA: <AlertTriangle size={10} />,
  'EUR-Lex': <FileText size={10} />,
  'SEC EDGAR': <BarChart3 size={10} />,
  Reddit: <Globe size={10} />,
  YouTube: <Globe size={10} />,
  'Semantic Scholar': <FileText size={10} />,
};

// ─── DotBar ───────────────────────────────────────────────────────────────

interface DotBarProps {
  value: number;
  onChange?: (val: number) => void;
  editable?: boolean;
  color?: 'blue' | 'amber' | 'emerald' | 'purple' | 'cyan';
  size?: 'xs' | 'sm' | 'md';
  direction?: 'Expansion' | 'Contraction';
  labelType?: 'impact' | 'probability' | 'exposure';
}

const LABEL_MAPS = {
  probability: ['Very Unlikely', 'Unlikely', 'Possible', 'Likely', 'Almost Certain'],
  exposure: ['None', 'Minimal', 'Low', 'Moderate', 'High'],
};

const DIRECTION_GRADIENTS = {
  Expansion: ['#BBF7D0', '#86EFAC', '#4ADE80', '#22C55E', '#16A34A'],
  Contraction: ['#FECACA', '#FCA5A5', '#F87171', '#EF4444', '#DC2626'],
};

const DotBar: FC<DotBarProps> = ({
  value,
  onChange,
  editable = false,
  color = 'blue',
  size = 'sm',
  direction,
  labelType,
}) => {
  const [hoveredDot, setHoveredDot] = useState<number | null>(null);
  const dots = [1, 2, 3, 4, 5];

  // Pixel sizes for each variant
  const sizePixels = { xs: 10, sm: 12, md: 14 };
  const dotSize = sizePixels[size];
  const gapSize = size === 'xs' ? 4 : 5;

  const colorMap = {
    blue: { filled: '#3B82F6', hover: '#60A5FA' },
    amber: { filled: '#FBBF24', hover: '#FCD34D' },
    emerald: { filled: '#34D399', hover: '#6EE7B7' },
    purple: { filled: '#A78BFA', hover: '#C4B5FD' },
    cyan: { filled: '#06B6D4', hover: '#22D3EE' },
  };

  // Unfilled dot color — clearly visible on dark bg
  const UNFILLED_COLOR = 'rgba(148, 163, 184, 0.2)';     // slate-400 at 20%
  const UNFILLED_BORDER = 'rgba(148, 163, 184, 0.35)';    // slate-400 at 35%
  const HOVER_PREVIEW = 'rgba(148, 163, 184, 0.45)';      // preview on hover

  const getFilledColor = (dot: number): string => {
    if (direction && DIRECTION_GRADIENTS[direction]) {
      return DIRECTION_GRADIENTS[direction]![dot - 1] || colorMap[color].filled;
    }
    return colorMap[color].filled;
  };

  const getDotStyle = (dot: number): React.CSSProperties => {
    const isFilled = dot <= value;
    const isHovered = hoveredDot !== null && dot <= hoveredDot;
    const isPreview = editable && !isFilled && isHovered;

    return {
      width: dotSize,
      height: dotSize,
      borderRadius: '50%',
      border: isFilled ? 'none' : `1.5px solid ${isPreview ? 'rgba(148,163,184,0.5)' : UNFILLED_BORDER}`,
      backgroundColor: isFilled
        ? getFilledColor(dot)
        : isPreview
          ? HOVER_PREVIEW
          : UNFILLED_COLOR,
      cursor: editable ? 'pointer' : 'default',
      transition: 'all 150ms ease',
      transform: (editable && isHovered) ? 'scale(1.25)' : 'scale(1)',
      boxShadow: isFilled ? `0 0 4px ${getFilledColor(dot)}40` : 'none',
      flexShrink: 0,
    };
  };

  const labels = labelType ? LABEL_MAPS[labelType] : null;
  const currentLabel = labels && value > 0 ? labels[value - 1] : null;

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center' }}
      title={editable ? 'Click dots to change score (1-5)' : `${value}/5`}
    >
      <div
        style={{ display: 'flex', gap: `${gapSize}px`, alignItems: 'center' }}
        onMouseLeave={() => editable && setHoveredDot(null)}
      >
        {dots.map((dot) => (
          <div
            key={dot}
            role={editable ? 'button' : undefined}
            tabIndex={editable ? 0 : undefined}
            onClick={(e) => {
              e.stopPropagation();
              if (editable) onChange?.(dot);
            }}
            onMouseEnter={() => editable && setHoveredDot(dot)}
            onKeyDown={(e) => {
              if (editable && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onChange?.(dot);
              }
            }}
            style={getDotStyle(dot)}
            title={`${dot}/5${labels ? ` — ${labels[dot - 1]}` : ''}${editable ? ' (click to set)' : ''}`}
          />
        ))}
      </div>
      {currentLabel && (
        <div style={{
          fontSize: '9px',
          color: T.text2,
          fontWeight: 500,
          whiteSpace: 'nowrap',
          letterSpacing: '0.3px',
        }}>
          {currentLabel}
        </div>
      )}
    </div>
  );
};

// ─── CategoryExposureGrid ─────────────────────────────────────────────────

interface CategoryExposureGridProps {
  exposures: Record<CategoryId, number>;
  onChange: (exp: Record<CategoryId, number>) => void;
  direction?: 'Expansion' | 'Contraction';
  isAdmin?: boolean;
}

const CategoryExposureGrid: FC<CategoryExposureGridProps> = ({ exposures, onChange, direction, isAdmin }) => {
  const grouped = {
    'Hair': CATEGORIES.filter(c => c.group === 'Hair'),
    'LHC': CATEGORIES.filter(c => c.group === 'LHC'),
  };

  const handleChange = (catId: CategoryId, newVal: number): void => {
    onChange({ ...exposures, [catId]: newVal });
  };

  return (
    <div>
      <div style={{
        fontSize: '11px',
        fontWeight: 600,
        color: T.text2,
        marginBottom: '12px',
        letterSpacing: '0.5px',
      }}>
        CATEGORY EXPOSURE
      </div>
      <div style={{
        borderRadius: '8px',
        border: `1px solid ${T.border1}`,
        overflow: 'hidden',
        backgroundColor: T.bg1,
      }}>
        {Object.entries(grouped).map(([group, cats], groupIdx) => (
          <React.Fragment key={group}>
            {/* Group header row */}
            <div style={{
              padding: '6px 12px',
              fontSize: '9px',
              fontWeight: 700,
              letterSpacing: '1px',
              color: T.text3,
              backgroundColor: T.bg3,
              borderTop: groupIdx > 0 ? `1px solid ${T.border1}` : 'none',
            }}>
              {group.toUpperCase()}
            </div>
            {/* Category rows */}
            {cats.map((cat, idx) => (
              <div
                key={cat.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 12px',
                  borderTop: idx > 0 ? `1px solid ${T.border1}22` : 'none',
                  transition: 'background-color 100ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `${T.bg2}`; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <div style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  color: T.text,
                  minWidth: '90px',
                }}>
                  {shortCat(cat.name)}
                </div>
                <DotBar
                  value={exposures?.[cat.id as CategoryId] || 0}
                  onChange={(val) => handleChange(cat.id as CategoryId, val)}
                  editable={isAdmin}
                  color="emerald"
                  size="sm"
                  direction={direction}
                />
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

// ─── ValueChainExposureGrid ───────────────────────────────────────────────

interface ValueChainStep {
  id: string;
  label: string;
}

interface ValueChainExposureGridProps {
  exposures: Record<string, number>;
  onChange: (exp: Record<string, number>) => void;
  direction?: 'Expansion' | 'Contraction';
  isAdmin?: boolean;
}

const ValueChainExposureGrid: FC<ValueChainExposureGridProps> = ({ exposures, onChange, direction, isAdmin }) => {
  const vcSteps: ValueChainStep[] = [
    { id: 'raw_materials', label: 'Raw Materials' },
    { id: 'formulation', label: 'Formulation' },
    { id: 'packaging', label: 'Packaging' },
    { id: 'manufacturing', label: 'Manufacturing' },
    { id: 'logistics', label: 'Logistics' },
    { id: 'marketing', label: 'Marketing' },
    { id: 'trade', label: 'Trade' },
    { id: 'after_sales', label: 'After-Sales' },
  ];

  const handleChange = (stepId: string, newVal: number): void => {
    onChange({ ...exposures, [stepId]: newVal });
  };

  return (
    <div>
      <div style={{
        fontSize: '11px',
        fontWeight: 600,
        color: T.text2,
        marginBottom: '12px',
        letterSpacing: '0.5px',
      }}>
        VALUE CHAIN EXPOSURE
      </div>
      <div style={{
        borderRadius: '8px',
        border: `1px solid ${T.border1}`,
        overflow: 'hidden',
        backgroundColor: T.bg1,
      }}>
        {vcSteps.map((step, idx) => (
          <div
            key={step.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '7px 12px',
              borderTop: idx > 0 ? `1px solid ${T.border1}22` : 'none',
              transition: 'background-color 100ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `${T.bg2}`; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <div style={{
              fontSize: '11px',
              fontWeight: 500,
              color: T.text,
              minWidth: '100px',
            }}>
              {step.label}
            </div>
            <DotBar
              value={exposures?.[step.id] || 0}
              onChange={(val) => handleChange(step.id, val)}
              editable={isAdmin}
              color="purple"
              size="sm"
              direction={direction}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── RegionalExposureGrid ─────────────────────────────────────────────────

interface RegionalExposureGridProps {
  exposures: Record<string, number>;
  onChange: (exp: Record<string, number>) => void;
  direction?: 'Expansion' | 'Contraction';
  isAdmin?: boolean;
}

const RegionalExposureGrid: FC<RegionalExposureGridProps> = ({ exposures, onChange, direction, isAdmin }) => {
  const regions = [
    { id: 'Europe', label: 'Europe' },
    { id: 'North America', label: 'North America' },
    { id: 'Asia', label: 'Asia' },
    { id: 'High Growth', label: 'High Growth' },
  ];

  const handleChange = (regionId: string, newVal: number): void => {
    onChange({ ...exposures, [regionId]: newVal });
  };

  return (
    <div>
      <div style={{
        fontSize: '11px',
        fontWeight: 600,
        color: T.text2,
        marginBottom: '12px',
        letterSpacing: '0.5px',
      }}>
        REGIONAL EXPOSURE
      </div>
      <div style={{
        borderRadius: '8px',
        border: `1px solid ${T.border1}`,
        overflow: 'hidden',
        backgroundColor: T.bg1,
      }}>
        {regions.map((region, idx) => (
          <div
            key={region.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '7px 12px',
              borderTop: idx > 0 ? `1px solid ${T.border1}22` : 'none',
              transition: 'background-color 100ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `${T.bg2}`; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <div style={{
              fontSize: '11px',
              fontWeight: 500,
              color: T.text,
              minWidth: '110px',
            }}>
              {region.label}
            </div>
            <DotBar
              value={exposures?.[region.id] || 0}
              onChange={(val) => handleChange(region.id, val)}
              editable={isAdmin}
              color="cyan"
              size="sm"
              direction={direction}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── ExpandedTrendRow ─────────────────────────────────────────────────────

interface ExpandedTrendRowProps {
  trend: TrendData;
  onUpdateTrend: (id: string, updates: Partial<TrendData>) => void;
  onClose: () => void;
  isAdmin?: boolean;
}

const ExpandedTrendRow: FC<ExpandedTrendRowProps> = ({ trend, onUpdateTrend, onClose, isAdmin = false }) => {
  const [catExposure, setCatExposure] = useState<Record<CategoryId, number>>(trend.category_exposure || {});
  const [vcExposure, setVcExposure] = useState<Record<string, number>>(trend.vc_exposure || {});
  const [regionalExposure, setRegionalExposure] = useState<Record<string, number>>(trend.regional_exposure || {});
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(trend.name || '');
  const [editDesc, setEditDesc] = useState(trend.description || '');
  const [editImplication, setEditImplication] = useState(trend.strategic_implication || '');
  const [editPeakYear, setEditPeakYear] = useState<number>(trend.peak_year || 2030);
  const [editDiffusion, setEditDiffusion] = useState<string>(trend.diffusion_curve || 's_curve');
  const [editSources, setEditSources] = useState<Array<{ url: string; title: string; data: string }>>(
    (trend.sources || []).map(s => ({ url: s.url || '', title: s.title || '', data: s.data || '' }))
  );

  const handleSave = (): void => {
    const updates: Partial<TrendData> = {
      category_exposure: catExposure,
      vc_exposure: vcExposure,
      regional_exposure: regionalExposure,
    };
    // Always include materialization timing fields
    if (editPeakYear !== (trend.peak_year || 2030)) (updates as any).peak_year = editPeakYear;
    if (editDiffusion !== (trend.diffusion_curve || 's_curve')) (updates as any).diffusion_curve = editDiffusion;
    // Include text field changes if admin edited them
    if (isAdmin) {
      if (editName !== trend.name) (updates as any).name = editName;
      if (editDesc !== trend.description) (updates as any).description = editDesc;
      if (editImplication !== trend.strategic_implication) (updates as any).strategic_implication = editImplication;
      // Include sources (filter out empty entries)
      const validSources = editSources.filter(s => s.url || s.title);
      (updates as any).sources = validSources;
    }
    onUpdateTrend(trend.id, updates);
    setIsEditing(false);
    onClose();
  };

  return (
    <tr>
      <td colSpan={9}>
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          style={{
            padding: '24px',
            borderTop: `1px solid ${T.border1}`,
            background: `linear-gradient(135deg, ${T.bg1} 0%, ${T.bg2} 100%)`,
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
            {/* Left: Name → Description → PRISM Analysis → Sources */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* 0. Trend Name (admin editable) */}
              <div>
                <div style={{ fontSize: '9px', fontWeight: 600, color: T.text3, marginBottom: '4px', letterSpacing: '0.5px' }}>
                  TREND NAME
                </div>
                {isAdmin ? (
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    readOnly={!isEditing}
                    style={{
                      width: '100%',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: T.text,
                      backgroundColor: isEditing ? T.bg2 : T.bg1,
                      border: `1px solid ${isEditing ? T.border1 : 'transparent'}`,
                      borderRadius: '6px',
                      padding: '8px 10px',
                      outline: 'none',
                      fontFamily: 'inherit',
                      cursor: isEditing ? 'text' : 'default',
                    }}
                    onFocus={(e) => { if (isEditing) e.currentTarget.style.borderColor = T.accent; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = isEditing ? T.border1 : 'transparent'; }}
                  />
                ) : (
                  <p style={{ fontSize: '12px', fontWeight: 600, color: T.text, margin: 0 }}>
                    {trend.name}
                  </p>
                )}
              </div>

              {/* 1. Description */}
              <div>
                <div style={{ fontSize: '9px', fontWeight: 600, color: T.text3, marginBottom: '4px', letterSpacing: '0.5px' }}>
                  DESCRIPTION
                </div>
                {isAdmin ? (
                  <textarea
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    readOnly={!isEditing}
                    rows={4}
                    style={{
                      width: '100%',
                      fontSize: '11px',
                      color: T.text2,
                      backgroundColor: isEditing ? T.bg2 : T.bg1,
                      border: `1px solid ${isEditing ? T.border1 : 'transparent'}`,
                      borderRadius: '6px',
                      padding: '8px 10px',
                      lineHeight: 1.6,
                      resize: 'vertical',
                      outline: 'none',
                      fontFamily: 'inherit',
                      cursor: isEditing ? 'text' : 'default',
                    }}
                    onFocus={(e) => { if (isEditing) e.currentTarget.style.borderColor = T.accent; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = isEditing ? T.border1 : 'transparent'; }}
                  />
                ) : (
                  <p style={{ fontSize: '11px', color: T.text2, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
                    {trend.description || '(No description provided)'}
                  </p>
                )}
              </div>

              {/* 2. PRISM Analysis / Strategic Implication */}
              <div>
                <div style={{ fontSize: '9px', fontWeight: 600, color: T.accent, marginBottom: '4px', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Sparkles size={10} /> PRISM ANALYSIS
                </div>
                {isAdmin ? (
                  <textarea
                    value={editImplication}
                    onChange={(e) => setEditImplication(e.target.value)}
                    readOnly={!isEditing}
                    rows={3}
                    style={{
                      width: '100%',
                      fontSize: '11px',
                      color: T.text2,
                      backgroundColor: isEditing ? T.bg2 : T.bg1,
                      border: `1px solid ${isEditing ? T.border1 : 'transparent'}`,
                      borderRadius: '6px',
                      padding: '8px 10px',
                      lineHeight: 1.6,
                      resize: 'vertical',
                      outline: 'none',
                      fontFamily: 'inherit',
                      cursor: isEditing ? 'text' : 'default',
                    }}
                    onFocus={(e) => { if (isEditing) e.currentTarget.style.borderColor = T.accent; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = isEditing ? T.border1 : 'transparent'; }}
                  />
                ) : (
                  <p style={{ fontSize: '11px', color: T.text2, lineHeight: 1.6, margin: 0 }}>
                    {trend.strategic_implication || '(No strategic implication documented)'}
                  </p>
                )}
              </div>

              {/* 3. GP1 % Affected — Economic Anchoring */}
              <div style={{
                padding: '12px 16px',
                borderRadius: '8px',
                backgroundColor: T.accent + '08',
                border: `1px solid ${T.accent}20`,
              }}>
                <div style={{ fontSize: '9px', fontWeight: 600, color: T.accent, marginBottom: '8px', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <BarChart3 size={10} /> GP1 % AFFECTED — ECONOMIC ANCHORING
                </div>
                <p style={{ fontSize: '10px', color: T.text3, lineHeight: 1.5, margin: '0 0 10px 0' }}>
                  What fraction of a category's GP1 can this trend realistically affect at full materialization?
                  A 5/5 impact trend with 15% GP1 affected means: maximum-severity trend, but only touches 15% of the pool.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input
                    type="range"
                    min={1}
                    max={50}
                    step={1}
                    value={Math.round((trend.gp1_pct_affected || 0.10) * 100)}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) / 100;
                      onUpdateTrend(trend.id, { gp1_pct_affected: val } as any);
                    }}
                    style={{
                      flex: 1,
                      height: '4px',
                      accentColor: T.accent,
                      cursor: 'pointer',
                    }}
                  />
                  <div style={{
                    minWidth: '56px',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    backgroundColor: T.bg2,
                    border: `1px solid ${T.border1}`,
                    textAlign: 'center',
                  }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, fontFamily: T.mono, color: T.accent }}>
                      {Math.round((trend.gp1_pct_affected || 0.10) * 100)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. Materialization Timing — Peak Year & Diffusion Curve */}
              <div style={{
                padding: '12px 16px',
                borderRadius: '8px',
                backgroundColor: '#8B5CF620',
                border: '1px solid #8B5CF630',
              }}>
                <div style={{ fontSize: '9px', fontWeight: 600, color: '#8B5CF6', marginBottom: '8px', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={10} /> MATERIALIZATION TIMING
                </div>
                <p style={{ fontSize: '10px', color: T.text3, lineHeight: 1.5, margin: '0 0 10px 0' }}>
                  When does this trend reach full impact, and how does it build over time?
                </p>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  {/* Peak Year */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '9px', fontWeight: 600, color: T.text3, marginBottom: '4px' }}>Peak Year</div>
                    <select
                      value={editPeakYear}
                      onChange={(e) => setEditPeakYear(parseInt(e.target.value, 10))}
                      style={{
                        width: '100%',
                        fontSize: '12px',
                        fontWeight: 600,
                        fontFamily: T.mono,
                        color: T.text,
                        backgroundColor: T.bg2,
                        border: `1px solid ${T.border1}`,
                        borderRadius: '6px',
                        padding: '6px 10px',
                        outline: 'none',
                        cursor: 'pointer',
                        appearance: 'auto' as any,
                      }}
                    >
                      {[2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                    <div style={{ fontSize: '9px', color: T.text4, marginTop: '3px' }}>
                      Year when 100% of impact materializes
                    </div>
                  </div>
                  {/* Diffusion Curve */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '9px', fontWeight: 600, color: T.text3, marginBottom: '4px' }}>Diffusion Curve</div>
                    <select
                      value={editDiffusion}
                      onChange={(e) => setEditDiffusion(e.target.value)}
                      style={{
                        width: '100%',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: T.text,
                        backgroundColor: T.bg2,
                        border: `1px solid ${T.border1}`,
                        borderRadius: '6px',
                        padding: '6px 10px',
                        outline: 'none',
                        cursor: 'pointer',
                        appearance: 'auto' as any,
                      }}
                    >
                      <option value="s_curve">S-Curve (default)</option>
                      <option value="linear">Linear</option>
                      <option value="front_loaded">Front-Loaded</option>
                      <option value="back_loaded">Back-Loaded</option>
                      <option value="step_function">Step Function</option>
                    </select>
                    <div style={{ fontSize: '9px', color: T.text4, marginTop: '3px' }}>
                      {editDiffusion === 's_curve' && 'Logistic — slow start, fast middle, plateau'}
                      {editDiffusion === 'linear' && 'Steady constant rate of materialization'}
                      {editDiffusion === 'front_loaded' && 'Fast early impact, then flattens (√t)'}
                      {editDiffusion === 'back_loaded' && 'Slow start, accelerates late (t²)'}
                      {editDiffusion === 'step_function' && 'Near-zero until ~80%, then sudden jump'}
                    </div>
                  </div>
                </div>
              </div>

              {/* 5. Sources — editable when editing, clickable links otherwise */}
              {isEditing ? (
                <div>
                  <div style={{ fontSize: '9px', fontWeight: 600, color: T.text3, marginBottom: '6px', letterSpacing: '0.5px' }}>
                    SOURCES ({editSources.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {editSources.map((src, i) => (
                      <div key={i} style={{
                        display: 'flex', flexDirection: 'column', gap: '4px',
                        padding: '8px', borderRadius: '6px', backgroundColor: T.bg2,
                        border: `1px solid ${T.border1}`,
                      }}>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <input
                            value={src.title}
                            onChange={(e) => {
                              const updated = [...editSources];
                              updated[i] = { ...updated[i], title: e.target.value };
                              setEditSources(updated);
                            }}
                            placeholder="Source title"
                            style={{
                              flex: 1, fontSize: '11px', color: T.text, backgroundColor: T.bg1,
                              border: `1px solid ${T.border1}`, borderRadius: '4px', padding: '5px 8px',
                              outline: 'none', fontFamily: 'inherit',
                            }}
                            onFocus={(e) => { e.currentTarget.style.borderColor = T.accent; }}
                            onBlur={(e) => { e.currentTarget.style.borderColor = T.border1; }}
                          />
                          <button
                            onClick={() => setEditSources(editSources.filter((_, idx) => idx !== i))}
                            style={{
                              padding: '4px', backgroundColor: 'transparent', border: 'none',
                              borderRadius: '4px', cursor: 'pointer', color: T.text4,
                              display: 'flex', alignItems: 'center',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = T.red; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = T.text4; }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <input
                          value={src.url}
                          onChange={(e) => {
                            const updated = [...editSources];
                            updated[i] = { ...updated[i], url: e.target.value };
                            setEditSources(updated);
                          }}
                          placeholder="https://..."
                          style={{
                            fontSize: '10px', color: T.accent, backgroundColor: T.bg1,
                            border: `1px solid ${T.border1}`, borderRadius: '4px', padding: '5px 8px',
                            outline: 'none', fontFamily: T.mono,
                          }}
                          onFocus={(e) => { e.currentTarget.style.borderColor = T.accent; }}
                          onBlur={(e) => { e.currentTarget.style.borderColor = T.border1; }}
                        />
                        <input
                          value={src.data}
                          onChange={(e) => {
                            const updated = [...editSources];
                            updated[i] = { ...updated[i], data: e.target.value };
                            setEditSources(updated);
                          }}
                          placeholder="Additional context (optional)"
                          style={{
                            fontSize: '10px', color: T.text3, backgroundColor: T.bg1,
                            border: `1px solid ${T.border1}`, borderRadius: '4px', padding: '5px 8px',
                            outline: 'none', fontFamily: 'inherit',
                          }}
                          onFocus={(e) => { e.currentTarget.style.borderColor = T.accent; }}
                          onBlur={(e) => { e.currentTarget.style.borderColor = T.border1; }}
                        />
                      </div>
                    ))}
                    <button
                      onClick={() => setEditSources([...editSources, { url: '', title: '', data: '' }])}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '6px 10px', fontSize: '10px', fontWeight: 500,
                        color: T.accent, backgroundColor: 'transparent',
                        border: `1px dashed ${T.border1}`, borderRadius: '6px',
                        cursor: 'pointer', width: 'fit-content',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.accent; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border1; }}
                    >
                      <Plus size={10} /> Add Source
                    </button>
                  </div>
                </div>
              ) : (trend.sources && trend.sources.length > 0 && (
                <div>
                  <div style={{ fontSize: '9px', fontWeight: 600, color: T.text3, marginBottom: '6px', letterSpacing: '0.5px' }}>
                    SOURCES ({trend.sources.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {trend.sources.map((src, i) => {
                      const url = (src.url || '').toLowerCase();
                      const apiName = url.includes('eur-lex') ? 'EUR-Lex'
                        : url.includes('echa') ? 'ECHA'
                        : url.includes('sec.gov') || url.includes('edgar') ? 'SEC EDGAR'
                        : url.includes('trends.google') ? 'Google Trends'
                        : url.includes('reddit') ? 'Reddit'
                        : url.includes('youtube') ? 'YouTube'
                        : url.includes('scholar') || url.includes('doi.org') || url.includes('nature.com') || url.includes('pubmed') ? 'Semantic Scholar'
                        : url.includes('gdelt') ? 'GDELT'
                        : url.includes('mckinsey') || url.includes('bain') || url.includes('bcg') ? 'GNews'
                        : url.includes('grandview') || url.includes('statista') || url.includes('euromonitor') ? 'GNews'
                        : url.includes('cosmetics') || url.includes('happi') || url.includes('retaildetail') || url.includes('grocery') || url.includes('packaging') ? 'RSS'
                        : url.includes('environment.ec.europa') || url.includes('europa.eu') ? 'EUR-Lex'
                        : 'GNews';
                      return (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                          <a
                            href={src.url || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'flex', alignItems: 'center', gap: '6px',
                              padding: '5px 8px', paddingBottom: src.data ? '2px' : '5px',
                              borderRadius: src.data ? '4px 4px 0 0' : '4px',
                              backgroundColor: T.bg3 + '40', textDecoration: 'none',
                              fontSize: '10px', color: T.accent, transition: 'background-color 0.15s',
                              pointerEvents: src.url ? 'auto' : 'none',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = T.bg3; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = T.bg3 + '40'; }}
                          >
                            {SOURCE_ICONS[apiName] || <Globe size={9} />}
                            <span style={{ color: T.text3, fontWeight: 500, flexShrink: 0 }}>{apiName}</span>
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{src.title || 'Source'}</span>
                            {src.url && <ExternalLink size={9} style={{ flexShrink: 0, opacity: 0.5 }} />}
                          </a>
                          {src.data && (
                            <div style={{
                              padding: '3px 8px 5px 27px', borderRadius: '0 0 4px 4px',
                              backgroundColor: T.bg3 + '40', fontSize: '9px', fontFamily: T.mono,
                              color: T.text3, lineHeight: 1.4,
                            }}>
                              {src.data}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {trend.ai_suggested && (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  backgroundColor: T.purpleDim,
                  borderRadius: '6px',
                  fontSize: '9px',
                  fontWeight: 500,
                  color: T.purple,
                  width: 'fit-content',
                }}>
                  <Sparkles size={10} /> AI Suggested
                </div>
              )}
            </div>

            {/* Right: Category & VC exposure grids */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <CategoryExposureGrid
                exposures={catExposure}
                onChange={setCatExposure}
                direction={trend.direction}
              />
              <ValueChainExposureGrid
                exposures={vcExposure}
                onChange={setVcExposure}
                direction={trend.direction}
              />
              <RegionalExposureGrid
                exposures={regionalExposure}
                onChange={setRegionalExposure}
                direction={trend.direction}
              />
            </div>
          </div>

          {/* Action buttons */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            marginTop: '20px',
            paddingTop: '16px',
            borderTop: `1px solid ${T.border1}`,
          }}>
            <button
              onClick={() => {
                if (isEditing) {
                  setIsEditing(false);
                  setEditName(trend.name || '');
                  setEditDesc(trend.description || '');
                  setEditImplication(trend.strategic_implication || '');
                  setEditPeakYear(trend.peak_year || 2030);
                  setEditDiffusion(trend.diffusion_curve || 's_curve');
                  setEditSources((trend.sources || []).map(s => ({ url: s.url || '', title: s.title || '', data: s.data || '' })));
                } else {
                  onClose();
                }
              }}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 500,
                color: T.text,
                backgroundColor: T.bg3,
                border: `1px solid ${T.border1}`,
                cursor: 'pointer',
                transition: 'all 120ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = T.bg4;
                e.currentTarget.style.borderColor = T.border2;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = T.bg3;
                e.currentTarget.style.borderColor = T.border1;
              }}
            >
              Cancel
            </button>
            {isAdmin && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: T.text,
                  backgroundColor: T.bg3,
                  border: `1px solid ${T.border1}`,
                  cursor: 'pointer',
                  transition: 'all 120ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = T.bg4;
                  e.currentTarget.style.borderColor = T.border2;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = T.bg3;
                  e.currentTarget.style.borderColor = T.border1;
                }}
              >
                Edit
              </button>
            )}
            {isEditing && (
              <button
                onClick={handleSave}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#fff',
                  backgroundColor: T.accent,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 120ms ease',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.opacity = '0.9';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.opacity = '1';
                }}
              >
                Save Changes
              </button>
            )}
          </div>
        </motion.div>
      </td>
    </tr>
  );
};

// ─── TrendExplorer ────────────────────────────────────────────────────────

// ─── Anomaly Detection & Badge Helpers ─────────────────────────────────────

interface TrendBadge {
  type: 'high_impact' | 'ai_suggested' | 'regulatory' | 'monitor';
  label: string;
}

function detectTrendBadges(trend: TrendData): TrendBadge[] {
  const badges: TrendBadge[] = [];

  // AI Suggested badge
  if (trend.ai_suggested) {
    badges.push({ type: 'ai_suggested', label: 'AI Suggested' });
  }

  // Regulatory Watch badge (pulsing)
  const regulatoryKeywords = ['Regulation', 'Ban', 'Tax', 'Restriction'];
  if (regulatoryKeywords.some(kw => (trend.name || '').includes(kw))) {
    badges.push({ type: 'regulatory', label: 'Regulatory Watch' });
  }

  // Monitor badge: probability === 5
  if (trend.probability === 5) {
    badges.push({ type: 'monitor', label: 'Monitor' });
  }

  return badges;
}

function BadgeStyled({ badge }: { badge: TrendBadge }): React.ReactNode {
  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '8px',
    padding: '2px 6px',
    borderRadius: '10px',
    fontWeight: 500,
    marginRight: '4px',
    whiteSpace: 'nowrap',
  };

  switch (badge.type) {
    case 'high_impact':
      return (
        <span
          style={{
            ...baseStyle,
            backgroundColor: 'rgba(255,159,10,0.12)',
            color: '#FF9F0A',
            border: '1px solid rgba(255,159,10,0.3)',
          }}
        >
          {badge.label}
        </span>
      );
    case 'ai_suggested':
      return (
        <span
          style={{
            ...baseStyle,
            backgroundColor: 'rgba(0,113,227,0.08)',
            color: '#0071E3',
            border: '1px solid rgba(0,113,227,0.2)',
          }}
        >
          {badge.label}
        </span>
      );
    case 'regulatory':
      return (
        <motion.span
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ repeat: Infinity, duration: 2 }}
          style={{
            ...baseStyle,
            backgroundColor: 'rgba(255,159,10,0.15)',
            color: '#FF9F0A',
            border: '1px solid rgba(255,159,10,0.4)',
          }}
        >
          {badge.label}
        </motion.span>
      );
    case 'monitor':
      return (
        <span
          style={{
            ...baseStyle,
            backgroundColor: 'rgba(0,0,0,0.04)',
            color: '#999999',
            border: '1px solid rgba(0,0,0,0.08)',
          }}
        >
          {badge.label}
        </span>
      );
    default:
      return null;
  }
}

const TrendExplorer: FC<TrendExplorerProps> = ({ data, forceFilter, onForceFilter, onUpdateTrend, onDeleteTrend, onCreateTrend, isAdmin = false, initialSearchQuery }) => {
  const [searchQuery, setSearchQuery] = useState<string>(initialSearchQuery || '');
  const [sortBy, setSortBy] = useState<string>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedTrendId, setExpandedTrendId] = useState<string | null>(null);
  const [badgeFilter, setBadgeFilter] = useState<'all' | 'flagged' | 'ai' | 'regulatory'>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTrendForce, setNewTrendForce] = useState<ForceName>('Consumer');
  const [newTrendName, setNewTrendName] = useState('');
  const [newTrendDirection, setNewTrendDirection] = useState<'Expansion' | 'Contraction'>('Expansion');
  const [newTrendProbability, setNewTrendProbability] = useState(3);

  // Sync search query when navigating from Consumer Journey trend link
  useEffect(() => {
    if (initialSearchQuery) {
      setSearchQuery(initialSearchQuery);
    }
  }, [initialSearchQuery]);

  const trends = data?.trends || [];
  const forces = ['All', ...Object.keys(FORCES)];

  // Compute badges for all trends
  const trendBadges = useMemo(() => {
    const map = new Map<string, TrendBadge[]>();
    trends.forEach(t => {
      map.set(t.id, detectTrendBadges(t));
    });
    return map;
  }, [trends]);

  // Count flagged trends
  const flaggedCount = useMemo(() => {
    return trends.filter(t => trendBadges.get(t.id)?.length ?? 0 > 0).length;
  }, [trends, trendBadges]);

  const aiSuggestedCount = useMemo(() => {
    return trends.filter(t => t.ai_suggested).length;
  }, [trends]);

  const regulatoryCount = useMemo(() => {
    return trends.filter(t => {
      const regulatoryKeywords = ['Regulation', 'Ban', 'Tax', 'Restriction'];
      return regulatoryKeywords.some(kw => (t.name || '').includes(kw));
    }).length;
  }, [trends]);

  // Filter & sort
  const filtered = useMemo(() => {
    let result = [...trends];

    // Force filter
    if (forceFilter && forceFilter !== 'All') {
      result = result.filter(t => t.force === forceFilter);
    }

    // Badge filter
    if (badgeFilter === 'flagged') {
      result = result.filter(t => (trendBadges.get(t.id)?.length ?? 0) > 0);
    } else if (badgeFilter === 'ai') {
      result = result.filter(t => t.ai_suggested);
    } else if (badgeFilter === 'regulatory') {
      const regulatoryKeywords = ['Regulation', 'Ban', 'Tax', 'Restriction'];
      result = result.filter(t => regulatoryKeywords.some(kw => (t.name || '').includes(kw)));
    }

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.name?.toLowerCase().includes(q) ||
        t.force?.toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      const aVal = (a as any)[sortBy];
      const bVal = (b as any)[sortBy];

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return 0;
    });

    return result;
  }, [trends, forceFilter, searchQuery, sortBy, sortDir, badgeFilter, trendBadges]);

  const handleSort = (column: string): void => {
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('desc');
    }
  };

  const SortIndicator: FC<{ column: string }> = ({ column }) => {
    if (sortBy !== column) return null;
    return sortDir === 'desc'
      ? <ChevronDown size={12} style={{ display: 'inline', marginLeft: '4px' }} />
      : <ChevronUp size={12} style={{ display: 'inline', marginLeft: '4px' }} />;
  };

  const handleCreateTrend = (): void => {
    if (!newTrendName.trim()) {
      alert('Please enter a trend name');
      return;
    }
    onCreateTrend?.({
      force: newTrendForce,
      name: newTrendName,
      direction: newTrendDirection,
      probability: newTrendProbability,
    });
    // Reset form
    setNewTrendName('');
    setNewTrendForce('Consumer');
    setNewTrendDirection('Expansion');
    setNewTrendProbability(3);
    setShowAddForm(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      style={{
        backgroundColor: T.bg2,
        borderRadius: '12px',
        border: `1px solid ${T.border1}`,
        backdropFilter: 'blur(10px)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '20px 24px',
        borderBottom: `1px solid ${T.border1}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: T.text }}>
          Trend Explorer
          <span style={{ marginLeft: '12px', fontSize: '14px', color: T.text2 }}>
            — {filtered.length} trends
          </span>
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isAdmin && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 500,
                color: '#fff',
                backgroundColor: T.accent,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 120ms ease',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.opacity = '0.9';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.opacity = '1';
              }}
            >
              <Plus size={14} /> Add Trend
            </button>
          )}
          <div style={{
            position: 'relative',
            width: '240px',
            backgroundColor: T.bg1,
            border: `1px solid ${T.border1}`,
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            paddingLeft: '12px',
          }}>
            <Search size={14} style={{ color: T.text2 }} />
            <input
              type="text"
              placeholder="Search trends…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                marginLeft: '8px',
                paddingRight: '12px',
                paddingTop: '8px',
                paddingBottom: '8px',
                backgroundColor: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: '12px',
                color: T.text,
              }}
            />
          </div>
        </div>
      </div>

      {/* Force Filter Chips */}
      <div style={{
        padding: '12px 24px',
        borderBottom: `1px solid ${T.border1}`,
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
      }}>
        {forces.map((force) => (
          <button
            key={force}
            onClick={() => onForceFilter(force)}
            style={{
              padding: '6px 12px',
              borderRadius: '16px',
              fontSize: '11px',
              fontWeight: 500,
              transition: 'all 120ms ease',
              backgroundColor: forceFilter === force
                ? force === 'All' ? T.accent : FORCE_COLORS[force as ForceName]
                : T.bg3,
              color: forceFilter === force ? '#fff' : T.text2,
              border: `1px solid ${forceFilter === force ? 'transparent' : T.border1}`,
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              if (forceFilter !== force) {
                e.currentTarget.style.backgroundColor = T.bg4;
                e.currentTarget.style.borderColor = T.border2;
              }
            }}
            onMouseLeave={(e) => {
              if (forceFilter !== force) {
                e.currentTarget.style.backgroundColor = T.bg3;
                e.currentTarget.style.borderColor = T.border1;
              }
            }}
          >
            {force === 'All' ? '◆ All Forces' : `${FORCE_ICONS[force as ForceName]} ${force}`}
          </button>
        ))}
      </div>

      {/* Badge Filter Chips */}
      <div style={{
        padding: '12px 24px',
        borderBottom: `1px solid ${T.border1}`,
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: '10px', fontWeight: 600, color: T.text2, marginRight: '4px' }}>
          FLAGS:
        </span>
        {[
          { key: 'all', label: 'All', count: trends.length },
          { key: 'flagged', label: 'Flagged', count: flaggedCount },
          { key: 'ai', label: 'AI Suggested', count: aiSuggestedCount },
          { key: 'regulatory', label: 'Regulatory Watch', count: regulatoryCount },
        ].map((filter) => (
          <button
            key={filter.key}
            onClick={() => setBadgeFilter(filter.key as any)}
            style={{
              padding: '6px 12px',
              borderRadius: '16px',
              fontSize: '11px',
              fontWeight: 500,
              transition: 'all 120ms ease',
              backgroundColor: badgeFilter === filter.key ? T.accent : T.bg3,
              color: badgeFilter === filter.key ? '#fff' : T.text2,
              border: `1px solid ${badgeFilter === filter.key ? 'transparent' : T.border1}`,
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              if (badgeFilter !== filter.key) {
                e.currentTarget.style.backgroundColor = T.bg4;
                e.currentTarget.style.borderColor = T.border2;
              }
            }}
            onMouseLeave={(e) => {
              if (badgeFilter !== filter.key) {
                e.currentTarget.style.backgroundColor = T.bg3;
                e.currentTarget.style.borderColor = T.border1;
              }
            }}
          >
            {filter.label} <span style={{ fontSize: '9px', marginLeft: '4px', opacity: 0.8 }}>({filter.count})</span>
          </button>
        ))}
      </div>

      {/* Add Trend Form (admin only) */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            style={{
              padding: '20px 24px',
              borderBottom: `1px solid ${T.border1}`,
              backgroundColor: T.bg1,
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '16px',
              alignItems: 'flex-end',
            }}
          >
            {/* Force dropdown */}
            <div>
              <div style={{ fontSize: '9px', fontWeight: 600, color: T.text3, marginBottom: '6px', letterSpacing: '0.5px' }}>
                FORCE
              </div>
              <select
                value={newTrendForce}
                onChange={(e) => setNewTrendForce(e.target.value as ForceName)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: `1px solid ${T.border1}`,
                  backgroundColor: T.bg2,
                  color: T.text,
                  fontSize: '11px',
                  fontWeight: 500,
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                {Object.keys(FORCES).map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            {/* Trend Name */}
            <div>
              <div style={{ fontSize: '9px', fontWeight: 600, color: T.text3, marginBottom: '6px', letterSpacing: '0.5px' }}>
                TREND NAME
              </div>
              <input
                type="text"
                value={newTrendName}
                onChange={(e) => setNewTrendName(e.target.value)}
                placeholder="Enter trend name…"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: `1px solid ${T.border1}`,
                  backgroundColor: T.bg2,
                  color: T.text,
                  fontSize: '11px',
                  outline: 'none',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = T.accent; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = T.border1; }}
              />
            </div>

            {/* Direction */}
            <div>
              <div style={{ fontSize: '9px', fontWeight: 600, color: T.text3, marginBottom: '6px', letterSpacing: '0.5px' }}>
                DIRECTION
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setNewTrendDirection('Expansion')}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: `1px solid ${newTrendDirection === 'Expansion' ? T.accent : T.border1}`,
                    backgroundColor: newTrendDirection === 'Expansion' ? '#D1FAE5' : T.bg2,
                    color: newTrendDirection === 'Expansion' ? T.green : T.text2,
                    fontSize: '10px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 120ms',
                  }}
                >
                  ▲ Expansion
                </button>
                <button
                  onClick={() => setNewTrendDirection('Contraction')}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: `1px solid ${newTrendDirection === 'Contraction' ? T.accent : T.border1}`,
                    backgroundColor: newTrendDirection === 'Contraction' ? '#FEE2E2' : T.bg2,
                    color: newTrendDirection === 'Contraction' ? T.red : T.text2,
                    fontSize: '10px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 120ms',
                  }}
                >
                  ▼ Contraction
                </button>
              </div>
            </div>

            {/* Probability */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: '9px', fontWeight: 600, color: T.text3, marginBottom: '6px', letterSpacing: '0.5px' }}>
                PROBABILITY
              </div>
              <DotBar
                value={newTrendProbability}
                onChange={setNewTrendProbability}
                editable
                color="amber"
                size="sm"
                direction={newTrendDirection}
                labelType="probability"
              />
            </div>

            {/* Action buttons */}
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewTrendName('');
                  setNewTrendForce('Consumer');
                  setNewTrendDirection('Expansion');
                  setNewTrendProbability(3);
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: T.text,
                  backgroundColor: T.bg3,
                  border: `1px solid ${T.border1}`,
                  cursor: 'pointer',
                  transition: 'all 120ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = T.bg4;
                  e.currentTarget.style.borderColor = T.border2;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = T.bg3;
                  e.currentTarget.style.borderColor = T.border1;
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTrend}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#fff',
                  backgroundColor: T.accent,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 120ms ease',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.opacity = '0.9';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.opacity = '1';
                }}
              >
                Create Trend
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.border1}`, backgroundColor: T.bg1 }}>
              {[
                { key: 'force', label: 'Force' },
                { key: 'name', label: 'Trend Name' },
                { key: 'direction', label: 'Direction' },
                { key: 'probability', label: 'Probability' },
                { key: 'gp1_pct_affected', label: 'GP1 % Affected' },
                { key: 'gp1_shift', label: 'Shift' },
                ...(isAdmin && onDeleteTrend ? [{ key: '_delete', label: '' }] : []),
              ].map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  style={{
                    padding: '12px 16px',
                    textAlign: col.key === 'name' ? 'left' : 'center',
                    fontSize: '10px',
                    fontWeight: 600,
                    color: T.text2,
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'color 120ms',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = T.accent; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = T.text2; }}
                >
                  {col.label}
                  <SortIndicator column={col.key} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <AnimatePresence mode="popLayout">
              {filtered.map((trend) => {
                const isExpanded = expandedTrendId === trend.id;
                const scoreColor = trend.direction === 'Expansion' ? T.green : trend.direction === 'Contraction' ? T.red : T.text3;

                return (
                  <React.Fragment key={trend.id}>
                    <motion.tr
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setExpandedTrendId(isExpanded ? null : trend.id)}
                      style={{
                        borderBottom: `1px solid ${T.border1}`,
                        cursor: 'pointer',
                        backgroundColor: 'transparent',
                        transition: 'background-color 120ms',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = T.bg1; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '10px',
                          fontWeight: 600,
                          backgroundColor: `${FORCE_COLORS[trend.force]}20`,
                          color: FORCE_COLORS[trend.force],
                        }}>
                          {FORCE_ICONS[trend.force]} {trend.force}
                        </span>
                      </td>
                      <td style={{
                        padding: '12px 16px',
                        fontSize: '12px',
                        fontWeight: 500,
                        color: T.accent,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flexWrap: 'wrap',
                      }}>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          {trend.name}
                          {(trendBadges.get(trend.id) || []).map((badge, idx) => (
                            <BadgeStyled key={idx} badge={badge} />
                          ))}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isAdmin) return;
                            const newDirection = trend.direction === 'Expansion' ? 'Contraction' : 'Expansion';
                            onUpdateTrend(trend.id, { direction: newDirection });
                          }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '16px',
                            fontSize: '11px',
                            fontWeight: 600,
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 120ms ease',
                            backgroundColor: trend.direction === 'Expansion' ? '#D1FAE5' : '#FEE2E2',
                            color: trend.direction === 'Expansion' ? T.green : T.red,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.opacity = '0.8';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.opacity = '1';
                          }}
                        >
                          {trend.direction === 'Expansion' ? '▲' : '▼'} {trend.direction}
                        </button>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <DotBar
                          value={trend.probability || 0}
                          onChange={(val) => onUpdateTrend(trend.id, { probability: val })}
                          editable={isAdmin}
                          color="amber"
                          size="sm"
                          direction={trend.direction}
                          labelType="probability"
                        />
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          step={1}
                          value={Math.round((trend.gp1_pct_affected || 0.10) * 100)}
                          onClick={(e) => e.stopPropagation()}
                          readOnly={!isAdmin}
                          onChange={(e) => {
                            if (!isAdmin) return;
                            const raw = parseInt(e.target.value, 10);
                            if (!isNaN(raw) && raw >= 1 && raw <= 100) {
                              onUpdateTrend(trend.id, { gp1_pct_affected: raw / 100 } as any);
                            }
                          }}
                          style={{
                            width: '48px',
                            padding: '4px 4px',
                            borderRadius: '4px',
                            border: `1px solid ${T.border1}`,
                            backgroundColor: T.bg2,
                            color: T.accent,
                            fontSize: '11px',
                            fontWeight: 600,
                            fontFamily: T.mono,
                            textAlign: 'center',
                            outline: 'none',
                          }}
                          onFocus={(e) => { e.currentTarget.style.borderColor = T.accent; }}
                          onBlur={(e) => { e.currentTarget.style.borderColor = T.border1; }}
                        />
                        <span style={{ fontSize: '9px', color: T.text3, marginLeft: '2px' }}>%</span>
                      </td>
                      <td style={{
                        padding: '12px 16px',
                        textAlign: 'right',
                        fontSize: '11px',
                        fontWeight: 600,
                        fontFamily: T.mono,
                        color: shiftColorHex(trend.gp1_shift || 0),
                      }}>
                        {fmtShift(trend.gp1_shift || 0, 2)}
                      </td>
                      {isAdmin && onDeleteTrend && (
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Delete trend "${trend.name}"?`)) {
                                onDeleteTrend(trend.id);
                              }
                            }}
                            style={{
                              padding: '6px',
                              borderRadius: '6px',
                              border: 'none',
                              backgroundColor: 'transparent',
                              color: T.text3,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 120ms',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = T.red + '15';
                              e.currentTarget.style.color = T.red;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = T.text3;
                            }}
                            title="Delete trend"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </motion.tr>

                    {isExpanded && (
                      <ExpandedTrendRow
                        trend={trend}
                        onUpdateTrend={onUpdateTrend}
                        onClose={() => setExpandedTrendId(null)}
                        isAdmin={isAdmin}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          color: T.text2,
          fontSize: '12px',
        }}>
          No trends found. Try adjusting your filters.
        </div>
      )}
    </motion.div>
  );
};

export default TrendExplorer;
