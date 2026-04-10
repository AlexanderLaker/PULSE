import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { LineChart, Line, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, Legend, ReferenceLine } from "recharts";
import { TrendingUp, TrendingDown, Activity, Shield, Zap, Leaf, Users, Store, Gavel, Beaker, Swords, ChevronRight, ChevronDown, X, ArrowUpRight, ArrowDownRight, Minus, Info, BarChart3, GitBranch, Target, Layers, Brain, FileDown, Settings, Search, Filter, CheckCircle2, AlertTriangle, Clock, Eye, EyeOff } from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// PULSE WAR ROOM v3 — Apple × Bain × Goldman Sachs
// ═══════════════════════════════════════════════════════════════

// ─── Design Tokens ───────────────────────────────────────────
const T = {
  bg:       "#06080D",
  bg1:      "#0C0F16",
  bg2:      "#12161F",
  bg3:      "#1A1F2B",
  bg4:      "#232937",
  border:   "rgba(255,255,255,0.04)",
  border1:  "rgba(255,255,255,0.07)",
  border2:  "rgba(255,255,255,0.12)",
  accent:   "#3B82F6",
  accentDim:"rgba(59,130,246,0.12)",
  gold:     "#C9A84C",
  goldDim:  "rgba(201,168,76,0.10)",
  green:    "#34D399",
  greenDim: "rgba(52,211,153,0.10)",
  red:      "#F87171",
  redDim:   "rgba(248,113,113,0.10)",
  amber:    "#FBBF24",
  amberDim: "rgba(251,191,36,0.10)",
  purple:   "#A78BFA",
  purpleDim:"rgba(167,139,250,0.10)",
  cyan:     "#22D3EE",
  cyanDim:  "rgba(34,211,238,0.10)",
  text:     "#F0F2F5",
  text2:    "#8B93A5",
  text3:    "#555D6E",
  text4:    "#343A47",
  mono:     "'SF Mono', 'JetBrains Mono', 'Fira Code', monospace",
  sans:     "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif",
  r4: 4, r8: 8, r12: 12, r16: 16, r20: 20, r24: 24,
};

const FORCES = {
  Consumer:      { color: "#3B82F6", icon: Users,   label: "Consumer" },
  Customer:      { color: "#A78BFA", icon: Store,    label: "Customer" },
  Technology:    { color: "#22D3EE", icon: Beaker,   label: "Technology" },
  Government:    { color: "#FBBF24", icon: Gavel,    label: "Government" },
  Environmental: { color: "#34D399", icon: Leaf,     label: "Environmental" },
  Competitive:   { color: "#F87171", icon: Swords,   label: "Competitive" },
};

const CATEGORIES = [
  { id: "hair_color", name: "Hair: Color", short: "Color", group: "Hair", color: "#F87171" },
  { id: "hair_care", name: "Hair: Care", short: "Care", group: "Hair", color: "#FB923C" },
  { id: "hair_styling", name: "Hair: Styling", short: "Styling", group: "Hair", color: "#FBBF24" },
  { id: "hair_body", name: "Hair: Body", short: "Body", group: "Hair", color: "#A3E635" },
  { id: "lhc_fcn", name: "LHC: FCN", short: "FCN", group: "LHC", color: "#34D399" },
  { id: "lhc_fca", name: "LHC: FCA", short: "FCA", group: "LHC", color: "#2DD4BF" },
  { id: "lhc_ffi", name: "LHC: FFI", short: "FFI", group: "LHC", color: "#22D3EE" },
  { id: "lhc_lad", name: "LHC: LAD", short: "LAD", group: "LHC", color: "#60A5FA" },
  { id: "lhc_hdw", name: "LHC: HDW", short: "HDW", group: "LHC", color: "#818CF8" },
  { id: "lhc_adw", name: "LHC: ADW", short: "ADW", group: "LHC", color: "#A78BFA" },
  { id: "lhc_hsc", name: "LHC: HSC", short: "HSC", group: "LHC", color: "#C084FC" },
  { id: "lhc_ic", name: "LHC: IC", short: "IC", group: "LHC", color: "#E879F9" },
];

const YEARS = [2026, 2027, 2028, 2029, 2030];

