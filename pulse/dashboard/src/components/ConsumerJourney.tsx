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

import { useState, useCallback } from 'react';
import { T } from '../lib/format';

// ═══════════════════════════════════════════════════════════════
// DATA: Laundry & Home Care — 13 Journey Stages
// ═══════════════════════════════════════════════════════════════

interface ProductEntry {
  name: string;
  type: 'product' | 'tech' | 'service';
  trendDrivers: string; // Specific PRISM trend(s) driving this product's fate
  intensity?: 1 | 2 | 3; // Impact intensity: 1=mild, 2=moderate, 3=strong
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
      { name: 'AI stain/fabric recognition apps', type: 'tech', trendDrivers: 'T-01 AI-Driven Formulation enables intelligent analysis', intensity: 3 },
      { name: 'Smart fabric scanner & QR tools', type: 'tech', trendDrivers: 'T-07 AI Personalization + T-01 AI enablement', intensity: 3 },
      { name: 'Garment care advisory service (digital)', type: 'service', trendDrivers: 'T-07 AI Personalization + K-04 Social Commerce', intensity: 2 },
      { name: 'Smart home integration platforms', type: 'tech', trendDrivers: 'T-01 + T-08 Connected Appliances auto-sorting', intensity: 3 },
    ],
    negativelyImpacted: [
      { name: 'Manual sorting aids (baskets, dividers)', type: 'product', trendDrivers: 'T-01 AI displacement of manual tasks', intensity: 2 },
      { name: 'Generic care label guides (print)', type: 'product', trendDrivers: 'T-07 Digital replaces static instructions', intensity: 1 },
      { name: 'Fabric identification cards', type: 'product', trendDrivers: 'T-01 AI recognition obsoletes manuals', intensity: 1 },
    ],
  },
  {
    id: 'pre_treating',
    label: 'Pre-Treating',
    benefiting: [
      { name: 'Enzyme-based stain removers (bio-actives)', type: 'product', trendDrivers: 'T-02 Bio-Based Chemistry + T-01 enzyme optimization', intensity: 3 },
      { name: 'Targeted stain pens & precision sprays', type: 'product', trendDrivers: 'T-03 Concentrated Formats enable targeted dosing', intensity: 2 },
      { name: 'Ultrasonic stain erasers (devices)', type: 'tech', trendDrivers: 'T-05 Manufacturing Automation + IoT devices', intensity: 2 },
      { name: 'Plant-based odor neutralizers', type: 'product', trendDrivers: 'T-02 Bio-Based Chemistry + C-04 Conscious Consumption', intensity: 2 },
      { name: 'Smart stain analyzer (app + device)', type: 'tech', trendDrivers: 'T-01 AI-Driven Formulation for stain ID', intensity: 3 },
      { name: 'Sustainable stain removal subscriptions', type: 'service', trendDrivers: 'C-04 Cleanical Beauty + K-06 Subscription models', intensity: 2 },
    ],
    negativelyImpacted: [
      { name: 'Chlorine-based pre-treaters', type: 'product', trendDrivers: 'G-01 PFAS Restriction + G-02 Microplastics Ban', intensity: 3 },
      { name: 'Solvent-based fabric protectors', type: 'product', trendDrivers: 'G-01 PFAS + G-03 Cosmetics Regulation extends to textiles', intensity: 3 },
      { name: 'Soil-release coatings (PFCs)', type: 'product', trendDrivers: 'G-01 PFAS Restriction (direct regulatory hit)', intensity: 3 },
      { name: 'Heavy chemical stain blockers', type: 'product', trendDrivers: 'G-05 Green Claims Directive (greenwashing crackdown)', intensity: 2 },
      { name: 'Synthetic perfume-heavy pre-treaters', type: 'product', trendDrivers: 'C-04 Conscious Consumption + G-05 Green Claims', intensity: 2 },
    ],
  },
  {
    id: 'loading',
    label: 'Loading',
    benefiting: [
      { name: 'Microfibre filters (catch clothing shedding)', type: 'product', trendDrivers: 'G-02 Microplastics Ban Phase 2 (regulatory tailwind)', intensity: 3 },
      { name: 'Smart load sensors / weight add-ons', type: 'tech', trendDrivers: 'T-08 Connected Appliances + IoT load detection', intensity: 2 },
      { name: 'Laundry optimization balls', type: 'product', trendDrivers: 'T-03 Concentrated Formats reduce detergent need', intensity: 2 },
      { name: 'Auto-load-weighing machine adapters', type: 'tech', trendDrivers: 'T-05 Manufacturing Automation integration', intensity: 2 },
      { name: 'Fabric care dispensing systems', type: 'product', trendDrivers: 'T-03 Concentrated Formats + T-08 Auto-dosing', intensity: 2 },
    ],
    negativelyImpacted: [
      { name: 'Delicate bags / drum accessories', type: 'product', trendDrivers: 'T-08 Smart machines obsolete manual aids', intensity: 1 },
      { name: 'Manual dosing aids / scoops', type: 'product', trendDrivers: 'T-08 Auto-dosing displaces manual measuring', intensity: 2 },
      { name: 'Fabric softening balls (low-tech)', type: 'product', trendDrivers: 'T-03 Concentrated formats eliminate need', intensity: 1 },
      { name: 'Generic load guides (printed)', type: 'product', trendDrivers: 'T-07 AI Personalization replaces static guides', intensity: 1 },
    ],
  },
  {
    id: 'add_products',
    label: 'Add Products',
    benefiting: [
      { name: 'Concentrated / ultra-compact detergents', type: 'product', trendDrivers: 'T-03 Concentrated Formats (core innovation) + G-04 PPWR', intensity: 3 },
      { name: 'Detergent sheets & pods (eco-formats)', type: 'product', trendDrivers: 'T-03 Solid Formats + G-04 PPWR + E-02 Water scarcity', intensity: 3 },
      { name: 'Refill systems & eco-subscriptions', type: 'service', trendDrivers: 'G-04 PPWR Packaging Waste Regulation + C-04 Conscious', intensity: 2 },
      { name: 'Bio-enzymatic booster packs', type: 'product', trendDrivers: 'T-02 Bio-Based Chemistry + T-01 enzyme optimization', intensity: 3 },
      { name: 'Premium fragrance bead boosters', type: 'product', trendDrivers: 'C-03 Premiumization Hair Care extends to home care', intensity: 2 },
      { name: 'Plant-based washing pod tablets', type: 'product', trendDrivers: 'T-02 Bio-Based Chemistry + G-05 Green Claims', intensity: 2 },
      { name: 'Modular detergent mix-your-own systems', type: 'product', trendDrivers: 'T-07 AI Personalization + T-03 Concentrated Formats', intensity: 2 },
      { name: 'Subscription laundry boxes (recurring)', type: 'service', trendDrivers: 'K-06 Subscription Lock-in trend + convenience', intensity: 2 },
    ],
    negativelyImpacted: [
      { name: 'Traditional bulk powder detergent', type: 'product', trendDrivers: 'T-03 Concentrated Formats displace dilute powders', intensity: 3 },
      { name: 'Conventional large liquid bottles', type: 'product', trendDrivers: 'T-03 Concentrated Formats + G-04 PPWR (packaging)', intensity: 3 },
      { name: 'Chlorine-based whiteners / bleach', type: 'product', trendDrivers: 'G-01 PFAS + G-02 Microplastics regulatoin', intensity: 3 },
      { name: 'Separate water softening salts', type: 'product', trendDrivers: 'T-08 Integrated water treatment in machines', intensity: 2 },
      { name: 'Synthetic optical brighteners', type: 'product', trendDrivers: 'G-05 Green Claims Directive (microplastic brighteners banned)', intensity: 2 },
      { name: 'Anti-greying chemical additives', type: 'product', trendDrivers: 'G-03 Cosmetics Regulation VII/VIII extends to additives', intensity: 2 },
      { name: 'DIY home-made detergent kits', type: 'product', trendDrivers: 'C-06 Cost-of-Living Squeeze pressures this niche', intensity: 1 },
    ],
  },
  {
    id: 'select_wash',
    label: 'Select Wash Settings',
    benefiting: [
      { name: 'Smart home apps (auto program selection)', type: 'tech', trendDrivers: 'T-08 Connected Appliances + IoT integration', intensity: 3 },
      { name: 'AI-based wash cycle advisors', type: 'tech', trendDrivers: 'T-01 AI-Driven systems for fabric optimization', intensity: 2 },
      { name: 'Auto-dosing machine ecosystems', type: 'tech', trendDrivers: 'T-08 Connected Appliances + T-05 Automation', intensity: 3 },
      { name: 'Voice-activated wash controls', type: 'tech', trendDrivers: 'T-01 AI + smart home voice assistants', intensity: 2 },
      { name: 'Mobile app machine pairing', type: 'service', trendDrivers: 'T-07 AI Personalization + K-04 Social Commerce', intensity: 2 },
    ],
    negativelyImpacted: [
      { name: 'Manual mechanical program dials', type: 'tech', trendDrivers: 'T-08 Connected Appliances displace manual controls', intensity: 2 },
      { name: 'Generic dosing instructions (packaging)', type: 'product', trendDrivers: 'T-01 AI + T-07 Personal dosing replaces generic', intensity: 1 },
      { name: 'Paper washing guides / manuals', type: 'product', trendDrivers: 'T-07 Digital instructions replace paper', intensity: 1 },
    ],
  },
  {
    id: 'washing_cycle',
    label: 'Washing Cycle',
    benefiting: [
      { name: 'Smart / connected washers (auto-dose)', type: 'tech', trendDrivers: 'T-08 Connected Appliances + T-05 Manufacturing Automation', intensity: 3 },
      { name: 'Cold-wash optimized detergents', type: 'product', trendDrivers: 'T-01 AI-Driven formulation for cold-water efficiency', intensity: 3 },
      { name: 'Water softening integrated systems', type: 'tech', trendDrivers: 'T-08 Connected Appliances + integrated water treatment', intensity: 2 },
      { name: 'Maintenance & care subscriptions', type: 'service', trendDrivers: 'K-06 Subscription models + post-purchase services', intensity: 2 },
      { name: 'Energy-monitor detergents (IoT-linked)', type: 'product', trendDrivers: 'T-08 Connected Appliances report water/energy usage', intensity: 2 },
      { name: 'Machine health predictive services', type: 'service', trendDrivers: 'T-05 Manufacturing Automation + IoT monitoring', intensity: 2 },
    ],
    negativelyImpacted: [
      { name: 'Standard non-connected machines', type: 'tech', trendDrivers: 'T-08 Connected Appliances obsolete legacy hardware', intensity: 3 },
      { name: 'Hot-wash detergent formulas', type: 'product', trendDrivers: 'T-01 AI cold-wash optimization + energy efficiency', intensity: 2 },
      { name: 'Standalone Calgon-type water softeners', type: 'product', trendDrivers: 'T-08 Integrated machine water treatment', intensity: 2 },
      { name: 'Static water-hardness testing strips', type: 'product', trendDrivers: 'T-08 IoT machines auto-detect water hardness', intensity: 1 },
      { name: 'High-temperature wash detergents', type: 'product', trendDrivers: 'E-02 Water Scarcity + energy efficiency trends', intensity: 2 },
    ],
  },
  {
    id: 'unloading',
    label: 'Unloading',
    benefiting: [
      { name: 'Anti-mustiness freshness solutions', type: 'product', trendDrivers: 'C-04 Conscious Consumption wants fresh, not masked', intensity: 2 },
      { name: 'Anti-wrinkle post-cycle sprays', type: 'product', trendDrivers: 'T-03 Concentrated Formats enable targeted sprays', intensity: 2 },
      { name: 'Smart unload reminders (app notifications)', type: 'tech', trendDrivers: 'T-08 Connected Appliances send completion alerts', intensity: 1 },
      { name: 'Odor-elimination fabric mists', type: 'product', trendDrivers: 'C-04 Conscious Consumption + bio-based solutions', intensity: 2 },
      { name: 'Microfiber-safe freshness products', type: 'product', trendDrivers: 'G-02 Microplastics Ban creates new care category', intensity: 2 },
    ],
    negativelyImpacted: [
      { name: 'Standalone fabric softeners (liquid)', type: 'product', trendDrivers: 'T-03 Concentrated Formats integrated into pods', intensity: 3 },
      { name: 'Heavy perfumed rinse aids', type: 'product', trendDrivers: 'C-04 Conscious Consumption + subtle scent preference', intensity: 2 },
      { name: 'Synthetic static-control sheets', type: 'product', trendDrivers: 'G-05 Green Claims + E-02 sustainability concerns', intensity: 2 },
    ],
  },
  {
    id: 'drying',
    label: 'Drying',
    benefiting: [
      { name: 'Heat pump dryers (energy-efficient)', type: 'tech', trendDrivers: 'E-02 Energy efficiency + climate consciousness', intensity: 3 },
      { name: 'Dryer sheets with scent boosters', type: 'product', trendDrivers: 'C-03 Premiumization extends to drying products', intensity: 2 },
      { name: 'Tumble dryer balls (eco-friendly)', type: 'product', trendDrivers: 'G-04 PPWR + E-02 Water Scarcity reduces fabric conditioner need', intensity: 2 },
      { name: 'Dehumidifiers for air-dry optimization', type: 'tech', trendDrivers: 'E-02 Water Scarcity drives alternative drying', intensity: 1 },
      { name: 'Smart dryer sensors & IoT tracking', type: 'tech', trendDrivers: 'T-08 Connected Appliances enable drying optimization', intensity: 2 },
    ],
    negativelyImpacted: [
      { name: 'Traditional vented tumble dryers', type: 'tech', trendDrivers: 'E-02 Energy efficiency pressure + heat pump adoption', intensity: 3 },
      { name: 'Basic drying racks (commoditized)', type: 'product', trendDrivers: 'T-08 Smart dryers with optimal timing', intensity: 1 },
      { name: 'Chemical static-removing sprays', type: 'product', trendDrivers: 'G-05 Green Claims Directive bans synthetic chemicals', intensity: 2 },
      { name: 'Dryer perfume papers (PVA-based)', type: 'product', trendDrivers: 'G-02 Microplastics Ban (polymer particle restrictions)', intensity: 2 },
    ],
  },
  {
    id: 'ironing',
    label: 'Ironing',
    benefiting: [
      { name: 'Garment steamers (replacing irons)', type: 'tech', trendDrivers: 'T-08 Connected Appliances + faster convenience trend', intensity: 3 },
      { name: 'Anti-wrinkle fabric treatment sprays', type: 'product', trendDrivers: 'T-03 Concentrated Formats + C-04 Conscious Consumption', intensity: 2 },
      { name: 'Wrinkle-release fabric technologies (apparel)', type: 'tech', trendDrivers: 'T-01 AI formulations for wrinkle-resistant textiles', intensity: 2 },
      { name: 'Steam closets / smart garment refresh cabinets', type: 'tech', trendDrivers: 'T-08 Connected Appliances + IoT clothing care', intensity: 2 },
      { name: 'Portable cordless garment steamers', type: 'tech', trendDrivers: 'T-05 Manufacturing Automation enables compact designs', intensity: 2 },
      { name: 'Smart garment care services (on-demand)', type: 'service', trendDrivers: 'K-04 Social Commerce + convenience premium', intensity: 2 },
    ],
    negativelyImpacted: [
      { name: 'Traditional irons & ironing boards', type: 'tech', trendDrivers: 'T-08 Steamers + smart fabrics displace irons', intensity: 3 },
      { name: 'Ironing starch sprays (traditional)', type: 'product', trendDrivers: 'T-03 Solid formats + fabric finish technologies', intensity: 2 },
      { name: 'Ironing accessories (covers, pads, stands)', type: 'product', trendDrivers: 'C-06 Cost-of-Living Squeeze + ironing decline', intensity: 2 },
      { name: 'Starch and sizing products (classic)', type: 'product', trendDrivers: 'T-01 AI fabrics reduce starch need', intensity: 1 },
    ],
  },
  {
    id: 'folding_storing',
    label: 'Folding & Storing',
    benefiting: [
      { name: 'Smart anti-moth & fabric protection', type: 'product', trendDrivers: 'T-01 AI-optimized formula + C-04 Conscious Consumption', intensity: 2 },
      { name: 'Fabric perfumes & closet scents (premium)', type: 'product', trendDrivers: 'C-03 Premiumization in home care products', intensity: 2 },
      { name: 'Smart wardrobe management apps', type: 'tech', trendDrivers: 'T-07 AI Personalization + T-08 IoT closet sensors', intensity: 2 },
      { name: 'Anti-humidity & moisture control devices', type: 'tech', trendDrivers: 'E-02 Water Scarcity + climate adaptation', intensity: 1 },
      { name: 'Bio-based garment protection solutions', type: 'product', trendDrivers: 'T-02 Bio-Based Chemistry + C-04 Conscious', intensity: 2 },
      { name: 'Smart storage container systems', type: 'tech', trendDrivers: 'T-08 Connected Appliances + home automation', intensity: 2 },
    ],
    negativelyImpacted: [
      { name: 'Mothballs (chemical, declining appeal)', type: 'product', trendDrivers: 'G-01 PFAS concerns + C-04 Conscious Consumption', intensity: 2 },
      { name: 'Basic storage boxes & organizers', type: 'product', trendDrivers: 'T-08 Smart storage obsoletes manual systems', intensity: 1 },
      { name: 'Synthetic fragrance closet bars', type: 'product', trendDrivers: 'C-04 Conscious Consumption + natural preference', intensity: 1 },
      { name: 'Wool blanket storage treatments', type: 'product', trendDrivers: 'T-02 Bio-Based Chemistry replaces synthetic treatments', intensity: 1 },
    ],
  },
  {
    id: 'taking_out',
    label: 'Taking Out of Closet',
    benefiting: [
      { name: 'On-the-go clothing refresh sprays', type: 'product', trendDrivers: 'C-06 Cost-of-Living Squeeze reduces dry cleaning', intensity: 2 },
      { name: 'Deodorizing mists (quick freshening)', type: 'product', trendDrivers: 'T-03 Concentrated Formats enable portable bottles', intensity: 2 },
      { name: 'Fragrance refresh boosters (natural)', type: 'product', trendDrivers: 'C-04 Conscious Consumption + T-02 Bio-Based Chemistry', intensity: 2 },
      { name: 'Fabric care on-demand services', type: 'service', trendDrivers: 'K-04 Social Commerce + convenience premium', intensity: 1 },
      { name: 'Smart scent dispensers', type: 'tech', trendDrivers: 'T-08 IoT fabric care devices', intensity: 1 },
    ],
    negativelyImpacted: [
      { name: 'Full re-wash cycle (replaced by refresh)', type: 'service', trendDrivers: 'C-06 Cost-of-Living Squeeze pressure + water scarcity', intensity: 2 },
      { name: 'Heavy synthetic fragrance products', type: 'product', trendDrivers: 'C-04 Conscious Consumption shift to subtle', intensity: 1 },
      { name: 'Conventional dry cleaning services', type: 'service', trendDrivers: 'C-06 Cost-of-Living Squeeze + E-02 sustainability', intensity: 2 },
    ],
  },
  {
    id: 'wearing',
    label: 'Wearing',
    benefiting: [
      { name: 'Anti-stain / anti-odor smart textiles', type: 'tech', trendDrivers: 'T-01 AI-optimized fiber coatings + T-02 Bio-Based', intensity: 3 },
      { name: 'Garment protection nano-coatings', type: 'product', trendDrivers: 'T-02 Bio-Based Chemistry + T-01 nano-formulations', intensity: 2 },
      { name: 'Textile softeners (beyond wash cycle)', type: 'product', trendDrivers: 'T-03 Concentrated Formats enable targeted application', intensity: 1 },
      { name: 'Clothing repair kits & devices', type: 'product', trendDrivers: 'C-04 Conscious Consumption + garment lifecycle extension', intensity: 2 },
      { name: 'Fashion lifecycle services (repair/resale)', type: 'service', trendDrivers: 'K-07 Professional Salon Crossover extends to fashion', intensity: 2 },
      { name: 'Stain-guard pre-treatment services', type: 'service', trendDrivers: 'C-03 Premiumization + K-07 Professional services', intensity: 2 },
    ],
    negativelyImpacted: [
      { name: 'Fast fashion disposable garments', type: 'product', trendDrivers: 'C-04 Conscious Consumption + G-06 Deforestation Reg', intensity: 2 },
      { name: 'Single-use stain wipes (plastic)', type: 'product', trendDrivers: 'G-04 PPWR + G-02 Microplastics regulation', intensity: 2 },
      { name: 'Quick-fix synthetic patches', type: 'product', trendDrivers: 'G-05 Green Claims Directive bans misleading claims', intensity: 1 },
      { name: 'Chemical-heavy protective sprays', type: 'product', trendDrivers: 'G-01 PFAS-based water repellents restricted', intensity: 2 },
    ],
  },
  {
    id: 'between_washes',
    label: 'Between Washes',
    benefiting: [
      { name: 'Fabric refresh sprays (concentrated)', type: 'product', trendDrivers: 'T-03 Concentrated Formats + C-06 Cost-of-Living', intensity: 2 },
      { name: 'On-the-go freshener/anti-static mists', type: 'product', trendDrivers: 'T-03 Concentrated Formats + convenience trend', intensity: 2 },
      { name: 'Portable garment steaming devices', type: 'tech', trendDrivers: 'T-05 Manufacturing Automation enables compact design', intensity: 2 },
      { name: 'Smart refreshing cabinets / steam closets', type: 'tech', trendDrivers: 'T-08 Connected Appliances + T-01 optimization', intensity: 2 },
      { name: 'UV garment sanitizers (portable)', type: 'tech', trendDrivers: 'C-12 Post-COVID Hygiene Persistence + T-01 validation', intensity: 1 },
      { name: 'Dry shampoo for clothes (spray)', type: 'product', trendDrivers: 'T-03 Concentrated Formats + C-06 Cost-Saving', intensity: 2 },
      { name: 'Odor-elimination enzyme sprays', type: 'product', trendDrivers: 'T-02 Bio-Based Chemistry + T-01 enzyme optimization', intensity: 2 },
      { name: 'Smart garment freshness alerts (app)', type: 'tech', trendDrivers: 'T-08 Connected Appliances + T-07 AI tracking', intensity: 1 },
    ],
    negativelyImpacted: [
      { name: 'Full wash cycle (over-washing declining)', type: 'service', trendDrivers: 'C-06 Cost-of-Living Squeeze + E-02 water scarcity', intensity: 2 },
      { name: 'Fabric de-wrinkling gadgets (niche)', type: 'tech', trendDrivers: 'T-08 Smart steamers + garment tech displaces niche', intensity: 1 },
      { name: 'Heavy synthetic fabric refreshers', type: 'product', trendDrivers: 'C-04 Conscious Consumption + G-05 Green Claims', intensity: 1 },
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
      { name: 'Shade finders & AR try-on tools', type: 'tech', trendDrivers: 'T-07 AI Personalization + T-01 color simulation', intensity: 3 },
      { name: 'Style inspiration apps & platforms', type: 'tech', trendDrivers: 'K-04 Social Commerce + T-07 AI Personalization', intensity: 3 },
      { name: 'Creator & community platforms', type: 'service', trendDrivers: 'K-04 Social Commerce + TikTok Shop trend', intensity: 3 },
      { name: 'Trend-led inspiration collections', type: 'product', trendDrivers: 'C-03 Premiumization + C-08 Male Grooming', intensity: 2 },
      { name: 'Digital consultation (AI-matched looks)', type: 'service', trendDrivers: 'T-01 AI-Driven matching + T-07 Personalization', intensity: 2 },
      { name: 'Influencer shade collaborations', type: 'product', trendDrivers: 'K-04 Social Commerce + C-03 Premiumization', intensity: 2 },
    ],
    negativelyImpacted: [
      { name: 'Print shade & style lookbooks', type: 'product', trendDrivers: 'T-07 Digital AR replaces static print', intensity: 2 },
      { name: 'Occasion-based hair collections', type: 'product', trendDrivers: 'C-11 Gen Z Dupe Culture seeks value', intensity: 1 },
      { name: 'Traditional salon consultations (walk-in)', type: 'service', trendDrivers: 'T-07 AI + digital booking reduces appointments', intensity: 2 },
      { name: 'Basic brochure-based color guides', type: 'product', trendDrivers: 'T-01 AI shade matching obsoletes static charts', intensity: 1 },
    ],
  },
  {
    id: 'diagnose',
    label: 'Diagnose',
    benefiting: [
      { name: 'Scalp & hair scanners (camera-based)', type: 'tech', trendDrivers: 'T-01 AI image analysis + T-04 Microbiome science', intensity: 3 },
      { name: 'AI hair profiling (color, damage, texture)', type: 'tech', trendDrivers: 'T-01 AI-Driven analysis + T-07 Personalization', intensity: 3 },
      { name: 'Porosity & damage diagnostic tests', type: 'product', trendDrivers: 'C-03 Premiumization (detailed diagnostics)', intensity: 2 },
      { name: 'Dermatological & trichology assessments', type: 'service', trendDrivers: 'C-10 Hair Loss Treatments + clinical validation', intensity: 3 },
      { name: 'Hormonal & nutritional deficiency screening', type: 'service', trendDrivers: 'C-05 Silver Economy + C-10 Hair Loss Treatments', intensity: 2 },
      { name: 'At-home scalp microbiome testing', type: 'tech', trendDrivers: 'T-04 Microbiome Science (at-home kits)', intensity: 2 },
      { name: 'DNA-based hair type profiling', type: 'service', trendDrivers: 'T-01 AI-Driven genetic matching + premiumization', intensity: 2 },
    ],
    negativelyImpacted: [
      { name: 'Scalp analysis kits (basic / manual)', type: 'product', trendDrivers: 'T-01 AI cameras obsolete basic kits', intensity: 2 },
      { name: 'Generic hair type classification guides', type: 'product', trendDrivers: 'T-01 AI personalization > generic guides', intensity: 1 },
      { name: 'Weather/environment tracking (low engagement)', type: 'tech', trendDrivers: 'T-07 Personalization shifts from weather to microbiome', intensity: 1 },
      { name: 'One-size-fits-all consultation models', type: 'service', trendDrivers: 'T-07 AI Personalization demands custom diagnostics', intensity: 1 },
    ],
  },
  {
    id: 'prepare',
    label: 'Prepare',
    benefiting: [
      { name: 'Scalp protection & comfort systems', type: 'product', trendDrivers: 'T-02 Bio-Based Chemistry + C-04 Conscious', intensity: 2 },
      { name: 'Bond builders (pre-color treatment)', type: 'product', trendDrivers: 'T-01 AI-optimized bond science + premiumization', intensity: 3 },
      { name: 'Heat & UV protectants (advanced)', type: 'product', trendDrivers: 'T-02 Bio-Based Chemistry + T-01 nano-formulations', intensity: 2 },
      { name: 'Anti-humidity & anti-frizz primers', type: 'product', trendDrivers: 'T-02 Bio-Based + T-01 climate-adaptive formulas', intensity: 2 },
      { name: 'Scalp detox & exfoliation scrubs', type: 'product', trendDrivers: 'C-07 Scalp Care Category (new trend expansion)', intensity: 2 },
      { name: 'Pre-treatment precision applicators (tech)', type: 'tech', trendDrivers: 'T-05 Manufacturing Automation precision dosing', intensity: 1 },
      { name: 'Pre-color pH adjustment products', type: 'product', trendDrivers: 'T-01 AI color formulation (pH optimization)', intensity: 2 },
      { name: 'Scalp barrier repair serums', type: 'product', trendDrivers: 'C-07 Scalp Care Category emergence', intensity: 2 },
    ],
    negativelyImpacted: [
      { name: 'Basic pre-color treatments (commoditized)', type: 'product', trendDrivers: 'C-03 Premiumization displaces commodity category', intensity: 2 },
      { name: 'Chelation treatments (niche, low awareness)', type: 'service', trendDrivers: 'T-07 Personalization requires new patient education', intensity: 1 },
      { name: 'Manual sectioning clips & tools', type: 'product', trendDrivers: 'T-05 Automation + T-01 AI guides precision', intensity: 1 },
      { name: 'Generic heat protection sprays', type: 'product', trendDrivers: 'C-03 Premiumization demands advanced formulas', intensity: 2 },
    ],
  },
  {
    id: 'remedy',
    label: 'Remedy',
    benefiting: [
      { name: 'Hair loss & thinning growth serums', type: 'product', trendDrivers: 'C-10 Hair Loss Treatments (core trend) + C-05 Silver', intensity: 3 },
      { name: 'Scalp care & barrier repair products', type: 'product', trendDrivers: 'C-07 Scalp Care Category (emerging category)', intensity: 3 },
      { name: 'Regenerative scalp devices (LED, microcurrent)', type: 'tech', trendDrivers: 'T-05 Manufacturing Automation + T-04 Microbiome', intensity: 2 },
      { name: 'Anti-dandruff & sensitive scalp remedies', type: 'product', trendDrivers: 'C-07 Scalp Care Category (medical positioning)', intensity: 2 },
      { name: 'Dermatological consultation services', type: 'service', trendDrivers: 'C-10 Hair Loss Treatments + clinical approach', intensity: 2 },
      { name: 'Low-level light therapy (LLLT) scalp tools', type: 'tech', trendDrivers: 'T-05 Manufacturing + clinical efficacy', intensity: 2 },
      { name: 'Prebiotic & probiotic scalp treatments', type: 'product', trendDrivers: 'T-04 Microbiome Science (new category)', intensity: 2 },
      { name: 'Nutritional supplementation programs', type: 'product', trendDrivers: 'C-05 Silver Economy + C-10 Hair Loss holistic', intensity: 2 },
    ],
    negativelyImpacted: [
      { name: 'Generic dandruff shampoo (commoditized)', type: 'product', trendDrivers: 'C-03 Premiumization + C-07 Scalp Care specialization', intensity: 3 },
      { name: 'Water softening devices for hair', type: 'tech', trendDrivers: 'T-08 Connected home water treatment integrated', intensity: 1 },
      { name: 'Life-phase condition-based programs', type: 'service', trendDrivers: 'T-07 AI Personalization > generic life-phase segments', intensity: 1 },
      { name: 'Synthetic scalp cooling treatments', type: 'product', trendDrivers: 'T-02 Bio-Based Chemistry replaces synthetics', intensity: 1 },
    ],
  },
  {
    id: 'transform',
    label: 'Transform',
    benefiting: [
      { name: 'Permanent & demi-permanent color (advanced)', type: 'product', trendDrivers: 'C-03 Premiumization Color Care (core trend)', intensity: 3 },
      { name: 'Balayage, highlight & brow tints', type: 'product', trendDrivers: 'C-03 Premiumization + K-07 Professional Salon', intensity: 3 },
      { name: 'Bond repair & strengthen treatments', type: 'product', trendDrivers: 'T-01 AI-Driven bond chemistry + premiumization', intensity: 3 },
      { name: 'Texture changers (perms, relaxers, keratin)', type: 'product', trendDrivers: 'T-02 Bio-Based Chemistry (safer formulas)', intensity: 2 },
      { name: 'Salon coloration & blending services', type: 'service', trendDrivers: 'K-07 Professional Salon Crossover (premium) + C-03', intensity: 3 },
      { name: 'Color application tools (precision devices)', type: 'tech', trendDrivers: 'T-05 Manufacturing Automation + precision dosing', intensity: 1 },
      { name: 'Brow, lash & hair growth serums', type: 'product', trendDrivers: 'C-10 Hair Loss Treatments extends to brows/lashes', intensity: 2 },
      { name: 'Digital color matching & consultation', type: 'service', trendDrivers: 'T-01 AI + T-07 Personalization for shade match', intensity: 2 },
    ],
    negativelyImpacted: [
      { name: 'Temporary color (declining vs. permanent)', type: 'product', trendDrivers: 'C-03 Premiumization drives permanent investment', intensity: 2 },
      { name: 'Basic shampoos & cleansers (frequent use decline)', type: 'product', trendDrivers: 'C-03 Premiumization shifts to treatments', intensity: 2 },
      { name: 'Gray blending (niche positioning)', type: 'product', trendDrivers: 'C-05 Silver Economy prefers full color/coverage', intensity: 1 },
      { name: 'Synthetic wigs & hair systems (stigma)', type: 'product', trendDrivers: 'C-03 Premiumization prefers authentic color', intensity: 1 },
      { name: 'Budget color boxes (home-use)', type: 'product', trendDrivers: 'C-11 Gen Z Dupe Culture but C-03 premiumization wins', intensity: 2 },
    ],
  },
  {
    id: 'lock_finish',
    label: 'Lock & Finish',
    benefiting: [
      { name: 'pH balance & neutralization systems', type: 'product', trendDrivers: 'T-01 AI-optimized pH science + color lock', intensity: 2 },
      { name: 'After-color bond protection / cuticle sealing', type: 'product', trendDrivers: 'T-01 AI bond preservation + C-03 premiumization', intensity: 3 },
      { name: 'Color stabilizers & color-lock serums', type: 'product', trendDrivers: 'T-01 AI color chemistry + extended fade resistance', intensity: 3 },
      { name: 'Premium hair perfumes & scent finishing', type: 'product', trendDrivers: 'C-09 Fragrance Premiumization Home Care', intensity: 2 },
      { name: 'Post-color stabilization services', type: 'service', trendDrivers: 'K-07 Professional Salon Crossover (premium service)', intensity: 2 },
      { name: 'Color-protective oil treatments', type: 'product', trendDrivers: 'T-02 Bio-Based Chemistry + C-03 Premiumization', intensity: 2 },
      { name: 'Ionic sealing hair tools', type: 'tech', trendDrivers: 'T-05 Manufacturing enables precision sealing', intensity: 1 },
    ],
    negativelyImpacted: [
      { name: 'Basic hold & fix products (commoditized)', type: 'product', trendDrivers: 'C-03 Premiumization eliminates low-end category', intensity: 3 },
      { name: 'Shine-only products (low differentiation)', type: 'product', trendDrivers: 'T-01 AI formulation > commodity shine boost', intensity: 2 },
      { name: 'Conventional plastic hair accessories', type: 'product', trendDrivers: 'C-04 Conscious Consumption + G-04 PPWR plastic', intensity: 1 },
      { name: 'Cheap fragrance finishing sprays', type: 'product', trendDrivers: 'C-09 Fragrance Premiumization (budget brands decline)', intensity: 2 },
    ],
  },
  {
    id: 'maintain_optimize',
    label: 'Maintain & Optimize',
    benefiting: [
      { name: 'Color protection systems (UV, heat, pollution)', type: 'product', trendDrivers: 'T-02 Bio-Based Chemistry + T-01 nano-protection', intensity: 3 },
      { name: 'Climate-adaptive protection shields', type: 'product', trendDrivers: 'T-02 Bio-Based + E-05 Climate Pest Shifts concern', intensity: 1 },
      { name: 'Anti-frizz & smoothing sprays (advanced)', type: 'product', trendDrivers: 'T-01 AI humidity resistance + C-03 Premiumization', intensity: 2 },
      { name: 'Scalp stimulation & regeneration devices', type: 'tech', trendDrivers: 'T-05 Manufacturing + T-04 Microbiome science', intensity: 2 },
      { name: 'Biological support (ingestibles, supplements)', type: 'product', trendDrivers: 'C-10 Hair Loss Treatments + C-05 Silver Economy', intensity: 2 },
      { name: 'Condition tracking & smart reminders (app)', type: 'tech', trendDrivers: 'T-07 AI Personalization + smart scheduling', intensity: 1 },
      { name: 'Subscription / programmatic care services', type: 'service', trendDrivers: 'K-06 Subscription Lock-in + C-03 Premiumization', intensity: 3 },
      { name: 'Weekly intensive treatment protocols', type: 'product', trendDrivers: 'C-03 Premiumization (multi-step routines)', intensity: 2 },
      { name: 'Personalized rinse cycle optimization', type: 'tech', trendDrivers: 'T-07 AI + T-08 Connected home water systems', intensity: 1 },
    ],
    negativelyImpacted: [
      { name: 'Tone & fade protection (anti-yellowing)', type: 'product', trendDrivers: 'T-01 AI color stability integrated in core formulas', intensity: 2 },
      { name: 'Fragrance refresh boosters (undifferentiated)', type: 'product', trendDrivers: 'C-09 Fragrance Premiumization demands uniqueness', intensity: 1 },
      { name: 'Deodorizing mists for hair (niche)', type: 'product', trendDrivers: 'C-06 Cost-of-Living Squeeze pressures accessory buys', intensity: 1 },
      { name: 'One-time treatments (low engagement)', type: 'product', trendDrivers: 'K-06 Subscription models displace single-use', intensity: 2 },
    ],
  },
  {
    id: 'refresh_between',
    label: 'Refresh / In-Between',
    benefiting: [
      { name: 'Dry shampoo (volume & convenience)', type: 'product', trendDrivers: 'C-06 Cost-of-Living Squeeze + convenience premium', intensity: 3 },
      { name: 'Root retouch sprays (instant color refresh)', type: 'product', trendDrivers: 'T-03 Concentrated Formats + C-06 Cost saving', intensity: 2 },
      { name: 'Color correction & neutralization products', type: 'product', trendDrivers: 'T-01 AI color correction formulas + on-demand', intensity: 2 },
      { name: 'Leave-in & overnight treatments (intensive)', type: 'product', trendDrivers: 'C-03 Premiumization (multi-step routines)', intensity: 2 },
      { name: 'Scalp care & balance mists', type: 'product', trendDrivers: 'C-07 Scalp Care Category (new category growth)', intensity: 2 },
      { name: 'Portable styling tools (cordless)', type: 'tech', trendDrivers: 'T-05 Manufacturing Automation enables portability', intensity: 1 },
      { name: 'Quick salon express refresh services', type: 'service', trendDrivers: 'K-04 Social Commerce + K-07 Professional crossover', intensity: 2 },
      { name: 'At-home color touch-up sprays', type: 'product', trendDrivers: 'T-03 Concentrated Formats + T-07 AI personalized shades', intensity: 2 },
      { name: 'Scalp wellness weekly protocols', type: 'product', trendDrivers: 'C-07 Scalp Care Category emergence', intensity: 2 },
    ],
    negativelyImpacted: [
      { name: 'Glosses (limited repeat purchase)', type: 'product', trendDrivers: 'C-03 Premiumization shifts to permanent investment', intensity: 2 },
      { name: 'Garment steaming for hair (novelty)', type: 'tech', trendDrivers: 'C-06 Cost squeeze + low engagement trend', intensity: 1 },
      { name: 'On-the-go freshener sprays (generic)', type: 'product', trendDrivers: 'C-07 Scalp Care replaces generic "freshener" category', intensity: 1 },
      { name: 'Temporary touch-up chalks', type: 'product', trendDrivers: 'T-03 Concentrated spray formats displace chalks', intensity: 1 },
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
  onNavigateToTrend?: (trendSearch: string) => void;
  onNavigateWarRoom?: () => void;
  onNavigateTrends?: () => void;
}

interface SelectedProduct {
  entry: ProductEntry;
  direction: 'expansion' | 'contraction';
  stageName: string;
}

// PRISM Analysis generator — contextual explanation for each product
function generatePrismAnalysis(entry: ProductEntry, direction: 'expansion' | 'contraction', stageName: string): string {
  const dirWord = direction === 'expansion' ? 'growth opportunity' : 'decline risk';
  const typeWord = entry.type === 'tech' ? 'technology solution' : entry.type === 'service' ? 'service model' : 'product category';

  // Extract trend codes from trendDrivers
  const trends = entry.trendDrivers;
  const isMultiTrend = trends.includes('+') || trends.includes(',');

  if (direction === 'expansion') {
    return `PRISM's force assessment identifies "${entry.name}" as a ${dirWord} within the "${stageName}" stage of the consumer journey.\n\n` +
      `As a ${typeWord}, it is positioned to capture value from ${isMultiTrend ? 'multiple converging forces' : 'a key structural force'}. ` +
      `The primary driver — ${trends.split('+')[0].trim().split('(')[0].trim()} — creates a tailwind that increases demand, justifies premium pricing, or opens new use occasions.\n\n` +
      `Strategic implication: This represents an addressable whitespace for innovation investment. ` +
      `Categories touching this product type should see expanding profit pools as the underlying trends materialize through 2030. ` +
      `First-mover advantage is significant given the ${entry.type === 'tech' ? 'technology adoption curve' : entry.type === 'service' ? 'service model lock-in' : 'consumer switching costs'}.`;
  } else {
    return `PRISM's force assessment flags "${entry.name}" as a ${dirWord} within the "${stageName}" stage of the consumer journey.\n\n` +
      `This ${typeWord} faces structural headwinds from ${isMultiTrend ? 'multiple converging negative forces' : 'a key disruptive force'}. ` +
      `The primary driver — ${trends.split('+')[0].trim().split('(')[0].trim()} — is eroding the value proposition through regulatory pressure, technological displacement, or shifting consumer preferences.\n\n` +
      `Strategic implication: Portfolio exposure to this product type should be actively managed. ` +
      `Consider defensive strategies (reformulation, repositioning) or planned exit. ` +
      `The profit pool contraction is expected to accelerate as ${entry.type === 'tech' ? 'superior alternatives gain adoption' : entry.type === 'service' ? 'new service models displace legacy approaches' : 'regulation and consumer shifts compound'}.`;
  }
}

// Trend context mapping — enriched descriptions for each trend code
const TREND_CONTEXT: Record<string, { name: string; force: string; description: string }> = {
  'T-01': { name: 'AI-Driven Formulation & Product Development', force: 'Technology', description: 'AI/ML accelerating R&D cycles, enabling personalized formulations, and optimizing ingredient combinations for efficacy and cost.' },
  'T-02': { name: 'Bio-Based & Green Chemistry Transition', force: 'Technology', description: 'Shift from petrochemical to bio-based ingredients driven by regulation (PFAS bans) and consumer demand for natural, sustainable formulations.' },
  'T-03': { name: 'Concentrated & Solid Formats Revolution', force: 'Technology', description: 'Ultra-concentrated detergents, solid bars, sheets, and pods reducing packaging, water usage, and logistics costs while commanding premium pricing.' },
  'T-04': { name: 'Microbiome-Aware Formulation', force: 'Technology', description: 'Products designed to preserve or enhance skin/scalp microbiome health, moving beyond "kill everything" chemistry to targeted, microbiome-safe formulas.' },
  'T-05': { name: 'Manufacturing Automation & Industry 4.0', force: 'Technology', description: 'Smart factories, IoT-connected production lines, and robotic automation reducing costs and enabling mass customization at scale.' },
  'T-07': { name: 'AI Personalization at Scale', force: 'Technology', description: 'AI-driven personalized product recommendations, custom formulations, and adaptive dosing systems tailored to individual consumer profiles.' },
  'T-08': { name: 'Connected Appliances & Smart Home', force: 'Technology', description: 'IoT-enabled washers, dryers, and dispensing systems auto-optimizing detergent dosing, cycle selection, and maintenance scheduling.' },
  'C-01': { name: 'Private Label Structural Penetration', force: 'Consumer', description: 'Retailer own-brands gaining share structurally across all price tiers, not just value — eroding branded manufacturer profit pools.' },
  'C-02': { name: 'GLP-1 Drugs Reshape Consumer Spending', force: 'Consumer', description: 'Weight-loss drugs shifting consumer spending patterns, affecting personal care routines and beauty/grooming category dynamics.' },
  'C-03': { name: 'Premiumization Acceleration in Hair Care', force: 'Consumer', description: 'Consumers trading up to salon-quality, ingredient-led, and science-backed hair products — expanding premium tier profit pools.' },
  'C-04': { name: 'Conscious Consumption & Cleanical Beauty', force: 'Consumer', description: 'Demand for transparent ingredients, clean labels, cruelty-free, and clinically proven efficacy — reshaping formulation and marketing.' },
  'C-05': { name: 'Silver Economy — Aging Population Demand', force: 'Consumer', description: 'Growing 50+ demographic driving demand for age-specific products: gray coverage, anti-thinning, gentle formulations, and accessibility.' },
  'C-06': { name: 'Cost-of-Living Squeeze & Trading Down', force: 'Consumer', description: 'Persistent inflation pressuring middle-market consumers toward value alternatives, private label, and reduced purchase frequency.' },
  'C-07': { name: 'Scalp Care Emerges as Standalone Category', force: 'Consumer', description: 'Scalp health becoming a distinct consumer need beyond dandruff — serums, exfoliants, and diagnostic tools creating new sub-category.' },
  'C-09': { name: 'Fragrance & Sensory Premiumization', force: 'Consumer', description: 'Consumers willing to pay premium for sophisticated fragrance experiences in home care and personal care beyond functional cleaning.' },
  'C-10': { name: 'Hair Loss Treatments Enter Consumer Mainstream', force: 'Consumer', description: 'Previously clinical/pharmaceutical hair loss solutions going mass-market through DTC brands, OTC treatments, and salon crossover.' },
  'C-11': { name: 'Gen Z Dupe Culture & Ingredient Literacy', force: 'Consumer', description: 'Young consumers seeking affordable alternatives to premium products, driven by social media ingredient education and price sensitivity.' },
  'G-01': { name: 'PFAS Restriction (EU-wide)', force: 'Government', description: 'EU-wide restriction on per- and polyfluoroalkyl substances forcing reformulation across detergents, textiles, and surface treatments.' },
  'G-02': { name: 'Microplastics Ban Phase 2', force: 'Government', description: 'Extended EU ban on intentionally added microplastics affecting cosmetics, detergents, and textile care products — driving formulation change.' },
  'G-03': { name: 'Cosmetics Regulation Tightening', force: 'Government', description: 'Stricter ingredient safety testing, allergen labeling, and endocrine disruptor limits across EU cosmetics and personal care regulation.' },
  'G-04': { name: 'PPWR Packaging Waste Regulation', force: 'Government', description: 'EU Packaging and Packaging Waste Regulation mandating recycled content, refill systems, and packaging reduction targets by 2030.' },
  'G-05': { name: 'Green Claims Directive', force: 'Government', description: 'EU crackdown on unsubstantiated environmental claims — requiring scientific evidence for "green", "natural", "eco" product positioning.' },
  'K-04': { name: 'Social Commerce & Creator Economy', force: 'Customer', description: 'TikTok Shop, Instagram Shopping, and creator-led product discovery reshaping purchase journeys and brand discovery channels.' },
  'K-06': { name: 'Subscription & Auto-Replenishment Models', force: 'Customer', description: 'D2C subscription boxes, auto-replenishment, and programmatic purchasing creating recurring revenue streams and customer lock-in.' },
  'K-07': { name: 'Professional Salon Channel Crossover', force: 'Customer', description: 'Blurring lines between professional salon and retail consumer channels — salon brands going mass, mass brands launching "pro" tiers.' },
  'E-02': { name: 'Water Scarcity & Conservation Pressure', force: 'Environmental', description: 'Growing water stress driving demand for low-water and waterless formulations, concentrated products, and water-efficient appliances.' },
  'E-05': { name: 'Climate-Driven Pest & Allergen Shifts', force: 'Environmental', description: 'Changing climate patterns altering pest distribution, allergen seasons, and consumer needs for protection and treatment products.' },
};

export default function ConsumerJourney({ onBack, onNavigateToTrend, onNavigateWarRoom, onNavigateTrends }: ConsumerJourneyProps) {
  const [activeTab, setActiveTab] = useState<'lhc' | 'hair'>('lhc');
  const [selectedProduct, setSelectedProduct] = useState<SelectedProduct | null>(null);

  const handleProductClick = useCallback((entry: ProductEntry, direction: 'expansion' | 'contraction', stageName: string) => {
    setSelectedProduct({ entry, direction, stageName });
  }, []);

  const journey = activeTab === 'lhc' ? LHC_JOURNEY : HAIR_JOURNEY;
  const title = activeTab === 'lhc'
    ? 'Laundry & Home Care — Consumer Journey'
    : 'Hair Consumer Business — Consumer Journey';
  const subtitle = activeTab === 'lhc'
    ? '13 stages from Sorting to Between Washes — product types mapped by profit pool impact direction'
    : '8 stages from Inspire to Refresh — product types mapped by profit pool impact direction';

  return (
    <div style={{ fontFamily: T.sans, color: T.text, background: T.bg, minHeight: '100vh' }}>
      {/* Header — same nav bar style as War Room */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${T.border}`,
        padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 4 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: `linear-gradient(135deg, ${T.accent}, #5856D6)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 13, fontWeight: 700,
          }}>P</div>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.text, letterSpacing: -0.3 }}>PRISM War Room</span>
          <span style={{ fontSize: 10, color: T.text3, fontWeight: 500 }}>v6.0</span>
        </div>

        {/* Nav pills — War Room, Trends, Consumer Journey */}
        <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
          {onNavigateWarRoom && (
            <button
              onClick={onNavigateWarRoom}
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
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              War Room
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
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              Trends
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
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16.24 7.76a6 6 0 010 8.49m-8.48-.01a6 6 0 010-8.49"/></svg>
            Consumer Journey
          </button>
        </div>

        {/* LHC / Hair toggle — left of spacer */}
        <div style={{ display: 'flex', gap: 2, background: T.bg1, borderRadius: 8, padding: 2, marginLeft: 12, marginRight: 'auto' }}>
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
        padding: '0 12px 40px', margin: '0 auto',
        overflowX: 'auto',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${journey.length}, minmax(0, 1fr))`,
          minWidth: journey.length > 10 ? `${journey.length * 100}px` : undefined,
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
              padding: '8px 6px 6px',
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
              padding: '6px 5px',
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
                <ProductPill key={i} entry={p} direction="expansion" onClick={() => handleProductClick(p, 'expansion', stage.label)} isSelected={selectedProduct?.entry.name === p.name && selectedProduct?.direction === 'expansion'} />
              ))}
            </div>
          ))}

          {/* Negatively impacted row (red) */}
          {journey.map(stage => (
            <div key={stage.id + '_negative'} style={{
              background: 'rgba(255,69,58,0.02)',
              padding: '6px 5px',
              minHeight: 120,
            }}>
              <div style={{
                fontSize: 8, fontWeight: 700, color: '#FF453A', letterSpacing: 1,
                textTransform: 'uppercase', marginBottom: 6, opacity: 0.7,
              }}>
                ▼ Declining
              </div>
              {stage.negativelyImpacted.map((p, i) => (
                <ProductPill key={i} entry={p} direction="contraction" onClick={() => handleProductClick(p, 'contraction', stage.label)} isSelected={selectedProduct?.entry.name === p.name && selectedProduct?.direction === 'contraction'} />
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

      {/* ── Product Detail Panel (slide-in overlay) ─────────────── */}
      {selectedProduct && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setSelectedProduct(null)}
            style={{
              position: 'fixed', inset: 0, zIndex: 200,
              background: 'rgba(0,0,0,0.15)',
              backdropFilter: 'blur(2px)',
            }}
          />
          {/* Panel */}
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0,
            width: 420, maxWidth: '90vw', zIndex: 201,
            background: '#fff', borderLeft: `1px solid ${T.border1}`,
            boxShadow: '-8px 0 30px rgba(0,0,0,0.08)',
            display: 'flex', flexDirection: 'column',
            animation: 'slideInRight 0.2s ease-out',
          }}>
            {/* Panel header */}
            <div style={{
              padding: '16px 20px', borderBottom: `1px solid ${T.border}`,
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                    background: selectedProduct.direction === 'expansion' ? 'rgba(48,209,88,0.12)' : 'rgba(255,69,58,0.10)',
                    color: selectedProduct.direction === 'expansion' ? '#30D158' : '#FF453A',
                    letterSpacing: 0.5, textTransform: 'uppercase',
                  }}>
                    {selectedProduct.direction === 'expansion' ? '▲ Expansion' : '▼ Contraction'}
                  </span>
                  <span style={{
                    fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                    background: (TYPE_STYLES[selectedProduct.entry.type] ?? TYPE_STYLES['product']).bg,
                    color: (TYPE_STYLES[selectedProduct.entry.type] ?? TYPE_STYLES['product']).text,
                  }}>
                    {(TYPE_STYLES[selectedProduct.entry.type] ?? TYPE_STYLES['product']).label}
                  </span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.text, lineHeight: 1.3 }}>
                  {selectedProduct.entry.name}
                </div>
                <div style={{ fontSize: 11, color: T.text3, marginTop: 2 }}>
                  Stage: {selectedProduct.stageName}
                </div>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: 4, borderRadius: 6, color: T.text3,
                  fontSize: 18, lineHeight: 1,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = T.bg1; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
              >
                ✕
              </button>
            </div>

            {/* Panel body */}
            <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
              {/* Trend Drivers section */}
              <div style={{ marginBottom: 20 }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: T.text3, letterSpacing: 0.8,
                  textTransform: 'uppercase', marginBottom: 8,
                }}>
                  Trend Drivers — Rationale
                </div>
                <div style={{
                  borderRadius: 8,
                  background: T.bg1, border: `1px solid ${T.border}`,
                  overflow: 'hidden',
                }}>
                  {selectedProduct.entry.trendDrivers.split('+').map((driver, i) => {
                    const trimmed = driver.trim();
                    // Extract trend code like T-01, G-02, C-04, K-06, E-02
                    const codeMatch = trimmed.match(/^([TCGKE]-\d{2})/);
                    const trendCode = codeMatch ? codeMatch[1] : null;
                    const context = trendCode ? TREND_CONTEXT[trendCode] : null;
                    const drivers = selectedProduct.entry.trendDrivers.split('+');

                    return (
                      <div key={i} style={{
                        padding: '10px 14px',
                        borderBottom: i < drivers.length - 1 ? `1px solid ${T.border}` : 'none',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700,
                            color: selectedProduct.direction === 'expansion' ? '#30D158' : '#FF453A',
                            marginTop: 1, flexShrink: 0,
                          }}>
                            {selectedProduct.direction === 'expansion' ? '↑' : '↓'}
                          </span>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: 12, color: T.text, lineHeight: 1.5, fontWeight: 600 }}>
                              {context ? `${trendCode}: ${context.name}` : trimmed}
                            </span>
                            {context && (
                              <>
                                <span style={{
                                  display: 'inline-block', marginLeft: 6,
                                  fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 3,
                                  background: 'rgba(0,113,227,0.08)', color: T.accent,
                                }}>
                                  {context.force}
                                </span>
                                <p style={{
                                  fontSize: 11, color: T.text2, lineHeight: 1.5,
                                  margin: '4px 0 0', fontWeight: 400,
                                }}>
                                  {context.description}
                                </p>
                              </>
                            )}
                            {!context && (
                              <p style={{
                                fontSize: 11, color: T.text2, lineHeight: 1.5,
                                margin: '4px 0 0',
                              }}>
                                {trimmed}
                              </p>
                            )}
                            {onNavigateToTrend && trendCode && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onNavigateToTrend(context?.name || trendCode); }}
                                style={{
                                  marginTop: 6, fontSize: 10, fontWeight: 600,
                                  color: T.accent, background: 'none', border: 'none',
                                  cursor: 'pointer', padding: 0, fontFamily: T.sans,
                                  display: 'flex', alignItems: 'center', gap: 4,
                                }}
                                onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline'; }}
                                onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none'; }}
                              >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                View full trend details →
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* PRISM Analysis section */}
              <div style={{ marginBottom: 20 }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: T.accent, letterSpacing: 0.8,
                  textTransform: 'uppercase', marginBottom: 8,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  PRISM Analysis
                </div>
                <div style={{
                  padding: '14px 16px', borderRadius: 8,
                  background: `linear-gradient(135deg, ${T.accentDim}, rgba(123,97,255,0.04))`,
                  border: `1px solid ${T.accent}15`,
                }}>
                  {generatePrismAnalysis(selectedProduct.entry, selectedProduct.direction, selectedProduct.stageName)
                    .split('\n\n')
                    .map((paragraph, i) => (
                      <p key={i} style={{
                        fontSize: 12, color: T.text, lineHeight: 1.65,
                        margin: i === 0 ? '0 0 10px' : '10px 0 0',
                      }}>
                        {paragraph}
                      </p>
                    ))}
                </div>
              </div>

              {/* Impact Summary */}
              <div style={{
                padding: '12px 14px', borderRadius: 8,
                background: selectedProduct.direction === 'expansion' ? 'rgba(48,209,88,0.05)' : 'rgba(255,69,58,0.04)',
                border: `1px solid ${selectedProduct.direction === 'expansion' ? 'rgba(48,209,88,0.15)' : 'rgba(255,69,58,0.12)'}`,
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.text3, marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  Impact Summary
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 9, color: T.text3, marginBottom: 2 }}>Direction & Intensity</div>
                    <div style={{
                      fontSize: 12, fontWeight: 700,
                      color: selectedProduct.direction === 'expansion' ? '#30D158' : '#FF453A',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <span style={{ fontSize: 14, letterSpacing: -1 }}>
                        {intensityArrows(selectedProduct.direction, selectedProduct.entry.intensity || 2)}
                      </span>
                      <span>
                        {intensityLabel(selectedProduct.entry.intensity || 2)} {selectedProduct.direction === 'expansion' ? 'Expansion' : 'Contraction'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: T.text3, marginBottom: 2 }}>Type</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>
                      {(TYPE_STYLES[selectedProduct.entry.type] ?? TYPE_STYLES['product']).label}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: T.text3, marginBottom: 2 }}>Journey Stage</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>
                      {selectedProduct.stageName}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: T.text3, marginBottom: 2 }}>Force Count</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>
                      {selectedProduct.entry.trendDrivers.split('+').length} trend{selectedProduct.entry.trendDrivers.split('+').length > 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <style>{`
            @keyframes slideInRight {
              from { transform: translateX(100%); opacity: 0; }
              to { transform: translateX(0); opacity: 1; }
            }
          `}</style>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENT: Product Pill
// ═══════════════════════════════════════════════════════════════

// Intensity-based color scales
const INTENSITY_COLORS = {
  expansion: {
    1: { bg: 'rgba(48,209,88,0.04)', border: 'rgba(48,209,88,0.12)', hoverBg: 'rgba(48,209,88,0.08)', hoverBorder: 'rgba(48,209,88,0.25)', selectedBg: 'rgba(48,209,88,0.10)' },
    2: { bg: 'rgba(48,209,88,0.08)', border: 'rgba(48,209,88,0.20)', hoverBg: 'rgba(48,209,88,0.14)', hoverBorder: 'rgba(48,209,88,0.35)', selectedBg: 'rgba(48,209,88,0.16)' },
    3: { bg: 'rgba(48,209,88,0.14)', border: 'rgba(48,209,88,0.30)', hoverBg: 'rgba(48,209,88,0.20)', hoverBorder: 'rgba(48,209,88,0.45)', selectedBg: 'rgba(48,209,88,0.24)' },
  },
  contraction: {
    1: { bg: 'rgba(255,69,58,0.03)', border: 'rgba(255,69,58,0.10)', hoverBg: 'rgba(255,69,58,0.06)', hoverBorder: 'rgba(255,69,58,0.20)', selectedBg: 'rgba(255,69,58,0.08)' },
    2: { bg: 'rgba(255,69,58,0.07)', border: 'rgba(255,69,58,0.18)', hoverBg: 'rgba(255,69,58,0.12)', hoverBorder: 'rgba(255,69,58,0.30)', selectedBg: 'rgba(255,69,58,0.14)' },
    3: { bg: 'rgba(255,69,58,0.12)', border: 'rgba(255,69,58,0.28)', hoverBg: 'rgba(255,69,58,0.18)', hoverBorder: 'rgba(255,69,58,0.40)', selectedBg: 'rgba(255,69,58,0.22)' },
  },
};

function intensityArrows(direction: 'expansion' | 'contraction', intensity: 1 | 2 | 3): string {
  const arrow = direction === 'expansion' ? '↑' : '↓';
  return arrow.repeat(intensity);
}

function intensityLabel(intensity: 1 | 2 | 3): string {
  return intensity === 3 ? 'Strong' : intensity === 2 ? 'Moderate' : 'Mild';
}

function ProductPill({ entry, direction, onClick, isSelected }: { entry: ProductEntry; direction: 'expansion' | 'contraction'; onClick?: () => void; isSelected?: boolean }) {
  const typeStyle = (TYPE_STYLES[entry.type] ?? TYPE_STYLES['product'])!;
  const intensity = entry.intensity || 2;
  const colors = INTENSITY_COLORS[direction][intensity];

  return (
    <div
      onClick={onClick}
      style={{
        marginBottom: 4,
        padding: '4px 6px',
        borderRadius: 5,
        background: isSelected ? colors.selectedBg : colors.bg,
        border: `1px solid ${isSelected ? colors.hoverBorder : colors.border}`,
        display: 'flex', alignItems: 'flex-start', gap: 4,
        cursor: 'pointer',
        transition: 'all 0.12s ease',
      }}
      title={`${intensityLabel(intensity)} impact · Click to view analysis`}
      onMouseEnter={e => {
        e.currentTarget.style.background = colors.hoverBg;
        e.currentTarget.style.borderColor = colors.hoverBorder;
      }}
      onMouseLeave={e => {
        if (!isSelected) {
          e.currentTarget.style.background = colors.bg;
          e.currentTarget.style.borderColor = colors.border;
        }
      }}
    >
      <span style={{
        fontSize: 8, fontWeight: 600, padding: '0px 3px', borderRadius: 2,
        background: typeStyle.bg, color: typeStyle.text,
        flexShrink: 0, marginTop: 1, letterSpacing: 0.2,
      }}>
        {entry.type === 'tech' ? 'T' : entry.type === 'service' ? 'S' : 'P'}
      </span>
      <span style={{
        fontSize: 10, color: T.text2, lineHeight: 1.3, fontWeight: intensity === 3 ? 600 : 500,
      }}>
        {entry.name}
      </span>
    </div>
  );
}
