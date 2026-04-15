/**
 * ProductImpactRankings — Top 15 positive & negative product-type impacts
 * Positioned below the heatmap in the Profit Pool Shift Model overview.
 *
 * Derives granular product-type impact rankings by cross-referencing
 * the simulation shift matrix with trend-level category exposure and
 * directional scores. Each product type represents a specific
 * category × force × trend intersection.
 *
 * Click any item → opens ProductImpactDetail modal with full AI analysis.
 */

import { useState, useMemo, FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, ChevronRight, Globe, Clock, Sparkles, X } from 'lucide-react';
import type { ShiftMatrix, Trend, ForceName } from '../types';
import { T, CATEGORIES, FORCES, FORCE_COLORS, YEARS, fmtShift, shiftColorHex } from '../lib/format';
import ProductImpactDetail from './ProductImpactDetail';

// ── Types ──────────────────────────────────────────────────────────

export interface ProductImpactItem {
  id: string;
  rank: number;
  productType: string;          // e.g. "Premium Hair Color (Salon)"
  category: string;             // Category ID
  categoryName: string;         // "Hair: Color"
  categoryShort: string;        // "Color"
  force: ForceName;             // Primary driving force
  shift2030: number;            // Median shift at 2030
  shift2028: number;            // Median shift at 2028
  velocity: number;             // Rate of change (acceleration)
  confidence: string;           // High / Medium / Low
  direction: 'Expansion' | 'Contraction';
  trendIds: string[];           // Contributing trend IDs
  trendNames: string[];         // Contributing trend names
  trendDescriptions: string[];  // Evidence descriptions
  sources: Array<{ title: string; url: string; data: string }>;
  geography: Record<string, number>; // Region → exposure score
  timeframe: string;            // "Near-term (2026-2028)" | "Medium-term" | "Long-term"
  marketOpportunity: string;    // Qualitative description
  strategicImplication: string; // Action recommendation
}

interface ProductImpactRankingsProps {
  shifts: ShiftMatrix | null;
  trends: Trend[];
  onCategorySelect?: (categoryId: string) => void;
}

// ── Product Type Mapping ───────────────────────────────────────────
// Maps category × force combinations to specific product types
// This is the FMCG domain knowledge layer

