/**
 * ProductImpactDetail — Full-screen modal for product-type deep dive.
 *
 * Shows when user clicks a product type in the rankings.
 * Sections:
 *  1. AI Analysis — narrative explaining why this product type is impacted
 *  2. Contributing Trends — the trends driving this impact with evidence
 *  3. Sources — external evidence links
 *  4. Timeframe — when the impact materializes
 *  5. Geography — regional exposure heatmap
 *  6. Market Opportunity — sizing and strategic recommendation
 *
 * Apple × McKinsey aesthetic with glassmorphism.
 */

import { FC, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  X, TrendingUp, TrendingDown, Clock, Globe, Zap,
  ExternalLink, BarChart3, Target, MapPin, Lightbulb,
  ArrowUpRight, ArrowDownRight, Shield, Sparkles,
} from 'lucide-react';
import type { Trend, ForceName } from '../types';
import { T, FORCES, FORCE_COLORS, fmtShift } from '../lib/format';
import type { ProductImpactItem } from './ProductImpactRankings';

interface ProductImpactDetailProps {
  item: ProductImpactItem;
  allTrends: Trend[];
  onClose: () => void;
  onCategorySelect?: (categoryId: string) => void;
}

// ── Geography bar colors ───────────────────────────────────────────

const GEO_CONFIG: Record<string, { flag: string; color: string }> = {
  'Europe':        { flag: '🇪🇺', color: '#0071E3' },
  'North America': { flag: '🇺🇸', color: '#5856D6' },
  'Asia':          { flag: '🇨🇳', color: '#FF9F0A' },
  'High Growth':   { flag: '🌍', color: '#30D158' },
};

// ── Generate AI Narrative ──────────────────────────────────────────

function generateAINarrative(item: ProductImpactItem, trends: Trend[]): string {
  const dir = item.direction === 'Expansion' ? 'positive' : 'negative';
  const mag = Math.abs(item.shift2030);
  const intensity = mag >= 0.03 ? 'significant' : mag >= 0.015 ? 'moderate' : 'mild';
  const accel = item.velocity > 0.002 ? 'accelerating' : item.velocity < -0.002 ? 'decelerating' : 'steady';

  // Primary driving trend
  const primaryTrend = item.trendNames[0] || 'multiple market forces';
  const secondTrend = item.trendNames[1] || '';

  // Geography narrative
  const topGeo = Object.entries(item.geography)
    .sort(([, a], [, b]) => b - a)
    .map(([r]) => r);
  const geoNarr = topGeo.length > 0
    ? `The impact is most pronounced in ${topGeo[0]}${topGeo[1] ? ` and ${topGeo[1]}` : ''}`
    : 'The impact is distributed globally';

  // Force mechanism
  const forceDef = FORCES[item.force];
  const forceLabel = forceDef?.label || item.force;

  if (item.direction === 'Expansion') {
    return `PRISM analysis identifies **${item.productType}** within ${item.categoryName} as showing ${intensity} ${dir} profit pool dynamics, with a projected median shift of ${fmtShift(item.shift2030)} by 2030. ` +
      `The primary driver is the **${forceLabel}** force, specifically through "${primaryTrend}"${secondTrend ? ` compounded by "${secondTrend}"` : ''}. ` +
      `The trajectory is ${accel}, with the shift path moving from ${fmtShift(item.shift2028)} in 2028 to ${fmtShift(item.shift2030)} by 2030. ` +
      `${geoNarr}, suggesting region-prioritized investment. ` +
      `This product type represents a growth pocket where early-mover advantage can capture disproportionate margin. ` +
      `The confidence level is ${item.confidence}, based on ${item.trendNames.length} contributing trend${item.trendNames.length > 1 ? 's' : ''} and ${item.sources.length} external source${item.sources.length > 1 ? 's' : ''}.`;
  } else {
    return `PRISM analysis flags **${item.productType}** within ${item.categoryName} as facing ${intensity} ${dir} profit pool pressure, with a projected median shift of ${fmtShift(item.shift2030)} by 2030. ` +
      `The key headwind originates from the **${forceLabel}** force, driven by "${primaryTrend}"${secondTrend ? ` and amplified by "${secondTrend}"` : ''}. ` +
      `The contraction path is ${accel}: from ${fmtShift(item.shift2028)} at mid-term to ${fmtShift(item.shift2030)} at long-term horizon. ` +
      `${geoNarr}, indicating where defensive measures are most urgent. ` +
      `This product type requires active portfolio management — premiumization, reformulation, or controlled exit should be evaluated. ` +
      `Confidence is ${item.confidence}, supported by ${item.trendNames.length} contributing trend${item.trendNames.length > 1 ? 's' : ''} across ${item.sources.length} evidence source${item.sources.length > 1 ? 's' : ''}.`;
  }
}

