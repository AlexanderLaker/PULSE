/**
 * PRISM Innovation Explorer — Gallery View
 * Editorial / Stitch "Digital Curator" Design
 * Bento grid layout with category pill filters
 */



import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Sparkles, TrendingUp, Clock, Target, BarChart3, Layers, Route, Zap } from 'lucide-react';
import { INNOVATIONS, INNOVATION_CATEGORIES, getFilteredInnovations, getTypeColor } from '../lib/innovations';
import type { Innovation } from '../lib/innovations';
import { T } from '../lib/format';
import InnovationProductImage from './InnovationProductImage';
import InnovationDeepDive from './InnovationDeepDive';

// ─── Design Tokens (Stitch editorial palette) ────────────────
const S = {
  bg: '#f8f9ff',
  surface: '#ffffff',
  surfaceLow: '#eff4ff',
  surfaceHigh: '#dce9ff',
  surfaceHighest: '#d2e4ff',
  primary: '#005db5',
  primaryDim: '#0052a0',
  primaryContainer: '#d6e3ff',
  onBg: '#00345e',
  onSurfaceVariant: '#26619d',
  secondary: '#526074',
  outline: '#81b5f6',
  headlineFont: "'Manrope', 'Inter', -apple-system, system-ui, sans-serif",
  bodyFont: "'Inter', -apple-system, system-ui, sans-serif",
};

interface InnovationExplorerProps {
  onNavigateToTrend?: (trendCode: string) => void;
  onNavigateToConsumerJourney?: (stage: string) => void;
  onNavigateProfitPoolShiftModel?: () => void;
  onNavigateTrends?: () => void;
}

