/**
 * EmergingTrends — API-powered trend discovery hub.
 * Triggers scans across 19 APIs (GDELT, GNews, RSS, ECHA, EUR-Lex, SEC EDGAR,
 * Google Trends, Reddit, YouTube, FRED, World Bank, Open-Meteo, OpenAlex,
 * NCBI PubMed, arXiv, EPO Patents, CurrentsAPI, NewsAPI, BeautyFeeds).
 *
 * Admin can multi-select trends and bulk-add them to the Trend Explorer.
 * Starts empty — all trends come exclusively from live API scans.
 */
import React, { useState, useMemo, useCallback, FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Plus, ChevronDown, ChevronUp, ExternalLink,
  RefreshCw, Filter, TrendingUp, AlertTriangle, Check,
  Globe, Newspaper, FileText, BarChart3, Square, CheckSquare,
  Loader, XCircle, Search,
} from 'lucide-react';
import { T, FORCES, FORCE_COLORS, FORCE_ICONS, CATEGORIES } from '../lib/format';
import type { ForceName, CategoryId } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────

interface EmergingTrendSource {
  api: string;
  title: string;
  url: string;
  snippet?: string;
  published?: string;
}

interface EmergingTrend {
  id: string;
  name: string;
  description: string;
  force: ForceName;
  direction: 'Expansion' | 'Contraction';
  suggested_impact: number;
  suggested_probability: number;
  relevance_score: number;
  category_mapping: Record<string, number>;
  sources: EmergingTrendSource[];
  discovered_at: string;
  reasoning: string;
  status: 'new' | 'reviewed' | 'added' | 'dismissed';
}

interface EmergingTrendsProps {
  onAddTrend: (trend: EmergingTrend) => void;
  userRole?: string;
}

interface ScanProgress {
  [key: string]: string;
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
  OpenAlex: <FileText size={10} />,
  FRED: <BarChart3 size={10} />,
  'World Bank': <Globe size={10} />,
  'Open-Meteo': <Globe size={10} />,
  NewsAPI: <Newspaper size={10} />,
  CurrentsAPI: <Newspaper size={10} />,
  'NCBI PubMed': <FileText size={10} />,
  arXiv: <FileText size={10} />,
  'EPO Patents': <Search size={10} />,
  BeautyFeeds: <Sparkles size={10} />,
};

// No mock data — all trends come exclusively from live API scans.

// ─── Relevance Badge ──────────────────────────────────────────────────────

const RelevanceBadge: FC<{ score: number }> = ({ score }) => {
  const color = score >= 85 ? T.green : score >= 70 ? '#EAB308' : T.text3;
  const label = score >= 85 ? 'High' : score >= 70 ? 'Medium' : 'Low';
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '3px 8px',
      borderRadius: '10px',
      fontSize: '10px',
      fontWeight: 600,
      fontFamily: T.mono,
      backgroundColor: color + '15',
      color: color,
    }}>
      <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: color }} />
      {score}% {label}
    </div>
  );
};

// ─── EmergingTrendCard ────────────────────────────────────────────────────

interface EmergingTrendCardProps {
  trend: EmergingTrend;
  onAdd: () => void;
  onDismiss: () => void;
  isAdmin?: boolean;
  expanded: boolean;
  onToggle: () => void;
  selected: boolean;
  onSelect: (checked: boolean) => void;
}

