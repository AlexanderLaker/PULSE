import { useState, useMemo } from "react";
import { Activity, TrendingUp, BarChart3, Layers, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, BarChart, Bar, Cell } from "recharts";

// ═══════════════════════════════════════════════════════════════
// PRISM Profit Pool Shift Model — Real V12 Data (5,000 Bayesian MC Iterations)
// ═══════════════════════════════════════════════════════════════

const HEATMAP = {"Hair: Body":{"2026":0.00219,"2027":0.00546,"2028":0.01093,"2029":0.01639,"2030":0.02186},"Hair: Care":{"2026":0.00189,"2027":0.00473,"2028":0.00946,"2029":0.01419,"2030":0.01893},"Hair: Color":{"2026":0.00276,"2027":0.0069,"2028":0.0138,"2029":0.0207,"2030":0.0276},"Hair: Styling":{"2026":0.0018,"2027":0.00449,"2028":0.00898,"2029":0.01348,"2030":0.01797},"LHC: ADW":{"2026":0.0021,"2027":0.00525,"2028":0.0105,"2029":0.01575,"2030":0.021},"LHC: FCA":{"2026":0.00222,"2027":0.00556,"2028":0.01111,"2029":0.01667,"2030":0.02223},"LHC: FCN":{"2026":0.00372,"2027":0.0093,"2028":0.0186,"2029":0.02791,"2030":0.03721},"LHC: FFI":{"2026":0.00095,"2027":0.00237,"2028":0.00474,"2029":0.0071,"2030":0.00947},"LHC: HDW":{"2026":0.00213,"2027":0.00533,"2028":0.01066,"2029":0.01599,"2030":0.02131},"LHC: HSC":{"2026":0.00254,"2027":0.00634,"2028":0.01268,"2029":0.01901,"2030":0.02535},"LHC: IC":{"2026":0.00222,"2027":0.00556,"2028":0.01111,"2029":0.01667,"2030":0.02222},"LHC: LAD":{"2026":0.00267,"2027":0.00667,"2028":0.01333,"2029":0.02,"2030":0.02667}};

const FORCES_DATA = [{"name":"Consumer","avg_score":0.424,"expansion_count":8,"contraction_count":2,"net_direction":"Expansion"},{"name":"Customer","avg_score":0.092,"expansion_count":4,"contraction_count":6,"net_direction":"Expansion"},{"name":"Technology","avg_score":0.328,"expansion_count":8,"contraction_count":2,"net_direction":"Expansion"},{"name":"Government","avg_score":-0.044,"expansion_count":2,"contraction_count":8,"net_direction":"Contraction"},{"name":"Environmental","avg_score":0.024,"expansion_count":3,"contraction_count":7,"net_direction":"Expansion"},{"name":"Competitive","avg_score":0.244,"expansion_count":5,"contraction_count":5,"net_direction":"Expansion"}];