const PRODUCT_TYPE_MAP: Record<string, Record<string, string>> = {
  hair_color: {
    Consumer:      'Premium At-Home Color Kits',
    Customer:      'Salon-Exclusive Color Lines',
    Technology:    'AI-Personalized Color Matching',
    Government:    'Clean-Formula Color (EU Compliant)',
    Environmental: 'Ammonia-Free / Plant-Based Color',
    Competitive:   'Value-Tier Color (Private Label Defense)',
  },
  hair_care: {
    Consumer:      'Natural / Clean Shampoo & Conditioner',
    Customer:      'Pharmacy-Channel Hair Treatments',
    Technology:    'Biotech Hair Repair (Keratin-Tech)',
    Government:    'Microplastic-Free Hair Care',
    Environmental: 'Waterless / Solid Hair Care',
    Competitive:   'Premium Scalp Care (Clinical)',
  },
  hair_styling: {
    Consumer:      'Texture & Curl Defining Products',
    Customer:      'Travel & Mini-Size Styling',
    Technology:    'Heat-Activated Smart Styling',
    Government:    'VOC-Compliant Styling Sprays',
    Environmental: 'Refillable Styling Systems',
    Competitive:   'Professional Styling (Salon Brands)',
  },
  hair_body: {
    Consumer:      'Men\'s Grooming Body Wash',
    Customer:      'Shower Gel Multipacks (Discounter)',
    Technology:    'Probiotic Body Care',
    Government:    'Allergen-Free Body Wash',
    Environmental: 'Concentrated Body Wash Pods',
    Competitive:   'Premium Body Oil & Lotion',
  },
  lhc_fcn: {
    Consumer:      'Eco-Conscious Laundry Detergent',
    Customer:      'E-Commerce Subscription Detergent',
    Technology:    'Cold-Wash Enzyme Detergent',
    Government:    'Phosphate-Free Detergent (EU)',
    Environmental: 'Ultra-Concentrated Refill Pouches',
    Competitive:   'Premium Capsule / Pod Formats',
  },
  lhc_fca: {
    Consumer:      'Specialty Delicates & Wool Care',
    Customer:      'Premium Shelf Fabric Care (Pharmacy/Dept)',
    Technology:    'Fiber-Protect Enzyme Technology',
    Government:    'Allergen-Labeled Specialty Detergent',
    Environmental: 'Plant-Based Delicate Wash',
    Competitive:   'Specialty Fabric Protection (Perwoll-Tier)',
  },
  lhc_ffi: {
    Consumer:      'Fragrance-Boosted Fabric Softener',
    Customer:      'Club-Format Softener & Dryer Sheets',
    Technology:    'Micro-Encapsulated Scent Beads',
    Government:    'Allergen-Labeled Softener Products',
    Environmental: 'Plant-Based Fabric Softener',
    Competitive:   'Premium Scent Experience (Lenor/Downy Defense)',
  },
  lhc_lad: {
    Consumer:      'In-Wash Scent Boosters & Enhancers',
    Customer:      'Online-Optimized Laundry Add-Ons',
    Technology:    'AI-Dosed Smart Dispensing Additives',
    Government:    'EU Detergent Regulation (Labeling)',
    Environmental: 'Sheet / Strip Laundry Additives',
    Competitive:   'Premium Scent Booster Formats',
  },
  lhc_hdw: {
    Consumer:      'Premium Hand Dishwash Concentrate',
    Customer:      'Discounter Hand Dishwash',
    Technology:    'Grease-Cutting Enzyme Formulas',
    Government:    'Skin-Safe Hand Dishwash (Derma-Tested)',
    Environmental: 'Refill-Station Hand Dishwash',
    Competitive:   'Antibacterial Hand Dishwash',
  },
  lhc_adw: {
    Consumer:      'Rinse-Aid & Specialty Dishwasher',
    Customer:      'Private-Label Dishwasher Tabs',
    Technology:    'Water-Saving Smart Dosing Dishwasher',
    Government:    'PFAS-Free Dishwasher Products',
    Environmental: 'Plastic-Free Dishwasher Pods',
    Competitive:   'All-in-One Performance Tabs',
  },
  lhc_hsc: {
    Consumer:      'Premium Specialty Surface Cleaners',
    Customer:      'Convenience-Store Ready Wipes',
    Technology:    'Probiotic / Enzyme Cleaners',
    Government:    'Biocide-Regulated Disinfectants',
    Environmental: 'Plastic-Free Cleaning Tabs',
    Competitive:   'Professional-Grade Home Cleaners',
  },
  lhc_ic: {
    Consumer:      'Outdoor Insect Repellent (DEET-Free)',
    Customer:      'Seasonal Insecticide Displays',
    Technology:    'Smart Home Insect Devices',
    Government:    'EU Biocide Regulation (BPR Art 95)',
    Environmental: 'Bio-Based Insecticide Sprays',
    Competitive:   'Raid-Alternative Premium Formats',
  },
};

// ── Geography Labels ───────────────────────────────────────────────

const GEO_LABELS: Record<string, string> = {
  'Europe': '🇪🇺 Europe',
  'North America': '🇺🇸 North America',
  'Asia': '🇨🇳 Asia-Pacific',
  'High Growth': '🌍 High Growth Markets',
};

// ── Helper: Extract Shift Value ────────────────────────────────────

function extractVal(path: unknown, year: number): number {
  if (!path) return 0;
  if (typeof path === 'number') return path;
  const p = path as Record<string, unknown>;
  if (p[year] != null) {
    const val = p[year];
    if (typeof val === 'object' && val !== null) {
      const obj = val as Record<string, unknown>;
      return (obj.median ?? obj.p50 ?? 0) as number;
    }
    return val as number;
  }
  if (p.median && typeof p.median === 'object') {
    return ((p.median as Record<string, number>)[year]) || 0;
  }
  return 0;
}

// ── Compute Product Impact Rankings ────────────────────────────────

