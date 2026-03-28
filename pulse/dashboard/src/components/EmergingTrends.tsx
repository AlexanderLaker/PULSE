/**
 * EmergingTrends — AI-curated trend candidates from external API sources.
 * Shows trends discovered via GDELT, GNews, RSS, Google Trends, regulatory APIs, etc.
 * Each trend has a relevance score based on PULSE category/force logic.
 * Users can "Add to Relevant Trends" to promote a candidate into the active Trend Explorer.
 *
 * On each login/refresh, the system queries API sources and curates new candidates.
 * When backend is unavailable, shows realistic mock emerging trends.
 */
import React, { useState, useMemo, useEffect, useCallback, FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Plus, ChevronDown, ChevronUp, ExternalLink,
  RefreshCw, Filter, TrendingUp, TrendingDown, AlertTriangle, Check,
  Globe, Newspaper, FileText, BarChart3,
} from 'lucide-react';
import { T, FORCES, FORCE_COLORS, FORCE_ICONS, CATEGORIES } from '../lib/format';
import type { ForceName, CategoryId } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────

interface EmergingTrendSource {
  api: string;        // 'GDELT' | 'GNews' | 'RSS' | 'Google Trends' | 'ECHA' | 'EUR-Lex' | etc.
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
  suggested_impact: number;    // 1-5 AI estimate
  suggested_probability: number; // 1-5 AI estimate
  relevance_score: number;     // 0-100 — how relevant is this for Henkel's categories
  category_mapping: Record<string, number>; // suggested category exposures
  sources: EmergingTrendSource[];
  discovered_at: string;       // ISO date
  reasoning: string;           // AI reasoning for why this is relevant
  status: 'new' | 'reviewed' | 'added' | 'dismissed';
}