const TRENDS = [{"id":"con_01","f":"Consumer","n":"Natural / Clean Beauty Movement","d":"Expansion","i":5,"p":4,"s":0.8,"e":{"Hair: Color":3,"Hair: Care":3,"Hair: Styling":2,"Hair: Body":2,"LHC: HDW":1}},{"id":"con_02","f":"Consumer","n":"Private Label Growth in Laundry & Toilet","d":"Contraction","i":1,"p":4,"s":-0.16,"e":{"LHC: IC":1,"LHC: FCN":3,"LHC: FCA":3,"LHC: FFI":2,"LHC: LAD":2,"LHC: HDW":2,"LHC: ADW":2,"LHC: HSC":3}},{"id":"con_03","f":"Consumer","n":"Premiumization in Hair Color (Salon-at-Home)","d":"Expansion","i":5,"p":3,"s":0.6,"e":{"Hair: Color":4,"Hair: Care":1}},{"id":"con_04","f":"Consumer","n":"Eco-Concentrated Laundry Products","d":"Expansion","i":5,"p":3,"s":0.6,"e":{"LHC: FCN":3,"LHC: FCA":2,"LHC: FFI":1,"LHC: LAD":2,"LHC: HDW":1,"LHC: ADW":2,"LHC: HSC":1}},{"id":"con_05","f":"Consumer","n":"Reduced Hair Washing Frequency","d":"Contraction","i":1,"p":3,"s":-0.12,"e":{"Hair: Color":1,"Hair: Care":3,"Hair: Styling":2}},{"id":"con_06","f":"Consumer","n":"Cold-Water Washing Trend","d":"Expansion","i":5,"p":3,"s":0.6,"e":{"LHC: FCN":3,"LHC: FCA":2,"LHC: FFI":1,"LHC: LAD":2}},{"id":"con_07","f":"Consumer","n":"Scalp Health & Treatment as New Category","d":"Expansion","i":5,"p":3,"s":0.6,"e":{"Hair: Color":1,"Hair: Care":3}},{"id":"con_08","f":"Consumer","n":"Hygiene Consciousness Post-COVID","d":"Expansion","i":5,"p":3,"s":0.6,"e":{"LHC: IC":1,"Hair: Body":1,"LHC: FCN":1,"LHC: LAD":1,"LHC: HDW":2,"LHC: ADW":1,"LHC: HSC":4}},{"id":"con_09","f":"Consumer","n":"Aging Population – Anti-Gray & Thinning Hair","d":"Expansion","i":5,"p":3,"s":0.6,"e":{"Hair: Color":3,"Hair: Care":2,"Hair: Styling":1,"Hair: Body":1}},{"id":"con_10","f":"Consumer","n":"Tropical Climate Growth – Insecticide Demand","d":"Expansion","i":1,"p":3,"s":0.12,"e":{"LHC: IC":3}},{"id":"cus_01","f":"Customer","n":"E-Commerce Growth in Hair Care","d":"Contraction","i":1,"p":4,"s":-0.16,"e":{"Hair: Color":2,"Hair: Care":3,"Hair: Styling":2,"Hair: Body":2}},{"id":"cus_02","f":"Customer","n":"Retail Media Networks – New Cost Layer","d":"Contraction","i":1,"p":4,"s":-0.16,"e":{"LHC: IC":1,"Hair: Color":2,"Hair: Care":2,"Hair: Styling":2,"Hair: Body":2,"LHC: FCN":3,"LHC: FCA":2,"LHC: FFI":1,"LHC: LAD":2,"LHC: HDW":2,"LHC: ADW":2,"LHC: HSC":2}},{"id":"cus_03","f":"Customer","n":"D2C Hair Color Subscription Models","d":"Contraction","i":1,"p":2,"s":-0.08,"e":{"Hair: Color":3,"Hair: Care":1}},{"id":"cus_04","f":"Customer","n":"Discounter Expansion in LHC (Aldi/Lidl)","d":"Contraction","i":1,"p":4,"s":-0.16,"e":{"LHC: IC":2,"LHC: FCN":3,"LHC: FCA":3,"LHC: FFI":2,"LHC: LAD":2,"LHC: HDW":3,"LHC: ADW":2,"LHC: HSC":3}},{"id":"cus_05","f":"Customer","n":"Social Commerce for Hair Styling (TikTok Shop)","d":"Expansion","i":4,"p":3,"s":0.48,"e":{"Hair: Color":1,"Hair: Care":1,"Hair: Styling":3,"Hair: Body":1}},{"id":"cus_06","f":"Customer","n":"Quick Commerce for Household Replenishment","d":"Expansion","i":1,"p":2,"s":0.08,"e":{"LHC: IC":1,"LHC: FCN":2,"LHC: FCA":1,"LHC: FFI":1,"LHC: LAD":1,"LHC: HDW":2,"LHC: ADW":1,"LHC: HSC":2}},{"id":"cus_07","f":"Customer","n":"Subscription Auto-Replenish (Laundry/Insecticides)","d":"Expansion","i":5,"p":3,"s":0.6,"e":{"LHC: IC":2,"LHC: FCN":3,"LHC: FCA":2,"LHC: FFI":1,"LHC: LAD":2,"LHC: HDW":2,"LHC: ADW":2,"LHC: HSC":2}},{"id":"cus_08","f":"Customer","n":"Professional Salon Channel Integration (Hair)","d":"Expansion","i":5,"p":3,"s":0.6,"e":{"Hair: Color":2,"Hair: Care":2,"Hair: Styling":2,"Hair: Body":1}},{"id":"cus_09","f":"Customer","n":"Trade Spend Inflation Across All Categories","d":"Contraction","i":1,"p":4,"s":-0.16,"e":{"LHC: IC":2,"Hair: Color":2,"Hair: Care":2,"Hair: Styling":2,"Hair: Body":2,"LHC: FCN":3,"LHC: FCA":2,"LHC: FFI":1,"LHC: LAD":2,"LHC: HDW":2,"LHC: ADW":2,"LHC: HSC":2}},{"id":"cus_10","f":"Customer","n":"Retailer Power Consolidation (Listing Fees)","d":"Contraction","i":1,"p":3,"s":-0.12,"e":{"LHC: IC":3,"Hair: Color":1,"Hair: Care":1,"Hair: Styling":1,"Hair: Body":1,"LHC: FCN":3,"LHC: FCA":2,"LHC: FFI":2,"LHC: LAD":2,"LHC: HDW":2,"LHC: ADW":2,"LHC: HSC":2}},{"id":"tec_01","f":"Technology","n":"GenAI Content for Hair/Beauty Marketing","d":"Expansion","i":5,"p":4,"s":0.8,"e":{"LHC: IC":1,"Hair: Color":2,"Hair: Care":2,"Hair: Styling":2,"Hair: Body":2,"LHC: FCN":2,"LHC: FCA":1,"LHC: FFI":1,"LHC: LAD":1,"LHC: HDW":1,"LHC: ADW":1,"LHC: HSC":1}},{"id":"tec_02","f":"Technology","n":"RGM / Pricing AI for Laundry & Toilet","d":"Expansion","i":5,"p":4,"s":0.8,"e":{"LHC: IC":2,"LHC: FCN":3,"LHC: FCA":2,"LHC: FFI":1,"LHC: LAD":2,"LHC: HDW":2,"LHC: ADW":2,"LHC: HSC":2}},{"id":"tec_03","f":"Technology","n":"Virtual Hair Try-On / AR Technology","d":"Expansion","i":5,"p":3,"s":0.6,"e":{"Hair: Color":3,"Hair: Care":1,"Hair: Styling":2}},{"id":"tec_04","f":"Technology","n":"Biotech Ingredients & Precision Fermentation","d":"Expansion","i":5,"p":2,"s":0.4,"e":{"LHC: IC":1,"Hair: Color":1,"Hair: Care":2,"Hair: Styling":1,"Hair: Body":1,"LHC: FCN":2,"LHC: FCA":1,"LHC: FFI":1,"LHC: LAD":2,"LHC: HDW":1,"LHC: ADW":1,"LHC: HSC":1}},{"id":"tec_05","f":"Technology","n":"Reformulation Cost for Clean Label","d":"Contraction","i":1,"p":3,"s":-0.12,"e":{"Hair: Color":2,"Hair: Care":2,"Hair: Styling":2,"Hair: Body":1,"LHC: FCN":2,"LHC: FCA":1,"LHC: FFI":1,"LHC: LAD":1,"LHC: HDW":1,"LHC: ADW":1,"LHC: HSC":1}},{"id":"tec_06","f":"Technology","n":"Smart Dispensing / Dosing Technology","d":"Expansion","i":1,"p":2,"s":0.08,"e":{"LHC: FCN":2,"LHC: FCA":1,"LHC: LAD":1,"LHC: HDW":1,"LHC: ADW":1,"LHC: HSC":1}},{"id":"tec_07","f":"Technology","n":"Hair Diagnostic Devices & Personalization","d":"Expansion","i":2,"p":2,"s":0.16,"e":{"Hair: Color":2,"Hair: Care":2,"Hair: Styling":1}},{"id":"tec_08","f":"Technology","n":"Factory Automation in LHC Manufacturing","d":"Expansion","i":5,"p":3,"s":0.6,"e":{"LHC: IC":2,"LHC: FCN":3,"LHC: FCA":2,"LHC: FFI":1,"LHC: LAD":2,"LHC: HDW":2,"LHC: ADW":2,"LHC: HSC":2}},{"id":"tec_09","f":"Technology","n":"1P Data / CDP for Hair Personalization","d":"Contraction","i":1,"p":3,"s":-0.12,"e":{"Hair: Color":2,"Hair: Care":2,"Hair: Styling":2,"Hair: Body":1}},{"id":"tec_10","f":"Technology","n":"AI-Driven Insecticide Precision Application","d":"Expansion","i":1,"p":2,"s":0.08,"e":{"LHC: IC":2}},{"id":"gov_01","f":"Government","n":"Chemical Ingredient Bans (Hair Care)","d":"Contraction","i":1,"p":4,"s":-0.16,"e":{"Hair: Color":3,"Hair: Care":3,"Hair: Styling":2,"Hair: Body":2}},{"id":"gov_02","f":"Government","n":"Pesticide / Biocide Regulation Tightening","d":"Contraction","i":1,"p":4,"s":-0.16,"e":{"LHC: IC":4,"LHC: HSC":1}},{"id":"gov_03","f":"Government","n":"Trade Tariffs on Chemical Inputs","d":"Contraction","i":1,"p":3,"s":-0.12,"e":{"LHC: IC":2,"Hair: Color":2,"Hair: Care":2,"Hair: Styling":2,"Hair: Body":1,"LHC: FCN":3,"LHC: FCA":2,"LHC: FFI":1,"LHC: LAD":2,"LHC: HDW":2,"LHC: ADW":2,"LHC: HSC":2}},{"id":"gov_04","f":"Government","n":"Packaging Taxes (EPR / Plastic Tax)","d":"Contraction","i":1,"p":4,"s":-0.16,"e":{"LHC: IC":2,"Hair: Color":2,"Hair: Care":2,"Hair: Styling":2,"Hair: Body":2,"LHC: FCN":4,"LHC: FCA":3,"LHC: FFI":2,"LHC: LAD":2,"LHC: HDW":3,"LHC: ADW":2,"LHC: HSC":3}},{"id":"gov_05","f":"Government","n":"CSRD / ESG Disclosure Requirements","d":"Contraction","i":1,"p":4,"s":-0.16,"e":{"LHC: IC":2,"Hair: Color":1,"Hair: Care":1,"Hair: Styling":1,"Hair: Body":1,"LHC: FCN":2,"LHC: FCA":1,"LHC: FFI":1,"LHC: LAD":1,"LHC: HDW":1,"LHC: ADW":1,"LHC: HSC":1}},{"id":"gov_06","f":"Government","n":"Animal Testing Bans & Cruelty-Free Mandates","d":"Contraction","i":1,"p":3,"s":-0.12,"e":{"LHC: IC":1,"Hair: Color":2,"Hair: Care":2,"Hair: Styling":2,"Hair: Body":2}},{"id":"gov_07","f":"Government","n":"Green Manufacturing Subsidies","d":"Expansion","i":5,"p":3,"s":0.6,"e":{"LHC: IC":2,"LHC: FCN":3,"LHC: FCA":2,"LHC: FFI":1,"LHC: LAD":2,"LHC: HDW":2,"LHC: ADW":2,"LHC: HSC":2}},{"id":"gov_08","f":"Government","n":"R&D Tax Credits for Bio-Based Formulas","d":"Expansion","i":1,"p":2,"s":0.08,"e":{"LHC: IC":1,"Hair: Color":1,"Hair: Care":1,"Hair: Styling":1,"Hair: Body":1,"LHC: FCN":1,"LHC: FCA":1,"LHC: FFI":1,"LHC: LAD":1,"LHC: HDW":1,"LHC: ADW":1,"LHC: HSC":1}},{"id":"gov_09","f":"Government","n":"GDPR / CCPA Impact on D2C Marketing","d":"Contraction","i":1,"p":3,"s":-0.12,"e":{"Hair: Color":2,"Hair: Care":2,"Hair: Styling":2,"Hair: Body":1}},{"id":"gov_10","f":"Government","n":"Phosphate / Chemical Discharge Regulations","d":"Contraction","i":1,"p":3,"s":-0.12,"e":{"LHC: FCN":3,"LHC: FCA":2,"LHC: FFI":1,"LHC: LAD":2,"LHC: HDW":2,"LHC: ADW":2,"LHC: HSC":2}},{"id":"env_01","f":"Environmental","n":"Microplastics in Hair/Laundry Products","d":"Contraction","i":1,"p":4,"s":-0.16,"e":{"Hair: Color":2,"Hair: Care":3,"Hair: Styling":3,"Hair: Body":2,"LHC: FCN":2,"LHC: FCA":1,"LHC: FFI":1,"LHC: LAD":1,"LHC: HDW":1,"LHC: ADW":1,"LHC: HSC":1}},{"id":"env_02","f":"Environmental","n":"Water Pollution from Detergent Chemicals","d":"Contraction","i":1,"p":3,"s":-0.12,"e":{"LHC: FCN":3,"LHC: FCA":2,"LHC: FFI":1,"LHC: LAD":2,"LHC: HDW":2,"LHC: ADW":2,"LHC: HSC":2}},{"id":"env_03","f":"Environmental","n":"Palm Oil Sustainability & NDPE Policies","d":"Contraction","i":1,"p":4,"s":-0.16,"e":{"Hair: Color":2,"Hair: Care":3,"Hair: Styling":2,"Hair: Body":2,"LHC: FCN":3,"LHC: FCA":2,"LHC: FFI":1,"LHC: LAD":1,"LHC: HDW":2,"LHC: ADW":1,"LHC: HSC":1}},{"id":"env_04","f":"Environmental","n":"Water Scarcity Impact on Manufacturing","d":"Contraction","i":1,"p":3,"s":-0.12,"e":{"LHC: IC":1,"LHC: FCN":3,"LHC: FCA":2,"LHC: FFI":1,"LHC: LAD":2,"LHC: HDW":2,"LHC: ADW":2,"LHC: HSC":2}},{"id":"env_05","f":"Environmental","n":"Plastic-Free Packaging Transition","d":"Contraction","i":1,"p":3,"s":-0.12,"e":{"LHC: IC":2,"Hair: Color":2,"Hair: Care":2,"Hair: Styling":2,"Hair: Body":2,"LHC: FCN":3,"LHC: FCA":2,"LHC: FFI":1,"LHC: LAD":2,"LHC: HDW":2,"LHC: ADW":2,"LHC: HSC":2}},{"id":"env_06","f":"Environmental","n":"Refill Economy Opportunity","d":"Expansion","i":5,"p":2,"s":0.4,"e":{"Hair: Color":1,"Hair: Care":2,"Hair: Styling":1,"Hair: Body":2,"LHC: FCN":3,"LHC: FCA":2,"LHC: LAD":1,"LHC: HDW":2,"LHC: HSC":2}},{"id":"env_07","f":"Environmental","n":"Carbon Pricing Impact on LHC Supply Chain","d":"Contraction","i":1,"p":3,"s":-0.12,"e":{"LHC: IC":2,"LHC: FCN":3,"LHC: FCA":2,"LHC: FFI":1,"LHC: LAD":2,"LHC: HDW":2,"LHC: ADW":2,"LHC: HSC":2}},{"id":"env_08","f":"Environmental","n":"Climate Impact on Insecticide Demand","d":"Expansion","i":1,"p":3,"s":0.12,"e":{"LHC: IC":3}},{"id":"env_09","f":"Environmental","n":"Insecticide Impact on Pollinators (Bee Decline)","d":"Contraction","i":1,"p":2,"s":-0.08,"e":{"LHC: IC":3}},{"id":"env_10","f":"Environmental","n":"Renewable Energy in Manufacturing (LHC)","d":"Expansion","i":5,"p":3,"s":0.6,"e":{"LHC: IC":2,"LHC: FCN":3,"LHC: FCA":2,"LHC: FFI":1,"LHC: LAD":2,"LHC: HDW":2,"LHC: ADW":2,"LHC: HSC":2}},{"id":"com_01","f":"Competitive","n":"D2C Indie Hair Brands (Function of Beauty, Olaplex)","d":"Contraction","i":1,"p":3,"s":-0.12,"e":{"Hair: Color":2,"Hair: Care":3,"Hair: Styling":3,"Hair: Body":1}},{"id":"com_02","f":"Competitive","n":"Amazon Basics / PL in LHC","d":"Contraction","i":1,"p":3,"s":-0.12,"e":{"LHC: IC":1,"LHC: FCN":3,"LHC: FCA":2,"LHC: FFI":1,"LHC: LAD":2,"LHC: HDW":2,"LHC: ADW":2,"LHC: HSC":2}},{"id":"com_03","f":"Competitive","n":"Consolidation in Hair Care (L'Or\u00e9al, Henkel, P&G)","d":"Expansion","i":5,"p":3,"s":0.6,"e":{"Hair: Color":2,"Hair: Care":2,"Hair: Styling":2,"Hair: Body":1}},{"id":"com_04","f":"Competitive","n":"Regional Insecticide Champions Emerging","d":"Contraction","i":1,"p":3,"s":-0.12,"e":{"LHC: IC":3}},{"id":"com_05","f":"Competitive","n":"Post-Inflation Price War Risk in Laundry","d":"Contraction","i":1,"p":3,"s":-0.12,"e":{"LHC: FCN":4,"LHC: FCA":3,"LHC: FFI":2,"LHC: LAD":2,"LHC: HDW":2,"LHC: ADW":2,"LHC: HSC":2}},{"id":"com_06","f":"Competitive","n":"Value Engineering & Cost Pass-Through Capability","d":"Expansion","i":5,"p":3,"s":0.6,"e":{"LHC: IC":2,"Hair: Color":2,"Hair: Care":2,"Hair: Styling":2,"Hair: Body":2,"LHC: FCN":3,"LHC: FCA":2,"LHC: FFI":1,"LHC: LAD":2,"LHC: HDW":2,"LHC: ADW":2,"LHC: HSC":2}},{"id":"com_07","f":"Competitive","n":"Cross-Category Competition (Pharma into Hair)","d":"Contraction","i":1,"p":2,"s":-0.08,"e":{"Hair: Color":1,"Hair: Care":2}},{"id":"com_08","f":"Competitive","n":"Eco-Innovation as Competitive Moat (Laundry)","d":"Expansion","i":5,"p":3,"s":0.6,"e":{"LHC: FCN":3,"LHC: FCA":2,"LHC: FFI":1,"LHC: LAD":2,"LHC: HDW":1,"LHC: ADW":2,"LHC: HSC":1}},{"id":"com_09","f":"Competitive","n":"ZBB & Productivity Programs (All Categories)","d":"Expansion","i":5,"p":3,"s":0.6,"e":{"LHC: IC":2,"Hair: Color":2,"Hair: Care":2,"Hair: Styling":2,"Hair: Body":2,"LHC: FCN":3,"LHC: FCA":2,"LHC: FFI":1,"LHC: LAD":2,"LHC: HDW":2,"LHC: ADW":2,"LHC: HSC":2}},{"id":"com_10","f":"Competitive","n":"Shared Services & Co-Manufacturing (LHC)","d":"Expansion","i":5,"p":3,"s":0.6,"e":{"LHC: IC":2,"LHC: FCN":3,"LHC: FCA":2,"LHC: FFI":1,"LHC: LAD":2,"LHC: HDW":2,"LHC: ADW":2,"LHC: HSC":2}}];

