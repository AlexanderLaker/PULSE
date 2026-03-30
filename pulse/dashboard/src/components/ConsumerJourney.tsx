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
      { name: 'AI stain/fabric recognition apps', type: 'tech', trendDrivers: 'T-01 AI-Driven Formulation enables intelligent analysis' },
      { name: 'Smart fabric scanner & QR tools', type: 'tech', trendDrivers: 'T-07 AI Personalization + T-01 AI enablement' },
      { name: 'Garment care advisory service (digital)', type: 'service', trendDrivers: 'T-07 AI Personalization + K-04 Social Commerce' },
      { name: 'Smart home integration platforms', type: 'tech', trendDrivers: 'T-01 + T-08 Connected Appliances auto-sorting' },
    ],
    negativelyImpacted: [
      { name: 'Manual sorting aids (baskets, dividers)', type: 'product', trendDrivers: 'T-01 AI displacement of manual tasks' },
      { name: 'Generic care label guides (print)', type: 'product', trendDrivers: 'T-07 Digital replaces static instructions' },
      { name: 'Fabric identification cards', type: 'product', trendDrivers: 'T-01 AI recognition obsoletes manuals' },
    ],
  },
  {
    id: 'pre_treating',
    label: 'Pre-Treating',
    benefiting: [
      { name: 'Enzyme-based stain removers (bio-actives)', type: 'product', trendDrivers: 'T-02 Bio-Based Chemistry + T-01 enzyme optimization' },
      { name: 'Targeted stain pens & precision sprays', type: 'product', trendDrivers: 'T-03 Concentrated Formats enable targeted dosing' },
      { name: 'Ultrasonic stain erasers (devices)', type: 'tech', trendDrivers: 'T-05 Manufacturing Automation + IoT devices' },
      { name: 'Plant-based odor neutralizers', type: 'product', trendDrivers: 'T-02 Bio-Based Chemistry + C-04 Conscious Consumption' },
      { name: 'Smart stain analyzer (app + device)', type: 'tech', trendDrivers: 'T-01 AI-Driven Formulation for stain ID' },
      { name: 'Sustainable stain removal subscriptions', type: 'service', trendDrivers: 'C-04 Cleanical Beauty + K-06 Subscription models' },
    ],
    negativelyImpacted: [
      { name: 'Chlorine-based pre-treaters', type: 'product', trendDrivers: 'G-01 PFAS Restriction + G-02 Microplastics Ban' },
      { name: 'Solvent-based fabric protectors', type: 'product', trendDrivers: 'G-01 PFAS + G-03 Cosmetics Regulation extends to textiles' },
      { name: 'Soil-release coatings (PFCs)', type: 'product', trendDrivers: 'G-01 PFAS Restriction (direct regulatory hit)' },
      { name: 'Heavy chemical stain blockers', type: 'product', trendDrivers: 'G-05 Green Claims Directive (greenwashing crackdown)' },
      { name: 'Synthetic perfume-heavy pre-treaters', type: 'product', trendDrivers: 'C-04 Conscious Consumption + G-05 Green Claims' },
    ],
  },
  {
    id: 'loading',
    label: 'Loading',
    benefiting: [
      { name: 'Microfibre filters (catch clothing shedding)', type: 'product', trendDrivers: 'G-02 Microplastics Ban Phase 2 (regulatory tailwind)' },
      { name: 'Smart load sensors / weight add-ons', type: 'tech', trendDrivers: 'T-08 Connected Appliances + IoT load detection' },
      { name: 'Laundry optimization balls', type: 'product', trendDrivers: 'T-03 Concentrated Formats reduce detergent need' },
      { name: 'Auto-load-weighing machine adapters', type: 'tech', trendDrivers: 'T-05 Manufacturing Automation integration' },
      { name: 'Fabric care dispensing systems', type: 'product', trendDrivers: 'T-03 Concentrated Formats + T-08 Auto-dosing' },
    ],
    negativelyImpacted: [
      { name: 'Delicate bags / drum accessories', type: 'product', trendDrivers: 'T-08 Smart machines obsolete manual aids' },
      { name: 'Manual dosing aids / scoops', type: 'product', trendDrivers: 'T-08 Auto-dosing displaces manual measuring' },
      { name: 'Fabric softening balls (low-tech)', type: 'product', trendDrivers: 'T-03 Concentrated formats eliminate need' },
      { name: 'Generic load guides (printed)', type: 'product', trendDrivers: 'T-07 AI Personalization replaces static guides' },
    ],
  },
  {
    id: 'add_products',
    label: 'Add Products',
    benefiting: [
      { name: 'Concentrated / ultra-compact detergents', type: 'product', trendDrivers: 'T-03 Concentrated Formats (core innovation) + G-04 PPWR' },
      { name: 'Detergent sheets & pods (eco-formats)', type: 'product', trendDrivers: 'T-03 Solid Formats + G-04 PPWR + E-02 Water scarcity' },
      { name: 'Refill systems & eco-subscriptions', type: 'service', trendDrivers: 'G-04 PPWR Packaging Waste Regulation + C-04 Conscious' },
      { name: 'Bio-enzymatic booster packs', type: 'product', trendDrivers: 'T-02 Bio-Based Chemistry + T-01 enzyme optimization' },
      { name: 'Premium fragrance bead boosters', type: 'product', trendDrivers: 'C-03 Premiumization Hair Care extends to home care' },
      { name: 'Plant-based washing pod tablets', type: 'product', trendDrivers: 'T-02 Bio-Based Chemistry + G-05 Green Claims' },
      { name: 'Modular detergent mix-your-own systems', type: 'product', trendDrivers: 'T-07 AI Personalization + T-03 Concentrated Formats' },
      { name: 'Subscription laundry boxes (recurring)', type: 'service', trendDrivers: 'K-06 Subscription Lock-in trend + convenience' },
    ],
    negativelyImpacted: [
      { name: 'Traditional bulk powder detergent', type: 'product', trendDrivers: 'T-03 Concentrated Formats displace dilute powders' },
      { name: 'Conventional large liquid bottles', type: 'product', trendDrivers: 'T-03 Concentrated Formats + G-04 PPWR (packaging)' },
      { name: 'Chlorine-based whiteners / bleach', type: 'product', trendDrivers: 'G-01 PFAS + G-02 Microplastics regulatoin' },
      { name: 'Separate water softening salts', type: 'product', trendDrivers: 'T-08 Integrated water treatment in machines' },
      { name: 'Synthetic optical brighteners', type: 'product', trendDrivers: 'G-05 Green Claims Directive (microplastic brighteners banned)' },
      { name: 'Anti-greying chemical additives', type: 'product', trendDrivers: 'G-03 Cosmetics Regulation VII/VIII extends to additives' },
      { name: 'DIY home-made detergent kits', type: 'product', trendDrivers: 'C-06 Cost-of-Living Squeeze pressures this niche' },
    ],
  },
  {
    id: 'select_wash',
    label: 'Select Wash Settings',
    benefiting: [
      { name: 'Smart home apps (auto program selection)', type: 'tech', trendDrivers: 'T-08 Connected Appliances + IoT integration' },
      { name: 'AI-based wash cycle advisors', type: 'tech', trendDrivers: 'T-01 AI-Driven systems for fabric optimization' },
      { name: 'Auto-dosing machine ecosystems', type: 'tech', trendDrivers: 'T-08 Connected Appliances + T-05 Automation' },
      { name: 'Voice-activated wash controls', type: 'tech', trendDrivers: 'T-01 AI + smart home voice assistants' },
      { name: 'Mobile app machine pairing', type: 'service', trendDrivers: 'T-07 AI Personalization + K-04 Social Commerce' },
    ],
    negativelyImpacted: [
      { name: 'Manual mechanical program dials', type: 'tech', trendDrivers: 'T-08 Connected Appliances displace manual controls' },
      { name: 'Generic dosing instructions (packaging)', type: 'product', trendDrivers: 'T-01 AI + T-07 Personal dosing replaces generic' },
      { name: 'Paper washing guides / manuals', type: 'product', trendDrivers: 'T-07 Digital instructions replace paper' },
    ],
  },
  {
    id: 'washing_cycle',
    label: 'Washing Cycle',
    benefiting: [
      { name: 'Smart / connected washers (auto-dose)', type: 'tech', trendDrivers: 'T-08 Connected Appliances + T-05 Manufacturing Automation' },
      { name: 'Cold-wash optimized detergents', type: 'product', trendDrivers: 'T-01 AI-Driven formulation for cold-water efficiency' },
      { name: 'Water softening integrated systems', type: 'tech', trendDrivers: 'T-08 Connected Appliances + integrated water treatment' },
      { name: 'Maintenance & care subscriptions', type: 'service', trendDrivers: 'K-06 Subscription models + post-purchase services' },
      { name: 'Energy-monitor detergents (IoT-linked)', type: 'product', trendDrivers: 'T-08 Connected Appliances report water/energy usage' },
      { name: 'Machine health predictive services', type: 'service', trendDrivers: 'T-05 Manufacturing Automation + IoT monitoring' },
    ],
    negativelyImpacted: [
      { name: 'Standard non-connected machines', type: 'tech', trendDrivers: 'T-08 Connected Appliances obsolete legacy hardware' },
      { name: 'Hot-wash detergent formulas', type: 'product', trendDrivers: 'T-01 AI cold-wash optimization + energy efficiency' },
      { name: 'Standalone Calgon-type water softeners', type: 'product', trendDrivers: 'T-08 Integrated machine water treatment' },
      { name: 'Static water-hardness testing strips', type: 'product', trendDrivers: 'T-08 IoT machines auto-detect water hardness' },
      { name: 'High-temperature wash detergents', type: 'product', trendDrivers: 'E-02 Water Scarcity + energy efficiency trends' },
    ],
  },
  {
    id: 'unloading',
    label: 'Unloading',
    benefiting: [
      { name: 'Anti-mustiness freshness solutions', type: 'product', trendDrivers: 'C-04 Conscious Consumption wants fresh, not masked' },
      { name: 'Anti-wrinkle post-cycle sprays', type: 'product', trendDrivers: 'T-03 Concentrated Formats enable targeted sprays' },
      { name: 'Smart unload reminders (app notifications)', type: 'tech', trendDrivers: 'T-08 Connected Appliances send completion alerts' },
      { name: 'Odor-elimination fabric mists', type: 'product', trendDrivers: 'C-04 Conscious Consumption + bio-based solutions' },
      { name: 'Microfiber-safe freshness products', type: 'product', trendDrivers: 'G-02 Microplastics Ban creates new care category' },
    ],
    negativelyImpacted: [
      { name: 'Standalone fabric softeners (liquid)', type: 'product', trendDrivers: 'T-03 Concentrated Formats integrated into pods' },
      { name: 'Heavy perfumed rinse aids', type: 'product', trendDrivers: 'C-04 Conscious Consumption + subtle scent preference' },
      { name: 'Synthetic static-control sheets', type: 'product', trendDrivers: 'G-05 Green Claims + E-02 sustainability concerns' },
    ],
  },
  {
    id: 'drying',
    label: 'Drying',
    benefiting: [
      { name: 'Heat pump dryers (energy-efficient)', type: 'tech', trendDrivers: 'E-02 Energy efficiency + climate consciousness' },
      { name: 'Dryer sheets with scent boosters', type: 'product', trendDrivers: 'C-03 Premiumization extends to drying products' },
      { name: 'Tumble dryer balls (eco-friendly)', type: 'product', trendDrivers: 'G-04 PPWR + E-02 Water Scarcity reduces fabric conditioner need' },
      { name: 'Dehumidifiers for air-dry optimization', type: 'tech', trendDrivers: 'E-02 Water Scarcity drives alternative drying' },
      { name: 'Smart dryer sensors & IoT tracking', type: 'tech', trendDrivers: 'T-08 Connected Appliances enable drying optimization' },
    ],
    negativelyImpacted: [
      { name: 'Traditional vented tumble dryers', type: 'tech', trendDrivers: 'E-02 Energy efficiency pressure + heat pump adoption' },
      { name: 'Basic drying racks (commoditized)', type: 'product', trendDrivers: 'T-08 Smart dryers with optimal timing' },
      { name: 'Chemical static-removing sprays', type: 'product', trendDrivers: 'G-05 Green Claims Directive bans synthetic chemicals' },
      { name: 'Dryer perfume papers (PVA-based)', type: 'product', trendDrivers: 'G-02 Microplastics Ban (polymer particle restrictions)' },
    ],
  },
  {
    id: 'ironing',
    label: 'Ironing',
    benefiting: [
      { name: 'Garment steamers (replacing irons)', type: 'tech', trendDrivers: 'T-08 Connected Appliances + faster convenience trend' },
      { name: 'Anti-wrinkle fabric treatment sprays', type: 'product', trendDrivers: 'T-03 Concentrated Formats + C-04 Conscious Consumption' },
      { name: 'Wrinkle-release fabric technologies (apparel)', type: 'tech', trendDrivers: 'T-01 AI formulations for wrinkle-resistant textiles' },
      { name: 'Steam closets / smart garment refresh cabinets', type: 'tech', trendDrivers: 'T-08 Connected Appliances + IoT clothing care' },
      { name: 'Portable cordless garment steamers', type: 'tech', trendDrivers: 'T-05 Manufacturing Automation enables compact designs' },
      { name: 'Smart garment care services (on-demand)', type: 'service', trendDrivers: 'K-04 Social Commerce + convenience premium' },
    ],
    negativelyImpacted: [
      { name: 'Traditional irons & ironing boards', type: 'tech', trendDrivers: 'T-08 Steamers + smart fabrics displace irons' },
      { name: 'Ironing starch sprays (traditional)', type: 'product', trendDrivers: 'T-03 Solid formats + fabric finish technologies' },
      { name: 'Ironing accessories (covers, pads, stands)', type: 'product', trendDrivers: 'C-06 Cost-of-Living Squeeze + ironing decline' },
      { name: 'Starch and sizing products (classic)', type: 'product', trendDrivers: 'T-01 AI fabrics reduce starch need' },
    ],
  },
  {
    id: 'folding_storing',
    label: 'Folding & Storing',
    benefiting: [
      { name: 'Smart anti-moth & fabric protection', type: 'product', trendDrivers: 'T-01 AI-optimized formula + C-04 Conscious Consumption' },
      { name: 'Fabric perfumes & closet scents (premium)', type: 'product', trendDrivers: 'C-03 Premiumization in home care products' },
      { name: 'Smart wardrobe management apps', type: 'tech', trendDrivers: 'T-07 AI Personalization + T-08 IoT closet sensors' },
      { name: 'Anti-humidity & moisture control devices', type: 'tech', trendDrivers: 'E-02 Water Scarcity + climate adaptation' },
      { name: 'Bio-based garment protection solutions', type: 'product', trendDrivers: 'T-02 Bio-Based Chemistry + C-04 Conscious' },
      { name: 'Smart storage container systems', type: 'tech', trendDrivers: 'T-08 Connected Appliances + home automation' },
    ],
    negativelyImpacted: [
      { name: 'Mothballs (chemical, declining appeal)', type: 'product', trendDrivers: 'G-01 PFAS concerns + C-04 Conscious Consumption' },
      { name: 'Basic storage boxes & organizers', type: 'product', trendDrivers: 'T-08 Smart storage obsoletes manual systems' },
      { name: 'Synthetic fragrance closet bars', type: 'product', trendDrivers: 'C-04 Conscious Consumption + natural preference' },
      { name: 'Wool blanket storage treatments', type: 'product', trendDrivers: 'T-02 Bio-Based Chemistry replaces synthetic treatments' },
    ],
  },
  {
    id: 'taking_out',
    label: 'Taking Out of Closet',
    benefiting: [
      { name: 'On-the-go clothing refresh sprays', type: 'product', trendDrivers: 'C-06 Cost-of-Living Squeeze reduces dry cleaning' },
      { name: 'Deodorizing mists (quick freshening)', type: 'product', trendDrivers: 'T-03 Concentrated Formats enable portable bottles' },
      { name: 'Fragrance refresh boosters (natural)', type: 'product', trendDrivers: 'C-04 Conscious Consumption + T-02 Bio-Based Chemistry' },
      { name: 'Fabric care on-demand services', type: 'service', trendDrivers: 'K-04 Social Commerce + convenience premium' },
      { name: 'Smart scent dispensers', type: 'tech', trendDrivers: 'T-08 IoT fabric care devices' },
    ],
    negativelyImpacted: [
      { name: 'Full re-wash cycle (replaced by refresh)', type: 'service', trendDrivers: 'C-06 Cost-of-Living Squeeze pressure + water scarcity' },
      { name: 'Heavy synthetic fragrance products', type: 'product', trendDrivers: 'C-04 Conscious Consumption shift to subtle' },
      { name: 'Conventional dry cleaning services', type: 'service', trendDrivers: 'C-06 Cost-of-Living Squeeze + E-02 sustainability' },
    ],
  },
  {
    id: 'wearing',
    label: 'Wearing',
    benefiting: [
      { name: 'Anti-stain / anti-odor smart textiles', type: 'tech', trendDrivers: 'T-01 AI-optimized fiber coatings + T-02 Bio-Based' },
      { name: 'Garment protection nano-coatings', type: 'product', trendDrivers: 'T-02 Bio-Based Chemistry + T-01 nano-formulations' },
      { name: 'Textile softeners (beyond wash cycle)', type: 'product', trendDrivers: 'T-03 Concentrated Formats enable targeted application' },
      { name: 'Clothing repair kits & devices', type: 'product', trendDrivers: 'C-04 Conscious Consumption + garment lifecycle extension' },
      { name: 'Fashion lifecycle services (repair/resale)', type: 'service', trendDrivers: 'K-07 Professional Salon Crossover extends to fashion' },
      { name: 'Stain-guard pre-treatment services', type: 'service', trendDrivers: 'C-03 Premiumization + K-07 Professional services' },
    ],
    negativelyImpacted: [
      { name: 'Fast fashion disposable garments', type: 'product', trendDrivers: 'C-04 Conscious Consumption + G-06 Deforestation Reg' },
      { name: 'Single-use stain wipes (plastic)', type: 'product', trendDrivers: 'G-04 PPWR + G-02 Microplastics regulation' },
      { name: 'Quick-fix synthetic patches', type: 'product', trendDrivers: 'G-05 Green Claims Directive bans misleading claims' },
      { name: 'Chemical-heavy protective sprays', type: 'product', trendDrivers: 'G-01 PFAS-based water repellents restricted' },
    ],
  },
  {
    id: 'between_washes',
    label: 'Between Washes',
    benefiting: [
      { name: 'Fabric refresh sprays (concentrated)', type: 'product', trendDrivers: 'T-03 Concentrated Formats + C-06 Cost-of-Living' },
      { name: 'On-the-go freshener/anti-static mists', type: 'product', trendDrivers: 'T-03 Concentrated Formats + convenience trend' },
      { name: 'Portable garment steaming devices', type: 'tech', trendDrivers: 'T-05 Manufacturing Automation enables compact design' },
      { name: 'Smart refreshing cabinets / steam closets', type: 'tech', trendDrivers: 'T-08 Connected Appliances + T-01 optimization' },
      { name: 'UV garment sanitizers (portable)', type: 'tech', trendDrivers: 'C-12 Post-COVID Hygiene Persistence + T-01 validation' },
      { name: 'Dry shampoo for clothes (spray)', type: 'product', trendDrivers: 'T-03 Concentrated Formats + C-06 Cost-Saving' },
      { name: 'Odor-elimination enzyme sprays', type: 'product', trendDrivers: 'T-02 Bio-Based Chemistry + T-01 enzyme optimization' },
      { name: 'Smart garment freshness alerts (app)', type: 'tech', trendDrivers: 'T-08 Connected Appliances + T-07 AI tracking' },
    ],
    negativelyImpacted: [
      { name: 'Full wash cycle (over-washing declining)', type: 'service', trendDrivers: 'C-06 Cost-of-Living Squeeze + E-02 water scarcity' },
      { name: 'Fabric de-wrinkling gadgets (niche)', type: 'tech', trendDrivers: 'T-08 Smart steamers + garment tech displaces niche' },
      { name: 'Heavy synthetic fabric refreshers', type: 'product', trendDrivers: 'C-04 Conscious Consumption + G-05 Green Claims' },
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
      { name: 'Shade finders & AR try-on tools', type: 'tech', trendDrivers: 'T-07 AI Personalization + T-01 color simulation' },
      { name: 'Style inspiration apps & platforms', type: 'tech', trendDrivers: 'K-04 Social Commerce + T-07 AI Personalization' },
      { name: 'Creator & community platforms', type: 'service', trendDrivers: 'K-04 Social Commerce + TikTok Shop trend' },
      { name: 'Trend-led inspiration collections', type: 'product', trendDrivers: 'C-03 Premiumization + C-08 Male Grooming' },
      { name: 'Digital consultation (AI-matched looks)', type: 'service', trendDrivers: 'T-01 AI-Driven matching + T-07 Personalization' },
      { name: 'Influencer shade collaborations', type: 'product', trendDrivers: 'K-04 Social Commerce + C-03 Premiumization' },
    ],
    negativelyImpacted: [
      { name: 'Print shade & style lookbooks', type: 'product', trendDrivers: 'T-07 Digital AR replaces static print' },
      { name: 'Occasion-based hair collections', type: 'product', trendDrivers: 'C-11 Gen Z Dupe Culture seeks value' },
      { name: 'Traditional salon consultations (walk-in)', type: 'service', trendDrivers: 'T-07 AI + digital booking reduces appointments' },
      { name: 'Basic brochure-based color guides', type: 'product', trendDrivers: 'T-01 AI shade matching obsoletes static charts' },
    ],
  },
  {
    id: 'diagnose',
    label: 'Diagnose',
    benefiting: [
      { name: 'Scalp & hair scanners (camera-based)', type: 'tech', trendDrivers: 'T-01 AI image analysis + T-04 Microbiome science' },
      { name: 'AI hair profiling (color, damage, texture)', type: 'tech', trendDrivers: 'T-01 AI-Driven analysis + T-07 Personalization' },
      { name: 'Porosity & damage diagnostic tests', type: 'product', trendDrivers: 'C-03 Premiumization (detailed diagnostics)' },
      { name: 'Dermatological & trichology assessments', type: 'service', trendDrivers: 'C-10 Hair Loss Treatments + clinical validation' },
      { name: 'Hormonal & nutritional deficiency screening', type: 'service', trendDrivers: 'C-05 Silver Economy + C-10 Hair Loss Treatments' },
      { name: 'At-home scalp microbiome testing', type: 'tech', trendDrivers: 'T-04 Microbiome Science (at-home kits)' },
      { name: 'DNA-based hair type profiling', type: 'service', trendDrivers: 'T-01 AI-Driven genetic matching + premiumization' },
    ],
    negativelyImpacted: [
      { name: 'Scalp analysis kits (basic / manual)', type: 'product', trendDrivers: 'T-01 AI cameras obsolete basic kits' },
      { name: 'Generic hair type classification guides', type: 'product', trendDrivers: 'T-01 AI personalization > generic guides' },
      { name: 'Weather/environment tracking (low engagement)', type: 'tech', trendDrivers: 'T-07 Personalization shifts from weather to microbiome' },
      { name: 'One-size-fits-all consultation models', type: 'service', trendDrivers: 'T-07 AI Personalization demands custom diagnostics' },
    ],
  },
  {
    id: 'prepare',
    label: 'Prepare',
    benefiting: [
      { name: 'Scalp protection & comfort systems', type: 'product', trendDrivers: 'T-02 Bio-Based Chemistry + C-04 Conscious' },
      { name: 'Bond builders (pre-color treatment)', type: 'product', trendDrivers: 'T-01 AI-optimized bond science + premiumization' },
      { name: 'Heat & UV protectants (advanced)', type: 'product', trendDrivers: 'T-02 Bio-Based Chemistry + T-01 nano-formulations' },
      { name: 'Anti-humidity & anti-frizz primers', type: 'product', trendDrivers: 'T-02 Bio-Based + T-01 climate-adaptive formulas' },
      { name: 'Scalp detox & exfoliation scrubs', type: 'product', trendDrivers: 'C-07 Scalp Care Category (new trend expansion)' },
      { name: 'Pre-treatment precision applicators (tech)', type: 'tech', trendDrivers: 'T-05 Manufacturing Automation precision dosing' },
      { name: 'Pre-color pH adjustment products', type: 'product', trendDrivers: 'T-01 AI color formulation (pH optimization)' },
      { name: 'Scalp barrier repair serums', type: 'product', trendDrivers: 'C-07 Scalp Care Category emergence' },
    ],
    negativelyImpacted: [
      { name: 'Basic pre-color treatments (commoditized)', type: 'product', trendDrivers: 'C-03 Premiumization displaces commodity category' },
      { name: 'Chelation treatments (niche, low awareness)', type: 'service', trendDrivers: 'T-07 Personalization requires new patient education' },
      { name: 'Manual sectioning clips & tools', type: 'product', trendDrivers: 'T-05 Automation + T-01 AI guides precision' },
      { name: 'Generic heat protection sprays', type: 'product', trendDrivers: 'C-03 Premiumization demands advanced formulas' },
    ],
  },
  {
    id: 'remedy',
    label: 'Remedy',
    benefiting: [
      { name: 'Hair loss & thinning growth serums', type: 'product', trendDrivers: 'C-10 Hair Loss Treatments (core trend) + C-05 Silver' },
      { name: 'Scalp care & barrier repair products', type: 'product', trendDrivers: 'C-07 Scalp Care Category (emerging category)' },
      { name: 'Regenerative scalp devices (LED, microcurrent)', type: 'tech', trendDrivers: 'T-05 Manufacturing Automation + T-04 Microbiome' },
      { name: 'Anti-dandruff & sensitive scalp remedies', type: 'product', trendDrivers: 'C-07 Scalp Care Category (medical positioning)' },
      { name: 'Dermatological consultation services', type: 'service', trendDrivers: 'C-10 Hair Loss Treatments + clinical approach' },
      { name: 'Low-level light therapy (LLLT) scalp tools', type: 'tech', trendDrivers: 'T-05 Manufacturing + clinical efficacy' },
      { name: 'Prebiotic & probiotic scalp treatments', type: 'product', trendDrivers: 'T-04 Microbiome Science (new category)' },
      { name: 'Nutritional supplementation programs', type: 'product', trendDrivers: 'C-05 Silver Economy + C-10 Hair Loss holistic' },
    ],
    negativelyImpacted: [
      { name: 'Generic dandruff shampoo (commoditized)', type: 'product', trendDrivers: 'C-03 Premiumization + C-07 Scalp Care specialization' },
      { name: 'Water softening devices for hair', type: 'tech', trendDrivers: 'T-08 Connected home water treatment integrated' },
      { name: 'Life-phase condition-based programs', type: 'service', trendDrivers: 'T-07 AI Personalization > generic life-phase segments' },
      { name: 'Synthetic scalp cooling treatments', type: 'product', trendDrivers: 'T-02 Bio-Based Chemistry replaces synthetics' },
    ],
  },
  {
    id: 'transform',
    label: 'Transform',
    benefiting: [
      { name: 'Permanent & demi-permanent color (advanced)', type: 'product', trendDrivers: 'C-03 Premiumization Color Care (core trend)' },
      { name: 'Balayage, highlight & brow tints', type: 'product', trendDrivers: 'C-03 Premiumization + K-07 Professional Salon' },
      { name: 'Bond repair & strengthen treatments', type: 'product', trendDrivers: 'T-01 AI-Driven bond chemistry + premiumization' },
      { name: 'Texture changers (perms, relaxers, keratin)', type: 'product', trendDrivers: 'T-02 Bio-Based Chemistry (safer formulas)' },
      { name: 'Salon coloration & blending services', type: 'service', trendDrivers: 'K-07 Professional Salon Crossover (premium) + C-03' },
      { name: 'Color application tools (precision devices)', type: 'tech', trendDrivers: 'T-05 Manufacturing Automation + precision dosing' },
      { name: 'Brow, lash & hair growth serums', type: 'product', trendDrivers: 'C-10 Hair Loss Treatments extends to brows/lashes' },
      { name: 'Digital color matching & consultation', type: 'service', trendDrivers: 'T-01 AI + T-07 Personalization for shade match' },
    ],
    negativelyImpacted: [
      { name: 'Temporary color (declining vs. permanent)', type: 'product', trendDrivers: 'C-03 Premiumization drives permanent investment' },
      { name: 'Basic shampoos & cleansers (frequent use decline)', type: 'product', trendDrivers: 'C-03 Premiumization shifts to treatments' },
      { name: 'Gray blending (niche positioning)', type: 'product', trendDrivers: 'C-05 Silver Economy prefers full color/coverage' },
      { name: 'Synthetic wigs & hair systems (stigma)', type: 'product', trendDrivers: 'C-03 Premiumization prefers authentic color' },
      { name: 'Budget color boxes (home-use)', type: 'product', trendDrivers: 'C-11 Gen Z Dupe Culture but C-03 premiumization wins' },
    ],
  },
  {
    id: 'lock_finish',
    label: 'Lock & Finish',
    benefiting: [
      { name: 'pH balance & neutralization systems', type: 'product', trendDrivers: 'T-01 AI-optimized pH science + color lock' },
      { name: 'After-color bond protection / cuticle sealing', type: 'product', trendDrivers: 'T-01 AI bond preservation + C-03 premiumization' },
      { name: 'Color stabilizers & color-lock serums', type: 'product', trendDrivers: 'T-01 AI color chemistry + extended fade resistance' },
      { name: 'Premium hair perfumes & scent finishing', type: 'product', trendDrivers: 'C-09 Fragrance Premiumization Home Care' },
      { name: 'Post-color stabilization services', type: 'service', trendDrivers: 'K-07 Professional Salon Crossover (premium service)' },
      { name: 'Color-protective oil treatments', type: 'product', trendDrivers: 'T-02 Bio-Based Chemistry + C-03 Premiumization' },
      { name: 'Ionic sealing hair tools', type: 'tech', trendDrivers: 'T-05 Manufacturing enables precision sealing' },
    ],
    negativelyImpacted: [
      { name: 'Basic hold & fix products (commoditized)', type: 'product', trendDrivers: 'C-03 Premiumization eliminates low-end category' },
      { name: 'Shine-only products (low differentiation)', type: 'product', trendDrivers: 'T-01 AI formulation > commodity shine boost' },
      { name: 'Conventional plastic hair accessories', type: 'product', trendDrivers: 'C-04 Conscious Consumption + G-04 PPWR plastic' },
      { name: 'Cheap fragrance finishing sprays', type: 'product', trendDrivers: 'C-09 Fragrance Premiumization (budget brands decline)' },
    ],
  },
  {
    id: 'maintain_optimize',
    label: 'Maintain & Optimize',
    benefiting: [
      { name: 'Color protection systems (UV, heat, pollution)', type: 'product', trendDrivers: 'T-02 Bio-Based Chemistry + T-01 nano-protection' },
      { name: 'Climate-adaptive protection shields', type: 'product', trendDrivers: 'T-02 Bio-Based + E-05 Climate Pest Shifts concern' },
      { name: 'Anti-frizz & smoothing sprays (advanced)', type: 'product', trendDrivers: 'T-01 AI humidity resistance + C-03 Premiumization' },
      { name: 'Scalp stimulation & regeneration devices', type: 'tech', trendDrivers: 'T-05 Manufacturing + T-04 Microbiome science' },
      { name: 'Biological support (ingestibles, supplements)', type: 'product', trendDrivers: 'C-10 Hair Loss Treatments + C-05 Silver Economy' },
      { name: 'Condition tracking & smart reminders (app)', type: 'tech', trendDrivers: 'T-07 AI Personalization + smart scheduling' },
      { name: 'Subscription / programmatic care services', type: 'service', trendDrivers: 'K-06 Subscription Lock-in + C-03 Premiumization' },
      { name: 'Weekly intensive treatment protocols', type: 'product', trendDrivers: 'C-03 Premiumization (multi-step routines)' },
      { name: 'Personalized rinse cycle optimization', type: 'tech', trendDrivers: 'T-07 AI + T-08 Connected home water systems' },
    ],
    negativelyImpacted: [
      { name: 'Tone & fade protection (anti-yellowing)', type: 'product', trendDrivers: 'T-01 AI color stability integrated in core formulas' },
      { name: 'Fragrance refresh boosters (undifferentiated)', type: 'product', trendDrivers: 'C-09 Fragrance Premiumization demands uniqueness' },
      { name: 'Deodorizing mists for hair (niche)', type: 'product', trendDrivers: 'C-06 Cost-of-Living Squeeze pressures accessory buys' },
      { name: 'One-time treatments (low engagement)', type: 'product', trendDrivers: 'K-06 Subscription models displace single-use' },
    ],
  },
  {
    id: 'refresh_between',
    label: 'Refresh / In-Between',
    benefiting: [
      { name: 'Dry shampoo (volume & convenience)', type: 'product', trendDrivers: 'C-06 Cost-of-Living Squeeze + convenience premium' },
      { name: 'Root retouch sprays (instant color refresh)', type: 'product', trendDrivers: 'T-03 Concentrated Formats + C-06 Cost saving' },
      { name: 'Color correction & neutralization products', type: 'product', trendDrivers: 'T-01 AI color correction formulas + on-demand' },
      { name: 'Leave-in & overnight treatments (intensive)', type: 'product', trendDrivers: 'C-03 Premiumization (multi-step routines)' },
      { name: 'Scalp care & balance mists', type: 'product', trendDrivers: 'C-07 Scalp Care Category (new category growth)' },
      { name: 'Portable styling tools (cordless)', type: 'tech', trendDrivers: 'T-05 Manufacturing Automation enables portability' },
      { name: 'Quick salon express refresh services', type: 'service', trendDrivers: 'K-04 Social Commerce + K-07 Professional crossover' },
      { name: 'At-home color touch-up sprays', type: 'product', trendDrivers: 'T-03 Concentrated Formats + T-07 AI personalized shades' },
      { name: 'Scalp wellness weekly protocols', type: 'product', trendDrivers: 'C-07 Scalp Care Category emergence' },
    ],
    negativelyImpacted: [
      { name: 'Glosses (limited repeat purchase)', type: 'product', trendDrivers: 'C-03 Premiumization shifts to permanent investment' },
      { name: 'Garment steaming for hair (novelty)', type: 'tech', trendDrivers: 'C-06 Cost squeeze + low engagement trend' },
      { name: 'On-the-go freshener sprays (generic)', type: 'product', trendDrivers: 'C-07 Scalp Care replaces generic "freshener" category' },
      { name: 'Temporary touch-up chalks', type: 'product', trendDrivers: 'T-03 Concentrated spray formats displace chalks' },
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

export default function ConsumerJourney({ onBack }: ConsumerJourneyProps) {
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
          gridTemplateColumns: `repeat(${journey.length}, minmax(140px, 1fr))`,
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
                <ProductPill key={i} entry={p} direction="expansion" onClick={() => handleProductClick(p, 'expansion', stage.label)} isSelected={selectedProduct?.entry.name === p.name && selectedProduct?.direction === 'expansion'} />
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
                  padding: '12px 14px', borderRadius: 8,
                  background: T.bg1, border: `1px solid ${T.border}`,
                }}>
                  {selectedProduct.entry.trendDrivers.split('+').map((driver, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 8,
                      padding: '6px 0',
                      borderBottom: i < selectedProduct.entry.trendDrivers.split('+').length - 1 ? `1px solid ${T.border}` : 'none',
                    }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700,
                        color: selectedProduct.direction === 'expansion' ? '#30D158' : '#FF453A',
                        marginTop: 1, flexShrink: 0,
                      }}>
                        {selectedProduct.direction === 'expansion' ? '↑' : '↓'}
                      </span>
                      <span style={{ fontSize: 12, color: T.text, lineHeight: 1.5, fontWeight: 500 }}>
                        {driver.trim()}
                      </span>
                    </div>
                  ))}
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
                    <div style={{ fontSize: 9, color: T.text3, marginBottom: 2 }}>Direction</div>
                    <div style={{
                      fontSize: 12, fontWeight: 700,
                      color: selectedProduct.direction === 'expansion' ? '#30D158' : '#FF453A',
                    }}>
                      {selectedProduct.direction === 'expansion' ? 'Pool Expansion ↑' : 'Pool Contraction ↓'}
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

