/**
 * TrendExplorer — Goldman-grade sortable/filterable table of all 60 trends.
 * Full inline editing: Impact, Probability, Category Exposure (0-5), Value Chain Exposure (0-5), GP1 Impact %.
 * Click trend name to expand detail view with all fields.
 * Real-time API updates via onUpdateTrend.
 *
 * Apple × Bain × Goldman Sachs design: glass cards, generous whitespace, silk transitions.
 */
import React, { useState, useMemo, FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import { T, FORCES, FORCE_COLORS, FORCE_ICONS, CATEGORIES, fmtShift, fmtPct, shortCat, shiftColorHex } from '@/lib/format';
import type { ForceName, CategoryId } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────

interface TrendData {
  id: string;
  force: ForceName;
  name: string;
  direction: 'Expansion' | 'Contraction';
  impact?: number;
  probability?: number;
  score?: number;
  gp1_shift?: number;
  description?: string;
  strategic_implication?: string;
  category_exposure?: Record<CategoryId, number>;
  vc_exposure?: Record<string, number>;
  sources?: Array<{ url?: string; title?: string; data?: string }>;
  ai_suggested?: boolean;
}

interface TrendExplorerData {
  trends?: TrendData[];
}

interface TrendExplorerProps {
  data: TrendExplorerData;
  forceFilter: string;
  onForceFilter: (force: string) => void;
  onUpdateTrend: (id: string, updates: Partial<TrendData>) => void;
}

// ─── DotBar ───────────────────────────────────────────────────────────────

interface DotBarProps {
  value: number;
  onChange?: (val: number) => void;
  editable?: boolean;
  color?: 'blue' | 'amber' | 'emerald' | 'purple';
  size?: 'xs' | 'sm' | 'md';
}

const DotBar: FC<DotBarProps> = ({ value, onChange, editable = false, color = 'blue', size = 'sm' }) => {
  const dots = [1, 2, 3, 4, 5];
  const sizeMap = {
    xs: 'w-1.5 h-1.5',
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
  };
  const colorMap = {
    blue: { filled: '#3B82F6', hover: '#60A5FA' },
    amber: { filled: '#FBBF24', hover: '#FCD34D' },
    emerald: { filled: '#34D399', hover: '#6EE7B7' },
    purple: { filled: '#A78BFA', hover: '#C4B5FD' },
  };

  return (
    <div className="flex gap-1">
      {dots.map((dot) => (
        <button
          key={dot}
          onClick={() => editable && onChange?.(dot)}
          disabled={!editable}
          className={`rounded-full transition-all ${sizeMap[size]} ${
            editable ? 'cursor-pointer hover:scale-125' : 'cursor-default'
          }`}
          style={{
            backgroundColor: dot <= value ? colorMap[color].filled : T.bg3,
            opacity: dot <= value ? 1 : 0.5,
          }}
          title={`${dot}/5${editable ? ' - click to set' : ''}`}
        />
      ))}
    </div>
  );
};

// ─── CategoryExposureGrid ─────────────────────────────────────────────────

interface CategoryExposureGridProps {
  exposures: Record<CategoryId, number>;
  onChange: (exp: Record<CategoryId, number>) => void;
}

const CategoryExposureGrid: FC<CategoryExposureGridProps> = ({ exposures, onChange }) => {
  const grouped = {
    'Hair': CATEGORIES.filter(c => c.group === 'Hair'),
    'LHC': CATEGORIES.filter(c => c.group === 'LHC'),
  };

  const handleChange = (catId: CategoryId, newVal: number): void => {
    onChange({ ...exposures, [catId]: newVal });
  };

  return (
    <div className="space-y-4">
      <div style={{ fontSize: '11px', fontWeight: 600, color: T.text2 }}>Category Exposure (0-5)</div>
      {Object.entries(grouped).map(([group, cats]) => (
        <div key={group}>
          <div style={{ fontSize: '9px', fontWeight: 500, marginBottom: '8px', color: T.text3 }}>
            {group.toUpperCase()}
          </div>
          <div className="grid grid-cols-4 gap-3">
            {cats.map((cat) => (
              <div key={cat.id} className="flex flex-col items-center gap-2">
                <DotBar
                  value={exposures?.[cat.id as CategoryId] || 0}
                  onChange={(val) => handleChange(cat.id as CategoryId, val)}
                  editable={true}
                  color="emerald"
                  size="xs"
                />
                <div style={{ fontSize: '9px', textAlign: 'center', color: T.text2, fontWeight: 500 }}>
                  {shortCat(cat.name)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
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
}

const ValueChainExposureGrid: FC<ValueChainExposureGridProps> = ({ exposures, onChange }) => {
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
    <div className="space-y-4">
      <div style={{ fontSize: '11px', fontWeight: 600, color: T.text2 }}>Value Chain Exposure (0-5)</div>
      <div className="grid grid-cols-2 gap-4">
        {vcSteps.map((step) => (
          <div key={step.id} className="flex items-center gap-2">
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '10px', fontWeight: 500, color: T.text2 }}>
                {step.label}
              </div>
              <DotBar
                value={exposures?.[step.id] || 0}
                onChange={(val) => handleChange(step.id, val)}
                editable={true}
                color="purple"
                size="xs"
              />
            </div>
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
}

const ExpandedTrendRow: FC<ExpandedTrendRowProps> = ({ trend, onUpdateTrend, onClose }) => {
  const [catExposure, setCatExposure] = useState<Record<CategoryId, number>>(trend.category_exposure || {});
  const [vcExposure, setVcExposure] = useState<Record<string, number>>(trend.vc_exposure || {});

  const handleSave = (): void => {
    onUpdateTrend(trend.id, {
      category_exposure: catExposure,
      vc_exposure: vcExposure,
    });
    onClose();
  };

  return (
    <tr>
      <td colSpan={8}>
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
            {/* Left: Description, implication, metadata */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 600, marginBottom: '6px', color: T.text2 }}>
                  EVIDENCE & DESCRIPTION
                </div>
                <div style={{ fontSize: '12px', lineHeight: 1.5, color: T.text, whiteSpace: 'pre-wrap' }}>
                  {trend.description || '(No description provided)'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 600, marginBottom: '6px', color: T.text2 }}>
                  STRATEGIC IMPLICATION
                </div>
                <div style={{ fontSize: '12px', lineHeight: 1.5, color: T.text }}>
                  {trend.strategic_implication || '(No strategic implication documented)'}
                </div>
              </div>

              {/* PRISM Analysis */}
              <div>
                <div style={{ fontSize: '10px', fontWeight: 600, marginBottom: '6px', color: T.accent, display: 'flex', alignItems: 'center', gap: '4px', letterSpacing: '0.5px' }}>
                  <span style={{ fontSize: '12px' }}>✨</span> PRISM ANALYSIS
                </div>
                <div style={{
                  padding: '12px 14px',
                  background: `${T.accent}06`,
                  borderRadius: '8px',
                  border: `1px solid ${T.accent}15`,
                }}>
                  <p style={{ fontSize: '11px', lineHeight: 1.6, color: T.text2, margin: 0 }}>
                    {trend.strategic_implication
                      ? `This trend has a weighted score of ${((trend.impact || 3) * (trend.probability || 3) * (trend.direction === 'Expansion' ? 1 : -1) / 25 * 100).toFixed(1)}% normalized impact. ${trend.direction === 'Expansion' ? 'Expansion' : 'Contraction'} force with ${trend.impact && trend.impact >= 4 ? 'high' : trend.impact && trend.impact >= 3 ? 'moderate' : 'low'} impact (${trend.impact || '—'}/5) and ${trend.probability && trend.probability >= 4 ? 'high' : trend.probability && trend.probability >= 3 ? 'moderate' : 'low'} probability (${trend.probability || '—'}/5). ${trend.strategic_implication}`
                      : `${trend.direction} trend in ${trend.force} force. Impact: ${trend.impact || '—'}/5, Probability: ${trend.probability || '—'}/5. Weighted score: ${((trend.impact || 3) * (trend.probability || 3) * (trend.direction === 'Expansion' ? 1 : -1) / 25 * 100).toFixed(1)}%.`
                    }
                  </p>
                </div>
              </div>

              {/* Sources & Evidence */}
              {trend.sources && trend.sources.length > 0 && (
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 600, marginBottom: '8px', color: T.text2, letterSpacing: '0.5px' }}>
                    SOURCES ({trend.sources.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {trend.sources.map((src, idx) => {
                      const isValidUrl = src.url && (src.url.startsWith('http://') || src.url.startsWith('https://'));
                      return (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            background: T.bg3 + '60',
                            borderRadius: '6px',
                            border: `1px solid ${T.border1}`,
                          }}
                        >
                          <span style={{ fontSize: '12px', flexShrink: 0 }}>📄</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {isValidUrl ? (
                              <a
                                href={src.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  color: T.accent,
                                  textDecoration: 'none',
                                  display: 'block',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline'; }}
                                onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none'; }}
                              >
                                {src.title || src.url} ↗
                              </a>
                            ) : (
                              <span style={{ fontSize: '11px', fontWeight: 600, color: T.text }}>
                                {src.title || 'Source'}
                              </span>
                            )}
                            {src.data && (
                              <div style={{
                                fontSize: '10px',
                                color: T.text3,
                                marginTop: '2px',
                                fontFamily: T.mono,
                                lineHeight: 1.4,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}>
                                {src.data}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
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
                  <span>✨</span> AI Suggested
                </div>
              )}
            </div>

            {/* Right: Category & VC exposure grids */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <CategoryExposureGrid
                exposures={catExposure}
                onChange={setCatExposure}
              />
              <ValueChainExposureGrid
                exposures={vcExposure}
                onChange={setVcExposure}
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
              onClick={onClose}
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
          </div>
        </motion.div>
      </td>
    </tr>
  );
};

// ─── TrendExplorer ────────────────────────────────────────────────────────

const TrendExplorer: FC<TrendExplorerProps> = ({ data, forceFilter, onForceFilter, onUpdateTrend }) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedTrendId, setExpandedTrendId] = useState<string | null>(null);

  const trends = data?.trends || [];
  const forces = ['All', ...Object.keys(FORCES)];

  // Filter & sort
  const filtered = useMemo(() => {
    let result = [...trends];

    // Force filter
    if (forceFilter && forceFilter !== 'All') {
      result = result.filter(t => t.force === forceFilter);
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
  }, [trends, forceFilter, searchQuery, sortBy, sortDir]);

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

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.border1}`, backgroundColor: T.bg1 }}>
              {[
                { key: 'force', label: 'Force' },
                { key: 'name', label: 'Trend Name' },
                { key: 'direction', label: 'Direction' },
                { key: 'impact', label: 'Impact' },
                { key: 'probability', label: 'Probability' },
                { key: 'score', label: 'Score' },
                { key: 'gp1_shift', label: 'GP1 Shift %' },
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
                const scoreColor = trend.score! > 0 ? T.green : trend.score! < 0 ? T.red : T.text3;

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
                      }}>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {trend.name}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: trend.direction === 'Expansion' ? T.green : T.red }}>
                          {trend.direction === 'Expansion' ? '▲' : '▼'} {trend.direction}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <DotBar
                          value={trend.impact || 0}
                          onChange={(val) => onUpdateTrend(trend.id, { impact: val })}
                          editable={true}
                          color="blue"
                          size="sm"
                        />
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <DotBar
                          value={trend.probability || 0}
                          onChange={(val) => onUpdateTrend(trend.id, { probability: val })}
                          editable={true}
                          color="amber"
                          size="sm"
                        />
                      </td>
                      <td style={{
                        padding: '12px 16px',
                        textAlign: 'right',
                        fontSize: '12px',
                        fontWeight: 600,
                        fontFamily: T.mono,
                        color: scoreColor,
                      }}>
                        {fmtPct((trend.score || 0) / 25, 1)}
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
                    </motion.tr>

                    {isExpanded && (
                      <ExpandedTrendRow
                        trend={trend}
                        onUpdateTrend={onUpdateTrend}
                        onClose={() => setExpandedTrendId(null)}
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