const YEARS = ["2026","2027","2028","2029","2030"];
const CATS = Object.keys(HEATMAP).sort();
const FI = {Consumer:"\u{1F464}",Customer:"\u{1F3EA}",Technology:"\u26A1",Government:"\u{1F3DB}\uFE0F",Environmental:"\u{1F331}",Competitive:"\u2694\uFE0F"};
const FC = {Consumer:"#818cf8",Customer:"#f472b6",Technology:"#38bdf8",Government:"#fbbf24",Environmental:"#34d399",Competitive:"#fb923c"};
const CC = ["#818cf8","#f472b6","#38bdf8","#fbbf24","#34d399","#fb923c","#a78bfa","#f87171","#22d3ee","#e879f9","#84cc16","#f59e0b"];
const FORCES = ["Consumer","Customer","Technology","Government","Environmental","Competitive"];

const fS = (v) => v==null?"—":`${v>=0?"+":""}${(v*100).toFixed(1)}%`;
const cBg = (v) => {const i=Math.min(Math.abs(v)/0.04,1); return v>0.001?`rgba(16,185,129,${0.1+i*0.5})`:v<-0.001?`rgba(239,68,68,${0.1+i*0.5})`:"rgba(107,114,128,0.15)";};
const cC = (v) => v>0.001?"#10b981":v<-0.001?"#ef4444":"#6b7280";

