/**
 * PRISM Innovation Explorer — Deep Dive View
 * Stitch "Digital Curator" editorial detail page
 * Two-column layout with insight rail + evaluation sidebar
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowUpRight, ExternalLink, Star, Globe, TrendingUp, TrendingDown, Beaker, ShieldCheck, BarChart3 } from 'lucide-react';
import type { Innovation } from '@/data/innovations';
import { getTypeColor } from '@/data/innovations';
import InnovationProductImage from './InnovationProductImage';

// Stitch design tokens
const S = {
  bg: '#f8f9ff',
  surface: '#ffffff',
  surfaceLow: '#eff4ff',
  surfaceHigh: '#dce9ff',
  surfaceHighest: '#d2e4ff',
  primary: '#005db5',
  primaryDim: '#0052a0',
  primaryContainer: '#d6e3ff',
  primaryFixedDim: '#bfd5ff',
  onBg: '#00345e',
  onSurfaceVariant: '#26619d',
  secondary: '#526074',
  secondaryContainer: '#d5e3fc',
  outline: '#81b5f6',
  headlineFont: "'Manrope', 'Inter', -apple-system, system-ui, sans-serif",
  bodyFont: "'Inter', -apple-system, system-ui, sans-serif",
};

interface InnovationDeepDiveProps {
  innovation: Innovation;
  onBack: () => void;
  onNavigateToTrend?: (trendCode: string) => void;
  onNavigateToConsumerJourney?: (stage: string) => void;
}

export default function InnovationDeepDive({
  innovation,
  onBack,
  onNavigateToTrend,
  onNavigateToConsumerJourney,
}: InnovationDeepDiveProps) {
  const typeColor = getTypeColor(innovation.type);

  const readinessColor = (level: string) => {
    switch (level) {
      case 'OPTIMAL': return { bg: '#dcfce7', text: '#166534' };
      case 'HIGH': return { bg: '#dbeafe', text: '#1e40af' };
      case 'MEDIUM': return { bg: '#fef3c7', text: '#92400e' };
      case 'LOW': return { bg: '#fee2e2', text: '#991b1b' };
      default: return { bg: '#f3f4f6', text: '#374151' };
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        minHeight: '100vh',
        background: S.bg,
        fontFamily: S.bodyFont,
      }}
    >
      {/* ─── HERO SECTION ─────────────────────────────────────── */}
      <section style={{
        position: 'relative',
        height: 480,
        width: '100%',
        overflow: 'hidden',
      }}>
        {/* Product Image */}
        <div style={{ position: 'absolute', inset: 0 }}>
          <InnovationProductImage
            innovationId={innovation.id}
            gradient={innovation.imageGradient}
            accent={innovation.imageAccent}
            size="hero"
          />
        </div>

        {/* Gradient overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to right, rgba(0,29,52,0.85) 0%, rgba(0,29,52,0.5) 50%, transparent 100%)',
        }} />

        {/* Back button */}
        <motion.button
          onClick={onBack}
          whileHover={{ scale: 1.05, background: 'rgba(255,255,255,0.2)' }}
          whileTap={{ scale: 0.95 }}
          style={{
            position: 'absolute',
            top: 24,
            left: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 20px',
            borderRadius: 12,
            background: 'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: 'white',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: S.bodyFont,
            zIndex: 10,
          }}
        >
          <ArrowLeft size={16} />
          Innovation Portfolio
        </motion.button>

        {/* Hero content */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: '0 64px 48px',
          maxWidth: 1440,
          margin: '0 auto',
        }}>
          {/* Badges */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '5px 12px',
              borderRadius: 999,
              background: `${typeColor.bg}cc`,
              color: typeColor.text,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            }}>
              {innovation.typeLabel}
            </span>
            {innovation.tierLevel === 1 && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 12px',
                borderRadius: 999,
                background: 'rgba(250,204,21,0.2)',
                border: '1px solid rgba(250,204,21,0.3)',
                color: '#fde68a',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.5,
              }}>
              <Star size={12} fill="currentColor" />
                TIER 1 — Invest Immediately
              </span>
            )}
            <span style={{
              padding: '5px 12px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.7)',
              fontSize: 11,
              fontWeight: 600,
            }}>
              {innovation.category}
            </span>
          </div>

          {/* Title */}
          <h1 style={{
            fontFamily: S.headlineFont,
            fontWeight: 800,
            fontSize: 48,
            color: 'white',
            letterSpacing: -1.5,
            lineHeight: 1.1,
            margin: '0 0 12px',
            maxWidth: 720,
          }}>
            {innovation.name}
          </h1>

          {/* Subtitle */}
          <p style={{
            fontSize: 17,
            color: S.primaryFixedDim,
            lineHeight: 1.6,
            maxWidth: 620,
            fontWeight: 500,
            margin: 0,
          }}>
            {innovation.subtitle}
          </p>
        </div>
      </section>

      {/* ─── MAIN CONTENT (Two-Column) ────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 380px',
        gap: 48,
        maxWidth: 1440,
        margin: '0 auto',
        padding: '48px 64px 80px',
      }}>
        {/* LEFT: Main Narrative */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>

          {/* ── The Consumer Need ──────────────────────────────── */}
          <article style={{ paddingLeft: 24, borderLeft: `4px solid ${S.primary}` }}>
            <h2 style={{
              fontFamily: S.headlineFont,
              fontWeight: 800,
              fontSize: 26,
              color: S.onBg,
              marginBottom: 16,
              marginTop: 0,
            }}>
              The Consumer Need
            </h2>
            <div style={{
              fontSize: 15,
              color: S.secondary,
              lineHeight: 1.8,
            }}>
              {innovation.consumerNeed.split('\n').map((p, i) => (
                <p key={i} style={{ margin: '0 0 12px' }}>{p}</p>
              ))}
            </div>
          </article>

          {/* ── Technical Specifications ───────────────────────── */}
          <section>
            <h2 style={{
              fontFamily: S.headlineFont,
              fontWeight: 800,
              fontSize: 22,
              color: S.onBg,
              marginBottom: 24,
              marginTop: 0,
            }}>
              Technical Specifications
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 16,
            }}>
              {innovation.techSpecs.map((spec, i) => (
                <div key={i} style={{
                  background: S.surface,
                  padding: 24,
                  borderRadius: 16,
                  boxShadow: '0 2px 16px rgba(0,52,94,0.04)',
                }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: S.primaryContainer,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 12,
                    color: S.primary,
                  }}>
                    <Beaker size={20} />
                  </div>
                  <h4 style={{
                    fontFamily: S.headlineFont,
                    fontWeight: 700,
                    fontSize: 14,
                    color: S.onBg,
                    marginBottom: 8,
                    marginTop: 0,
                  }}>
                    {spec.title}
                  </h4>
                  <p style={{
                    fontSize: 13,
                    color: S.secondary,
                    lineHeight: 1.6,
                    margin: 0,
                  }}>
                    {spec.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Portfolio Fit & Go-to-Market ───────────────────── */}
          <article style={{ paddingLeft: 24, borderLeft: `4px solid ${S.primary}` }}>
            <h2 style={{
              fontFamily: S.headlineFont,
              fontWeight: 800,
              fontSize: 22,
              color: S.onBg,
              marginBottom: 16,
              marginTop: 0,
            }}>
              Portfolio Fit & Go-to-Market
            </h2>
            <div style={{
              fontSize: 15,
              color: S.secondary,
              lineHeight: 1.8,
            }}>
              <p style={{ margin: 0 }}>{innovation.portfolioFit}</p>
            </div>
          </article>

          {/* ── Trend Connections ──────────────────────────────── */}
          <section>
            <h2 style={{
              fontFamily: S.headlineFont,
              fontWeight: 800,
              fontSize: 22,
              color: S.onBg,
              marginBottom: 20,
              marginTop: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <TrendingUp size={20} style={{ color: S.primary }} />
              Trend Connections (PRISM Database)
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {innovation.trendConnections.map((trend, i) => (
                <motion.div
                  key={trend.code}
                  whileHover={{ x: 4, background: S.surfaceLow }}
                  onClick={() => onNavigateToTrend?.(trend.code)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '56px 1fr auto',
                    gap: 16,
                    alignItems: 'center',
                    padding: '14px 16px',
                    borderRadius: 12,
                    background: S.surface,
                    cursor: onNavigateToTrend ? 'pointer' : 'default',
                    transition: 'all 0.2s',
                    boxShadow: '0 1px 4px rgba(0,52,94,0.03)',
                  }}
                >
                  {/* Code badge */}
                  <span style={{
                    fontFamily: S.headlineFont,
                    fontWeight: 800,
                    fontSize: 13,
                    color: S.primary,
                    background: S.primaryContainer,
                    padding: '4px 10px',
                    borderRadius: 6,
                    textAlign: 'center',
                  }}>
                    {trend.code}
                  </span>
                  {/* Name + Rationale */}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: S.onBg, marginBottom: 2 }}>
                      {trend.name}
                    </div>
                    <div style={{ fontSize: 11, color: S.secondary }}>
                      {trend.rationale}
                    </div>
                  </div>
                  {/* Direction */}
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 11,
                    fontWeight: 700,
                    color: trend.direction === 'Expansion' ? '#16a34a' : '#dc2626',
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: trend.direction === 'Expansion' ? '#dcfce7' : '#fee2e2',
                  }}>
                    {trend.direction === 'Expansion' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {trend.direction}
                  </span>
                </motion.div>
              ))}
            </div>
          </section>

          {/* ── Consumer Journey Stages ────────────────────────── */}
          <section>
            <h2 style={{
              fontFamily: S.headlineFont,
              fontWeight: 800,
              fontSize: 22,
              color: S.onBg,
              marginBottom: 20,
              marginTop: 0,
            }}>
              Consumer Journey Integration
            </h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {innovation.consumerJourneyStages.map((stage, i) => (
                <React.Fragment key={stage}>
                  <motion.button
                    whileHover={{ scale: 1.05, background: S.surfaceHighest }}
                    onClick={() => onNavigateToConsumerJourney?.(stage)}
                    style={{
                      padding: '10px 20px',
                      borderRadius: 12,
                      background: S.surface,
                      border: 'none',
                      boxShadow: '0 2px 8px rgba(0,52,94,0.04)',
                      cursor: onNavigateToConsumerJourney ? 'pointer' : 'default',
                      fontFamily: S.bodyFont,
                      fontSize: 13,
                      fontWeight: 600,
                      color: S.onBg,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      background: S.primaryContainer,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 800,
                      color: S.primary,
                    }}>
                      {i + 1}
                    </span>
                    {stage}
                  </motion.button>
                  {i < innovation.consumerJourneyStages.length - 1 && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      color: S.outline,
                      opacity: 0.4,
                    }}>
                      →
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </section>

          {/* ── Sources & Intelligence ─────────────────────────── */}
          <section>
            <h2 style={{
              fontFamily: S.headlineFont,
              fontWeight: 800,
              fontSize: 22,
              color: S.onBg,
              marginBottom: 16,
              marginTop: 0,
            }}>
              Sources & Intelligence
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
            }}>
              {innovation.sources.map((source, i) => (
                <div key={i} style={{
                  padding: 16,
                  background: S.surface,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 1px 4px rgba(0,52,94,0.03)',
                }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: S.secondary, lineHeight: 1.4 }}>{source}</span>
                  <ExternalLink size={14} style={{ color: S.outline, flexShrink: 0, marginLeft: 8, opacity: 0.5 }} />
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* RIGHT: Evaluation Sidebar */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Evaluation Panel (Sticky) */}
          <div style={{
            position: 'sticky',
            top: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
          }}>
            {/* Evaluation Matrix */}
            <div style={{
              background: S.surface,
              borderRadius: 20,
              padding: 28,
              boxShadow: '0 32px 64px -15px rgba(0,52,94,0.06)',
            }}>
              <h3 style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 1.5,
                color: S.outline,
                marginBottom: 24,
                marginTop: 0,
              }}>
                Evaluation Matrix
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {innovation.evaluation.map(metric => (
                  <div key={metric.label}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-end',
                      marginBottom: 8,
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: S.secondary }}>{metric.label}</span>
                      <span style={{ fontSize: 22, fontWeight: 800, color: S.primary, fontFamily: S.headlineFont }}>{metric.score}%</span>
                    </div>
                    {/* Progress bar */}
                    <div style={{
                      height: 6,
                      width: '100%',
                      background: S.surfaceHighest,
                      borderRadius: 999,
                      overflow: 'hidden',
                    }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${metric.score}%` }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        style={{
                          height: '100%',
                          background: `linear-gradient(90deg, ${S.primary}, ${S.primaryDim})`,
                          borderRadius: 999,
                        }}
                      />
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: S.primary, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {metric.rating}
                    </div>
                  </div>
                ))}
              </div>

              {/* Composite Score */}
              <div style={{
                marginTop: 24,
                padding: 16,
                background: S.bg,
                borderRadius: 12,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <span style={{ display: 'block', fontSize: 10, fontWeight: 600, color: S.secondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>Composite Score</span>
                  <span style={{
                    fontSize: 32,
                    fontWeight: 800,
                    color: S.onBg,
                    fontFamily: S.headlineFont,
                    letterSpacing: -1,
                  }}>
                    {Math.round(innovation.evaluation.reduce((sum, m) => sum + m.score, 0) / innovation.evaluation.length)}%
                  </span>
                </div>
                <BarChart3 size={32} style={{ color: S.primary, opacity: 0.6 }} />
              </div>

              {/* Horizon */}
              <div style={{
                marginTop: 16,
                padding: 12,
                background: S.bg,
                borderRadius: 12,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: S.secondary }}>Innovation Horizon</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: S.onBg, fontFamily: S.headlineFont }}>{innovation.horizon}</span>
              </div>
            </div>

            {/* Regional Readiness */}
            <div style={{
              background: S.surface,
              borderRadius: 20,
              padding: 28,
              boxShadow: '0 32px 64px -15px rgba(0,52,94,0.06)',
            }}>
              <h3 style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 1.5,
                color: S.outline,
                marginBottom: 20,
                marginTop: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <Globe size={12} />
                Regional Readiness
              </h3>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
              }}>
                {innovation.regionalReadiness.map(region => {
                  const rc = readinessColor(region.readiness);
                  return (
                    <div key={region.region} style={{
                      background: S.bg,
                      padding: 12,
                      borderRadius: 10,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: S.secondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {region.region}
                      </span>
                      <span style={{
                        fontSize: 12,
                        fontWeight: 800,
                        color: rc.text,
                        fontFamily: S.headlineFont,
                      }}>
                        {region.readiness}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Related Trends Tags */}
            <div style={{
              background: S.surface,
              borderRadius: 20,
              padding: 28,
              boxShadow: '0 32px 64px -15px rgba(0,52,94,0.06)',
            }}>
              <h3 style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 1.5,
                color: S.outline,
                marginBottom: 16,
                marginTop: 0,
              }}>
                Connected Trends
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {innovation.trendConnections.map(trend => (
                  <motion.span
                    key={trend.code}
                    whileHover={{ scale: 1.05 }}
                    onClick={() => onNavigateToTrend?.(trend.code)}
                    style={{
                      padding: '5px 10px',
                      background: S.secondaryContainer,
                      color: S.onBg,
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: onNavigateToTrend ? 'pointer' : 'default',
                    }}
                  >
                    {trend.code}
                  </motion.span>
                ))}
              </div>
            </div>

            {/* CTA Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  padding: '14px 24px',
                  borderRadius: 14,
                  border: 'none',
                  background: `linear-gradient(180deg, ${S.primary} 0%, ${S.primaryDim} 100%)`,
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: S.bodyFont,
                  cursor: 'pointer',
                  boxShadow: `0 8px 24px rgba(0,93,181,0.2)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <ShieldCheck size={16} />
                Schedule Internal Review
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02, background: `${S.primary}08` }}
                whileTap={{ scale: 0.98 }}
                onClick={onBack}
                style={{
                  padding: '14px 24px',
                  borderRadius: 14,
                  border: `2px solid ${S.primary}`,
                  background: 'transparent',
                  color: S.primary,
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: S.bodyFont,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <ArrowLeft size={16} />
                Back to Portfolio
              </motion.button>
            </div>
          </div>
        </aside>
      </div>
    </motion.div>
  );
}
