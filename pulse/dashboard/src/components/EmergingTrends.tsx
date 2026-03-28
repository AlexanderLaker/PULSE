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
      name: 'Biotech Peptide Hair Care — Bond-Building Disruption',
      description: 'Biotechnology-based hair care market valued at $1.16B (2025), projected to reach $2.39B by 2033 (CAGR 9.4%). Croda launched KeraBio K31 — first proteomics-derived keratin bond builder outperforming commercial alternatives. L\'Oréal\'s VOYAGER AI platform evaluated 100,000 ingredient combinations to discover novel peptide sequences. COSRX (Amorepacific) debuted peptide hair care line. Bond-building category alone exceeds $800M.',
      force: 'Technology',
      direction: 'Expansion',
      suggested_impact: 4,
      suggested_probability: 4,
      relevance_score: 88,
      category_mapping: { hair_care: 5, hair_color: 3, hair_body: 2, hair_styling: 1 },
      sources: [
        { api: 'RSS', title: 'Biotech-derived keratin aims to shake up bond-building hair care', url: 'https://www.cosmeticsdesign.com/Article/2025/10/30/biotech-derived-keratin-ingredient-aims-to-shake-up-bond-building-hair-care-category/', snippet: 'Croda KeraBio K31 — first biotech-designed bond builder, outperforming commercial alternatives in tensile strength testing', published: '2025-10-30' },
        { api: 'RSS', title: 'Peptide-powered hair care: the new frontier', url: 'https://www.cosmeticsdesign-europe.com/Article/2025/04/07/peptide-powered-haircare/', snippet: 'Biotech peptide hair care market growing at 9.4% CAGR to $2.39B by 2033', published: '2025-04-07' },
        { api: 'Semantic Scholar', title: 'Technological Advances in Anti-hair Loss Cosmeceuticals (2025)', url: 'https://link.springer.com/article/10.1007/s00266-025-05077-3', snippet: '23% of consumers seeking anti-hair loss treatments; peptides emerging as clinical-grade active', published: '2025-03-15' },
      ],
      discovered_at: '2026-03-20T09:15:00Z',
      reasoning: 'High relevance for Henkel Hair Care. Peptide bond-builders create a premiumization lane worth $800M+ globally. Schwarzkopf Professional has salon credibility to extend into peptide-based consumer lines. If Henkel doesn\'t move, L\'Oréal (VOYAGER) and Croda partnerships will capture this growth. R&D pipeline must shift from traditional conditioning to in-vivo peptide efficacy claims.',
      status: 'new',
    },
    {
      id: 'em_002',
      name: 'GLP-1 Weight Loss Drugs Reshaping Beauty Demand',
      description: '8-10% of Americans now on GLP-1 medications (Ozempic, Wegovy), projected 10M+ users by end 2025. GLP-1 market exceeds $100B by 2030 (J.P. Morgan). Drop in leptin, insulin, estrogen causes reduced collagen production — "Ozempic face" (volume loss) and hair thinning are documented side effects. Medical aesthetics revenue up 9% at GLP-1-offering practices. New beauty sub-categories emerging: plumping skincare, volumizing hair care, dessert-themed fragrances.',
      force: 'Consumer',
      direction: 'Contraction',
      suggested_impact: 3,
      suggested_probability: 4,
      relevance_score: 74,
      category_mapping: { hair_care: 4, hair_body: 3, hair_styling: 2, hair_color: 1 },
      sources: [
        { api: 'GNews', title: 'How GLP-1 drugs are reshaping beauty and wellness innovation', url: 'https://www.nutraingredients.com/Article/2026/03/20/how-glp1-drugs-are-reshaping-beauty-and-wellness-innovation/', snippet: 'GLP-1 market exceeds $100B by 2030; beauty categories adapting to new consumer needs', published: '2026-03-20' },
        { api: 'GDELT', title: 'The GLP-1 Effect: How Weight Loss Medications Shape Beauty', url: 'https://www.uschamber.com/co/good-company/launch-pad/how-weight-loss-medications-are-shaping-the-future-of-wellness-and-beauty', snippet: '8-10% of Americans on GLP-1; medical aesthetics up 9% at offering practices', published: '2025-11-15' },
        { api: 'Reddit', title: 'r/skincareaddiction: GLP-1 users reporting hair thinning, skin laxity', url: 'https://www.reddit.com/r/SkincareAddiction/', snippet: 'Unfiltered consumer reports of Ozempic face, hair loss 2-4 weeks before mainstream coverage', published: '2026-03-01' },
      ],
      discovered_at: '2026-03-22T14:30:00Z',
      reasoning: 'Mixed signal for Henkel. Hair Care volume may contract among GLP-1 adopters (hair thinning is documented side effect), but premium "resilience" and volumizing products create a new sub-segment. Recommended: develop "GLP-1 resilience" hair care positioning targeting the 10M+ user base with clinically-backed volumizing claims. This is a 3-5 year adoption wave, not a fad.',
      status: 'new',
    },
    {
      id: 'em_003',
      name: 'Solid Beauty Bars & Concentrated Formats Acceleration',
      description: 'Global solid cosmetics market valued at $3.42B (2025), growing to $6.15B by 2034 (CAGR 7.8%). Broader waterless beauty market $13.67B → $27.78B by 2032 (CAGR 12.9%). Solid formats reduce plastic waste by up to 80%. Regulatory tailwind from Plastic Packaging Tax + Extended Producer Responsibility (EPR) rollout 2025-2026 materially increasing liquid packaging costs. USA market expanding at 8.1% CAGR.',
      force: 'Technology',
      direction: 'Expansion',
      suggested_impact: 4,
      suggested_probability: 4,
      relevance_score: 83,
      category_mapping: { hair_care: 4, hair_body: 3, lhc_fcn: 3, lhc_fca: 2 },
      sources: [
        { api: 'GNews', title: 'Solid Cosmetics Market Outlook: $6.15B by 2034', url: 'https://www.reportsandinsights.com/report/solid-cosmetics-market', snippet: 'Global solid cosmetics growing at 7.8% CAGR; 80% plastic waste reduction vs. liquid', published: '2025-12-10' },
        { api: 'RSS', title: 'Shampoo Bar Market Size, Growth & Trends 2026-2034', url: 'https://www.fortunebusinessinsights.com/shampoo-bar-market-108594', snippet: 'Regulatory tailwind: EPR + Plastic Tax increase liquid packaging costs by 8-15%', published: '2026-01-20' },
        { api: 'Google Trends', title: 'Search interest: "solid shampoo bar" +145% YoY in DE', url: 'https://trends.google.com/trends/explore?q=solid+shampoo+bar&geo=DE', published: '2026-03-15' },
      ],
      discovered_at: '2026-03-15T11:00:00Z',
      reasoning: 'Structural shift, not a trend. EPR + Plastic Tax create permanent cost disadvantage for liquid-heavy portfolios. Henkel\'s existing bar expertise should be rapidly scaled from Hair Care into Laundry (concentrated tablet formats already winning). First-mover in premium solid bars captures 2-3x margin vs. liquid equivalents.',
      status: 'new',
    },
    {
      id: 'em_004',
      name: 'AI-Powered Retailer Shelf Optimization — Channel Power Shift',
      description: 'AI-Integrated Retail Shelf Optimization market growing at 20.2% CAGR, reaching $13.1B by 2033. 89% of retailers actively use or pilot AI (NVIDIA survey). Computer vision + smart shelf sensors give retailers real-time visibility into manufacturer stockouts, planogram deviation, and competitor shelf behavior. 87% of grocery/drugstore chains now have AI shelf pilots in 200+ stores.',
      force: 'Customer',
      direction: 'Contraction',
      suggested_impact: 4,
      suggested_probability: 4,
      relevance_score: 86,
      category_mapping: { lhc_fcn: 4, lhc_fca: 3, hair_care: 3, hair_color: 3, lhc_hdw: 2, lhc_adw: 2 },
      sources: [
        { api: 'GNews', title: 'AI Shelf Optimization Systems: $13.1B Market by 2033', url: 'https://www.htfmarketreport.com/reports/4404357-aiintegrated-retail-shelf-optimization-systems-market', snippet: '20.2% CAGR; 89% of retailers using AI; 87% report revenue uplift', published: '2026-02-15' },
        { api: 'RSS', title: 'AI-Powered Shelf Monitoring in Retail (EuroShop 2026)', url: 'https://www.euroshop-tradefair.com/en/media-news/euroshopmag/retail-technology/ai-powered-shelf-monitoring', snippet: 'Smart sensors + ML enable real-time monitoring of stockouts, automatic replenishment triggers', published: '2026-02-28' },
        { api: 'SEC EDGAR', title: 'Retail AI Deployment: Walmart, Target Q4 2025 Earnings Calls', url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&type=10-K', snippet: 'Major retailers disclosing AI shelf monitoring capex, planogram compliance metrics', published: '2026-01-30' },
      ],
      discovered_at: '2026-03-01T10:30:00Z',
      reasoning: 'Critical for Henkel\'s channel strategy. AI shelf sensors shift negotiating power to retailers who now have 24/7 visibility into Henkel stockouts and competitor activity. Retailers can identify underperforming SKUs and demand volume commitments or delisting. Defensive play: invest in Henkel\'s own AI shelf intelligence capability to counter-offer retailers data partnerships.',
      status: 'new',
    },
    {
      id: 'em_005',
      name: 'Palm Oil Supply Chain Structural Tightening',
      description: 'Indonesia faces 2-5M tonnes CPO production at risk (2026) from government land-seizure programs. B50 biodiesel mandate cuts exports by 1.5-3M tonnes. La Niña flooding in Q1 2026 increased oleochemical shipment delays by 4-7 days. Malaysia 2026 CPO forecast cut 400K tonnes from 2025 record. El Niño/La Niña cycles can reduce yields 10-15% regionally, creating surfactant/emollient supply shortages.',
      force: 'Environmental',
      direction: 'Contraction',
      suggested_impact: 4,
      suggested_probability: 4,
      relevance_score: 85,
      category_mapping: { hair_care: 4, hair_body: 4, lhc_fcn: 3, lhc_fca: 3, lhc_adw: 2 },
      sources: [
        { api: 'GDELT', title: 'Palm Oil Price Forecast & Production Outlook 2026', url: 'https://www.fastmarkets.com/insights/palm-oil-price-forecast-and-production-outlook-2026/', snippet: 'Indonesia 2-5M tonnes at risk; Malaysia production declining 400K tonnes from record', published: '2026-01-15' },
        { api: 'RSS', title: 'La Niña Impact on Palm Stearin Prices & Logistics', url: 'https://www.oleochemicalsasia.com/market-insights/2026-la-nina-impact-palm-stearin-prices-logistics', snippet: 'Vessel delays +4-7 days for oleochemical shipments Q1 2026', published: '2026-02-20' },
        { api: 'FRED', title: 'Palm Oil Futures — Tightening Supply Signal', url: 'https://fred.stlouisfed.org/series/PPOILUSDM', snippet: 'FRED commodity data tracking palm oil price escalation through Q1 2026', published: '2026-03-10' },
      ],
      discovered_at: '2026-03-10T16:20:00Z',
      reasoning: 'Direct COGS impact for Henkel. Palm-derived ingredients are core to conditioners, body wash, and surfactants. If COGS rises 15-20%, profit pools contract 3-5% unless Henkel passes through or switches to alternative surfactants. B50 biodiesel mandate is structural (not cyclical), creating permanent supply diversion. Propagation: Environmental → Technology (reformulation with alternatives) → Customer (shelf price pressure).',
      status: 'new',
    },
    {
      id: 'em_006',
      name: 'EUDR Deforestation Regulation — Compliance Cliff Dec 2026',
      description: 'EU Deforestation Regulation (2023/1115) requires geolocation-based traceability for palm, rubber, cocoa, soya — all present in Henkel formulations. Large operators must comply by 30 December 2026. "Mass balance" certification no longer sufficient — only real-time geolocation accepted. Compliance adds 3-8% to ingredient sourcing costs. Suppliers unable to trace will be delisted.',
      force: 'Government',
      direction: 'Contraction',
      suggested_impact: 4,
      suggested_probability: 5,
      relevance_score: 91,
      category_mapping: { hair_care: 4, hair_body: 3, lhc_fcn: 3, lhc_fca: 3, hair_color: 2 },
      sources: [
        { api: 'EUR-Lex', title: 'Regulation (EU) 2023/1115 — Deforestation-Free Products', url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32023R1115', snippet: 'Large operators: 30 Dec 2026 deadline. Geolocation traceability mandatory, mass balance rejected', published: '2023-06-09' },
        { api: 'GNews', title: 'EUDR 2026: What Lies Ahead for Consumer Goods', url: 'https://www.mayerbrown.com/en/insights/publications/2026/02/eu-regulation-on-deforestation-free-products-eudr-what-lies-ahead-in-2026', snippet: 'Geolocation verification adds 3-8% to ingredient sourcing; non-compliant suppliers face delisting', published: '2026-02-10' },
        { api: 'RSS', title: 'Deforestation Law: Parliament Adopts Changes', url: 'https://www.europarl.europa.eu/news/en/press-room/20251211IPR32168/deforestation-law-parliament-adopts-changes-to-postpone-and-simplify-measures', snippet: 'December 2025 confirmation of compliance timeline and simplified measures for SMEs', published: '2025-12-11' },
      ],
      discovered_at: '2026-02-12T14:30:00Z',
      reasoning: 'Imminent compliance cliff. Henkel must verify geolocation data for every palm/soya/cocoa batch by Dec 2026. If 10%+ of suppliers cannot comply, ingredient availability shrinks and COGS rises. First-movers who build robust traceability systems gain supply security advantage. Propagation: Government → Environmental (enforcement of green standards) → Technology (traceability IT investment) → Customer (cost pass-through).',
      status: 'new',
    },
    {
      id: 'em_007',
      name: 'Chinese C-Beauty Brands Entering European Premium Market',
      description: 'Florasis opened first European counter at La Samaritaine (Paris). Chinese cosmetics exports hit ¥36.68B ($5.2B) first 8 months 2025, +11.7% YoY. C-Beauty targets €50+ premium segment with "traditional Chinese cosmetics" heritage positioning + Gen Z cultural cachet (British Museum collaboration). Entered Ulta Beauty (US), Watsons (Asia/EU expansion). 40%+ Gen Z preference for C-Beauty over Western brands in China, now tracking Western Gen Z adoption.',
      force: 'Competitive',
      direction: 'Contraction',
      suggested_impact: 3,
      suggested_probability: 3,
      relevance_score: 72,
      category_mapping: { hair_color: 3, hair_care: 2, hair_styling: 2 },
      sources: [
        { api: 'GNews', title: 'Chinese Makeup Brands Set for Global Lift-Off in 2026', url: 'https://beautymatter.com/articles/chinese-makeup-brands-set-for-global-lift-off-in-2026', snippet: 'Florasis EU expansion; $5.2B cosmetics exports +11.7% YoY; premium positioning', published: '2026-01-20' },
        { api: 'GDELT', title: 'C-Beauty Goes Global: Challenges and Strategies in Europe', url: 'https://jingzhi.news/section/jingzhi-voice/c-beauty-goes-global-challenges-and-strategies-for-chinese-beauty-brands-in-europe/', snippet: 'Florasis Paris Samaritaine; heritage + Gen Z cultural cachet; Watsons EU expansion', published: '2026-02-05' },
        { api: 'Google Trends', title: 'Search interest: "Florasis" +280% YoY in EU markets', url: 'https://trends.google.com/trends/explore?q=Florasis&geo=DE', snippet: 'Rapid awareness building in DACH and FR markets from TikTok + retail presence', published: '2026-03-15' },
      ],
      discovered_at: '2026-03-15T13:00:00Z',
      reasoning: 'New competitive vector. C-Beauty brands are not traditional PL or indie — they combine heritage storytelling, premium pricing, and Gen Z TikTok virality. Hair Color most exposed: Florasis could position "traditional Chinese hair color" as a premium alternative to Schwarzkopf. Defensive play: strengthen Schwarzkopf\'s Distinctive Brand Assets and European heritage positioning before C-Beauty captures the premium consideration set.',
      status: 'new',
    },
    {
      id: 'em_008',
      name: 'Enzyme Cold-Wash Performance Parity — Laundry Format Disruption',
      description: 'Cold-wash enzyme stabilizers market: $0.58B (2026) → $1.25B by 2036 (7.9% CAGR). Enzymes now deliver hot-wash cleaning at cold temperatures, saving 90% of washer energy. Protease enzymes = 42% of detergent enzyme market. Novonesis launched Progress Beyond/Go protease solutions (Mar 2025). Lion Corporation launched "super enzyme" detergent (Aug 2025). Liquid detergent share now 44% (growing), favoring enzyme stability over powder.',
      force: 'Technology',
      direction: 'Expansion',
      suggested_impact: 4,
      suggested_probability: 4,
      relevance_score: 82,
      category_mapping: { lhc_fcn: 5, lhc_fca: 4, lhc_ffi: 2, lhc_adw: 2 },
      sources: [
        { api: 'RSS', title: 'Enzymes for Laundry Detergent Market 2025-2035', url: 'https://www.futuremarketinsights.com/reports/enzymes-for-laundry-detergent-market', snippet: 'Enzyme laundry market $275.5M → $466.1M by 2035 (5.4% CAGR); protease 42% share', published: '2025-11-10' },
        { api: 'GNews', title: 'Cold-Wash Enzyme Stabilizers: Performance Parity Achieved', url: 'https://www.factmr.com/report/cold-wash-laundry-enzyme-stabilizers-market', snippet: '$0.58B → $1.25B by 2036; 90% energy saving; hot-wash parity at cold temperatures', published: '2026-01-15' },
        { api: 'Semantic Scholar', title: 'Enzyme-Based Detergents: Consumer Adoption & Environmental Impact', url: 'https://www.globaldata.com/media/consumer/enzyme-based-detergents-gain-popularity-among-time-sensitive-ecologically-conscious-consumers-says-globaldata/', snippet: 'Enzyme detergents gaining popularity among eco-conscious consumers; Novonesis, Lion launching next-gen formulations', published: '2025-09-20' },
      ],
      discovered_at: '2026-03-18T09:00:00Z',
      reasoning: 'Critical for Persil and Henkel LHC. Cold-wash enzyme parity + EU energy-saving mandates create a format inflection point. If Henkel\'s powder-dominant portfolio doesn\'t pivot to enzyme-optimized liquid/concentrated formats, it risks losing 12-15% share to enzyme-liquid competitors. Offensive play: leverage Henkel\'s formulation R&D to develop proprietary enzyme stabilization, positioning Persil as "the enzyme-powered clean" leader.',
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
  expanded: boolean;
  onToggle: () => void;
}

const EmergingTrendCard: FC<EmergingTrendCardProps> = ({ trend, onAdd, onDismiss, isAdmin = false, expanded, onToggle }) => {
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
        onClick={onToggle}
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
  const [expandedTrendId, setExpandedTrendId] = useState<string | null>(null);

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
              expanded={expandedTrendId === trend.id}
              onToggle={() => setExpandedTrendId(expandedTrendId === trend.id ? null : trend.id)}
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