const G = {background:"rgba(26,26,46,0.6)",backdropFilter:"blur(20px)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:16,padding:20};
const H = {fontSize:12,color:"#8888a0",textTransform:"uppercase",letterSpacing:1,fontWeight:600,marginBottom:16};

// ── Score Dots ──────────────────────────────────────────────
function Dots({val,max=5}) {
  return <div style={{display:"flex",gap:2}}>
    {Array.from({length:max},(_,i)=><div key={i} style={{width:16,height:16,borderRadius:4,fontSize:9,fontFamily:"monospace",fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",background:i<val?"rgba(99,102,241,0.35)":"rgba(255,255,255,0.03)",color:i<val?"#818cf8":"#55556a",border:i<val?"1px solid rgba(99,102,241,0.3)":"1px solid transparent"}}>{i+1}</div>)}
  </div>;
}

// ── Trend Explorer ──────────────────────────────────────────
function TrendExplorer({onSelectCategory}) {
  const [search, setSearch] = useState("");
  const [forceFilter, setForceFilter] = useState(null);
  const [sortKey, setSortKey] = useState("s");
  const [sortDir, setSortDir] = useState("desc");
  const [expanded, setExpanded] = useState(null);

  const filtered = useMemo(() => {
    let list = [...TRENDS];
    if (search) { const q=search.toLowerCase(); list=list.filter(t=>t.n.toLowerCase().includes(q)||t.f.toLowerCase().includes(q)); }
    if (forceFilter) list=list.filter(t=>t.f===forceFilter);
    list.sort((a,b)=> {
      const av=typeof a[sortKey]==="string"?a[sortKey]:a[sortKey]||0;
      const bv=typeof b[sortKey]==="string"?b[sortKey]:b[sortKey]||0;
      if (typeof av==="string") return sortDir==="asc"?av.localeCompare(bv):bv.localeCompare(av);
      return sortDir==="asc"?av-bv:bv-av;
    });
    return list;
  }, [search,forceFilter,sortKey,sortDir]);

  const toggleSort=(k)=>{if(sortKey===k)setSortDir(d=>d==="asc"?"desc":"asc");else{setSortKey(k);setSortDir("desc");}};
  const SI=({col})=>{if(sortKey!==col)return <ArrowUpDown size={9} color="#55556a"/>;return sortDir==="asc"?<ArrowUp size={9} color="#818cf8"/>:<ArrowDown size={9} color="#818cf8"/>;};

  return (
    <div style={G}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:12}}>
        <span style={H}>Trend Explorer ({filtered.length} trends)</span>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <div style={{display:"flex",gap:3}}>
            <button onClick={()=>setForceFilter(null)} style={{fontSize:10,padding:"4px 10px",borderRadius:20,border:"none",cursor:"pointer",background:!forceFilter?"rgba(99,102,241,0.2)":"rgba(255,255,255,0.03)",color:!forceFilter?"#818cf8":"#55556a"}}>All</button>
            {FORCES.map(f=><button key={f} onClick={()=>setForceFilter(forceFilter===f?null:f)} style={{fontSize:10,padding:"4px 10px",borderRadius:20,border:"none",cursor:"pointer",background:forceFilter===f?"rgba(99,102,241,0.2)":"rgba(255,255,255,0.03)",color:forceFilter===f?"#818cf8":"#55556a"}}>{FI[f]} {f}</button>)}
          </div>
          <div style={{position:"relative"}}>
            <Search size={13} style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",color:"#55556a"}}/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search trends..." style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:8,padding:"6px 10px 6px 28px",fontSize:12,color:"#f0f0f5",width:180,outline:"none"}}/>
          </div>
        </div>
      </div>

      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:800}}>
          <thead>
            <tr style={{borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
              {[{k:"f",l:"Force"},{k:"n",l:"Trend"},{k:"d",l:"Direction"},{k:"i",l:"Impact"},{k:"p",l:"Probability"},{k:"s",l:"Score"}].map(c=>
                <th key={c.k} onClick={()=>toggleSort(c.k)} style={{textAlign:"left",fontSize:10,color:"#55556a",fontWeight:500,padding:"6px 8px",cursor:"pointer",userSelect:"none",textTransform:"uppercase",letterSpacing:0.5}}>
                  <span style={{display:"flex",alignItems:"center",gap:4}}>{c.l} <SI col={c.k}/></span>
                </th>
              )}
              <th style={{textAlign:"left",fontSize:10,color:"#55556a",fontWeight:500,padding:"6px 8px",textTransform:"uppercase",letterSpacing:0.5}}>Categories</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(t=>(
              <tr key={t.id} style={{borderBottom:"1px solid rgba(255,255,255,0.03)",cursor:"pointer",transition:"background 0.15s"}} onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.02)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"} onClick={()=>setExpanded(expanded===t.id?null:t.id)}>
                <td style={{padding:"8px"}}>
                  <span style={{fontSize:10,padding:"3px 8px",borderRadius:20,fontWeight:500,background:`${FC[t.f]}15`,color:FC[t.f]}}>{FI[t.f]} {t.f}</span>
                </td>
                <td style={{padding:"8px",fontSize:12,fontWeight:500,maxWidth:280}}>{t.n}</td>
                <td style={{padding:"8px"}}>
                  <span style={{fontSize:11,fontWeight:500,color:t.d==="Expansion"?"#10b981":"#ef4444"}}>{t.d==="Expansion"?"\u2191":"\u2193"} {t.d}</span>
                </td>
                <td style={{padding:"8px"}}><Dots val={t.i}/></td>
                <td style={{padding:"8px"}}><Dots val={t.p}/></td>
                <td style={{padding:"8px"}}>
                  <span style={{fontSize:12,fontFamily:"monospace",fontWeight:600,color:t.s>0?"#10b981":t.s<0?"#ef4444":"#6b7280"}}>{t.s>0?"+":""}{t.s.toFixed(3)}</span>
                </td>
                <td style={{padding:"8px"}}>
                  <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                    {Object.entries(t.e).slice(0,4).map(([cat,exp])=>
                      <span key={cat} onClick={e=>{e.stopPropagation();onSelectCategory?.(cat);}} style={{fontSize:9,padding:"2px 6px",borderRadius:10,background:"rgba(255,255,255,0.04)",color:"#8888a0",cursor:"pointer",whiteSpace:"nowrap"}}>{cat} <span style={{color:"#818cf8"}}>{exp}</span></span>
                    )}
                    {Object.keys(t.e).length>4 && <span style={{fontSize:9,color:"#55556a"}}>+{Object.keys(t.e).length-4}</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── KPI Card ────────────────────────────────────────────────
function KPI({icon:Icon,label,value,sub,color}) {
  return <div style={G}><div style={{display:"flex",alignItems:"center",gap:8,color:"#8888a0",fontSize:11,textTransform:"uppercase",letterSpacing:1,fontWeight:600,marginBottom:8}}><Icon size={14} color={color}/>{label}</div><div style={{fontSize:24,fontWeight:600,color,letterSpacing:"-0.5px"}}>{value}</div>{sub&&<div style={{fontSize:11,color:"#55556a",marginTop:4}}>{sub}</div>}</div>;
}

// ── Heatmap ─────────────────────────────────────────────────
function HeatmapView({onSelect}) {
  return <div style={G}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",...H}}>
      <span>Category x Year Shift Matrix</span>
      <div style={{display:"flex",gap:12,fontSize:10,color:"#55556a",textTransform:"none",letterSpacing:0}}>
        <span><span style={{display:"inline-block",width:10,height:10,borderRadius:3,background:"rgba(16,185,129,0.5)",marginRight:4,verticalAlign:"middle"}}/>Expansion</span>
        <span><span style={{display:"inline-block",width:10,height:10,borderRadius:3,background:"rgba(239,68,68,0.5)",marginRight:4,verticalAlign:"middle"}}/>Contraction</span>
      </div>
    </div>
    <table style={{width:"100%",borderCollapse:"collapse"}}>
      <thead><tr><th style={{textAlign:"left",fontSize:10,color:"#55556a",padding:"4px 8px",fontWeight:500}}>Category</th>{YEARS.map(y=><th key={y} style={{textAlign:"center",fontSize:10,color:"#55556a",padding:"4px 8px",fontWeight:500}}>{y}</th>)}</tr></thead>
      <tbody>{CATS.map(c=><tr key={c} onClick={()=>onSelect?.(c)} style={{cursor:"pointer"}}><td style={{fontSize:12,fontWeight:500,padding:"4px 8px",whiteSpace:"nowrap"}}>{c}</td>{YEARS.map(y=>{const v=HEATMAP[c][y];return<td key={y} style={{padding:3}}><div style={{background:cBg(v),color:cC(v),borderRadius:8,padding:"6px 10px",textAlign:"center",fontSize:12,fontFamily:"monospace",fontWeight:600}}>{fS(v)}</div></td>;})}</tr>)}</tbody>
    </table>
  </div>;
}

// ── Path Timeline ───────────────────────────────────────────
function Paths({selected}) {
  const data = useMemo(()=>[2025,...YEARS.map(Number)].map(y=>{const pt={year:y};CATS.forEach(c=>{pt[c]=y===2025?0:HEATMAP[c][String(y)]||0;});return pt;}),[]);
  const show = selected?[selected]:CATS.slice(0,6);
  return <div style={G}><span style={H}>Path Trajectories 2025-2030</span><div style={{height:300,marginTop:12}}><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{top:5,right:20,bottom:5,left:10}}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/><XAxis dataKey="year" tick={{fill:"#8888a0",fontSize:11}} axisLine={{stroke:"rgba(255,255,255,0.06)"}}/><YAxis tickFormatter={v=>`${(v*100).toFixed(0)}%`} tick={{fill:"#8888a0",fontSize:11}} axisLine={{stroke:"rgba(255,255,255,0.06)"}} width={45}/><Tooltip content={({active,payload,label})=>{if(!active||!payload?.length)return null;return<div style={{background:"rgba(26,26,46,0.95)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:12,padding:"10px 14px",boxShadow:"0 8px 32px rgba(0,0,0,0.4)"}}><div style={{fontSize:11,color:"#55556a",marginBottom:6}}>{label}</div>{payload.map((p,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:6,fontSize:12}}><span style={{width:6,height:6,borderRadius:3,background:p.color}}/><span style={{color:"#8888a0"}}>{p.name}:</span><span style={{fontFamily:"monospace",fontWeight:600,color:p.color}}>{fS(p.value)}</span></div>)}</div>;}}/>{show.map((c,i)=><Line key={c} type="monotone" dataKey={c} name={c} stroke={CC[CATS.indexOf(c)%CC.length]} strokeWidth={selected===c?3:2} dot={{r:3,fill:CC[CATS.indexOf(c)%CC.length]}}/>)}</LineChart></ResponsiveContainer></div></div>;
}

// ── Force Radar ─────────────────────────────────────────────
function FRadar() {
  const data=FORCES_DATA.map(f=>({force:f.name,score:Math.abs(f.avg_score)*100}));
  return <div style={G}><span style={H}>Force Landscape</span><div style={{height:280}}><ResponsiveContainer width="100%" height="100%"><RadarChart data={data}><PolarGrid stroke="rgba(255,255,255,0.06)"/><PolarAngleAxis dataKey="force" tick={({x,y,payload})=><text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill="#8888a0" style={{fontSize:10}}>{FI[payload.value]} {payload.value}</text>}/><Radar dataKey="score" stroke="#818cf8" fill="#818cf8" fillOpacity={0.15} strokeWidth={2}/></RadarChart></ResponsiveContainer></div>
    <div style={{display:"flex",flexWrap:"wrap",gap:12,justifyContent:"center",marginTop:8}}>{FORCES_DATA.map(f=><div key={f.name} style={{display:"flex",alignItems:"center",gap:4,fontSize:10}}><span style={{width:6,height:6,borderRadius:3,background:FC[f.name]}}/><span style={{color:"#55556a"}}>{f.name}</span><span style={{color:f.net_direction==="Expansion"?"#10b981":"#ef4444"}}>{f.net_direction==="Expansion"?"\u2191":"\u2193"}</span><span style={{fontSize:9,color:"#55556a"}}>{f.expansion_count}E/{f.contraction_count}C</span></div>)}</div>
  </div>;
}

// ═══════════════════════════════════════════════════════════════
export default function ProfitPoolShiftModel() {
  const [tab,setTab]=useState("overview");
  const [selCat,setSelCat]=useState(null);
  const avg=CATS.reduce((s,c)=>s+HEATMAP[c]["2030"],0)/CATS.length;
  const topE=CATS.reduce((b,c)=>HEATMAP[c]["2030"]>HEATMAP[b]["2030"]?c:b,CATS[0]);
  const topC=CATS.reduce((b,c)=>HEATMAP[c]["2030"]<HEATMAP[b]["2030"]?c:b,CATS[0]);

  return <div style={{minHeight:"100vh",background:"#0a0a0f",color:"#f0f0f5",fontFamily:"-apple-system,BlinkMacSystemFont,'SF Pro Display','Inter',sans-serif"}}>
    {/* Header */}
    <div style={{position:"sticky",top:0,zIndex:40,backdropFilter:"blur(20px)",background:"rgba(10,10,15,0.8)",borderBottom:"1px solid rgba(255,255,255,0.06)",padding:"12px 24px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <div style={{display:"flex",alignItems:"center",gap:16}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,borderRadius:10,background:"rgba(99,102,241,0.2)",display:"flex",alignItems:"center",justifyContent:"center"}}><Activity size={16} color="#6366f1"/></div>
          <div><div style={{fontSize:14,fontWeight:700,letterSpacing:"-0.3px"}}>PRISM</div><div style={{fontSize:8,color:"#55556a",textTransform:"uppercase",letterSpacing:2}}>Profit Pool Shift Model</div></div>
        </div>
        <div style={{display:"flex",gap:2,background:"rgba(255,255,255,0.03)",borderRadius:10,padding:3,marginLeft:12}}>
          {[{id:"overview",l:"Overview"},{id:"trends",l:"Trends"}].map(t=>
            <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"6px 16px",borderRadius:8,border:"none",fontSize:12,fontWeight:500,cursor:"pointer",background:tab===t.id?"rgba(255,255,255,0.06)":"transparent",color:tab===t.id?"#f0f0f5":"#55556a",transition:"all 0.2s"}}>{t.l}</button>
          )}
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <div style={{display:"inline-flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:20,background:"rgba(16,185,129,0.12)",color:"#10b981",fontSize:10,fontWeight:600}}>Converged <span style={{fontFamily:"monospace",opacity:0.7}}>R\u0302{"<"}1.05 | 5K iter</span></div>
        <div style={{background:"rgba(26,26,46,0.6)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"8px 16px",fontSize:13,display:"flex",alignItems:"center",gap:8}}><span style={{color:"#818cf8",fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Scenario:</span><span style={{fontWeight:500}}>Base Case</span></div>
      </div>
    </div>

    <div style={{maxWidth:1440,margin:"0 auto",padding:24,display:"flex",flexDirection:"column",gap:20}}>
      {tab==="overview" && <>
        <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
          <KPI icon={TrendingUp} label="Portfolio Shift 2030" value={fS(avg)} sub="5,000 Bayesian MC iterations" color="#10b981"/>
          <KPI icon={BarChart3} label="Top Expansion" value={fS(HEATMAP[topE]["2030"])} sub={topE} color="#10b981"/>
          <KPI icon={Activity} label="Lowest Growth" value={fS(HEATMAP[topC]["2030"])} sub={topC} color="#f59e0b"/>
          <KPI icon={Layers} label="Model" value="Active" sub="60 trends \u00b7 12 categories \u00b7 6 forces" color="#6366f1"/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}><HeatmapView onSelect={setSelCat}/><Paths selected={selCat}/></div>
        <FRadar/>
      </>}
      {tab==="trends" && <TrendExplorer onSelectCategory={setSelCat}/>}
      <div style={{textAlign:"center",padding:16,fontSize:10,color:"#55556a"}}>PRISM v3.0 \u00b7 Bayesian MC t-Copula (\u03BD=4) \u00b7 Financial Firewall active \u00b7 All values relative % only</div>
    </div>
  </div>;
}