export default function InnovationExplorer({ onNavigateToTrend, onNavigateToConsumerJourney, onNavigateProfitPoolShiftModel, onNavigateTrends }: InnovationExplorerProps) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedInnovation, setSelectedInnovation] = useState<Innovation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredInnovations = useMemo(() => {
    let innovations = getFilteredInnovations(activeCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      innovations = innovations.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.subtitle.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q) ||
        i.typeLabel.toLowerCase().includes(q)
      );
    }
    return innovations;
  }, [activeCategory, searchQuery]);

  // Return deep dive if innovation is selected
  if (selectedInnovation) {
    return (
      <InnovationDeepDive
        innovation={selectedInnovation}
        onBack={() => setSelectedInnovation(null)}
        onNavigateToTrend={onNavigateToTrend}
        onNavigateToConsumerJourney={onNavigateToConsumerJourney}
      />
    );
  }

  // Determine bento grid layout positions
  const getCardSize = (index: number, total: number): 'hero' | 'feature' | 'standard' | 'compact' => {
    if (index === 0) return 'hero';
    if (index === 1 || index === 2) return 'feature';
    if (index % 5 === 0 && index > 0) return 'feature';
    return 'standard';
  };

  const activeCats = INNOVATION_CATEGORIES.filter(c => {
    if (c.id === 'all') return true;
    const count = getFilteredInnovations(c.id).length;
    return count > 0;
  });

  return (
    <div style={{
      minHeight: '100vh',
      background: S.bg,
      fontFamily: S.bodyFont,
    }}>
      {/* ─── TOP NAV BAR — matching other pages ─────────────── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${T.border}`,
        padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 12,
        fontFamily: T.sans,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 4 }}>
          <div style={{
            width: 28, height: 28,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginLeft: 36,
          }}>
            <svg width="24" height="24" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <polygon points="50,5 95,85 5,85" fill="#1a1a2e" />
              <polygon points="50,5 72,85 50,70 28,85" fill="#2d2d44" />
              <polygon points="50,5 72,85 50,70" fill="#3a3a55" />
              <line x1="50" y1="5" x2="50" y2="70" stroke="#6366f1" strokeWidth="1.5" opacity="0.5" />
              <line x1="50" y1="70" x2="28" y2="85" stroke="#6366f1" strokeWidth="1" opacity="0.3" />
              <line x1="50" y1="70" x2="72" y2="85" stroke="#6366f1" strokeWidth="1" opacity="0.3" />
            </svg>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.text, letterSpacing: -0.3 }}>PRISM Profit Pool Analysis</span>
          <span style={{ fontSize: 10, color: T.text3, fontWeight: 500 }}>v6.0</span>
        </div>

        {/* Nav pills — Profit Pool Analysis, Trends, Consumer Journey, Innovation Explorer */}
        <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
          {onNavigateProfitPoolShiftModel && (
            <button
              onClick={onNavigateProfitPoolShiftModel}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 14px', borderRadius: 8,
                border: `1px solid ${T.border}`, background: 'transparent',
                color: T.text2, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                fontFamily: T.sans, transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = T.bg1; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <BarChart3 size={13} />
              Profit Pool Analysis
            </button>
          )}
          {onNavigateTrends && (
            <button
              onClick={onNavigateTrends}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 14px', borderRadius: 8,
                border: `1px solid ${T.border}`, background: 'transparent',
                color: T.text2, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                fontFamily: T.sans, transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = T.bg1; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <Layers size={13} />
              Trends
            </button>
          )}
          {onNavigateToConsumerJourney && (
            <button
              onClick={() => onNavigateToConsumerJourney('')}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 14px', borderRadius: 8,
                border: `1px solid ${T.border}`, background: 'transparent',
                color: T.text2, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                fontFamily: T.sans, transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = T.bg1; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <Route size={13} />
              Consumer Journey
            </button>
          )}
          <button
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 14px', borderRadius: 8,
              border: 'none', background: T.accent,
              color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'default',
              fontFamily: T.sans,
            }}
          >
            <Zap size={13} />
            Innovation Explorer
          </button>
        </div>
      </div>

      {/* ─── EDITORIAL HEADER ─────────────────────────────────── */}
      <header style={{
        padding: '48px 48px 0',
        maxWidth: 1440,
        margin: '0 auto',
      }}>
        {/* Breadcrumb */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 24,
        }}>
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            color: S.primary,
            fontFamily: S.headlineFont,
          }}>
            PRISM Strategy Intelligence
          </span>
          <span style={{ color: S.secondary, fontSize: 11 }}>/</span>
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 1,
            textTransform: 'uppercase',
            color: S.secondary,
          }}>
            Innovation Explorer
          </span>
        </div>

        {/* Hero Title */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 40, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <h1 style={{
              fontFamily: S.headlineFont,
              fontWeight: 800,
              fontSize: 44,
              letterSpacing: -1.5,
              color: S.onBg,
              lineHeight: 1.1,
              margin: 0,
            }}>
              Innovation Portfolio
            </h1>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={S.secondary} strokeWidth="2" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            <input
              type="text"
              placeholder="Search innovations..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                paddingLeft: 40,
                paddingRight: 16,
                paddingTop: 10,
                paddingBottom: 10,
                background: S.surfaceLow,
                border: 'none',
                borderRadius: 999,
                fontSize: 13,
                fontFamily: S.bodyFont,
                color: S.onBg,
                width: 220,
                outline: 'none',
                transition: 'all 0.3s',
              }}
              onFocus={e => { e.currentTarget.style.boxShadow = `0 0 0 2px ${S.primary}`; e.currentTarget.style.width = '280px'; }}
              onBlur={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.width = '220px'; }}
            />
          </div>
        </div>

        {/* ─── PORTFOLIO STATS BAR ─────────────────────────────── */}
        <div style={{
          display: 'flex',
          gap: 32,
          paddingTop: 16,
          paddingBottom: 24,
          borderBottom: 'none',
        }}>
          {[
            { label: 'Total Concepts', value: '16', icon: <Sparkles size={14} /> },
            { label: 'Tier 1 Priority', value: '14', icon: <Target size={14} /> },
            { label: 'Avg. Market Score', value: '84%', icon: <TrendingUp size={14} /> },
            { label: 'Horizon', value: '2027–2030', icon: <Clock size={14} /> },
          ].map(stat => (
            <div key={stat.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: S.primaryContainer,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: S.primary,
              }}>
                {stat.icon}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: S.onBg, fontFamily: S.headlineFont }}>{stat.value}</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: S.secondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ─── CATEGORY PILL FILTERS ──────────────────────────── */}
        <div style={{
          display: 'flex',
          gap: 8,
          paddingBottom: 32,
          overflowX: 'auto',
          flexWrap: 'wrap',
        }}>
          {activeCats.map(cat => {
            const isActive = activeCategory === cat.id;
            const count = cat.id === 'all' ? INNOVATIONS.length : getFilteredInnovations(cat.id).length;
            return (
              <motion.button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                whileTap={{ scale: 0.95 }}
                style={{
                  padding: '8px 18px',
                  borderRadius: 999,
                  border: 'none',
                  background: isActive ? S.primary : S.primaryContainer,
                  color: isActive ? '#ffffff' : S.onBg,
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: S.bodyFont,
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                }}
              >
                {cat.short}
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  opacity: isActive ? 0.8 : 0.5,
                  background: isActive ? 'rgba(255,255,255,0.2)' : 'rgba(0,52,94,0.08)',
                  padding: '2px 6px',
                  borderRadius: 999,
                }}>
                  {count}
                </span>
              </motion.button>
            );
          })}
        </div>
      </header>

      {/* ─── BENTO GRID GALLERY ──────────────────────────────── */}
      <main style={{
        padding: '0 48px 64px',
        maxWidth: 1440,
        margin: '0 auto',
      }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCategory + searchQuery}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(12, 1fr)',
              gap: 20,
              gridAutoRows: 'minmax(220px, auto)',
            }}
          >
            {filteredInnovations.map((innovation, index) => {
              const cardSize = getCardSize(index, filteredInnovations.length);
              const typeColor = getTypeColor(innovation.type);

              // Grid span based on card size
              const gridColumn = cardSize === 'hero' ? 'span 8' :
                                 cardSize === 'feature' ? 'span 4' :
                                 'span 4';
              const gridRow = cardSize === 'hero' ? 'span 2' :
                              cardSize === 'feature' ? 'span 1' :
                              'span 1';

              return (
                <motion.article
                  key={innovation.id}
                  layoutId={innovation.id}
                  onClick={() => setSelectedInnovation(innovation)}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04, duration: 0.4 }}
                  style={{
                    gridColumn,
                    gridRow,
                    position: 'relative',
                    borderRadius: 16,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    boxShadow: '0 32px 64px rgba(0,52,94,0.06)',
                    minHeight: cardSize === 'hero' ? 420 : 260,
                  }}
                  whileHover={{ scale: 1.01, boxShadow: '0 32px 64px rgba(0,52,94,0.12)' }}
                  className="group"
                >
                  {/* Product Image Background */}
                  <div style={{ position: 'absolute', inset: 0 }}>
                    <InnovationProductImage
                      innovationId={innovation.id}
                      gradient={innovation.imageGradient}
                      accent={innovation.imageAccent}
                      size={cardSize === 'hero' ? 'hero' : 'card'}
                    />
                  </div>

                  {/* Dark gradient overlay */}
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: cardSize === 'hero'
                      ? 'linear-gradient(to top, rgba(0,29,52,0.88) 0%, rgba(0,29,52,0.3) 50%, transparent 100%)'
                      : 'linear-gradient(to top, rgba(0,29,52,0.85) 0%, rgba(0,29,52,0.2) 60%, transparent 100%)',
                  }} />

                  {/* Content overlay */}
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: cardSize === 'hero' ? 36 : 24,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: cardSize === 'hero' ? 12 : 8,
                  }}>
                    {/* Top badges */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      {/* Type badge */}
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 10px',
                        borderRadius: 999,
                        background: 'rgba(255,255,255,0.15)',
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: 0.8,
                        textTransform: 'uppercase',
                        color: 'white',
                      }}>
                        {innovation.typeLabel}
                      </span>
                      {/* Tier badge */}
                      {innovation.tierLevel === 1 && (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                          padding: '4px 8px',
                          borderRadius: 999,
                          background: 'rgba(250,204,21,0.2)',
                          border: '1px solid rgba(250,204,21,0.3)',
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: 0.6,
                          textTransform: 'uppercase',
                          color: '#fde68a',
                        }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                          TIER 1
                        </span>
                      )}
                      {/* Category */}
                      <span style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: 'rgba(255,255,255,0.6)',
                        letterSpacing: 0.3,
                      }}>
                        {innovation.category}
                      </span>
                    </div>

                    {/* Title */}
                    <h2 style={{
                      fontFamily: S.headlineFont,
                      fontWeight: 800,
                      fontSize: cardSize === 'hero' ? 32 : 20,
                      color: 'white',
                      lineHeight: 1.15,
                      letterSpacing: -0.5,
                      margin: 0,
                    }}>
                      {innovation.name}
                    </h2>

                    {/* Subtitle - only on hero */}
                    {cardSize === 'hero' && (
                      <p style={{
                        fontFamily: S.bodyFont,
                        fontSize: 15,
                        color: 'rgba(255,255,255,0.75)',
                        lineHeight: 1.5,
                        maxWidth: 540,
                        margin: 0,
                      }}>
                        {innovation.subtitle}
                      </p>
                    )}

                    {/* Metrics bar */}
                    <div style={{
                      display: 'flex',
                      gap: cardSize === 'hero' ? 20 : 12,
                      alignItems: 'center',
                      marginTop: 4,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>MKT</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: 'white', fontFamily: S.headlineFont }}>{innovation.marketScore}%</span>
                      </div>
                      <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.2)' }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>FIT</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: 'white', fontFamily: S.headlineFont }}>{innovation.fitScore}%</span>
                      </div>
                      <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.2)' }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{innovation.horizon}</span>
                      </div>

                      {/* CTA */}
                      {cardSize === 'hero' && (
                        <motion.div
                          whileHover={{ x: 4 }}
                          style={{
                            marginLeft: 'auto',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '8px 16px',
                            borderRadius: 10,
                            background: 'rgba(255,255,255,0.15)',
                            backdropFilter: 'blur(8px)',
                            color: 'white',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Explore Concept <ArrowRight size={14} />
                        </motion.div>
                      )}
                    </div>
                  </div>

                  {/* Number badge top-right */}
                  <div style={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.12)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 800,
                    color: 'rgba(255,255,255,0.7)',
                    fontFamily: S.headlineFont,
                  }}>
                    {String(innovation.number).padStart(2, '0')}
                  </div>
                </motion.article>
              );
            })}
          </motion.div>
        </AnimatePresence>

        {/* Empty state */}
        {filteredInnovations.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '80px 40px',
            color: S.secondary,
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>
              <Sparkles size={48} style={{ color: S.primaryContainer }} />
            </div>
            <h3 style={{ fontFamily: S.headlineFont, fontSize: 20, fontWeight: 700, color: S.onBg, marginBottom: 8 }}>
              No innovations in this category
            </h3>
            <p style={{ fontSize: 14, color: S.secondary }}>
              Try selecting a different category or clearing your search.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