const EmergingTrendCard: FC<EmergingTrendCardProps> = ({
  trend, onAdd, onDismiss, isAdmin = false, expanded, onToggle, selected, onSelect,
}) => {
  const trendColor = trend.direction === 'Expansion' ? T.green : T.red;
  const isActioned = trend.status === 'added' || trend.status === 'dismissed';
  const relevanceColor = trend.relevance_score >= 85 ? T.green :
    trend.relevance_score >= 70 ? '#EAB308' : T.text3;

  return (
    <div
      style={{
        backgroundColor: expanded ? T.bg1 : selected ? T.accent + '08' : 'transparent',
        borderRadius: '8px',
        border: expanded
          ? `1px solid ${trend.status === 'added' ? T.green + '40' : T.border1}`
          : selected
            ? `1px solid ${T.accent}30`
            : `1px solid transparent`,
        opacity: isActioned ? 0.45 : 1,
        transition: 'all 0.2s',
      }}
    >
      {/* Compact row — always visible */}
      <div
        style={{
          padding: expanded ? '14px 16px' : '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          cursor: 'pointer',
          borderRadius: expanded ? 0 : '8px',
          transition: 'background-color 100ms',
        }}
        onClick={onToggle}
        onMouseEnter={(e) => { if (!expanded && !selected) e.currentTarget.style.backgroundColor = T.bg1; }}
        onMouseLeave={(e) => { if (!expanded && !selected) e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        {/* Checkbox (admin only) */}
        {isAdmin && !isActioned && (
          <div
            onClick={(e) => { e.stopPropagation(); onSelect(!selected); }}
            style={{ flexShrink: 0, cursor: 'pointer', color: selected ? T.accent : T.text3, display: 'flex', alignItems: 'center' }}
          >
            {selected ? <CheckSquare size={16} /> : <Square size={16} />}
          </div>
        )}

        {/* Relevance bar */}
        <div style={{
          width: '3px',
          height: '28px',
          borderRadius: '2px',
          backgroundColor: relevanceColor,
          flexShrink: 0,
        }} />

        {/* Force badge */}
        <span style={{
          padding: '3px 8px',
          borderRadius: '10px',
          fontSize: '10px',
          fontWeight: 600,
          backgroundColor: FORCE_COLORS[trend.force] + '20',
          color: FORCE_COLORS[trend.force],
          flexShrink: 0,
          minWidth: '72px',
          textAlign: 'center',
        }}>
          {FORCE_ICONS[trend.force]} {trend.force}
        </span>

        {/* Trend name */}
        <div style={{
          flex: 1,
          fontSize: '13px',
          fontWeight: 500,
          color: T.text,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {trend.name}
        </div>

        {/* Direction pill */}
        <span style={{
          padding: '2px 7px',
          borderRadius: '10px',
          fontSize: '9px',
          fontWeight: 600,
          backgroundColor: trendColor + '15',
          color: trendColor,
          flexShrink: 0,
        }}>
          {trend.direction === 'Expansion' ? '▲' : '▼'}
        </span>

        {/* Score */}
        <div style={{
          fontSize: '11px',
          fontWeight: 600,
          fontFamily: T.mono,
          color: T.text2,
          flexShrink: 0,
          minWidth: '36px',
          textAlign: 'center',
        }}>
          {trend.suggested_impact}×{trend.suggested_probability}
        </div>

        {/* Relevance badge */}
        <RelevanceBadge score={trend.relevance_score} />

        {/* Status / Chevron */}
        <div style={{ flexShrink: 0, color: T.text3, display: 'flex', alignItems: 'center', gap: '4px' }}>
          {trend.status === 'added' && (
            <span style={{ fontSize: '9px', color: T.green, fontWeight: 600 }}>
              <Check size={10} />
            </span>
          )}
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      {/* Expanded Detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              padding: '0 16px 16px',
              borderTop: `1px solid ${T.border1}`,
              paddingTop: '14px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
            }}>
              {/* Left column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <div style={{ fontSize: '9px', fontWeight: 600, color: T.text3, marginBottom: '4px', letterSpacing: '0.5px' }}>
                    DESCRIPTION
                  </div>
                  <p style={{ fontSize: '11px', color: T.text2, lineHeight: 1.6, margin: 0 }}>
                    {trend.description}
                  </p>
                </div>
                <div>
                  <div style={{ fontSize: '9px', fontWeight: 600, color: T.accent, marginBottom: '4px', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Sparkles size={10} /> PULSE ANALYSIS
                  </div>
                  <p style={{ fontSize: '11px', color: T.text2, lineHeight: 1.6, margin: 0 }}>
                    {trend.reasoning}
                  </p>
                </div>
                <div>
                  <div style={{ fontSize: '9px', fontWeight: 600, color: T.text3, marginBottom: '6px', letterSpacing: '0.5px' }}>
                    SOURCES ({trend.sources.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {trend.sources.map((src, i) => (
                      <a
                        key={i}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '5px 8px',
                          borderRadius: '4px',
                          backgroundColor: T.bg3 + '40',
                          textDecoration: 'none',
                          fontSize: '10px',
                          color: T.accent,
                          transition: 'background-color 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = T.bg3; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = T.bg3 + '40'; }}
                      >
                        {SOURCE_ICONS[src.api] || <Globe size={9} />}
                        <span style={{ color: T.text3, fontWeight: 500, flexShrink: 0 }}>{src.api}</span>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{src.title}</span>
                        <ExternalLink size={9} style={{ flexShrink: 0, opacity: 0.5 }} />
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 1, padding: '10px', backgroundColor: T.bg3 + '60', borderRadius: '8px' }}>
                    <div style={{ fontSize: '9px', color: T.text3, marginBottom: '4px' }}>Impact</div>
                    <div style={{ fontSize: '18px', fontWeight: 600, color: T.text, fontFamily: T.mono }}>{trend.suggested_impact}<span style={{ fontSize: '11px', color: T.text3 }}>/5</span></div>
                  </div>
                  <div style={{ flex: 1, padding: '10px', backgroundColor: T.bg3 + '60', borderRadius: '8px' }}>
                    <div style={{ fontSize: '9px', color: T.text3, marginBottom: '4px' }}>Probability</div>
                    <div style={{ fontSize: '18px', fontWeight: 600, color: T.text, fontFamily: T.mono }}>{trend.suggested_probability}<span style={{ fontSize: '11px', color: T.text3 }}>/5</span></div>
                  </div>
                  <div style={{ flex: 1, padding: '10px', backgroundColor: T.bg3 + '60', borderRadius: '8px' }}>
                    <div style={{ fontSize: '9px', color: T.text3, marginBottom: '4px' }}>Relevance</div>
                    <div style={{ fontSize: '18px', fontWeight: 600, color: relevanceColor, fontFamily: T.mono }}>{trend.relevance_score}<span style={{ fontSize: '11px', color: T.text3 }}>%</span></div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '9px', fontWeight: 600, color: T.text3, marginBottom: '6px', letterSpacing: '0.5px' }}>
                    SUGGESTED CATEGORY EXPOSURE
                  </div>
                  <div style={{
                    borderRadius: '6px',
                    border: `1px solid ${T.border1}`,
                    overflow: 'hidden',
                    backgroundColor: T.bg1,
                  }}>
                    {Object.entries(trend.category_mapping).map(([catId, exposure], idx) => {
                      const cat = CATEGORIES.find(c => c.id === catId);
                      return (
                        <div key={catId} style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 10px',
                          borderTop: idx > 0 ? `1px solid ${T.border1}22` : 'none',
                        }}>
                          <span style={{ fontSize: '10px', color: T.text2 }}>{cat?.name || catId}</span>
                          <span style={{ fontSize: '11px', fontWeight: 600, fontFamily: T.mono, color: T.text }}>{exposure}/5</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ fontSize: '10px', color: T.text3 }}>
                  Discovered: {new Date(trend.discovered_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </div>

                {/* Individual add/dismiss (when not using bulk) */}
                {!isActioned && isAdmin && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={(e) => { e.stopPropagation(); onAdd(); }}
                      style={{
                        flex: 1,
                        padding: '10px 16px',
                        borderRadius: '8px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#fff',
                        backgroundColor: T.accent,
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      <Plus size={14} />
                      Add to Trend Explorer
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={(e) => { e.stopPropagation(); onDismiss(); }}
                      style={{
                        padding: '10px 16px',
                        borderRadius: '8px',
                        fontSize: '11px',
                        fontWeight: 500,
                        color: T.text2,
                        backgroundColor: T.bg3,
                        border: `1px solid ${T.border1}`,
                        cursor: 'pointer',
                      }}
                    >
                      Dismiss
                    </motion.button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Scan Progress Overlay ────────────────────────────────────────────────

const ScanProgressOverlay: FC<{ progress: ScanProgress; errors: string[] }> = ({ progress, errors }) => {
  const entries = Object.entries(progress);
  const done = entries.filter(([, v]) => v.startsWith('ok') || v.startsWith('error'));
  const pct = entries.length > 0 ? Math.round((done.length / entries.length) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      style={{
        padding: '12px 24px',
        backgroundColor: T.accent + '08',
        borderBottom: `1px solid ${T.border1}`,
      }}
    >
      {/* Progress bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
        <div style={{ flex: 1, height: '4px', borderRadius: '2px', backgroundColor: T.bg3, overflow: 'hidden' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            style={{ height: '100%', backgroundColor: T.accent, borderRadius: '2px' }}
          />
        </div>
        <span style={{ fontSize: '10px', fontFamily: T.mono, color: T.accent, fontWeight: 600, minWidth: '40px' }}>
          {pct}%
        </span>
      </div>

      {/* Source status grid */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {entries.map(([source, status]) => {
          const isOk = status.startsWith('ok');
          const isError = status.startsWith('error');
          const isQuerying = !isOk && !isError;
          return (
            <span key={source} style={{
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '8px',
              fontWeight: 500,
              fontFamily: T.mono,
              backgroundColor: isOk ? T.green + '15' : isError ? T.red + '15' : T.accent + '10',
              color: isOk ? T.green : isError ? T.red : T.accent,
            }}>
              {isQuerying && <Loader size={7} style={{ marginRight: '3px', display: 'inline' }} />}
              {source.split(':')[0]}
            </span>
          );
        })}
      </div>

      {errors.length > 0 && (
        <div style={{ marginTop: '6px', fontSize: '9px', color: T.red }}>
          {errors.length} source(s) had errors
        </div>
      )}
    </motion.div>
  );
};

// ─── EmergingTrends Component ─────────────────────────────────────────────

const MAX_VISIBLE_TRENDS = 60;

const EmergingTrends: FC<EmergingTrendsProps> = ({ onAddTrend, userRole = 'viewer' }) => {
  const [emergingTrends, setEmergingTrends] = useState<EmergingTrend[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress>({});
  const [scanErrors, setScanErrors] = useState<string[]>([]);
  const [forceFilter, setForceFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'relevance' | 'date' | 'impact'>('relevance');
  const [lastScanned, setLastScanned] = useState<Date | null>(null);
  const [expandedTrendId, setExpandedTrendId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const isAdmin = userRole === 'admin';

  // ─── Load saved trends from database on mount ───────────────────────
  React.useEffect(() => {
    fetch('/api/v1/scanner/saved-trends')
      .then(r => r.json())
      .then(data => {
        if (data.trends && data.trends.length > 0) {
          const loaded: EmergingTrend[] = data.trends.map((t: any) => ({
            id: t.id,
            name: t.name,
            description: t.description || '',
            force: t.force || 'Consumer',
            direction: t.direction || 'Expansion',
            suggested_impact: t.suggested_impact || 3,
            suggested_probability: t.suggested_probability || 3,
            relevance_score: t.relevance_score || 65,
            category_mapping: typeof t.category_mapping === 'string'
              ? JSON.parse(t.category_mapping || '{}')
              : (t.category_mapping || {}),
            sources: typeof t.sources === 'string'
              ? JSON.parse(t.sources || '[]')
              : (t.sources || []),
            discovered_at: t.discovered_at || new Date().toISOString(),
            reasoning: t.reasoning || '',
            status: t.status || 'new',
          }));
          setEmergingTrends(loaded);
        }
      })
      .catch(() => { /* no saved trends yet */ });
  }, []);

  // ─── Save trends to database ────────────────────────────────────────
  const saveTrendsToDb = useCallback(async (trends: EmergingTrend[]) => {
    try {
      await fetch('/api/v1/scanner/save-trends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trends }),
      });
    } catch {
      console.warn('Failed to persist scanned trends');
    }
  }, []);

  // ─── API Scan Handler ─────────────────────────────────────────────────
  const handleScan = useCallback(async () => {
    setIsScanning(true);
    setScanProgress({});
    setScanErrors([]);

    try {
      // Vercel serverless: use synchronous endpoint directly (no background tasks)
      const res = await fetch('/api/v1/scanner/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit_per_source: 20 }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.trends && data.trends.length > 0) {
          const mapped = mapApiResultsToTrends(data.trends);
          setEmergingTrends(prev => {
            const existingNames = new Set(prev.map(t => t.name));
            const newOnes = mapped.filter(t => !existingNames.has(t.name));
            // Mark previously-seen trends as 'reviewed'
            const updated = prev.map(t => t.status === 'new' ? { ...t, status: 'reviewed' as const } : t);
            const merged = [...newOnes, ...updated].slice(0, MAX_VISIBLE_TRENDS);
            // Persist merged trends to database
            saveTrendsToDb(merged);
            return merged;
          });
        }
        // Update progress from meta
        if (data.meta) {
          setScanProgress(
            Object.fromEntries(
              (data.meta.sources_queried || []).map((s: string) => [s, 'ok'])
            )
          );
          if (data.meta.sources_failed > 0) {
            setScanErrors([`${data.meta.sources_failed} source(s) had errors`]);
          }
        }
      } else {
        const errText = await res.text();
        setScanErrors([`Scan failed: ${res.status} ${errText.slice(0, 100)}`]);
      }
    } catch (err) {
      console.warn('Scanner request failed:', err);
      setScanErrors(['Backend unreachable — ensure the PULSE API server is running']);
    } finally {
      setIsScanning(false);
      setLastScanned(new Date());
    }
  }, [saveTrendsToDb]);

  // ─── Map raw API results to EmergingTrend format ──────────────────────
  function mapApiResultsToTrends(raw: any[]): EmergingTrend[] {
    return raw
      .filter(r => r && (r.name || r.title))
      .map((r, i) => ({
        id: r.id || `api_${Date.now()}_${i}`,
        name: r.name || r.title || 'Untitled',
        description: r.description || r.snippet || r.abstract || '',
        force: (r.force || inferForce(r)) as ForceName,
        direction: (r.direction || 'Expansion') as 'Expansion' | 'Contraction',
        suggested_impact: r.suggested_impact || r.impact || 3,
        suggested_probability: r.suggested_probability || r.probability || 3,
        relevance_score: r.relevance_score || r.relevance || 65,
        category_mapping: r.category_mapping || r.categories || {},
        sources: Array.isArray(r.sources) ? r.sources : [
          { api: r.source || r.api || 'API', title: r.name || r.title || '', url: r.url || '#', snippet: r.snippet, published: r.published || r.date }
        ],
        discovered_at: r.discovered_at || r.detected_date || new Date().toISOString(),
        reasoning: r.reasoning || r.ai_reasoning || '',
        status: 'new' as const,
      }))
      .slice(0, MAX_VISIBLE_TRENDS);
  }

  function inferForce(r: any): string {
    const text = ((r.name || '') + ' ' + (r.description || '')).toLowerCase();
    if (text.match(/regulat|eu |directive|ban|restrict|compli/)) return 'Government';
    if (text.match(/consumer|demand|preference|trend|wellness|beauty/)) return 'Consumer';
    if (text.match(/retail|channel|store|e-commerce|amazon|shelf/)) return 'Customer';
    if (text.match(/innovat|biotech|ai |patent|enzyme|formul/)) return 'Technology';
    if (text.match(/climate|carbon|water|sustainab|palm|deforest/)) return 'Environmental';
    if (text.match(/p&g|unilever|reckitt|compet|market share|m&a/)) return 'Competitive';
    return 'Consumer';
  }

  // ─── Selection handlers ───────────────────────────────────────────────
  const toggleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    const actionable = emergingTrends.filter(t => t.status === 'new' || t.status === 'reviewed');
    setSelectedIds(new Set(actionable.map(t => t.id)));
  }, [emergingTrends]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // ─── Bulk add handler ─────────────────────────────────────────────────
  const handleBulkAdd = useCallback(() => {
    const selected = emergingTrends.filter(t => selectedIds.has(t.id));
    selected.forEach(t => onAddTrend(t));
    setEmergingTrends(prev => prev.map(t =>
      selectedIds.has(t.id) ? { ...t, status: 'added' as const } : t
    ));
    setSelectedIds(new Set());
  }, [emergingTrends, selectedIds, onAddTrend]);

  // ─── Individual handlers ──────────────────────────────────────────────
  const handleAddTrend = useCallback((trend: EmergingTrend) => {
    setEmergingTrends(prev => prev.map(t =>
      t.id === trend.id ? { ...t, status: 'added' as const } : t
    ));
    onAddTrend(trend);
  }, [onAddTrend]);

  const handleDismiss = useCallback((trendId: string) => {
    setEmergingTrends(prev => prev.map(t =>
      t.id === trendId ? { ...t, status: 'dismissed' as const } : t
    ));
    setSelectedIds(prev => { const n = new Set(prev); n.delete(trendId); return n; });
    // Persist dismiss status to database
    fetch('/api/v1/scanner/update-trend-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trend_id: trendId, status: 'dismissed' }),
    }).catch(() => {});
  }, []);

  // ─── Filter & sort ────────────────────────────────────────────────────
  const filteredTrends = useMemo(() => {
    let result = [...emergingTrends];
    if (forceFilter !== 'All') {
      result = result.filter(t => t.force === forceFilter);
    }
    result.sort((a, b) => {
      if (a.status === 'dismissed' && b.status !== 'dismissed') return 1;
      if (a.status !== 'dismissed' && b.status === 'dismissed') return -1;
      if (a.status === 'added' && b.status !== 'added') return 1;
      if (a.status !== 'added' && b.status === 'added') return -1;
      switch (sortBy) {
        case 'relevance': return b.relevance_score - a.relevance_score;
        case 'impact': return (b.suggested_impact * b.suggested_probability) - (a.suggested_impact * a.suggested_probability);
        case 'date': return new Date(b.discovered_at).getTime() - new Date(a.discovered_at).getTime();
        default: return 0;
      }
    });
    return result.slice(0, MAX_VISIBLE_TRENDS);
  }, [emergingTrends, forceFilter, sortBy]);

  const newCount = emergingTrends.filter(t => t.status === 'new').length;
  const addedCount = emergingTrends.filter(t => t.status === 'added').length;
  const forces = ['All', ...Object.keys(FORCES)];
  const selectedCount = selectedIds.size;

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: T.text, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} style={{ color: T.accent }} />
            Emerging Trends
            {newCount > 0 && (
              <span style={{
                padding: '2px 8px',
                borderRadius: '10px',
                fontSize: '11px',
                fontWeight: 600,
                backgroundColor: T.accent + '20',
                color: T.accent,
              }}>
                {newCount} new
              </span>
            )}
          </h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {lastScanned && (
            <span style={{ fontSize: '9px', color: T.text3 }}>
              Last scan: {lastScanned.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleScan}
            disabled={isScanning}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: 600,
              color: '#fff',
              backgroundColor: T.accent,
              border: 'none',
              cursor: isScanning ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              opacity: isScanning ? 0.7 : 1,
            }}
          >
            <motion.div
              animate={isScanning ? { rotate: 360 } : {}}
              transition={isScanning ? { repeat: Infinity, duration: 1, ease: 'linear' } : {}}
            >
              <RefreshCw size={12} />
            </motion.div>
            {isScanning ? 'Scanning 19 APIs...' : 'Scan All Sources'}
          </motion.button>
        </div>
      </div>

      {/* Scan Progress */}
      <AnimatePresence>
        {isScanning && Object.keys(scanProgress).length > 0 && (
          <ScanProgressOverlay progress={scanProgress} errors={scanErrors} />
        )}
      </AnimatePresence>

      {/* Info Bar */}
      <div style={{
        padding: '10px 24px',
        borderBottom: `1px solid ${T.border}`,
        backgroundColor: T.accent + '05',
        fontSize: '10px',
        color: T.text2,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}>
        <Sparkles size={10} style={{ color: T.accent }} />
        Scans GDELT · GNews · CurrentsAPI · RSS · FRED · Google Trends · World Bank · ECHA · EUR-Lex · SEC EDGAR · Reddit · YouTube · OpenAlex · PubMed · arXiv · EPO Patents · Open-Meteo · NewsAPI
      </div>

      {/* Filters + Select All */}
      <div style={{
        padding: '12px 24px',
        borderBottom: `1px solid ${T.border1}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Select all toggle (admin only) */}
          {isAdmin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: '8px' }}>
              <button
                onClick={selectedCount > 0 ? deselectAll : selectAll}
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '9px',
                  fontWeight: 600,
                  color: selectedCount > 0 ? T.accent : T.text3,
                  backgroundColor: selectedCount > 0 ? T.accent + '10' : 'transparent',
                  border: `1px solid ${selectedCount > 0 ? T.accent + '30' : T.border1}`,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {selectedCount > 0 ? <CheckSquare size={10} /> : <Square size={10} />}
                {selectedCount > 0 ? 'Deselect All' : 'Select All'}
              </button>
            </div>
          )}

          {/* Force Filter Chips */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {forces.map((force) => (
              <button
                key={force}
                onClick={() => setForceFilter(force)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '14px',
                  fontSize: '10px',
                  fontWeight: 500,
                  backgroundColor: forceFilter === force
                    ? force === 'All' ? T.accent : FORCE_COLORS[force as ForceName]
                    : T.bg3,
                  color: forceFilter === force ? '#fff' : T.text2,
                  border: `1px solid ${forceFilter === force ? 'transparent' : T.border1}`,
                  cursor: 'pointer',
                  transition: 'all 120ms',
                }}
              >
                {force === 'All' ? 'All' : `${FORCE_ICONS[force as ForceName]} ${force}`}
              </button>
            ))}
          </div>
        </div>

        {/* Sort */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Filter size={10} style={{ color: T.text3 }} />
          {(['relevance', 'impact', 'date'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              style={{
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '9px',
                fontWeight: sortBy === s ? 600 : 400,
                color: sortBy === s ? T.accent : T.text3,
                backgroundColor: sortBy === s ? T.accent + '10' : 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Action Bar (visible when items selected) */}
      <AnimatePresence>
        {selectedCount > 0 && isAdmin && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              padding: '10px 24px',
              borderBottom: `1px solid ${T.accent}30`,
              backgroundColor: T.accent + '0A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 600, color: T.accent }}>
              {selectedCount} trend{selectedCount > 1 ? 's' : ''} selected
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleBulkAdd}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#fff',
                  backgroundColor: T.accent,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Plus size={12} />
                Add {selectedCount} to Trend Explorer
              </motion.button>
              <button
                onClick={deselectAll}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: 500,
                  color: T.text3,
                  backgroundColor: 'transparent',
                  border: `1px solid ${T.border1}`,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trend Cards */}
      <div style={{
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        maxHeight: '800px',
        overflowY: 'auto',
      }}>
        {filteredTrends.length === 0 ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: T.text3,
            fontSize: '12px',
          }}>
            {isScanning
              ? 'Scanning 19 API sources for emerging trends...'
              : emergingTrends.length === 0
                ? 'No trends loaded yet. Click "Scan All Sources" above to discover trends from 19 live API sources.'
                : 'No trends match the current filter.'}
          </div>
        ) : (
          filteredTrends.map(trend => (
            <EmergingTrendCard
              key={trend.id}
              trend={trend}
              onAdd={() => handleAddTrend(trend)}
              onDismiss={() => handleDismiss(trend.id)}
              isAdmin={isAdmin}
              expanded={expandedTrendId === trend.id}
              onToggle={() => setExpandedTrendId(expandedTrendId === trend.id ? null : trend.id)}
              selected={selectedIds.has(trend.id)}
              onSelect={(checked) => toggleSelect(trend.id, checked)}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '12px 24px',
        borderTop: `1px solid ${T.border1}`,
        fontSize: '9px',
        color: T.text3,
        display: 'flex',
        justifyContent: 'space-between',
      }}>
        <span>
          {filteredTrends.length} trends · {newCount} new · {addedCount} added{selectedCount > 0 ? ` · ${selectedCount} selected` : ''}
        </span>
        <span>
          19 API sources · Max {MAX_VISIBLE_TRENDS} trends
        </span>
      </div>
    </motion.div>
  );
};

export default EmergingTrends;