// ── Main Component ─────────────────────────────────────────────────

const ProductImpactDetail: FC<ProductImpactDetailProps> = ({
  item,
  allTrends,
  onClose,
  onCategorySelect,
}) => {
  const isPositive = item.direction === 'Expansion';
  const accentColor = isPositive ? T.green : T.red;
  const accentDim = isPositive ? T.greenDim : T.redDim;

  // Get full trend objects for contributing trends
  const contributingTrends = useMemo(() => {
    return item.trendIds
      .map(id => allTrends.find(t => t.id === id))
      .filter((t): t is Trend => t != null);
  }, [item.trendIds, allTrends]);

  // AI narrative
  const narrative = useMemo(
    () => generateAINarrative(item, contributingTrends),
    [item, contributingTrends],
  );

  // Parse narrative for **bold** markers
  const renderNarrative = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} style={{ color: T.text, fontWeight: 650 }}>{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 500,
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(8px)',
        }}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        style={{
          position: 'fixed',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(820px, 92vw)',
          maxHeight: '88vh',
          overflowY: 'auto',
          zIndex: 501,
          background: T.bg,
          borderRadius: 18,
          border: `1px solid ${T.border2}`,
          boxShadow: '0 24px 80px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.04)',
          fontFamily: T.sans,
        }}
      >
        {/* ── Header ────────────────────────────────────── */}
        <div style={{
          padding: '24px 28px 20px',
          borderBottom: `1px solid ${T.border}`,
          position: 'sticky', top: 0, zIndex: 10,
          background: T.bg,
          borderRadius: '18px 18px 0 0',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ flex: 1 }}>
              {/* Category Breadcrumb */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{
                  fontSize: 10, fontWeight: 650, color: FORCE_COLORS[item.force] || T.text3,
                  background: `${FORCE_COLORS[item.force] || T.text3}14`,
                  padding: '2px 8px', borderRadius: 4,
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  {item.force}
                </span>
                <span style={{ fontSize: 11, color: T.text3 }}>·</span>
                <button
                  onClick={() => { onCategorySelect?.(item.category); onClose(); }}
                  style={{
                    fontSize: 11, color: T.accent, fontWeight: 500,
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: 0, fontFamily: T.sans,
                  }}
                >
                  {item.categoryName} →
                </button>
              </div>

              {/* Title */}
              <h2 style={{
                fontSize: 22, fontWeight: 700, color: T.text,
                letterSpacing: '-0.03em', margin: '0 0 6px',
              }}>
                {item.productType}
              </h2>

              {/* Subtitle badges */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 13, fontWeight: 650, color: accentColor,
                  background: accentDim, padding: '3px 10px', borderRadius: 8,
                }}>
                  {isPositive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                  {fmtShift(item.shift2030)} by 2030
                </span>
                <span style={{
                  fontSize: 11, color: T.text3,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <Clock size={11} />
                  {item.timeframe}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 600,
                  color: item.confidence === 'High' ? T.green : item.confidence === 'Medium' ? T.amber : T.red,
                  background: item.confidence === 'High' ? T.greenDim : item.confidence === 'Medium' ? T.amberDim : T.redDim,
                  padding: '2px 7px', borderRadius: 4,
                }}>
                  {item.confidence} Confidence
                </span>
              </div>
            </div>

            {/* Close */}
            <button
              onClick={onClose}
              style={{
                width: 32, height: 32, borderRadius: 8,
                border: `1px solid ${T.border2}`, background: T.bg1,
                cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, marginLeft: 16,
              }}
            >
              <X size={16} color={T.text3} />
            </button>
          </div>
        </div>

        {/* ── Body ──────────────────────────────────────── */}
        <div style={{ padding: '24px 28px 28px' }}>

          {/* ─ Section 1: PRISM AI Analysis ──────────── */}
          <Section icon={<Sparkles size={14} color={T.accent} />} title="PRISM AI Analysis" color={T.accent}>
            <p style={{
              fontSize: 13.5, color: T.text2, lineHeight: 1.75,
              margin: 0,
            }}>
              {renderNarrative(narrative)}
            </p>
          </Section>

          {/* ─ Section 2: Key Metrics Row ────────────── */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12, marginBottom: 28,
          }}>
            <MetricCard
              label="Shift 2028"
              value={fmtShift(item.shift2028)}
              sublabel="Mid-term"
              color={item.shift2028 >= 0 ? T.green : T.red}
            />
            <MetricCard
              label="Shift 2030"
              value={fmtShift(item.shift2030)}
              sublabel="Long-term"
              color={item.shift2030 >= 0 ? T.green : T.red}
            />
            <MetricCard
              label="Velocity"
              value={item.velocity >= 0 ? `+${(item.velocity * 100).toFixed(2)}%` : `${(item.velocity * 100).toFixed(2)}%`}
              sublabel={item.velocity > 0.002 ? 'Accelerating ↑' : item.velocity < -0.002 ? 'Decelerating ↓' : 'Steady →'}
              color={item.velocity > 0.002 ? T.green : item.velocity < -0.002 ? T.red : T.text3}
            />
            <MetricCard
              label="Trends"
              value={String(item.trendNames.length)}
              sublabel={`${item.sources.length} sources`}
              color={T.accent}
            />
          </div>

          {/* ─ Section 3: Geography ──────────────────── */}
          <Section icon={<Globe size={14} color={T.purple} />} title="Geographic Exposure" color={T.purple}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.entries(item.geography)
                .sort(([, a], [, b]) => b - a)
                .map(([region, score]) => {
                  const cfg = GEO_CONFIG[region] || { flag: '🌐', color: T.text3 };
                  const pct = (score / 5) * 100;
                  return (
                    <div key={region} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{cfg.flag}</span>
                      <span style={{
                        fontSize: 12, fontWeight: 500, color: T.text2,
                        width: 110, flexShrink: 0,
                      }}>
                        {region}
                      </span>
                      <div style={{
                        flex: 1, height: 8, borderRadius: 4,
                        background: T.bg1, overflow: 'hidden',
                      }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                          style={{
                            height: '100%', borderRadius: 4,
                            background: `linear-gradient(90deg, ${cfg.color}80, ${cfg.color})`,
                          }}
                        />
                      </div>
                      <span style={{
                        fontSize: 11, fontWeight: 600, color: T.text3,
                        fontFamily: T.mono, width: 28, textAlign: 'right',
                      }}>
                        {score.toFixed(1)}
                      </span>
                    </div>
                  );
                })}
            </div>
          </Section>

          {/* ─ Section 4: Market Opportunity ─────────── */}
          <Section icon={<Target size={14} color={isPositive ? T.green : T.red} />} title="Market Opportunity & Strategic Action" color={isPositive ? T.green : T.red}>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14,
            }}>
              <div style={{
                padding: 14, borderRadius: 10,
                background: accentDim, border: `1px solid ${accentColor}20`,
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 650, color: accentColor,
                  textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  {isPositive ? <ArrowUpRight size={12} /> : <Shield size={12} />}
                  {isPositive ? 'Opportunity' : 'Risk Assessment'}
                </div>
                <p style={{ fontSize: 12.5, color: T.text2, lineHeight: 1.6, margin: 0 }}>
                  {item.marketOpportunity}
                </p>
              </div>
              <div style={{
                padding: 14, borderRadius: 10,
                background: T.accentDim, border: `1px solid ${T.accent}20`,
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 650, color: T.accent,
                  textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <Lightbulb size={12} />
                  Strategic Implication
                </div>
                <p style={{ fontSize: 12.5, color: T.text2, lineHeight: 1.6, margin: 0 }}>
                  {item.strategicImplication || 'Review portfolio allocation and competitive positioning in this product segment.'}
                </p>
              </div>
            </div>
          </Section>

          {/* ─ Section 5: Contributing Trends ────────── */}
          <Section icon={<Zap size={14} color={T.amber} />} title={`Contributing Trends (${contributingTrends.length})`} color={T.amber}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {contributingTrends.map((trend) => {
                const forceColor = FORCE_COLORS[trend.force] || T.text3;
                const isExp = trend.direction === 'Expansion';
                return (
                  <div
                    key={trend.id}
                    style={{
                      padding: '12px 14px', borderRadius: 10,
                      border: `1px solid ${T.border}`,
                      background: T.bg2,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{
                        fontSize: 9, fontWeight: 700, color: forceColor,
                        background: `${forceColor}14`, padding: '1px 6px',
                        borderRadius: 3, textTransform: 'uppercase',
                        letterSpacing: '0.03em',
                      }}>
                        {trend.force}
                      </span>
                      <span style={{
                        fontSize: 9, fontWeight: 600,
                        color: isExp ? T.green : T.red,
                        background: isExp ? T.greenDim : T.redDim,
                        padding: '1px 6px', borderRadius: 3,
                      }}>
                        {isExp ? '↑ Expansion' : '↓ Contraction'}
                      </span>
                      <span style={{
                        fontSize: 11, fontWeight: 600, color: T.text3,
                        fontFamily: T.mono, marginLeft: 'auto',
                      }}>
                        Prob {trend.probability ?? '?'}
                      </span>
                    </div>
                    <div style={{
                      fontSize: 13, fontWeight: 600, color: T.text,
                      letterSpacing: '-0.01em', marginBottom: 4,
                    }}>
                      {trend.name}
                    </div>
                    <p style={{
                      fontSize: 12, color: T.text3, lineHeight: 1.55, margin: 0,
                    }}>
                      {trend.description}
                    </p>
                  </div>
                );
              })}
              {contributingTrends.length === 0 && (
                <p style={{ fontSize: 12, color: T.text3, margin: 0, fontStyle: 'italic' }}>
                  No detailed trend data available. Run the AI scanner to populate trends.
                </p>
              )}
            </div>
          </Section>

          {/* ─ Section 6: Sources ────────────────────── */}
          {item.sources.length > 0 && (
            <Section icon={<ExternalLink size={14} color={T.cyan} />} title={`Evidence Sources (${item.sources.length})`} color={T.cyan}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {item.sources.map((source, i) => (
                  <a
                    key={i}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 8,
                      border: `1px solid ${T.border}`, background: T.bg2,
                      textDecoration: 'none', transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = T.accent; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = T.border; }}
                  >
                    <ExternalLink size={13} color={T.accent} style={{ flexShrink: 0 }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{
                        fontSize: 12, fontWeight: 550, color: T.accent,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {source.title || 'External Source'}
                      </div>
                      {source.data && (
                        <div style={{
                          fontSize: 11, color: T.text3, marginTop: 2,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {source.data}
                        </div>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            </Section>
          )}
        </div>
      </motion.div>
    </>
  );
};

export default ProductImpactDetail;

// ── Section Wrapper ────────────────────────────────────────────────

const Section: FC<{
  icon: React.ReactNode;
  title: string;
  color: string;
  children: React.ReactNode;
}> = ({ icon, title, color, children }) => (
  <div style={{ marginBottom: 28 }}>
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7,
      marginBottom: 14,
    }}>
      <div style={{
        width: 24, height: 24, borderRadius: 6,
        background: `${color}12`, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <h4 style={{
        fontSize: 13, fontWeight: 650, color: T.text,
        letterSpacing: '-0.01em', margin: 0,
        fontFamily: T.sans,
      }}>
        {title}
      </h4>
    </div>
    {children}
  </div>
);

// ── Metric Card ────────────────────────────────────────────────────

const MetricCard: FC<{
  label: string;
  value: string;
  sublabel: string;
  color: string;
}> = ({ label, value, sublabel, color }) => (
  <div style={{
    padding: '14px 14px 12px',
    borderRadius: 10,
    border: `1px solid ${T.border}`,
    background: T.bg2,
    textAlign: 'center',
  }}>
    <div style={{ fontSize: 10, fontWeight: 600, color: T.text3, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
      {label}
    </div>
    <div style={{ fontSize: 20, fontWeight: 700, color, fontFamily: T.mono, letterSpacing: '-0.03em', marginBottom: 3 }}>
      {value}
    </div>
    <div style={{ fontSize: 10, color: T.text4, fontWeight: 500 }}>
      {sublabel}
    </div>
  </div>
);