function computeRankings(
  shifts: ShiftMatrix | null,
  trends: Trend[],
): ProductImpactItem[] {
  if (!shifts || trends.length === 0) return [];

  const items: ProductImpactItem[] = [];

  for (const cat of CATEGORIES) {
    const catShifts = shifts[cat.id];
    if (!catShifts) continue;

    const shift2030 = extractVal(catShifts, 2030);
    const shift2028 = extractVal(catShifts, 2028);
    const shift2026 = extractVal(catShifts, 2026);

    // Group trends by force for this category
    const forceGroups: Record<string, Trend[]> = {};
    for (const trend of trends) {
      const exposure = trend.category_exposure?.[cat.id as keyof typeof trend.category_exposure] ??
                       trend.category_exposure?.[cat.name as keyof typeof trend.category_exposure] ?? 0;
      if (typeof exposure === 'number' && exposure >= 2) {
        const force = trend.force;
        if (!forceGroups[force]) forceGroups[force] = [];
        forceGroups[force].push(trend);
      }
    }

    // For each force with relevant trends, create a product-type entry
    for (const [force, forceTrends] of Object.entries(forceGroups)) {
      const productTypeName = PRODUCT_TYPE_MAP[cat.id]?.[force] || `${cat.short} (${force})`;

      // Compute weighted impact from contributing trends
      const totalWeight = forceTrends.reduce((sum, t) => {
        const exp = (t.category_exposure?.[cat.id as keyof typeof t.category_exposure] ?? 3) as number;
        const score = (t.probability ?? 3);
        return sum + score * exp;
      }, 0);

      // Scale: use the category's shift, weighted by this force's share
      const allForceWeights = Object.entries(forceGroups).reduce((acc, [f, fts]) => {
        acc[f] = fts.reduce((s, t) => {
          const exp = (t.category_exposure?.[cat.id as keyof typeof t.category_exposure] ?? 3) as number;
          return s + (t.probability ?? 3) * exp;
        }, 0);
        return acc;
      }, {} as Record<string, number>);

      const totalAllForces = Object.values(allForceWeights).reduce((a, b) => a + b, 0);
      const forceShare = totalAllForces > 0 ? (totalWeight / totalAllForces) : (1 / Object.keys(forceGroups).length);

      const forceShift2030 = shift2030 * forceShare;
      const forceShift2028 = shift2028 * forceShare;
      const velocity = (forceShift2030 - forceShift2028) / 2; // annualized

      // Aggregate direction from trends
      const expansionScore = forceTrends
        .filter(t => t.direction === 'Expansion')
        .reduce((s, t) => s + (t.probability ?? 3), 0);
      const contractionScore = forceTrends
        .filter(t => t.direction === 'Contraction')
        .reduce((s, t) => s + (t.probability ?? 3), 0);

      // Determine primary direction
      let direction: 'Expansion' | 'Contraction' = forceShift2030 >= 0 ? 'Expansion' : 'Contraction';
      if (Math.abs(forceShift2030) < 0.001) {
        direction = expansionScore >= contractionScore ? 'Expansion' : 'Contraction';
      }

      // Aggregate geography from trends
      const geoAgg: Record<string, number[]> = {};
      for (const t of forceTrends) {
        if (t.regional_exposure) {
          for (const [region, score] of Object.entries(t.regional_exposure)) {
            if (!geoAgg[region]) geoAgg[region] = [];
            geoAgg[region].push(score as number);
          }
        }
      }
      const geography: Record<string, number> = {};
      for (const [region, scores] of Object.entries(geoAgg)) {
        geography[region] = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10;
      }
      // Default if no regional data
      if (Object.keys(geography).length === 0) {
        geography['Europe'] = 4;
        geography['North America'] = 3;
        geography['Asia'] = 2;
        geography['High Growth'] = 2;
      }

      // Aggregate confidence
      const confidences = forceTrends.map(t => t.confidence || 'Medium');
      const confScore = confidences.reduce((s, c) =>
        s + (c === 'High' ? 3 : c === 'Medium' ? 2 : 1), 0) / confidences.length;
      const confidence = confScore >= 2.5 ? 'High' : confScore >= 1.5 ? 'Medium' : 'Low';

      // Determine timeframe
      const avgStartYear = forceTrends.reduce((s, t) => s + (t.start_year ?? 2026), 0) / forceTrends.length;
      let timeframe = 'Medium-term (2027-2029)';
      if (avgStartYear <= 2026.5) timeframe = 'Near-term (2026-2028)';
      else if (avgStartYear >= 2028.5) timeframe = 'Long-term (2029-2030)';

      // Collect sources
      const allSources = forceTrends.flatMap(t => t.sources || []);
      const uniqueSources = allSources.filter((s, i, arr) =>
        arr.findIndex(x => x.url === s.url) === i
      ).slice(0, 5);

      // Market opportunity description
      const absShift = Math.abs(forceShift2030);
      let marketOpp = '';
      if (direction === 'Expansion') {
        if (absShift >= 0.03) marketOpp = 'Major growth opportunity — early investment recommended';
        else if (absShift >= 0.015) marketOpp = 'Moderate growth potential — consider resource allocation';
        else marketOpp = 'Incremental expansion — monitor and prepare';
      } else {
        if (absShift >= 0.03) marketOpp = 'Significant contraction risk — defensive strategy needed';
        else if (absShift >= 0.015) marketOpp = 'Moderate headwind — portfolio review recommended';
        else marketOpp = 'Mild pressure — watch for acceleration signals';
      }

      // Strategic implication from top trend
      const topTrend = forceTrends.sort((a, b) =>
        (b.probability ?? 3) - (a.probability ?? 3)
      )[0];

      items.push({
        id: `${cat.id}_${force}`,
        rank: 0,
        productType: productTypeName,
        category: cat.id,
        categoryName: cat.name,
        categoryShort: cat.short,
        force: force as ForceName,
        shift2030: forceShift2030,
        shift2028: forceShift2028,
        velocity,
        confidence,
        direction,
        trendIds: forceTrends.map(t => t.id),
        trendNames: forceTrends.map(t => t.name),
        trendDescriptions: forceTrends.map(t => t.description),
        sources: uniqueSources,
        geography,
        timeframe,
        marketOpportunity: marketOpp,
        strategicImplication: topTrend?.strategic_implication || '',
      });
    }
  }

  return items;
}

