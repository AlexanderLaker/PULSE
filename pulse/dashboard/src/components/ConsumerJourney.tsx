/**
 * ConsumerJourney.tsx — Consumer Journey Profit Flow Map
 *
 * Two journey overviews:
 * 1. Laundry & Home Care (13 stages: Sorting → Between Washes)
 * 2. Hair Consumer Business (8 stages: Inspire → Refresh/Between)
 *
 * Each overview is split horizontally:
 *   - TOP half: product types that BENEFIT (Expansion) from trends & forces
 *   - BOTTOM half: product types NEGATIVELY IMPACTED (Contraction)
 *
 * This is a derived analytical view — products are mapped to journey stages
 * based on where they live in the consumer's life, then colored by the
 * directional impact of PRISM's force assessment.
 */

import { useState } from 'react';
import { T } from '../lib/format';

// ═══════════════════════════════════════════════════════════════
// DATA: Laundry & Home Care — 13 Journey Stages
// ═══════════════════════════════════════════════════════════════

interface ProductEntry {
  name: string;
  type: 'product' | 'tech' | 'service';
}

interface JourneyStage {
  id: string;
  label: string;
  benefiting: ProductEntry[];
  negativelyImpacted: ProductEntry[];
}

const LHC_JOURNEY: JourneyStage[] = [
  {
    id: 'sorting',
    label: 'Sorting',
    benefiting: [
      { name: 'AI stain/fabric recognition apps', type: 'tech' },
      { name: 'Garment care label / QR scanning tools', type: 'tech' },
      { name: 'Smart sorting assistants', type: 'service' },
    ],
    negativelyImpacted: [
      { name: 'Manual sorting aids (baskets, dividers)', type: 'product' },
      { name: 'Generic care label guides', type: 'product' },
    ],
  },
  {
    id: 'pre_treating',
    label: 'Pre-Treating',
    benefiting: [
      { name: 'Enzyme-based stain removers (bio-actives)', type: 'product' },
      { name: 'Targeted stain pens & sprays', type: 'product' },
      { name: 'Ultrasonic stain erasers', type: 'tech' },
      { name: 'Plant-based odor neutralizers', type: 'product' },
    ],
    negativelyImpacted: [
      { name: 'Conventional chlorine-based pre-treaters', type: 'product' },
      { name: 'Solvent-based fabric protectors', type: 'product' },
      { name: 'Soil-release coatings (chemicals under regulation)', type: 'product' },
    ],
  },
  {
    id: 'loading',
    label: 'Loading',
    benefiting: [
      { name: 'Microfibre filters (regulatory tailwind)', type: 'product' },
      { name: 'Smart load sensors / add-ons', type: 'tech' },
      { name: 'Laundry balls (reduce detergent need)', type: 'product' },
    ],
    negativelyImpacted: [
      { name: 'Delicate bags / drum accessories (commoditized)', type: 'product' },
      { name: 'Manual dosing aids', type: 'product' },
    ],
  },
  {
    id: 'add_products',
    label: 'Add Products',
    benefiting: [
      { name: 'Concentrated / ultra-compact detergents', type: 'product' },
      { name: 'Detergent sheets & pods (format innovation)', type: 'product' },
      { name: 'Bio / enzyme-boosted finishers', type: 'product' },
      { name: 'Refill systems & subscriptions', type: 'service' },
      { name: 'Premium fragrance boosters (beads)', type: 'product' },
    ],
    negativelyImpacted: [
      { name: 'Traditional powder detergent (bulk)', type: 'product' },
      { name: 'Conventional liquid detergent (dilute)', type: 'product' },
      { name: 'Chlorine-based whiteners', type: 'product' },
      { name: 'Home-made detergent (DIY movement)', type: 'product' },
      { name: 'Chemical-heavy additives (anti-greying, anti-lime)', type: 'product' },
    ],
  },
  {
    id: 'select_wash',
    label: 'Select Wash Settings',
    benefiting: [
      { name: 'Smart home apps (auto program selection)', type: 'tech' },
      { name: 'AI-based wash advisors', type: 'tech' },
      { name: 'Auto-dosing machines', type: 'tech' },
    ],
    negativelyImpacted: [
      { name: 'Manual program dials', type: 'tech' },
      { name: 'Generic dosing instructions on packaging', type: 'product' },
    ],
  },
  {
    id: 'washing_cycle',
    label: 'Washing Cycle',
    benefiting: [
      { name: 'Smart / connected machines (auto-dose)', type: 'tech' },
      { name: 'Cold-wash optimized detergents', type: 'product' },
      { name: 'Water softening integrated systems', type: 'tech' },
      { name: 'Maintenance subscription services', type: 'service' },
    ],
    negativelyImpacted: [
      { name: 'Standard / non-connected machines', type: 'tech' },
      { name: 'Hot-wash detergent formulas', type: 'product' },
      { name: 'Separate water softening products (Calgon-type)', type: 'product' },
    ],
  },
  {
    id: 'unloading',
    label: 'Unloading',
    benefiting: [
      { name: 'Anti-mustiness products (post-wash freshness)', type: 'product' },
      { name: 'Anti-wrinkle spray (post-cycle)', type: 'product' },
      { name: 'Smart reminders (app notifications)', type: 'tech' },
    ],
    negativelyImpacted: [
      { name: 'Standalone fabric softeners (declining relevance)', type: 'product' },
    ],
  },
  {
    id: 'drying',
    label: 'Drying',
    benefiting: [
      { name: 'Heat pump dryers (energy-efficient)', type: 'tech' },
      { name: 'Dryer sheets with fragrance boosters', type: 'product' },
      { name: 'Tumble dryer balls (eco-friendly)', type: 'product' },
      { name: 'Dehumidifiers for indoor drying', type: 'tech' },
    ],
    negativelyImpacted: [
      { name: 'Traditional vented tumble dryers', type: 'tech' },
      { name: 'Basic drying racks (commoditized)', type: 'product' },
      { name: 'Chemical-based static removers', type: 'product' },
    ],
  },
  {
    id: 'ironing',
    label: 'Ironing',
    benefiting: [
      { name: 'Garment steamers (replacing irons)', type: 'tech' },
      { name: 'Anti-wrinkle sprays (skip ironing)', type: 'product' },
      { name: 'Wrinkle-release fabric technologies', type: 'tech' },
      { name: 'Steam closets / garment refresh cabinets', type: 'tech' },
    ],
    negativelyImpacted: [
      { name: 'Traditional irons & ironing boards', type: 'tech' },
      { name: 'Ironing starch sprays', type: 'product' },
      { name: 'Ironing accessories (covers, pads)', type: 'product' },
    ],
  },
  {
    id: 'folding_storing',
    label: 'Folding & Storing',
    benefiting: [
      { name: 'Anti-moth & fabric protection solutions', type: 'product' },
      { name: 'Fabric perfumes & closet scents', type: 'product' },
      { name: 'Smart wardrobe management apps', type: 'tech' },
      { name: 'Anti-humidity devices', type: 'tech' },
    ],
    negativelyImpacted: [
      { name: 'Mothballs (chemical, declining appeal)', type: 'product' },
      { name: 'Basic storage boxes & organizers', type: 'product' },
    ],
  },
  {
    id: 'taking_out',
    label: 'Taking Out of Closet',
    benefiting: [
      { name: 'On-the-go refresh sprays', type: 'product' },
      { name: 'Deodorizing mists (quick freshening)', type: 'product' },
      { name: 'Fragrance refresh boosters', type: 'product' },
    ],
    negativelyImpacted: [
      { name: 'Re-wash cycle (replaced by refresh products)', type: 'service' },
      { name: 'Heavy fragrance products (consumer shift to subtle)', type: 'product' },
    ],
  },
  {
    id: 'wearing',
    label: 'Wearing',
    benefiting: [
      { name: 'Anti-stain / anti-odor clothing technologies', type: 'tech' },
      { name: 'Garment protection coatings', type: 'product' },
      { name: 'Textile softeners (beyond wash cycle)', type: 'product' },
      { name: 'Clothing repair kits & devices', type: 'product' },
      { name: 'Fashion lifecycle services (repair, renew, resale)', type: 'service' },
    ],
    negativelyImpacted: [
      { name: 'Fast fashion (disposable garments vs. garment care)', type: 'product' },
      { name: 'Single-use stain wipes (plastic regulation)', type: 'product' },
    ],
  },
  {
    id: 'between_washes',
    label: 'Between Washes',
    benefiting: [
      { name: 'Fabric refresh sprays', type: 'product' },
      { name: 'On-the-go clothing freshener / anti-static', type: 'product' },
      { name: 'Garment steaming devices (portable)', type: 'tech' },
      { name: 'Smart refreshing cabinets / steam closets', type: 'tech' },
      { name: 'UV garment sanitizers', type: 'tech' },
      { name: 'Dry shampoo for clothes', type: 'product' },
    ],
    negativelyImpacted: [
      { name: 'Full wash cycle (over-washing trend declining)', type: 'service' },
      { name: 'Fabric de-wrinkling gadgets (niche, low adoption)', type: 'tech' },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// DATA: Hair Consumer Business — 8 Journey Stages
// ═══════════════════════════════════════════════════════════════

const HAIR_JOURNEY: JourneyStage[] = [
  {
    id: 'inspire',
    label: 'Inspire',
    benefiting: [
      { name: 'Shade finders & AR try-on tools', type: 'tech' },
      { name: 'Style inspiration apps & platforms', type: 'tech' },
      { name: 'Creator & community platforms', type: 'service' },
      { name: 'Trend-led inspiration collections', type: 'product' },
      { name: 'Digital consultation (AI-matched looks)', type: 'service' },
    ],
    negativelyImpacted: [
      { name: 'Shade & style lookbooks (print / static)', type: 'product' },
      { name: 'Occasion-based hair solutions (declining format)', type: 'product' },
      { name: 'Traditional salon consultation (non-digital)', type: 'service' },
    ],
  },
  {
    id: 'diagnose',
    label: 'Diagnose',
    benefiting: [
      { name: 'Scalp & hair scanners (camera-based)', type: 'tech' },
      { name: 'AI hair profiling (color, damage, texture)', type: 'tech' },
      { name: 'Porosity & damage diagnostic tests', type: 'product' },
      { name: 'Dermatological & trichology assessments', type: 'service' },
      { name: 'Hormonal & deficiency screening', type: 'service' },
    ],
    negativelyImpacted: [
      { name: 'Scalp analysis kits (basic / manual)', type: 'product' },
      { name: 'Generic hair type guides', type: 'product' },
      { name: 'Weather / environment tracking (low engagement)', type: 'tech' },
    ],
  },
  {
    id: 'prepare',
    label: 'Prepare',
    benefiting: [
      { name: 'Scalp protection & comfort systems', type: 'product' },
      { name: 'Bond builders (pre-color treatment)', type: 'product' },
      { name: 'Heat & UV protectants / heat prep', type: 'product' },
      { name: 'Anti-humidity & anti-frizz primers', type: 'product' },
      { name: 'Detox / exfoliation scrubs', type: 'product' },
      { name: 'Pre-treatment applicators (precision dosing)', type: 'tech' },
    ],
    negativelyImpacted: [
      { name: 'Basic pre-color treatments (commoditized)', type: 'product' },
      { name: 'Chelation treatments (niche awareness)', type: 'service' },
      { name: 'Manual sectioning tools (replaced by devices)', type: 'product' },
    ],
  },
  {
    id: 'remedy',
    label: 'Remedy',
    benefiting: [
      { name: 'Hair loss & thinning treatments (growth serums)', type: 'product' },
      { name: 'Scalp care & barrier repair products', type: 'product' },
      { name: 'Regenerative scalp devices (LED, microcurrent)', type: 'tech' },
      { name: 'Anti-dandruff & sensitive scalp remedies', type: 'product' },
      { name: 'Dermatological consultation (clinical supervision)', type: 'service' },
      { name: 'LLLT tools (scalp dysfunction treatment)', type: 'tech' },
    ],
    negativelyImpacted: [
      { name: 'Generic dandruff shampoo (commoditized)', type: 'product' },
      { name: 'Water softening devices (limited adoption)', type: 'tech' },
      { name: 'Life-phase programs (condition-linked, low awareness)', type: 'service' },
    ],
  },
  {
    id: 'transform',
    label: 'Transform',
    benefiting: [
      { name: 'Permanent & demi-permanent color', type: 'product' },
      { name: 'Balayage, highlight & brow tints', type: 'product' },
      { name: 'Bond repair & strengthen treatments', type: 'product' },
      { name: 'Texture changers (perms, relaxers, keratin)', type: 'product' },
      { name: 'Salon coloration & blending services', type: 'service' },
      { name: 'Color application tools (precision devices)', type: 'tech' },
      { name: 'Brows, lashes & growth serums', type: 'product' },
    ],
    negativelyImpacted: [
      { name: 'Temporary color (declining share vs. permanent)', type: 'product' },
      { name: 'Cleansers & basic shampoo (reduced frequency)', type: 'product' },
      { name: 'Grey blending (niche, growing but small base)', type: 'product' },
      { name: 'Wigs & full hair systems (stigma barrier)', type: 'product' },
    ],
  },
  {
    id: 'lock_finish',
    label: 'Lock & Finish',
    benefiting: [
      { name: 'pH balance & neutralization systems', type: 'product' },
      { name: 'After-color bond protection / cuticle sealing', type: 'product' },
      { name: 'Color stabilizers & color-lock serums', type: 'product' },
      { name: 'Hair perfumes & scent finishing', type: 'product' },
      { name: 'Post-color stabilization services', type: 'service' },
    ],
    negativelyImpacted: [
      { name: 'Basic hold / fix products (commoditized)', type: 'product' },
      { name: 'Shine-only products (low differentiation)', type: 'product' },
      { name: 'Conventional hair accessories (non-functional)', type: 'product' },
    ],
  },
  {
    id: 'maintain_optimize',
    label: 'Maintain & Optimize',
    benefiting: [
      { name: 'Color protection systems (UV, heat, pollution defense)', type: 'product' },
      { name: 'Climadaptive protection (environmental shields)', type: 'product' },
      { name: 'Anti-frizz & smoothing sprays', type: 'product' },
      { name: 'Scalp stimulation & regeneration devices', type: 'tech' },
      { name: 'Biological support (ingestibles, supplements)', type: 'product' },
      { name: 'Condition tracking & smart reminders', type: 'tech' },
      { name: 'Subscription / programmatic care services', type: 'service' },
    ],
    negativelyImpacted: [
      { name: 'Tone & fade protection (anti-yellowing, narrow use)', type: 'product' },
      { name: 'Fragrance refresh boosters (low differentiation)', type: 'product' },
      { name: 'Deodorizing mists for hair (niche)', type: 'product' },
    ],
  },
  {
    id: 'refresh_between',
    label: 'Refresh / In-Between',
    benefiting: [
      { name: 'Dry shampoo (volume & convenience)', type: 'product' },
      { name: 'Root retouch sprays (instant color refresh)', type: 'product' },
      { name: 'Color correction & neutralization products', type: 'product' },
      { name: 'Leave-ins & overnight treatments', type: 'product' },
      { name: 'Scalp care & balance mists', type: 'product' },
      { name: 'Portable styling tools', type: 'tech' },
      { name: 'Refresh & renewal services (salon express)', type: 'service' },
    ],
    negativelyImpacted: [
      { name: 'Glosses (limited repeat purchase)', type: 'product' },
      { name: 'Garment steaming for hair (novelty, low adoption)', type: 'tech' },
      { name: 'On-the-go freshener sprays (fragrance-only, undifferentiated)', type: 'product' },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// TYPE BADGE COLORS
// ═══════════════════════════════════════════════════════════════

const TYPE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  product: { bg: 'rgba(0,113,227,0.10)', text: '#0071E3', label: 'Product' },
  tech:    { bg: 'rgba(0,180,216,0.10)', text: '#00B4D8', label: 'Tech/Device' },
  service: { bg: 'rgba(123,97,255,0.10)', text: '#7B61FF', label: 'Service' },
};

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

interface ConsumerJourneyProps {
  onBack?: () => void;
}

export default function ConsumerJourney({ onBack }: ConsumerJourneyProps) {
  const [activeTab, setActiveTab] = useState<'lhc' | 'hair'>('lhc');

  const journey = activeTab === 'lhc' ? LHC_JOURNEY : HAIR_JOURNEY;
  const title = activeTab === 'lhc'
    ? 'Laundry & Home Care — Consumer Journey'
    : 'Hair Consumer Business — Consumer Journey';
  const subtitle = activeTab === 'lhc'
    ? '13 stages from Sorting to Between Washes — product types mapped by profit pool impact direction'
    : '8 stages from Inspire to Refresh — product types mapped by profit pool impact direction';

  return (
    <div style={{ fontFamily: T.sans, color: T.text, background: T.bg, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: T.bg, borderBottom: `1px solid ${T.border}`,
        padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 24,
      }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '4px 8px', borderRadius: 6, display: 'flex', alignItems: 'center',
              color: T.accent, fontSize: 13, fontWeight: 500, fontFamily: T.sans,
              gap: 4, marginRight: -8,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = T.bg1; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
            War Room
          </button>
        )}
        <div style={{ fontSize: 15, fontWeight: 700, color: T.text, letterSpacing: -0.3 }}>
          PRISM
        </div>
        <div style={{ fontSize: 13, color: T.text3, marginRight: 'auto' }}>
          Consumer Journey
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 2, background: T.bg1, borderRadius: 8, padding: 2 }}>
          {(['lhc', 'hair'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600, fontFamily: T.sans,
                background: activeTab === tab ? '#fff' : 'transparent',
                color: activeTab === tab ? T.text : T.text3,
                boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {tab === 'lhc' ? 'Laundry & Home Care' : 'Hair'}
            </button>
          ))}
        </div>
      </div>

      {/* Title area */}
      <div style={{ padding: '20px 24px 8px', maxWidth: 1600, margin: '0 auto' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: -0.3 }}>{title}</h2>
        <p style={{ fontSize: 12, color: T.text3, margin: '4px 0 0' }}>{subtitle}</p>
      </div>

      {/* Legend */}
      <div style={{ padding: '4px 24px 12px', maxWidth: 1600, margin: '0 auto', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(48,209,88,0.15)', border: '1px solid rgba(48,209,88,0.3)' }} />
          <span style={{ fontSize: 11, color: T.text2 }}>Benefiting (Expansion)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(255,69,58,0.10)', border: '1px solid rgba(255,69,58,0.25)' }} />
          <span style={{ fontSize: 11, color: T.text2 }}>Negatively Impacted (Contraction)</span>
        </div>
        <div style={{ width: 1, height: 14, background: T.border }} />
        {Object.entries(TYPE_STYLES).map(([key, s]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 3,
              background: s.bg, color: s.text, letterSpacing: 0.3,
            }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Journey grid */}
      <div style={{
        padding: '0 24px 40px', maxWidth: 1600, margin: '0 auto',
        overflowX: 'auto',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${journey.length}, minmax(170px, 1fr))`,
          gap: 1,
          background: T.border,
          borderRadius: 10,
          overflow: 'hidden',
          border: `1px solid ${T.border1}`,
        }}>
          {/* Column headers */}
          {journey.map((stage, i) => (
            <div key={stage.id + '_header'} style={{
              background: T.bg1,
              padding: '10px 10px 8px',
              textAlign: 'center',
              borderBottom: `2px solid ${T.border2}`,
            }}>
              <div style={{
                fontSize: 9, fontWeight: 700, color: T.text2, letterSpacing: 1,
                textTransform: 'uppercase',
              }}>
                {`Stage ${i + 1}`}
              </div>
              <div style={{
                fontSize: 11, fontWeight: 700, color: T.text, marginTop: 2,
                lineHeight: 1.25,
              }}>
                {stage.label}
              </div>
            </div>
          ))}

          {/* Benefiting row (green) */}
          {journey.map(stage => (
            <div key={stage.id + '_benefit'} style={{
              background: 'rgba(48,209,88,0.03)',
              padding: '8px 8px',
              minHeight: 160,
              borderBottom: `1px solid ${T.border1}`,
            }}>
              <div style={{
                fontSize: 8, fontWeight: 700, color: '#30D158', letterSpacing: 1,
                textTransform: 'uppercase', marginBottom: 6, opacity: 0.7,
              }}>
                ▲ Benefiting
              </div>
              {stage.benefiting.map((p, i) => (
                <ProductPill key={i} entry={p} direction="expansion" />
              ))}
            </div>
          ))}

          {/* Negatively impacted row (red) */}
          {journey.map(stage => (
            <div key={stage.id + '_negative'} style={{
              background: 'rgba(255,69,58,0.02)',
              padding: '8px 8px',
              minHeight: 120,
            }}>
              <div style={{
                fontSize: 8, fontWeight: 700, color: '#FF453A', letterSpacing: 1,
                textTransform: 'uppercase', marginBottom: 6, opacity: 0.7,
              }}>
                ▼ Declining
              </div>
              {stage.negativelyImpacted.map((p, i) => (
                <ProductPill key={i} entry={p} direction="contraction" />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Arrow flow indicator */}
      <div style={{
        padding: '0 24px 32px', maxWidth: 1600, margin: '0 auto',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{ fontSize: 11, color: T.text3, fontWeight: 600 }}>
          Consumer flow →
        </div>
        <div style={{
          flex: 1, height: 2,
          background: `linear-gradient(90deg, ${T.accent}33, ${T.accent}05)`,
          borderRadius: 1,
        }} />
        <div style={{ fontSize: 10, color: T.text4, fontStyle: 'italic' }}>
          {activeTab === 'lhc'
            ? 'From pre-wash preparation through garment lifecycle to between-wash care'
            : 'From inspiration and diagnosis through transformation to ongoing maintenance'
          }
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENT: Product Pill
// ═══════════════════════════════════════════════════════════════

function ProductPill({ entry, direction }: { entry: ProductEntry; direction: 'expansion' | 'contraction' }) {
  const typeStyle = (TYPE_STYLES[entry.type] ?? TYPE_STYLES['product'])!;
  const borderColor = direction === 'expansion'
    ? 'rgba(48,209,88,0.15)'
    : 'rgba(255,69,58,0.12)';

  return (
    <div style={{
      marginBottom: 4,
      padding: '4px 6px',
      borderRadius: 5,
      background: direction === 'expansion' ? 'rgba(48,209,88,0.05)' : 'rgba(255,69,58,0.04)',
      border: `1px solid ${borderColor}`,
      display: 'flex', alignItems: 'flex-start', gap: 4,
    }}>
      <span style={{
        fontSize: 8, fontWeight: 600, padding: '0px 3px', borderRadius: 2,
        background: typeStyle.bg, color: typeStyle.text,
        flexShrink: 0, marginTop: 1, letterSpacing: 0.2,
      }}>
        {entry.type === 'tech' ? 'T' : entry.type === 'service' ? 'S' : 'P'}
      </span>
      <span style={{
        fontSize: 10, color: T.text2, lineHeight: 1.3,
      }}>
        {entry.name}
      </span>
    </div>
  );
}