function ProductPill({ entry, direction, onClick, isSelected }: { entry: ProductEntry; direction: 'expansion' | 'contraction'; onClick?: () => void; isSelected?: boolean }) {
  const typeStyle = (TYPE_STYLES[entry.type] ?? TYPE_STYLES['product'])!;
  const borderColor = isSelected
    ? (direction === 'expansion' ? 'rgba(48,209,88,0.5)' : 'rgba(255,69,58,0.4)')
    : (direction === 'expansion' ? 'rgba(48,209,88,0.15)' : 'rgba(255,69,58,0.12)');

  return (
    <div
      onClick={onClick}
      style={{
        marginBottom: 4,
        padding: '4px 6px',
        borderRadius: 5,
        background: isSelected
          ? (direction === 'expansion' ? 'rgba(48,209,88,0.12)' : 'rgba(255,69,58,0.10)')
          : (direction === 'expansion' ? 'rgba(48,209,88,0.05)' : 'rgba(255,69,58,0.04)'),
        border: `1px solid ${borderColor}`,
        display: 'flex', alignItems: 'flex-start', gap: 4,
        cursor: 'pointer',
        transition: 'all 0.12s ease',
      }}
      title="Click to view analysis"
      onMouseEnter={e => {
        e.currentTarget.style.background = direction === 'expansion' ? 'rgba(48,209,88,0.10)' : 'rgba(255,69,58,0.08)';
        e.currentTarget.style.borderColor = direction === 'expansion' ? 'rgba(48,209,88,0.3)' : 'rgba(255,69,58,0.25)';
      }}
      onMouseLeave={e => {
        if (!isSelected) {
          e.currentTarget.style.background = direction === 'expansion' ? 'rgba(48,209,88,0.05)' : 'rgba(255,69,58,0.04)';
          e.currentTarget.style.borderColor = direction === 'expansion' ? 'rgba(48,209,88,0.15)' : 'rgba(255,69,58,0.12)';
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
        fontSize: 10, color: T.text2, lineHeight: 1.3, fontWeight: 500,
      }}>
        {entry.name}
      </span>
    </div>
  );
}