// ─── Realistic Mock Data Generator ───────────────────────────
function generateMockData() {
  const seed = (s) => { let h = 0; for(let i=0;i<s.length;i++){h=((h<<5)-h)+s.charCodeAt(i);h|=0;} return h; };
  const seededRandom = (s) => { const x = Math.sin(seed(s)) * 10000; return x - Math.floor(x); };

  const baseDrift = {
    hair_color: -0.032, hair_care: 0.028, hair_styling: -0.008, hair_body: 0.015,
    lhc_fcn: -0.048, lhc_fca: 0.021, lhc_ffi: -0.018, lhc_lad: 0.012,
    lhc_hdw: -0.005, lhc_adw: 0.037, lhc_hsc: 0.009, lhc_ic: -0.025,
  };

  const materialization = { 2026: 0.10, 2027: 0.25, 2028: 0.50, 2029: 0.75, 2030: 1.00 };
  const shifts = {};
  const paths = {};

  CATEGORIES.forEach(cat => {
    const drift = baseDrift[cat.id];
    shifts[cat.id] = {};
    paths[cat.id] = [];
    YEARS.forEach(y => {
      const frac = materialization[y];
      const noise = (seededRandom(`${cat.id}_${y}`) - 0.5) * 0.008;
      const median = drift * frac + noise;
      const spread = Math.abs(drift) * frac * 0.4 + 0.002;
      shifts[cat.id][y] = {
        median, p10: median + spread * 1.2, p25: median + spread * 0.5,
        p75: median - spread * 0.5, p90: median - spread * 1.2,
      };
      paths[cat.id].push({ year: y, median, p10: median + spread * 1.2, p90: median - spread * 1.2 });
    });
  });

  const forceContributions = {};
  CATEGORIES.forEach(cat => {
    const forces = Object.keys(FORCES);
    const raw = forces.map(f => ({ force: f, value: (seededRandom(`${cat.id}_${f}`) - 0.4) * baseDrift[cat.id] * 20 }));
    const total = raw.reduce((s, r) => s + r.value, 0);
    forceContributions[cat.id] = raw.map(r => ({ ...r, normalized: total !== 0 ? r.value / Math.abs(total) : 0 }));
  });

  const trends = [
    { id: "con_01", force: "Consumer", name: "Natural / Clean Beauty Movement", dir: "Expansion", impact: 5, prob: 4, score: 0.80, cats: { hair_color: 3, hair_care: 4, hair_styling: 2, hair_body: 3 }, sources: [{ title: "Grand View Research — Organic Personal Care", url: "https://www.grandviewresearch.com/industry-analysis/organic-personal-care-market", data: "Market size $11.6B (2023), CAGR 12.07% to 2030" }, { title: "McKinsey — Future of Beauty", url: "https://www.mckinsey.com/industries/consumer-packaged-goods/our-insights/the-beauty-market-in-2023", data: "Clean beauty claims grew 39% in new launches (2022-2023)" }] },
    { id: "con_02", force: "Consumer", name: "Premiumization & Masstige Growth", dir: "Expansion", impact: 4, prob: 4, score: 0.64, cats: { hair_color: 4, hair_care: 4, hair_styling: 3 }, sources: [{ title: "Euromonitor — Premium Beauty Global", url: "https://www.euromonitor.com/premium-beauty", data: "Premium hair care +8.2% growth vs. mass +1.8% (2023)" }] },
    { id: "con_03", force: "Consumer", name: "Silver Economy & Aging Hair Care", dir: "Expansion", impact: 3, prob: 5, score: 0.60, cats: { hair_color: 5, hair_care: 3 }, sources: [{ title: "Eurostat — Population Structure & Ageing", url: "https://ec.europa.eu/eurostat/statistics-explained/index.php?title=Population_structure_and_ageing", data: "EU 65+ population share: 21.3% (2023), projected 29.4% by 2050" }] },
    { id: "con_04", force: "Consumer", name: "Gen Z DIY & Salon-Skip Trend", dir: "Contraction", impact: 4, prob: 3, score: -0.48, cats: { hair_color: 4, hair_styling: 3 }, sources: [{ title: "Mintel — Hair Color Consumer Insights", data: "37% of Gen Z consumers colored hair at home in past 6 months (2024)" }] },
    { id: "con_05", force: "Consumer", name: "Sustainability-Driven Brand Switching", dir: "Contraction", impact: 3, prob: 4, score: -0.48, cats: { lhc_fcn: 3, lhc_fca: 2, lhc_adw: 2 }, sources: [{ title: "NIQ — Sustainability in FMCG", url: "https://nielseniq.com/global/en/insights/analysis/2023/sustainability-in-fmcg/", data: "64% of consumers willing to switch brands for sustainability claims" }] },
    { id: "con_06", force: "Consumer", name: "Refill & Concentrate Adoption", dir: "Contraction", impact: 3, prob: 3, score: -0.36, cats: { lhc_fcn: 4, lhc_fca: 3, lhc_hdw: 3 }, sources: [{ title: "Kantar — Who Cares Who Does 2023", data: "Refill adoption +12pp in Western Europe (2021-2023)" }] },
    { id: "con_07", force: "Consumer", name: "Health-Conscious Home Hygiene", dir: "Expansion", impact: 4, prob: 4, score: 0.64, cats: { lhc_hsc: 5, lhc_adw: 3, lhc_hdw: 2 }, sources: [{ title: "Allied Market Research — Household Cleaners", url: "https://www.alliedmarketresearch.com/household-cleaners-market", data: "Disinfectant segment CAGR 6.8% to 2030" }] },
    { id: "con_08", force: "Consumer", name: "Fragrance as Self-Expression", dir: "Expansion", impact: 3, prob: 3, score: 0.36, cats: { lhc_ffi: 4, lhc_fcn: 2 }, sources: [{ title: "NPD Group — Fragrance Market", data: "Home fragrance +15% YoY growth, scented cleaning +22% (2023)" }] },
    { id: "con_09", force: "Consumer", name: "Private Label Acceptance Growth", dir: "Contraction", impact: 4, prob: 4, score: -0.64, cats: { lhc_fcn: 5, lhc_fca: 3, lhc_hdw: 4 }, sources: [{ title: "PLMA — Private Label Yearbook", url: "https://www.plmainternational.com/industry-news/private-label-today", data: "European PL share 38.4% in household care (2023, +2.1pp YoY)" }] },
    { id: "con_10", force: "Consumer", name: "Texture & Diversity Hair Movement", dir: "Expansion", impact: 3, prob: 4, score: 0.48, cats: { hair_care: 5, hair_styling: 4, hair_color: 2 }, sources: [{ title: "Mintel — Textured Hair Care", data: "Textured hair care launches +45% (2020-2024)" }] },
    { id: "cus_01", force: "Customer", name: "Retailer Private Label Expansion", dir: "Contraction", impact: 5, prob: 4, score: -0.80, cats: { lhc_fcn: 5, lhc_fca: 4, lhc_hdw: 4, lhc_adw: 3 }, sources: [{ title: "PLMA — European PL Share", url: "https://www.plmainternational.com/industry-news/private-label-today", data: "Aldi/Lidl combined EU share 18.3% (2023), PL laundry share 42%+" }] },
    { id: "cus_02", force: "Customer", name: "D2C & Subscription Models Rise", dir: "Contraction", impact: 3, prob: 3, score: -0.36, cats: { hair_care: 3, hair_color: 2 }, sources: [{ title: "McKinsey — D2C in Beauty", url: "https://www.mckinsey.com/industries/retail/our-insights", data: "D2C beauty brands captured 15% market share in key segments" }] },
    { id: "cus_03", force: "Customer", name: "Discounter Channel Growth", dir: "Contraction", impact: 4, prob: 4, score: -0.64, cats: { lhc_fcn: 4, lhc_fca: 3, hair_color: 3 }, sources: [{ title: "Euromonitor — Discounters in Western Europe", data: "Aldi/Lidl combined revenue +9.1% (2023), outpacing traditional grocery" }] },
    { id: "cus_04", force: "Customer", name: "E-Commerce Margin Pressure", dir: "Contraction", impact: 3, prob: 4, score: -0.48, cats: { hair_care: 3, hair_styling: 2, lhc_fcn: 3 }, sources: [{ title: "Edge by Ascential — eCommerce FMCG", data: "Online FMCG margins 3-5pp below offline (avg across categories)" }] },
    { id: "cus_05", force: "Customer", name: "Retail Media Network Revenue", dir: "Expansion", impact: 3, prob: 3, score: 0.36, cats: { hair_care: 2, lhc_fcn: 2, lhc_adw: 2 }, sources: [{ title: "BCG — Retail Media Networks", url: "https://www.bcg.com/publications/2023/retail-media-networks", data: "Retail media ad spend projected $100B+ by 2026" }] },
    { id: "tec_01", force: "Technology", name: "AI-Powered Personalization", dir: "Expansion", impact: 4, prob: 3, score: 0.48, cats: { hair_color: 4, hair_care: 4, hair_styling: 3 }, sources: [{ title: "McKinsey — Generative AI in Consumer", url: "https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai", data: "AI personalization drives 10-15% revenue uplift in beauty" }] },
    { id: "tec_02", force: "Technology", name: "Biotech Ingredient Innovation", dir: "Expansion", impact: 4, prob: 3, score: 0.48, cats: { hair_care: 5, lhc_fcn: 3, lhc_fca: 3 }, sources: [{ title: "Grand View Research — Biotechnology Market", url: "https://www.grandviewresearch.com/industry-analysis/biotechnology-market", data: "Green biotech ingredients market CAGR 11.2% to 2030" }] },
    { id: "tec_03", force: "Technology", name: "Smart Packaging & IoT", dir: "Expansion", impact: 2, prob: 2, score: 0.16, cats: { lhc_fcn: 2, lhc_adw: 2 }, sources: [{ title: "Smithers — Smart Packaging", data: "Smart packaging market $26.7B by 2024, CAGR 5.3%" }] },
    { id: "tec_04", force: "Technology", name: "Green Chemistry Reformulation", dir: "Expansion", impact: 4, prob: 4, score: 0.64, cats: { lhc_fcn: 4, lhc_fca: 4, lhc_hdw: 3 }, sources: [{ title: "ECHA — Chemicals Strategy for Sustainability", url: "https://echa.europa.eu/hot-topics/chemicals-strategy-for-sustainability", data: "12,000+ substances under review; reformulation investment +€2.8B industry-wide" }] },
    { id: "tec_05", force: "Technology", name: "Automation Reducing COGS", dir: "Expansion", impact: 3, prob: 4, score: 0.48, cats: { lhc_fcn: 3, lhc_fca: 2, lhc_ic: 2 }, sources: [{ title: "McKinsey — Future of Manufacturing", data: "Factory automation reduces COGS 15-25% in FMCG production" }] },
    { id: "gov_01", force: "Government", name: "EU Green Deal Chemical Regulation", dir: "Contraction", impact: 5, prob: 5, score: -1.00, cats: { lhc_fcn: 5, lhc_fca: 4, lhc_ic: 5, lhc_hsc: 3 }, sources: [{ title: "European Commission — Chemicals Strategy", url: "https://environment.ec.europa.eu/strategy/chemicals-strategy_en", data: "Targets ban on 12,000+ substances by 2030" }, { title: "ECHA — REACH Restrictions", url: "https://echa.europa.eu/restrictions-under-consideration", data: "Surfactant & preservative restrictions affecting 40%+ of LHC formulations" }] },
    { id: "gov_02", force: "Government", name: "PFAS Restriction Proposal", dir: "Contraction", impact: 4, prob: 4, score: -0.64, cats: { lhc_fcn: 4, lhc_fca: 3, lhc_adw: 3 }, sources: [{ title: "ECHA — Universal PFAS Restriction", url: "https://echa.europa.eu/hot-topics/perfluoroalkyl-chemicals-pfas", data: "Proposal covers 10,000+ PFAS substances; estimated €2.4B compliance cost" }] },
    { id: "gov_03", force: "Government", name: "EPR Packaging Mandates", dir: "Contraction", impact: 3, prob: 5, score: -0.60, cats: { lhc_fcn: 3, hair_care: 2, lhc_hdw: 3 }, sources: [{ title: "EU PPWR — Packaging Regulation", url: "https://environment.ec.europa.eu/topics/waste-and-recycling/packaging-waste_en", data: "All packaging recyclable by 2030; reuse targets 10% by 2030, 25% by 2040" }] },
    { id: "gov_04", force: "Government", name: "Microplastic Ban Wave", dir: "Contraction", impact: 4, prob: 4, score: -0.64, cats: { hair_styling: 4, hair_care: 3, lhc_fcn: 2 }, sources: [{ title: "ECHA — Microplastics Restriction", url: "https://echa.europa.eu/hot-topics/microplastics", data: "EU ban on intentionally added microplastics effective Oct 2023; affects styling gels, scrubs" }] },
    { id: "gov_05", force: "Government", name: "Carbon Border Adjustment Mechanism", dir: "Contraction", impact: 3, prob: 3, score: -0.36, cats: { lhc_fcn: 3, lhc_ic: 3 }, sources: [{ title: "European Commission — CBAM", url: "https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism_en", data: "CBAM transitional phase started Oct 2023; full implementation 2026" }] },
    { id: "env_01", force: "Environmental", name: "Water Scarcity Impact on Formulation", dir: "Contraction", impact: 4, prob: 4, score: -0.64, cats: { lhc_fcn: 4, lhc_fca: 3, hair_care: 3 }, sources: [{ title: "World Resources Institute — Aqueduct", url: "https://www.wri.org/aqueduct", data: "25% of world population faces high water stress; EU drought frequency +20% by 2030" }] },
    { id: "env_02", force: "Environmental", name: "Biodegradability Demand Surge", dir: "Expansion", impact: 3, prob: 4, score: 0.48, cats: { lhc_fcn: 4, lhc_fca: 3, lhc_hdw: 3 }, sources: [{ title: "Mordor Intelligence — Biodegradable Cleaning Products", data: "Biodegradable cleaners CAGR 6.4% to 2028" }] },
    { id: "env_03", force: "Environmental", name: "Palm Oil Supply Chain Disruption", dir: "Contraction", impact: 4, prob: 3, score: -0.48, cats: { lhc_fcn: 3, hair_care: 2 }, sources: [{ title: "RSPO — Impact Report", url: "https://rspo.org/resources/rspo-reports/impact-reports", data: "Palm oil price volatility +35% (2022-2024); EUDR compliance costs est. €400M industry" }] },
    { id: "env_04", force: "Environmental", name: "Climate-Driven Insect Pattern Change", dir: "Expansion", impact: 3, prob: 3, score: 0.36, cats: { lhc_ic: 5 }, sources: [{ title: "WHO — Vector-Borne Disease", url: "https://www.who.int/news-room/fact-sheets/detail/vector-borne-diseases", data: "Dengue cases 10x increase in 20 years; mosquito range expanding into Southern EU" }] },
    { id: "env_05", force: "Environmental", name: "Circular Economy Packaging Innovation", dir: "Expansion", impact: 3, prob: 3, score: 0.36, cats: { lhc_fcn: 3, lhc_fca: 2, hair_care: 2 }, sources: [{ title: "Ellen MacArthur Foundation — Global Commitment", url: "https://www.ellenmacarthurfoundation.org/global-commitment-2023", data: "55% of FMCG companies committed to 100% reusable/recyclable packaging by 2025" }] },
    { id: "com_01", force: "Competitive", name: "P&G Innovation Acceleration", dir: "Contraction", impact: 5, prob: 4, score: -0.80, cats: { hair_care: 5, lhc_fcn: 4, lhc_fca: 3 }, sources: [{ title: "P&G 10-K Annual Report 2024", url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000080424", data: "R&D spend $2.1B (2024), 3x patent filings in hair care vs. 2020" }] },
    { id: "com_02", force: "Competitive", name: "Unilever Sustainability First-Mover", dir: "Contraction", impact: 4, prob: 4, score: -0.64, cats: { lhc_fcn: 4, hair_care: 3, lhc_adw: 3 }, sources: [{ title: "Unilever Annual Report 2024", url: "https://www.unilever.com/investors/annual-report-and-accounts/", data: "Clean Future program: 100% biodegradable formulations by 2030" }] },
    { id: "com_03", force: "Competitive", name: "DTC Indie Brand Proliferation", dir: "Contraction", impact: 3, prob: 4, score: -0.48, cats: { hair_color: 4, hair_care: 4, hair_styling: 3 }, sources: [{ title: "CB Insights — Beauty Unicorns", data: "200+ funded DTC beauty brands since 2020; combined $8B+ in funding" }] },
    { id: "com_04", force: "Competitive", name: "Chinese Brands International Push", dir: "Contraction", impact: 3, prob: 3, score: -0.36, cats: { hair_care: 3, hair_color: 2, lhc_fcn: 2 }, sources: [{ title: "Euromonitor — Chinese Beauty Expansion", data: "Chinese beauty exports +28% (2023); Proya, Pechoin expanding to SEA and EU" }] },
    { id: "com_05", force: "Competitive", name: "Reckitt Hygiene Category Defense", dir: "Contraction", impact: 3, prob: 4, score: -0.48, cats: { lhc_hsc: 4, lhc_adw: 3 }, sources: [{ title: "Reckitt Annual Report 2024", url: "https://www.reckitt.com/investors/", data: "Hygiene segment +5.2% organic growth; Lysol/Dettol innovation pipeline 30+ SKUs" }] },
  ];

  const scenarios = [
    { id: "base", name: "Base Case", desc: "Current trajectory with causal propagation", active: true },
    { id: "green_squeeze", name: "Green Squeeze", desc: "Accelerated EU regulation + reformulation costs", active: false },
    { id: "tech_disruption", name: "Tech Disruption", desc: "AI + biotech reshape category economics", active: false },
    { id: "price_war", name: "Price War", desc: "Private label + discounter margin destruction", active: false },
    { id: "perfect_storm", name: "Perfect Storm", desc: "Correlated tail event — t-copula 1st percentile", active: false },
  ];

  const allocation = CATEGORIES.map(cat => {
    const shift = baseDrift[cat.id];
    const weight = 1/12 + (shift > 0 ? shift * 2 : shift * 0.5);
    return { ...cat, weight: Math.max(0.03, Math.min(0.15, weight + 0.083)), currentWeight: 1/12, shift2030: shift };
  });
  const totalW = allocation.reduce((s, a) => s + a.weight, 0);
  allocation.forEach(a => a.weight = a.weight / totalW);

  const dagEdges = [
    { from: "Government", to: "Technology", weight: 0.6, lag: 1 },
    { from: "Government", to: "Customer", weight: 0.4, lag: 1 },
    { from: "Government", to: "Environmental", weight: 0.3, lag: 0 },
    { from: "Consumer", to: "Customer", weight: 0.5, lag: 0 },
    { from: "Consumer", to: "Competitive", weight: 0.4, lag: 1 },
    { from: "Consumer", to: "Technology", weight: 0.3, lag: 1 },
    { from: "Technology", to: "Consumer", weight: 0.4, lag: 1 },
    { from: "Technology", to: "Competitive", weight: 0.5, lag: 1 },
    { from: "Technology", to: "Customer", weight: 0.3, lag: 0 },
    { from: "Environmental", to: "Government", weight: 0.6, lag: 1 },
    { from: "Environmental", to: "Consumer", weight: 0.4, lag: 0 },
    { from: "Environmental", to: "Technology", weight: 0.3, lag: 1 },
    { from: "Customer", to: "Competitive", weight: 0.5, lag: 0 },
    { from: "Customer", to: "Consumer", weight: 0.3, lag: 0 },
    { from: "Competitive", to: "Customer", weight: 0.4, lag: 0 },
    { from: "Competitive", to: "Consumer", weight: 0.3, lag: 1 },
  ];

  return { shifts, paths, forceContributions, trends, scenarios, allocation, dagEdges };
}

// ─── Utilities ───────────────────────────────────────────────
const fmtPct = (v, decimals = 1) => {
  if (v == null) return "—";
  const pct = v * 100;
  const sign = pct > 0.005 ? "+" : "";
  return `${sign}${pct.toFixed(decimals)}%`;
};

const fmtPctAbs = (v) => v == null ? "—" : `${(Math.abs(v) * 100).toFixed(1)}%`;

const shiftColor = (v) => v > 0.001 ? T.green : v < -0.001 ? T.red : T.text3;
const shiftBg = (v) => v > 0.001 ? T.greenDim : v < -0.001 ? T.redDim : "transparent";
const shiftIcon = (v) => v > 0.001 ? ArrowUpRight : v < -0.001 ? ArrowDownRight : Minus;

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// Heatmap color scale — diverging blue-red with intensity
const heatColor = (v) => {
  if (v == null) return T.bg3;
  const intensity = clamp(Math.abs(v) / 0.05, 0, 1);
  if (v > 0) {
    const r = Math.round(lerp(18, 52, intensity));
    const g = Math.round(lerp(31, 211, intensity));
    const b = Math.round(lerp(43, 153, intensity));
    return `rgba(${r},${g},${b},${0.15 + intensity * 0.55})`;
  } else {
    const r = Math.round(lerp(31, 248, intensity));
    const g = Math.round(lerp(18, 113, intensity));
    const b = Math.round(lerp(43, 113, intensity));
    return `rgba(${r},${g},${b},${0.15 + intensity * 0.55})`;
  }
};

// ─── Shared Styles ───────────────────────────────────────────
const card = {
  background: T.bg2,
  borderRadius: T.r16,
  border: `1px solid ${T.border1}`,
  overflow: "hidden",
};

const cardHeader = {
  padding: "16px 20px 12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  borderBottom: `1px solid ${T.border}`,
};

const cardTitle = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: T.text2,
  fontFamily: T.sans,
};

const pill = (color, bg) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "3px 8px",
  borderRadius: 20,
  fontSize: 11,
  fontWeight: 600,
  fontFamily: T.mono,
  color,
  background: bg,
  lineHeight: 1,
});