interface EmergingTrendsProps {
  onAddTrend: (trend: EmergingTrend) => void;
  userRole?: string;
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

// ─── Mock Emerging Trends Generator ───────────────────────────────────────

function generateMockEmergingTrends(): EmergingTrend[] {
  return [
    {
      id: 'em_001',
      name: 'AI-Powered Personalized Hair Color Formulation',
      description: 'Multiple beauty tech startups (Prose, Function of Beauty) are launching AI-driven hair color matching tools. L\'Oréal filed 23 patents in Q1 2026 for AI-color algorithms. This could disrupt the mass hair color market by enabling salon-grade personalization at home.',
      force: 'Technology',
      direction: 'Expansion',
      suggested_impact: 4,
      suggested_probability: 3,
      relevance_score: 87,
      category_mapping: { hair_color: 5, hair_care: 2 },
      sources: [
        { api: 'GNews', title: 'L\'Oréal Patents AI Hair Color Tech', url: 'https://www.cosmeticsdesign-europe.com/Article/2026/02/15/loreal-ai-hair-color', snippet: 'L\'Oréal files 23 new patents for AI-driven hair color formulation...', published: '2026-02-15' },
        { api: 'GDELT', title: 'Beauty Tech AI Funding Surge Q1 2026', url: 'https://www.beautyindependent.com/beauty-tech-ai-funding-2026', published: '2026-03-01' },
        { api: 'Google Trends', title: 'Search interest: "AI hair color" +240% YoY', url: 'https://trends.google.com/trends/explore?q=AI+hair+color', published: '2026-03-20' },
      ],
      discovered_at: '2026-03-25T09:15:00Z',
      reasoning: 'High relevance for Henkel Hair Color category. If AI-personalization becomes mainstream, it could shift the competitive landscape from brand loyalty to technology capability. P&G and L\'Oréal are investing heavily. Henkel needs a response strategy.',
      status: 'new',
    },
    {
      id: 'em_002',
      name: 'EU Microplastics Ban Phase 2 — Detergent Capsules',
      description: 'European Commission published draft regulation extending microplastics restrictions to laundry capsule film (PVA) by 2028. ECHA risk assessment classifies certain PVA films as persistent. This affects all pod/capsule laundry products.',
      force: 'Government',
      direction: 'Contraction',
      suggested_impact: 5,
      suggested_probability: 4,
      relevance_score: 95,
      category_mapping: { lhc_fcn: 5, lhc_fca: 4, lhc_hdw: 2 },
      sources: [
        { api: 'EUR-Lex', title: 'Draft Regulation COM/2026/0142 — Microplastics Restriction Amendment', url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=COM:2026:0142', published: '2026-03-10' },
        { api: 'ECHA', title: 'PVA Film Persistence Assessment — ECHA/RAC/2026/003', url: 'https://echa.europa.eu/documents/10162/rac-opinion-pva-2026', published: '2026-02-28' },
        { api: 'RSS', title: 'Chemical Watch: Laundry Industry Braces for PVA Restrictions', url: 'https://www.chemicalwatch.com/pva-laundry-capsules-regulation-2026', published: '2026-03-15' },
      ],
      discovered_at: '2026-03-15T14:30:00Z',
      reasoning: 'Critical relevance. Directly impacts Persil Discs/Caps format — a key innovation platform for Henkel LHC. Reformulation cost estimated at €15-25M. Competitive advantage if Henkel moves first to bio-degradable film alternatives. Propagation: Government → Technology (reformulation) → Customer (shelf price).',
      status: 'new',
    },
    {
      id: 'em_003',
      name: 'Refill Station Rollout at European Discounters',
      description: 'Aldi Nord and Lidl announced pilot refill stations for laundry detergent in 200+ stores across Germany and Netherlands by Q3 2026. Unilever signed exclusive supplier agreement with Aldi for the pilot.',
      force: 'Customer',
      direction: 'Contraction',
      suggested_impact: 4,
      suggested_probability: 3,
      relevance_score: 82,
      category_mapping: { lhc_fcn: 4, lhc_fca: 3, lhc_adw: 2 },
      sources: [
        { api: 'GNews', title: 'Aldi Nord Launches Detergent Refill Stations', url: 'https://www.retaildetail.eu/news/food/aldi-nord-refill-stations-laundry', snippet: 'Aldi Nord to roll out refill stations in 200+ stores...', published: '2026-03-18' },
        { api: 'RSS', title: 'Grocery Dive: Refill Economy Gains Momentum in EU Retail', url: 'https://www.grocerydive.com/news/refill-stations-eu-grocery-2026', published: '2026-03-20' },
      ],
      discovered_at: '2026-03-20T11:00:00Z',
      reasoning: 'Significant for Henkel LHC. Refill stations reduce brand differentiation (packaging as brand asset disappears) and shift power to retailers. Unilever\'s exclusive deal with Aldi is a competitive threat. Henkel must decide: join the refill ecosystem or defend branded packaging.',
      status: 'new',
    },
    {
      id: 'em_004',
      name: 'Scalp Microbiome as the Next Skinification Frontier',
      description: 'Scalp microbiome products grew 340% on Amazon EU in 2025. Clinical evidence linking scalp health to hair loss prevention is accelerating. Galderma and L\'Oréal launched dedicated scalp microbiome lines.',
      force: 'Consumer',
      direction: 'Expansion',
      suggested_impact: 3,
      suggested_probability: 4,
      relevance_score: 76,
      category_mapping: { hair_care: 5, hair_color: 2, hair_body: 3 },
      sources: [
        { api: 'Google Trends', title: 'Search interest: "scalp microbiome" +190% YoY', url: 'https://trends.google.com/trends/explore?q=scalp+microbiome', published: '2026-03-22' },
        { api: 'Semantic Scholar', title: 'Review: Scalp Microbiome and Hair Follicle Health (Nature Reviews, 2026)', url: 'https://www.nature.com/articles/s41579-026-0892-4', published: '2026-01-15' },
        { api: 'GNews', title: 'Galderma Launches Scalp Biome Line at €25 Premium', url: 'https://www.cosmeticsdesign-europe.com/Article/2026/03/05/galderma-scalp-biome', published: '2026-03-05' },
      ],
      discovered_at: '2026-03-22T08:45:00Z',
      reasoning: 'Moderate-high relevance for Hair Care. Scalp health is a premiumization opportunity — consumers willing to pay 2-3x for "clinically-backed" scalp products. Schwarzkopf Professional has scalp expertise that could be extended to mass market.',
      status: 'new',
    },
    {
      id: 'em_005',
      name: 'Water-Scarcity Laundry: Low-Water & Waterless Formats',
      description: 'Water scarcity affecting 40% of global population by 2030. Dry cleaning sheets and low-water detergent formats growing 85% YoY. P&G launched waterless laundry sheets in 5 EU markets.',
      force: 'Environmental',
      direction: 'Expansion',
      suggested_impact: 4,
      suggested_probability: 3,
      relevance_score: 79,
      category_mapping: { lhc_fcn: 4, lhc_fca: 3, lhc_ffi: 2 },
      sources: [
        { api: 'GDELT', title: 'Global Water Scarcity Report: Laundry Innovation Response', url: 'https://www.worldbank.org/en/topic/water/publication/water-scarcity-laundry-2026', published: '2026-02-20' },
        { api: 'RSS', title: 'P&G Launches Waterless Laundry Sheets in EU', url: 'https://www.packagingdive.com/news/pg-waterless-laundry-sheets-eu-2026', published: '2026-03-12' },
      ],
      discovered_at: '2026-03-12T16:20:00Z',
      reasoning: 'Relevant for LHC innovation pipeline. Waterless formats could disrupt liquid/powder dominance. Henkel\'s concentrated formulation expertise is a competitive advantage here. Early-mover in this space could capture premium positioning.',
      status: 'new',
    },
    {
      id: 'em_006',
      name: 'Amazon Private Label Expansion into Premium Hair Care',
      description: 'Amazon launched "Reverie" premium hair care line in DE, FR, IT — priced at Schwarzkopf Professional levels. Using AI-driven reviews to identify gaps in existing brand portfolios.',
      force: 'Competitive',
      direction: 'Contraction',
      suggested_impact: 4,
      suggested_probability: 3,
      relevance_score: 84,
      category_mapping: { hair_care: 5, hair_styling: 3, hair_color: 2 },
      sources: [
        { api: 'GNews', title: 'Amazon Launches Premium Hair Care Brand in Europe', url: 'https://www.beautyindependent.com/amazon-reverie-premium-hair-care-europe', published: '2026-03-08' },
        { api: 'GDELT', title: 'E-commerce Private Label Disruption in Beauty', url: 'https://www.mckinsey.com/industries/retail/our-insights/ecommerce-private-label-beauty-2026', published: '2026-03-01' },
      ],
      discovered_at: '2026-03-08T10:30:00Z',
      reasoning: 'High competitive threat. Amazon using data advantage to target exact price/positioning gaps where Schwarzkopf competes. Different from traditional PL — Amazon has superior consumer data and logistics. Hair Care most exposed.',
      status: 'new',
    },
    {
      id: 'em_007',
      name: 'TikTok Shop Launches Beauty Category in DACH',
      description: 'TikTok Shop expanding to Germany, Austria, Switzerland with beauty as anchor category. Early data from UK/US shows TikTok Shop capturing 8% of beauty e-commerce within 12 months.',
      force: 'Customer',
      direction: 'Expansion',
      suggested_impact: 3,
      suggested_probability: 4,
      relevance_score: 71,
      category_mapping: { hair_care: 3, hair_styling: 4, hair_color: 3 },
      sources: [
        { api: 'GNews', title: 'TikTok Shop DACH Launch: Beauty First', url: 'https://www.retaildetail.eu/news/general/tiktok-shop-dach-beauty-launch-2026', published: '2026-03-22' },
        { api: 'Google Trends', title: 'Search interest: "TikTok Shop beauty" +320% in DE', url: 'https://trends.google.com/trends/explore?q=TikTok+Shop+beauty&geo=DE', published: '2026-03-25' },
      ],
      discovered_at: '2026-03-25T13:00:00Z',
      reasoning: 'New channel opportunity. TikTok Shop rewards content-first brands — Schwarzkopf has strong creator network. Risk: price transparency and impulse buying favor trendy/indie brands over legacy portfolios. Early activation could give Henkel first-mover advantage in DACH.',
      status: 'new',
    },
    {
      id: 'em_008',
      name: 'Bioethanol-Based Surfactant Breakthrough',
      description: 'BASF announced commercial-scale production of bio-based surfactants from second-generation bioethanol. 40% lower carbon footprint vs. petrochemical surfactants at cost parity.',
      force: 'Technology',
      direction: 'Expansion',
      suggested_impact: 3,
      suggested_probability: 3,
      relevance_score: 68,
      category_mapping: { lhc_fcn: 3, lhc_fca: 2, lhc_adw: 2 },
      sources: [
        { api: 'RSS', title: 'HAPPI: BASF Bio-Surfactant Scale-Up Announced', url: 'https://www.happi.com/contents/view_breaking-news/2026-03-14/basf-bio-surfactant-scale-up', published: '2026-03-14' },
        { api: 'Semantic Scholar', title: 'Lifecycle Assessment of Second-Generation Bio-Surfactants', url: 'https://doi.org/10.1016/j.jclepro.2026.138421', published: '2026-02-10' },
      ],
      discovered_at: '2026-03-14T09:00:00Z',
      reasoning: 'Moderate relevance. Could enable Henkel to achieve sustainability claims without cost premium. BASF is a key Henkel supplier — potential for early access/exclusivity. LHC portfolio would benefit most from reformulation.',
      status: 'new',
    },
  ];
}

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
      fontSize: '9px',
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
}

const EmergingTrendCard: FC<EmergingTrendCardProps> = ({ trend, onAdd, onDismiss, isAdmin = false }) => {
  const [expanded, setExpanded] = useState(false);
  const trendColor = trend.direction === 'Expansion' ? T.green : T.red;
  const isActioned = trend.status === 'added' || trend.status === 'dismissed';
  const relevanceColor = trend.relevance_score >= 85 ? T.green :
    trend.relevance_score >= 70 ? '#EAB308' : T.text3;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: isActioned ? 0.45 : 1, y: 0 }}
      transition={{ duration: 0.15 }}
      style={{
        backgroundColor: expanded ? T.bg1 : 'transparent',
        borderRadius: '8px',
        border: expanded
          ? `1px solid ${trend.status === 'added' ? T.green + '40' : T.border1}`
          : `1px solid transparent`,
        overflow: 'hidden',
        transition: 'all 0.2s',
      }}
    >
      {/* Compact row — always visible */}
      <div
        style={{
          padding: expanded ? '12px 16px' : '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          cursor: 'pointer',
          borderRadius: expanded ? 0 : '8px',
          transition: 'background-color 100ms',
        }}
        onClick={() => setExpanded(!expanded)}
        onMouseEnter={(e) => { if (!expanded) e.currentTarget.style.backgroundColor = T.bg1; }}
        onMouseLeave={(e) => { if (!expanded) e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
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
          padding: '2px 7px',
          borderRadius: '10px',
          fontSize: '9px',
          fontWeight: 600,
          backgroundColor: FORCE_COLORS[trend.force] + '20',
          color: FORCE_COLORS[trend.force],
          flexShrink: 0,
          minWidth: '68px',
          textAlign: 'center',
        }}>
          {FORCE_ICONS[trend.force]} {trend.force}
        </span>

        {/* Trend name — takes remaining space */}
        <div style={{
          flex: 1,
          fontSize: '12px',
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
          fontSize: '10px',
          fontWeight: 600,
          fontFamily: T.mono,
          color: T.text2,
          flexShrink: 0,
          minWidth: '30px',
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
                {/* Description */}
                <div>
                  <div style={{ fontSize: '9px', fontWeight: 600, color: T.text3, marginBottom: '4px', letterSpacing: '0.5px' }}>
                    DESCRIPTION
                  </div>
                  <p style={{ fontSize: '11px', color: T.text2, lineHeight: 1.6, margin: 0 }}>
                    {trend.description}
                  </p>
                </div>

                {/* AI Reasoning */}
                <div>
                  <div style={{ fontSize: '9px', fontWeight: 600, color: T.accent, marginBottom: '4px', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Sparkles size={10} /> PULSE ANALYSIS
                  </div>
                  <p style={{ fontSize: '11px', color: T.text2, lineHeight: 1.6, margin: 0 }}>
                    {trend.reasoning}
                  </p>
                </div>

                {/* Sources */}
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
                {/* Suggested Scores */}
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

                {/* Category Mapping */}
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

                {/* Date */}
                <div style={{ fontSize: '10px', color: T.text3 }}>
                  Discovered: {new Date(trend.discovered_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </div>

                {/* Actions */}
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
                      Add to Relevant Trends
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
    </motion.div>
  );
};

// ─── EmergingTrends Component ─────────────────────────────────────────────

const EmergingTrends: FC<EmergingTrendsProps> = ({ onAddTrend, userRole = 'viewer' }) => {
  const [emergingTrends, setEmergingTrends] = useState<EmergingTrend[]>(() => generateMockEmergingTrends());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [forceFilter, setForceFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'relevance' | 'date' | 'impact'>('relevance');
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // In production, this calls the backend API which queries all external sources
      // POST /api/v1/ai/scan → triggers GDELT, GNews, RSS, etc.
      const response = await fetch('/api/v1/ai/scan', { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        if (data.emerging_trends) {
          setEmergingTrends(prev => {
            const existing = new Set(prev.map(t => t.id));
            const newTrends = data.emerging_trends.filter((t: EmergingTrend) => !existing.has(t.id));
            return [...newTrends, ...prev];
          });
        }
      }
    } catch {
      // Backend unavailable — generate fresh mock data to simulate discovery
      const fresh = generateMockEmergingTrends().map(t => ({
        ...t,
        id: `em_refresh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        discovered_at: new Date().toISOString(),
      }));
      // Only add truly "new" ones (avoid duplicates by name)
      setEmergingTrends(prev => {
        const existingNames = new Set(prev.map(t => t.name));
        const newOnes = fresh.filter(t => !existingNames.has(t.name));
        return newOnes.length > 0 ? [...newOnes.slice(0, 2), ...prev] : prev;
      });
    } finally {
      setIsRefreshing(false);
      setLastRefreshed(new Date());
    }
  }, []);

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
  }, []);

  // Filter & sort
  const filteredTrends = useMemo(() => {
    let result = [...emergingTrends];

    if (forceFilter !== 'All') {
      result = result.filter(t => t.force === forceFilter);
    }

    // Sort dismissed to bottom
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

    return result;
  }, [emergingTrends, forceFilter, sortBy]);

  const newCount = emergingTrends.filter(t => t.status === 'new').length;
  const forces = ['All', ...Object.keys(FORCES)];

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
          <span style={{ fontSize: '9px', color: T.text3 }}>
            Last scan: {lastRefreshed.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRefresh}
            disabled={isRefreshing}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: 600,
              color: T.accent,
              backgroundColor: T.accent + '10',
              border: `1px solid ${T.accent}30`,
              cursor: isRefreshing ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              opacity: isRefreshing ? 0.6 : 1,
            }}
          >
            <motion.div
              animate={isRefreshing ? { rotate: 360 } : {}}
              transition={isRefreshing ? { repeat: Infinity, duration: 1, ease: 'linear' } : {}}
            >
              <RefreshCw size={12} />
            </motion.div>
            {isRefreshing ? 'Scanning...' : 'Scan Sources'}
          </motion.button>
        </div>
      </div>

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
        AI-curated from GDELT, GNews, RSS, Google Trends, ECHA, EUR-Lex, SEC, and academic sources.
        Relevance scored by PULSE category/force logic.
      </div>

      {/* Filters */}
      <div style={{
        padding: '12px 24px',
        borderBottom: `1px solid ${T.border1}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
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

      {/* Trend Cards */}
      <div style={{
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        maxHeight: '700px',
        overflowY: 'auto',
      }}>
        {filteredTrends.length === 0 ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: T.text3,
            fontSize: '12px',
          }}>
            No emerging trends found for this filter. Click "Scan Sources" to discover new trends.
          </div>
        ) : (
          filteredTrends.map(trend => (
            <EmergingTrendCard
              key={trend.id}
              trend={trend}
              onAdd={() => handleAddTrend(trend)}
              onDismiss={() => handleDismiss(trend.id)}
              isAdmin={userRole === 'admin'}
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
          {filteredTrends.length} trends · {newCount} new · {emergingTrends.filter(t => t.status === 'added').length} added
        </span>
        <span>
          Sources: GDELT · GNews · RSS (12 feeds) · Google Trends · ECHA · EUR-Lex · SEC · Semantic Scholar
        </span>
      </div>
    </motion.div>
  );
};

export default EmergingTrends;