// ── Main Component ─────────────────────────────────────────────────

const ProductImpactRankings: FC<ProductImpactRankingsProps> = ({
  shifts,
  trends,
  onCategorySelect,
}) => {
  const [selectedItem, setSelectedItem] = useState<ProductImpactItem | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const allItems = useMemo(() => computeRankings(shifts, trends), [shifts, trends]);

  const { positive, negative } = useMemo(() => {
    // Sort by shift2030 descending for positive, ascending for negative
    const sorted = [...allItems].sort((a, b) => b.shift2030 - a.shift2030);

    const pos = sorted
      .filter(i => i.shift2030 > 0.001)
      .slice(0, 15)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));

    const neg = sorted
      .filter(i => i.shift2030 < -0.001)
      .reverse()
      .slice(0, 15)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));

    return { positive: pos, negative: neg };
  }, [allItems]);

  if (positive.length === 0 && negative.length === 0) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        style={{ marginBottom: 32 }}
      >
        {/* Section Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: `linear-gradient(135deg, ${T.accent}, ${T.purple})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles size={16} color="#fff" />
          </div>
          <div>
            <h3 style={{
              fontSize: 16, fontWeight: 650, color: T.text, margin: 0,
              letterSpacing: '-0.02em', fontFamily: T.sans,
            }}>
              Product Type Impact Rankings
            </h3>
            <p style={{
              fontSize: 12, color: T.text3, margin: '2px 0 0', fontFamily: T.sans,
            }}>
              Top 15 highest positive and negative profit pool impacts by product type — click for PRISM AI analysis
            </p>
          </div>
        </div>

        {/* Two columns: Positive & Negative */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 20,
        }}>
          {/* ── POSITIVE IMPACT BOX ────────────────────── */}
          <div style={{
            background: T.bg,
            borderRadius: 14,
            border: `1px solid ${T.border2}`,
            overflow: 'hidden',
            boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
          }}>
            {/* Header */}
            <div style={{
              padding: '14px 18px',
              borderBottom: `1px solid ${T.border}`,
              display: 'flex', alignItems: 'center', gap: 8,
              background: T.greenDim,
            }}>
              <TrendingUp size={15} color={T.green} strokeWidth={2.5} />
              <span style={{
                fontSize: 13, fontWeight: 650, color: T.green,
                letterSpacing: '-0.01em', fontFamily: T.sans,
              }}>
                Highest Positive Impact
              </span>
              <span style={{
                fontSize: 11, color: T.text3, marginLeft: 'auto', fontFamily: T.sans,
              }}>
                {positive.length} product types
              </span>
            </div>

            {/* List */}
            <div style={{ maxHeight: 640, overflowY: 'auto' }}>
              {positive.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: T.text3, fontSize: 13 }}>
                  No positive impacts detected. Run a simulation first.
                </div>
              ) : positive.map((item) => (
                <RankingRow
                  key={item.id}
                  item={item}
                  isPositive={true}
                  isHovered={hoveredId === item.id}
                  onHover={setHoveredId}
                  onClick={() => setSelectedItem(item)}
                />
              ))}
            </div>
          </div>

          {/* ── NEGATIVE IMPACT BOX ────────────────────── */}
          <div style={{
            background: T.bg,
            borderRadius: 14,
            border: `1px solid ${T.border2}`,
            overflow: 'hidden',
            boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
          }}>
            {/* Header */}
            <div style={{
              padding: '14px 18px',
              borderBottom: `1px solid ${T.border}`,
              display: 'flex', alignItems: 'center', gap: 8,
              background: T.redDim,
            }}>
              <TrendingDown size={15} color={T.red} strokeWidth={2.5} />
              <span style={{
                fontSize: 13, fontWeight: 650, color: T.red,
                letterSpacing: '-0.01em', fontFamily: T.sans,
              }}>
                Highest Negative Impact
              </span>
              <span style={{
                fontSize: 11, color: T.text3, marginLeft: 'auto', fontFamily: T.sans,
              }}>
                {negative.length} product types
              </span>
            </div>

            {/* List */}
            <div style={{ maxHeight: 640, overflowY: 'auto' }}>
              {negative.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: T.text3, fontSize: 13 }}>
                  No negative impacts detected. Run a simulation first.
                </div>
              ) : negative.map((item) => (
                <RankingRow
                  key={item.id}
                  item={item}
                  isPositive={false}
                  isHovered={hoveredId === item.id}
                  onHover={setHoveredId}
                  onClick={() => setSelectedItem(item)}
                />
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Detail Modal ────────────────────────────── */}
      <AnimatePresence>
        {selectedItem && (
          <ProductImpactDetail
            item={selectedItem}
            allTrends={trends}
            onClose={() => setSelectedItem(null)}
            onCategorySelect={onCategorySelect}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default ProductImpactRankings;

// ── Ranking Row Sub-Component ──────────────────────────────────────

interface RankingRowProps {
  item: ProductImpactItem;
  isPositive: boolean;
  isHovered: boolean;
  onHover: (id: string | null) => void;
  onClick: () => void;
}

const RankingRow: FC<RankingRowProps> = ({ item, isPositive, isHovered, onHover, onClick }) => {
  const forceColor = FORCE_COLORS[item.force] || T.text3;
  const shiftColor = isPositive ? T.green : T.red;
  const bgHover = isHovered ? (isPositive ? 'rgba(48,209,88,0.04)' : 'rgba(255,69,58,0.04)') : 'transparent';

  // Geographic summary — top 2 regions
  const topGeos = Object.entries(item.geography)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2)
    .map(([region]) => {
      if (region === 'Europe') return '🇪🇺';
      if (region === 'North America') return '🇺🇸';
      if (region === 'Asia') return '🇨🇳';
      return '🌍';
    })
    .join(' ');

  return (
    <motion.div
      onClick={onClick}
      onMouseEnter={() => onHover(item.id)}
      onMouseLeave={() => onHover(null)}
      whileTap={{ scale: 0.995 }}
      style={{
        display: 'grid',
        gridTemplateColumns: '28px 1fr auto auto 18px',
        alignItems: 'center',
        gap: 10,
        padding: '11px 16px',
        cursor: 'pointer',
        borderBottom: `1px solid ${T.border}`,
        background: bgHover,
        transition: 'background 0.15s',
      }}
    >
      {/* Rank */}
      <span style={{
        fontSize: 12, fontWeight: 700, color: T.text3,
        fontFamily: T.mono, textAlign: 'center',
        width: 22, height: 22, borderRadius: 6,
        background: T.bg1, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {item.rank}
      </span>

      {/* Name + Category + Force */}
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 550, color: T.text,
          letterSpacing: '-0.01em', fontFamily: T.sans,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {item.productType}
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginTop: 3,
        }}>
          <span style={{
            fontSize: 10, fontWeight: 600, color: forceColor,
            background: `${forceColor}12`, padding: '1px 6px',
            borderRadius: 4, letterSpacing: '0.02em',
            textTransform: 'uppercase',
          }}>
            {item.force}
          </span>
          <span style={{ fontSize: 11, color: T.text3 }}>
            {item.categoryShort}
          </span>
          <span style={{ fontSize: 10, color: T.text4, marginLeft: 2 }}>
            {topGeos}
          </span>
        </div>
      </div>

      {/* Timeframe Badge */}
      <div style={{
        fontSize: 10, color: T.text3, fontFamily: T.sans,
        display: 'flex', alignItems: 'center', gap: 3,
      }}>
        <Clock size={10} />
        {item.timeframe.includes('Near') ? '2026-28' : item.timeframe.includes('Long') ? '2029-30' : '2027-29'}
      </div>

      {/* Shift Value */}
      <div style={{
        fontFamily: T.mono, fontSize: 13, fontWeight: 600,
        color: shiftColor, textAlign: 'right', minWidth: 56,
      }}>
        {fmtShift(item.shift2030)}
      </div>

      {/* Chevron */}
      <ChevronRight
        size={14}
        color={isHovered ? shiftColor : T.text4}
        style={{ transition: 'color 0.15s, transform 0.15s', transform: isHovered ? 'translateX(2px)' : 'none' }}
      />
    </motion.div>
  );
};