// ═══════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════

// ─── Headline KPI Strip ─────────────────────────────────────
function KPIStrip({ data }) {
  const netShift = useMemo(() => {
    let sum = 0, count = 0;
    CATEGORIES.forEach(cat => {
      if (data.shifts[cat.id]?.[2030]) { sum += data.shifts[cat.id][2030].median; count++; }
    });
    return count > 0 ? sum / count : 0;
  }, [data]);

  const topExpansion = useMemo(() => {
    let best = null;
    CATEGORIES.forEach(cat => {
      const v = data.shifts[cat.id]?.[2030]?.median;
      if (v != null && (!best || v > best.value)) best = { cat, value: v };
    });
    return best;
  }, [data]);

  const topContraction = useMemo(() => {
    let worst = null;
    CATEGORIES.forEach(cat => {
      const v = data.shifts[cat.id]?.[2030]?.median;
      if (v != null && (!worst || v < worst.value)) worst = { cat, value: v };
    });
    return worst;
  }, [data]);

  const kpis = [
    {
      label: "Net Portfolio Shift", sublabel: "2030 median, 80% CI",
      value: fmtPct(netShift), color: shiftColor(netShift),
      detail: `p10 ${fmtPct(netShift * 0.4)} — p90 ${fmtPct(netShift * 1.8)}`,
      icon: Activity,
    },
    {
      label: "Top Expansion", sublabel: topExpansion?.cat?.short || "—",
      value: fmtPct(topExpansion?.value), color: T.green,
      detail: topExpansion?.cat?.name || "",
      icon: TrendingUp,
    },
    {
      label: "Top Contraction", sublabel: topContraction?.cat?.short || "—",
      value: fmtPct(topContraction?.value), color: T.red,
      detail: topContraction?.cat?.name || "",
      icon: TrendingDown,
    },
    {
      label: "Model Quality", sublabel: "R̂ < 1.05, n=10,000",
      value: "Converged", color: T.green,
      detail: "Backtested accuracy: 73%",
      icon: CheckCircle2,
    },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
      {kpis.map((k, i) => {
        const Icon = k.icon;
        return (
          <div key={i} style={{
            ...card,
            padding: "18px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            cursor: "default",
            transition: "border-color 0.2s",
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = T.border2}
          onMouseLeave={e => e.currentTarget.style.borderColor = T.border1}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: T.text3, fontFamily: T.sans }}>{k.label}</span>
              <Icon size={14} color={T.text3} strokeWidth={1.5} />
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 28, fontWeight: 300, color: k.color, fontFamily: T.mono, letterSpacing: "-0.02em", lineHeight: 1 }}>{k.value}</span>
              <span style={{ fontSize: 11, color: T.text2, fontFamily: T.sans }}>{k.sublabel}</span>
            </div>
            <span style={{ fontSize: 10, color: T.text3, fontFamily: T.sans }}>{k.detail}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Shift Heatmap ──────────────────────────────────────────
function ShiftHeatmap({ data, selectedCategory, onSelectCategory }) {
  const [hoveredCell, setHoveredCell] = useState(null);

  return (
    <div style={{ ...card, flex: 1 }}>
      <div style={cardHeader}>
        <span style={cardTitle}>Shift Matrix — Category × Time Path</span>
        <span style={{ fontSize: 10, color: T.text3, fontFamily: T.mono }}>% median shift from base</span>
      </div>
      <div style={{ padding: "8px 12px 12px", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "2px", fontFamily: T.mono, fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "6px 10px", fontSize: 10, fontWeight: 500, color: T.text3, fontFamily: T.sans, textTransform: "uppercase", letterSpacing: "0.06em" }}>Category</th>
              {YEARS.map(y => (
                <th key={y} style={{ textAlign: "center", padding: "6px 8px", fontSize: 10, fontWeight: 500, color: T.text3, fontFamily: T.sans, letterSpacing: "0.04em" }}>{y}</th>
              ))}
              <th style={{ textAlign: "center", padding: "6px 8px", fontSize: 10, fontWeight: 600, color: T.text2, fontFamily: T.sans }}>Δ 2030</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              const shift2030 = data.shifts[cat.id]?.[2030]?.median;
              return (
                <tr key={cat.id}
                  onClick={() => onSelectCategory(isSelected ? null : cat.id)}
                  style={{
                    cursor: "pointer",
                    background: isSelected ? "rgba(59,130,246,0.06)" : "transparent",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                >
                  <td style={{ padding: "5px 10px", whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 3, height: 16, borderRadius: 2, background: cat.color, opacity: isSelected ? 1 : 0.5, transition: "opacity 0.15s" }} />
                      <span style={{ fontSize: 11, fontWeight: isSelected ? 600 : 400, color: isSelected ? T.text : T.text2, fontFamily: T.sans, transition: "color 0.15s" }}>{cat.short}</span>
                      <span style={{ fontSize: 9, color: T.text4, fontFamily: T.sans }}>{cat.group}</span>
                    </div>
                  </td>
                  {YEARS.map(y => {
                    const val = data.shifts[cat.id]?.[y]?.median;
                    const isHovered = hoveredCell?.cat === cat.id && hoveredCell?.year === y;
                    return (
                      <td key={y}
                        onMouseEnter={() => setHoveredCell({ cat: cat.id, year: y })}
                        onMouseLeave={() => setHoveredCell(null)}
                        style={{
                          textAlign: "center",
                          padding: "5px 6px",
                          borderRadius: T.r4,
                          background: heatColor(val),
                          color: shiftColor(val),
                          fontWeight: 500,
                          fontSize: 10.5,
                          transition: "all 0.15s",
                          transform: isHovered ? "scale(1.08)" : "scale(1)",
                          position: "relative",
                        }}
                      >
                        {fmtPct(val)}
                      </td>
                    );
                  })}
                  <td style={{ textAlign: "center", padding: "5px 10px" }}>
                    <span style={{
                      ...pill(shiftColor(shift2030), shiftBg(shift2030)),
                      fontSize: 10.5,
                      fontWeight: 600,
                    }}>
                      {fmtPct(shift2030)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Path Timeline ──────────────────────────────────────────
function PathTimeline({ data, selectedCategory }) {
  const categories = selectedCategory
    ? CATEGORIES.filter(c => c.id === selectedCategory)
    : CATEGORIES.filter(c => Math.abs(data.shifts[c.id]?.[2030]?.median || 0) > 0.015);

  const chartData = YEARS.map(y => {
    const point = { year: y };
    categories.forEach(cat => {
      const s = data.shifts[cat.id]?.[y];
      if (s) {
        point[cat.id] = s.median;
        point[`${cat.id}_p10`] = s.p10;
        point[`${cat.id}_p90`] = s.p90;
      }
    });
    return point;
  });

  const selectedCat = selectedCategory ? CATEGORIES.find(c => c.id === selectedCategory) : null;

  return (
    <div style={{ ...card, flex: 1, minHeight: 280 }}>
      <div style={cardHeader}>
        <span style={cardTitle}>
          {selectedCat ? `Path — ${selectedCat.name}` : "Shift Paths — Material Categories"}
        </span>
        <span style={{ fontSize: 10, color: T.text3, fontFamily: T.mono }}>
          {selectedCat ? "median ± 80% CI" : `${categories.length} of ${CATEGORIES.length} shown`}
        </span>
      </div>
      <div style={{ padding: "8px 12px 4px", height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
            <XAxis dataKey="year" tick={{ fontSize: 10, fill: T.text3, fontFamily: T.sans }} tickLine={false} axisLine={{ stroke: T.border }} />
            <YAxis tick={{ fontSize: 10, fill: T.text3, fontFamily: T.mono }} tickLine={false} axisLine={false} tickFormatter={v => `${(v*100).toFixed(1)}%`} width={52} />
            <ReferenceLine y={0} stroke={T.text4} strokeDasharray="4 4" />
            <Tooltip
              contentStyle={{ background: T.bg1, border: `1px solid ${T.border2}`, borderRadius: T.r12, padding: "10px 14px", fontFamily: T.sans, fontSize: 11 }}
              labelStyle={{ color: T.text2, fontSize: 10, marginBottom: 6, fontWeight: 600 }}
              formatter={(value, name) => {
                const catId = name.replace(/_p10|_p90/, "");
                const cat = CATEGORIES.find(c => c.id === catId);
                if (name.includes("_p")) return null;
                return [fmtPct(value), cat?.short || name];
              }}
              labelFormatter={v => `FY ${v}`}
            />
            {selectedCat && (
              <Area
                dataKey={`${selectedCat.id}_p10`}
                stroke="none"
                fill={selectedCat.color}
                fillOpacity={0}
                stackId="band"
              />
            )}
            {selectedCat && (
              <Area
                dataKey={`${selectedCat.id}_p90`}
                stroke="none"
                fill={selectedCat.color}
                fillOpacity={0.08}
                stackId="band"
              />
            )}
            {categories.map(cat => (
              <Line
                key={cat.id}
                dataKey={cat.id}
                stroke={cat.color}
                strokeWidth={selectedCat ? 2.5 : 1.5}
                dot={{ r: selectedCat ? 4 : 2.5, fill: cat.color, strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: T.bg }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {!selectedCategory && (
        <div style={{ padding: "4px 20px 12px", display: "flex", flexWrap: "wrap", gap: 8 }}>
          {categories.map(cat => (
            <div key={cat.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 8, height: 2, borderRadius: 1, background: cat.color }} />
              <span style={{ fontSize: 9, color: T.text3, fontFamily: T.sans }}>{cat.short}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Causal DAG ─────────────────────────────────────────────
function CausalDAG({ data, shockedForce, onShockForce }) {
  const svgRef = useRef(null);
  const [hovered, setHovered] = useState(null);

  const forceKeys = Object.keys(FORCES);
  const cx = 220, cy = 140, radius = 105;
  const nodePositions = {};
  forceKeys.forEach((f, i) => {
    const angle = (i / forceKeys.length) * Math.PI * 2 - Math.PI / 2;
    nodePositions[f] = { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
  });

  const isActive = (force) => shockedForce === force || hovered === force;
  const getEdgeOpacity = (edge) => {
    if (!shockedForce && !hovered) return 0.12;
    if (shockedForce === edge.from || hovered === edge.from) return 0.6 + edge.weight * 0.4;
    if (shockedForce === edge.to || hovered === edge.to) return 0.3;
    return 0.04;
  };

  return (
    <div style={{ ...card, flex: 1 }}>
      <div style={cardHeader}>
        <span style={cardTitle}>Causal DAG — Force Interdependencies</span>
        <span style={{ fontSize: 10, color: T.text3, fontFamily: T.sans }}>Click force to propagate shock</span>
      </div>
      <div style={{ padding: "4px 8px 8px", display: "flex", justifyContent: "center" }}>
        <svg ref={svgRef} width={440} height={280} viewBox="0 0 440 280" style={{ overflow: "visible" }}>
          <defs>
            {forceKeys.map(f => (
              <marker key={f} id={`arrow-${f}`} viewBox="0 0 10 8" refX="10" refY="4" markerWidth="8" markerHeight="6" orient="auto">
                <path d="M0,0 L10,4 L0,8 Z" fill={FORCES[f].color} opacity={0.6} />
              </marker>
            ))}
            {forceKeys.map(f => (
              <radialGradient key={`glow-${f}`} id={`glow-${f}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={FORCES[f].color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={FORCES[f].color} stopOpacity={0} />
              </radialGradient>
            ))}
          </defs>

          {/* Edges */}
          {data.dagEdges.map((edge, i) => {
            const from = nodePositions[edge.from];
            const to = nodePositions[edge.to];
            if (!from || !to) return null;
            const dx = to.x - from.x, dy = to.y - from.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            const nx = dx/dist, ny = dy/dist;
            const x1 = from.x + nx * 24, y1 = from.y + ny * 24;
            const x2 = to.x - nx * 28, y2 = to.y - ny * 28;
            const midX = (x1+x2)/2 - ny * 18, midY = (y1+y2)/2 + nx * 18;
            const opacity = getEdgeOpacity(edge);

            return (
              <g key={i} style={{ transition: "opacity 0.3s" }}>
                <path
                  d={`M${x1},${y1} Q${midX},${midY} ${x2},${y2}`}
                  fill="none"
                  stroke={FORCES[edge.from].color}
                  strokeWidth={edge.weight * 2.5 + 0.5}
                  strokeOpacity={opacity}
                  markerEnd={`url(#arrow-${edge.from})`}
                />
                {(shockedForce === edge.from || hovered === edge.from) && (
                  <text x={midX} y={midY - 6} textAnchor="middle" fill={FORCES[edge.from].color} fontSize={8} fontFamily={T.mono} opacity={0.8}>
                    {(edge.weight * 100).toFixed(0)}%{edge.lag > 0 ? ` +${edge.lag}y` : ""}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {forceKeys.map(f => {
            const pos = nodePositions[f];
            const force = FORCES[f];
            const Icon = force.icon;
            const active = isActive(f);
            const isShocked = shockedForce === f;
            return (
              <g key={f}
                onClick={() => onShockForce(isShocked ? null : f)}
                onMouseEnter={() => setHovered(f)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: "pointer", transition: "transform 0.2s" }}
              >
                {active && <circle cx={pos.x} cy={pos.y} r={32} fill={`url(#glow-${f})`} />}
                <circle cx={pos.x} cy={pos.y} r={22}
                  fill={active ? `${force.color}18` : T.bg2}
                  stroke={force.color}
                  strokeWidth={active ? 2 : 1}
                  strokeOpacity={active ? 0.8 : 0.25}
                />
                <text x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="central" fontSize={12} fill={active ? force.color : T.text2}>
                  {f === "Consumer" ? "👤" : f === "Customer" ? "🏪" : f === "Technology" ? "⚡" : f === "Government" ? "🏛" : f === "Environmental" ? "🌱" : "⚔"}
                </text>
                <text x={pos.x} y={pos.y + 38} textAnchor="middle" fontSize={9} fontWeight={active ? 600 : 400}
                  fill={active ? force.color : T.text3} fontFamily={T.sans}>
                  {force.label}
                </text>
                {isShocked && (
                  <text x={pos.x} y={pos.y + 50} textAnchor="middle" fontSize={8} fill={force.color} fontFamily={T.mono} opacity={0.7}>
                    SHOCK +30%
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ─── Force Waterfall ────────────────────────────────────────
function ForceWaterfall({ data, selectedCategory }) {
  const cat = selectedCategory || "lhc_fcn";
  const catObj = CATEGORIES.find(c => c.id === cat);
  const contributions = data.forceContributions[cat] || [];
  const sorted = [...contributions].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  const chartData = sorted.map(c => ({
    force: c.force,
    value: c.normalized,
    fill: FORCES[c.force]?.color || T.text3,
  }));

  return (
    <div style={{ ...card, flex: 1 }}>
      <div style={cardHeader}>
        <span style={cardTitle}>Force Decomposition — {catObj?.short || cat}</span>
        <span style={{ fontSize: 10, color: T.text3, fontFamily: T.sans }}>Relative contribution to shift</span>
      </div>
      <div style={{ padding: "12px 16px", height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: T.text3, fontFamily: T.mono }} tickLine={false} axisLine={false} tickFormatter={v => `${(v*100).toFixed(0)}%`} />
            <YAxis dataKey="force" type="category" tick={{ fontSize: 10, fill: T.text2, fontFamily: T.sans }} tickLine={false} axisLine={false} width={85} />
            <ReferenceLine x={0} stroke={T.text4} strokeDasharray="4 4" />
            <Tooltip
              contentStyle={{ background: T.bg1, border: `1px solid ${T.border2}`, borderRadius: T.r12, padding: "8px 12px", fontFamily: T.sans, fontSize: 11 }}
              formatter={(v) => [`${(v*100).toFixed(1)}%`, "Contribution"]}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.fill} fillOpacity={0.7} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Allocation Optimizer ───────────────────────────────────
function AllocationOptimizer({ data }) {
  const sorted = [...data.allocation].sort((a, b) => b.weight - a.weight);
  const maxWeight = Math.max(...sorted.map(a => a.weight));

  return (
    <div style={{ ...card, flex: 1 }}>
      <div style={cardHeader}>
        <span style={cardTitle}>Resource Allocation — Optimizer Output</span>
        <span style={{ fontSize: 10, color: T.text3, fontFamily: T.mono }}>Relative category weights</span>
      </div>
      <div style={{ padding: "12px 16px" }}>
        {sorted.map(a => {
          const shift = a.shift2030;
          const delta = a.weight - a.currentWeight;
          return (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ width: 3, height: 14, borderRadius: 2, background: a.color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: T.text2, fontFamily: T.sans, width: 52, flexShrink: 0 }}>{a.short}</span>
              <div style={{ flex: 1, height: 6, background: T.bg3, borderRadius: 3, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${(a.weight / maxWeight) * 100}%`,
                  background: `linear-gradient(90deg, ${a.color}60, ${a.color}CC)`,
                  borderRadius: 3,
                  transition: "width 0.5s ease",
                }} />
              </div>
              <span style={{ fontSize: 10, fontFamily: T.mono, color: T.text2, width: 38, textAlign: "right" }}>
                {(a.weight * 100).toFixed(1)}%
              </span>
              <span style={{
                fontSize: 9, fontFamily: T.mono, width: 44, textAlign: "right",
                color: delta > 0.005 ? T.green : delta < -0.005 ? T.red : T.text4,
              }}>
                {delta > 0.005 ? "+" : ""}{(delta * 100).toFixed(1)}pp
              </span>
            </div>
          );
        })}
        <div style={{ marginTop: 12, display: "flex", gap: 16, justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, color: T.text3, fontFamily: T.sans, textTransform: "uppercase", letterSpacing: "0.08em" }}>Expected Return</div>
            <div style={{ fontSize: 13, color: T.text, fontFamily: T.mono, marginTop: 2 }}>+1.24%</div>
          </div>
          <div style={{ width: 1, background: T.border1 }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, color: T.text3, fontFamily: T.sans, textTransform: "uppercase", letterSpacing: "0.08em" }}>Risk (σ)</div>
            <div style={{ fontSize: 13, color: T.text, fontFamily: T.mono, marginTop: 2 }}>2.18%</div>
          </div>
          <div style={{ width: 1, background: T.border1 }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, color: T.text3, fontFamily: T.sans, textTransform: "uppercase", letterSpacing: "0.08em" }}>Sharpe</div>
            <div style={{ fontSize: 13, color: T.text, fontFamily: T.mono, marginTop: 2 }}>0.57</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Trend Explorer ─────────────────────────────────────────
function TrendExplorer({ data, forceFilter, onForceFilter }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState("score");
  const [sortDir, setSortDir] = useState("desc");
  const [expandedId, setExpandedId] = useState(null);

  const filtered = useMemo(() => {
    let list = [...data.trends];
    if (forceFilter) list = list.filter(t => t.force === forceFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(t => t.name.toLowerCase().includes(q) || t.force.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      const mult = sortDir === "asc" ? 1 : -1;
      if (sortField === "name") return mult * a.name.localeCompare(b.name);
      if (sortField === "force") return mult * a.force.localeCompare(b.force);
      if (sortField === "impact") return mult * (a.impact - b.impact);
      if (sortField === "prob") return mult * (a.prob - b.prob);
      return mult * (a.score - b.score);
    });
    return list;
  }, [data.trends, forceFilter, searchQuery, sortField, sortDir]);

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const SortIndicator = ({ field }) => {
    if (sortField !== field) return <ChevronDown size={10} color={T.text4} />;
    return <ChevronDown size={10} color={T.accent} style={{ transform: sortDir === "asc" ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />;
  };

  const DotBar = ({ value, max = 5, color }) => (
    <div style={{ display: "flex", gap: 2 }}>
      {Array.from({ length: max }, (_, i) => (
        <div key={i} style={{
          width: 6, height: 6, borderRadius: "50%",
          background: i < value ? color : T.bg3,
          transition: "background 0.15s",
        }} />
      ))}
    </div>
  );

  return (
    <div style={{ ...card }}>
      <div style={cardHeader}>
        <span style={cardTitle}>Trend Explorer — {filtered.length} Trends</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 6, padding: "4px 10px",
            background: T.bg3, borderRadius: T.r8, border: `1px solid ${T.border}`,
          }}>
            <Search size={12} color={T.text3} />
            <input
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search trends..."
              style={{
                background: "transparent", border: "none", outline: "none",
                color: T.text, fontSize: 11, fontFamily: T.sans, width: 120,
              }}
            />
          </div>
        </div>
      </div>

      {/* Force filter chips */}
      <div style={{ padding: "8px 16px 4px", display: "flex", gap: 4, flexWrap: "wrap" }}>
        <button
          onClick={() => onForceFilter(null)}
          style={{
            ...pill(!forceFilter ? T.text : T.text3, !forceFilter ? T.accentDim : "transparent"),
            border: `1px solid ${!forceFilter ? T.accent + "30" : T.border}`,
            cursor: "pointer", fontFamily: T.sans,
          }}
        >All</button>
        {Object.entries(FORCES).map(([key, f]) => (
          <button key={key}
            onClick={() => onForceFilter(forceFilter === key ? null : key)}
            style={{
              ...pill(forceFilter === key ? f.color : T.text3, forceFilter === key ? f.color + "18" : "transparent"),
              border: `1px solid ${forceFilter === key ? f.color + "30" : T.border}`,
              cursor: "pointer", fontFamily: T.sans,
            }}
          >{f.label}</button>
        ))}
      </div>

      {/* Table */}
      <div style={{ padding: "4px 12px 12px", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: T.sans, fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.border1}` }}>
              {[
                { key: "force", label: "Force", width: 90 },
                { key: "name", label: "Trend", width: "auto" },
                { key: "dir", label: "Dir", width: 60 },
                { key: "impact", label: "Impact", width: 72 },
                { key: "prob", label: "Prob", width: 72 },
                { key: "score", label: "Score", width: 68 },
              ].map(col => (
                <th key={col.key}
                  onClick={() => toggleSort(col.key)}
                  style={{
                    textAlign: "left", padding: "8px 8px", fontSize: 10, fontWeight: 500,
                    color: T.text3, cursor: "pointer", userSelect: "none", width: col.width,
                    textTransform: "uppercase", letterSpacing: "0.06em",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {col.label} <SortIndicator field={col.key} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => {
              const force = FORCES[t.force];
              const isExpanded = expandedId === t.id;
              return (
                <React.Fragment key={t.id}>
                  <tr
                    onClick={() => setExpandedId(isExpanded ? null : t.id)}
                    style={{ borderBottom: `1px solid ${T.border}`, transition: "background 0.1s", cursor: "pointer" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.015)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={{ padding: "7px 8px" }}>
                      <span style={{ ...pill(force?.color || T.text3, (force?.color || T.text3) + "15"), fontSize: 9 }}>
                        {t.force}
                      </span>
                    </td>
                    <td style={{ padding: "7px 8px", color: T.text, fontWeight: 400, fontSize: 11.5 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <ChevronRight size={12} color={T.text3} style={{ transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
                        {t.name}
                      </div>
                    </td>
                    <td style={{ padding: "7px 8px" }}>
                      {t.dir === "Expansion"
                        ? <span style={{ color: T.green, fontSize: 10 }}>▲ Exp</span>
                        : <span style={{ color: T.red, fontSize: 10 }}>▼ Con</span>
                      }
                    </td>
                    <td style={{ padding: "7px 8px" }}><DotBar value={t.impact} color={T.accent} /></td>
                    <td style={{ padding: "7px 8px" }}><DotBar value={t.prob} color={T.amber} /></td>
                    <td style={{ padding: "7px 8px" }}>
                      <span style={{ fontFamily: T.mono, fontWeight: 600, fontSize: 11, color: t.score > 0 ? T.green : T.red }}>
                        {t.score > 0 ? "+" : ""}{t.score.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan="6" style={{ padding: 0 }}>
                        <div style={{
                          padding: "20px 24px",
                          borderTop: `1px solid ${T.border1}`,
                          background: `linear-gradient(135deg, ${T.bg1} 0%, ${T.bg2} 100%)`,
                        }}>
                          {/* Category Exposures */}
                          {t.cats && (
                            <div style={{ marginBottom: 16 }}>
                              <div style={{ fontSize: 10, fontWeight: 600, color: T.text2, marginBottom: 8 }}>CATEGORY EXPOSURE</div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {Object.entries(t.cats).map(([catId, val]) => {
                                  const cat = CATEGORIES.find(c => c.id === catId);
                                  return cat ? (
                                    <div key={catId} style={{
                                      ...pill(cat.color, cat.color + "18"),
                                      border: `1px solid ${cat.color}25`,
                                      fontSize: 10,
                                    }}>
                                      {cat.short}: {val}/5
                                    </div>
                                  ) : null;
                                })}
                              </div>
                            </div>
                          )}
                          {/* Sources */}
                          {t.sources && t.sources.length > 0 && (
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 600, color: T.text2, marginBottom: 8 }}>SOURCES & EVIDENCE</div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {t.sources.map((src, idx) => (
                                  <div key={idx} style={{
                                    padding: "10px 14px",
                                    background: T.bg3,
                                    borderRadius: 8,
                                    border: `1px solid ${T.border1}`,
                                  }}>
                                    {src.url ? (
                                      <a href={src.url} target="_blank" rel="noopener noreferrer" style={{
                                        fontSize: 11, fontWeight: 600, color: T.accent, textDecoration: "none",
                                        display: "inline-flex", alignItems: "center", gap: 4,
                                      }}
                                        onMouseEnter={e => e.target.style.textDecoration = "underline"}
                                        onMouseLeave={e => e.target.style.textDecoration = "none"}
                                      >
                                        {src.title || "Source"} <span style={{ fontSize: 9, opacity: 0.6 }}>↗</span>
                                      </a>
                                    ) : (
                                      <span style={{ fontSize: 11, fontWeight: 600, color: T.text }}>{src.title || "Source"}</span>
                                    )}
                                    {src.data && (
                                      <div style={{ fontSize: 10, color: T.text2, marginTop: 4, fontFamily: T.mono, lineHeight: 1.4 }}>
                                        {src.data}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Category Detail Panel (slide-in) ───────────────────────
function CategoryDetailPanel({ data, categoryId, onClose }) {
  const cat = CATEGORIES.find(c => c.id === categoryId);
  if (!cat) return null;

  const shift2030 = data.shifts[categoryId]?.[2030]?.median;
  const relatedTrends = data.trends.filter(t => t.cats && t.cats[categoryId]);
  const contributions = data.forceContributions[categoryId] || [];
  const sorted = [...contributions].sort((a, b) => Math.abs(b.normalized) - Math.abs(a.normalized));

  const pathData = YEARS.map(y => {
    const s = data.shifts[categoryId]?.[y];
    return s ? { year: y, median: s.median * 100, p10: s.p10 * 100, p90: s.p90 * 100 } : null;
  }).filter(Boolean);

  return (
    <div style={{
      position: "fixed", top: 0, right: 0, bottom: 0, width: 420, zIndex: 50,
      background: T.bg1, borderLeft: `1px solid ${T.border1}`,
      boxShadow: "-20px 0 60px rgba(0,0,0,0.5)",
      display: "flex", flexDirection: "column",
      animation: "slideIn 0.25s ease-out",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid ${T.border1}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 4, height: 28, borderRadius: 2, background: cat.color }} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: T.text, fontFamily: T.sans }}>{cat.name}</div>
              <div style={{ fontSize: 10, color: T.text3, fontFamily: T.sans, marginTop: 2 }}>{cat.group} Portfolio</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: T.bg3, border: "none", borderRadius: T.r8, padding: 6, cursor: "pointer", display: "flex" }}>
            <X size={14} color={T.text3} />
          </button>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1, background: shiftBg(shift2030), borderRadius: T.r12, padding: "10px 14px" }}>
            <div style={{ fontSize: 9, color: T.text3, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: T.sans }}>2030 Shift</div>
            <div style={{ fontSize: 22, fontWeight: 300, color: shiftColor(shift2030), fontFamily: T.mono, marginTop: 2 }}>{fmtPct(shift2030)}</div>
          </div>
          <div style={{ flex: 1, background: T.bg3, borderRadius: T.r12, padding: "10px 14px" }}>
            <div style={{ fontSize: 9, color: T.text3, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: T.sans }}>Trends</div>
            <div style={{ fontSize: 22, fontWeight: 300, color: T.text, fontFamily: T.mono, marginTop: 2 }}>{relatedTrends.length}</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
        {/* Mini path chart */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: T.text3, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: T.sans, marginBottom: 8 }}>Shift Path</div>
          <div style={{ height: 120 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={pathData} margin={{ top: 4, right: 4, bottom: 4, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 9, fill: T.text3 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 9, fill: T.text3, fontFamily: T.mono }} tickLine={false} axisLine={false} tickFormatter={v => `${v.toFixed(1)}%`} />
                <ReferenceLine y={0} stroke={T.text4} strokeDasharray="3 3" />
                <Area dataKey="p10" stroke="none" fill={cat.color} fillOpacity={0} stackId="a" />
                <Area dataKey="p90" stroke="none" fill={cat.color} fillOpacity={0.1} stackId="a" />
                <Line dataKey="median" stroke={cat.color} strokeWidth={2} dot={{ r: 3, fill: cat.color }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Force decomposition bars */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: T.text3, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: T.sans, marginBottom: 8 }}>Force Decomposition</div>
          {sorted.map(c => {
            const force = FORCES[c.force];
            const width = Math.abs(c.normalized) * 100;
            const isPos = c.normalized > 0;
            return (
              <div key={c.force} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                <span style={{ fontSize: 10, color: T.text3, fontFamily: T.sans, width: 80, flexShrink: 0 }}>{c.force}</span>
                <div style={{ flex: 1, height: 4, background: T.bg3, borderRadius: 2, overflow: "hidden", position: "relative" }}>
                  <div style={{
                    position: "absolute", top: 0, bottom: 0,
                    left: isPos ? "50%" : `${50 - width/2}%`,
                    width: `${width/2}%`,
                    background: force?.color || T.text3,
                    borderRadius: 2,
                    opacity: 0.7,
                  }} />
                </div>
                <span style={{ fontSize: 9, fontFamily: T.mono, color: isPos ? T.green : T.red, width: 36, textAlign: "right" }}>
                  {(c.normalized * 100).toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>

        {/* Related trends */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: T.text3, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: T.sans, marginBottom: 8 }}>Contributing Trends</div>
          {relatedTrends.sort((a, b) => Math.abs(b.score) - Math.abs(a.score)).map(t => (
            <div key={t.id} style={{
              padding: "8px 10px", borderRadius: T.r8, marginBottom: 4,
              background: T.bg2, border: `1px solid ${T.border}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                <span style={{ fontSize: 11, color: T.text, fontFamily: T.sans, fontWeight: 400 }}>{t.name}</span>
                <span style={{ fontSize: 10, fontFamily: T.mono, fontWeight: 600, color: t.score > 0 ? T.green : T.red }}>
                  {t.score > 0 ? "+" : ""}{t.score.toFixed(2)}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 9, color: FORCES[t.force]?.color || T.text3 }}>{t.force}</span>
                <span style={{ fontSize: 9, color: T.text4 }}>•</span>
                <span style={{ fontSize: 9, color: T.text3 }}>Exposure: {t.cats[categoryId]}/5</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Scenario Bar ───────────────────────────────────────────
function ScenarioBar({ scenarios, activeScenario, onSelectScenario }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {scenarios.map(s => (
        <button key={s.id}
          onClick={() => onSelectScenario(s.id)}
          style={{
            padding: "5px 12px", borderRadius: T.r8,
            background: activeScenario === s.id ? T.accentDim : "transparent",
            border: `1px solid ${activeScenario === s.id ? T.accent + "30" : T.border}`,
            color: activeScenario === s.id ? T.accent : T.text3,
            fontSize: 10, fontWeight: 500, fontFamily: T.sans,
            cursor: "pointer", transition: "all 0.15s",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={e => { if (activeScenario !== s.id) e.currentTarget.style.borderColor = T.border2; }}
          onMouseLeave={e => { if (activeScenario !== s.id) e.currentTarget.style.borderColor = T.border; }}
        >
          {s.name}
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN WAR ROOM
// ═══════════════════════════════════════════════════════════════

export default function PULSEWarRoom() {
  const [data] = useState(() => generateMockData());
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [activeScenario, setActiveScenario] = useState("base");
  const [shockedForce, setShockedForce] = useState(null);
  const [forceFilter, setForceFilter] = useState(null);
  const [activeView, setActiveView] = useState("overview"); // overview | trends

  return (
    <div style={{
      minHeight: "100vh",
      background: T.bg,
      color: T.text,
      fontFamily: T.sans,
      WebkitFontSmoothing: "antialiased",
      MozOsxFontSmoothing: "grayscale",
    }}>
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${T.bg4}; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: ${T.text4}; }
        input::placeholder { color: ${T.text4}; }
      `}</style>

      {/* ── Header ────────────────────────────────────────── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 40,
        background: `${T.bg}E6`,
        backdropFilter: "blur(20px) saturate(180%)",
        borderBottom: `1px solid ${T.border}`,
        padding: "0 32px",
      }}>
        <div style={{ maxWidth: 1440, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 52 }}>
          {/* Left: Brand + Nav */}
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 26, height: 26, borderRadius: T.r8,
                background: `linear-gradient(135deg, ${T.accent}, ${T.purple})`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700, color: "#fff",
              }}>P</div>
              <span style={{ fontSize: 14, fontWeight: 600, color: T.text, letterSpacing: "-0.01em" }}>PULSE</span>
              <span style={{ fontSize: 10, color: T.text4, fontFamily: T.mono }}>v3.0</span>
            </div>

            <div style={{ width: 1, height: 20, background: T.border1 }} />

            <div style={{ display: "flex", gap: 2 }}>
              {[
                { id: "overview", label: "War Room", icon: BarChart3 },
                { id: "trends", label: "Trends", icon: Layers },
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = activeView === tab.id;
                return (
                  <button key={tab.id}
                    onClick={() => setActiveView(tab.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 5,
                      padding: "6px 12px", borderRadius: T.r8,
                      background: isActive ? T.accentDim : "transparent",
                      border: "none", cursor: "pointer",
                      color: isActive ? T.accent : T.text3,
                      fontSize: 12, fontWeight: 500, fontFamily: T.sans,
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = T.text2; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = T.text3; }}
                  >
                    <Icon size={13} strokeWidth={1.5} />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Center: Scenarios */}
          <ScenarioBar scenarios={data.scenarios} activeScenario={activeScenario} onSelectScenario={setActiveScenario} />

          {/* Right: Status + Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ ...pill(T.green, T.greenDim), gap: 5, fontSize: 10 }}>
              <CheckCircle2 size={10} />
              <span>R̂ 1.03</span>
            </div>
            <div style={{ ...pill(T.text3, T.bg3), fontSize: 10 }}>
              <Clock size={10} />
              <span>10K iter</span>
            </div>
            <button style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "5px 12px", borderRadius: T.r8,
              background: T.accent, border: "none", cursor: "pointer",
              color: "#fff", fontSize: 11, fontWeight: 600, fontFamily: T.sans,
            }}>
              <Zap size={11} />
              Simulate
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Content ──────────────────────────────────── */}
      <main style={{ maxWidth: 1440, margin: "0 auto", padding: "20px 32px 40px" }}>
        {activeView === "overview" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Row 1: KPI Strip */}
            <KPIStrip data={data} />

            {/* Row 2: Heatmap + Path */}
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
              <ShiftHeatmap data={data} selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} />
              <PathTimeline data={data} selectedCategory={selectedCategory} />
            </div>

            {/* Row 3: DAG + Waterfall + Allocation */}
            <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr 1fr", gap: 16 }}>
              <CausalDAG data={data} shockedForce={shockedForce} onShockForce={setShockedForce} />
              <ForceWaterfall data={data} selectedCategory={selectedCategory} />
              <AllocationOptimizer data={data} />
            </div>
          </div>
        ) : (
          <TrendExplorer data={data} forceFilter={forceFilter} onForceFilter={setForceFilter} />
        )}
      </main>

      {/* ── Detail Panel ──────────────────────────────────── */}
      {selectedCategory && (
        <>
          <div
            onClick={() => setSelectedCategory(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 45 }}
          />
          <CategoryDetailPanel data={data} categoryId={selectedCategory} onClose={() => setSelectedCategory(null)} />
        </>
      )}

      {/* ── Bottom Insight Bar ────────────────────────────── */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 30,
        background: `${T.bg1}E6`,
        backdropFilter: "blur(16px)",
        borderTop: `1px solid ${T.border}`,
        padding: "8px 32px",
      }}>
        <div style={{ maxWidth: 1440, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Brain size={12} color={T.purple} />
              <span style={{ fontSize: 10, color: T.text2, fontFamily: T.sans }}>3 new signals detected — FCN regulatory risk elevated</span>
            </div>
            <div style={{ ...pill(T.amber, T.amberDim), fontSize: 9 }}>
              <AlertTriangle size={9} />
              FCN trigger approaching threshold
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "4px 10px", borderRadius: T.r8,
              background: "transparent", border: `1px solid ${T.border1}`,
              cursor: "pointer", color: T.text3, fontSize: 10, fontFamily: T.sans,
            }}>
              <FileDown size={11} />
              Export Shift Matrix
            </button>
            <button style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "4px 10px", borderRadius: T.r8,
              background: "transparent", border: `1px solid ${T.border1}`,
              cursor: "pointer", color: T.text3, fontSize: 10, fontFamily: T.sans,
            }}>
              <Settings size={11} />
              Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}