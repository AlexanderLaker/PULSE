/**
 * ConsumerJourney2.tsx — Consumer Journey Profit Flow Map (Editorial View)
 *
 * Design-harmonized sibling of ConsumerJourney.tsx. Content is identical —
 * only the visual language is upgraded to match Trends2 / ProfitPoolAnalysis2
 * / TrendExplorer ("Digital Curator" editorial style).
 *
 * Design principles applied:
 *   • Maritime blue palette with tonal layering (no hard borders)
 *   • Manrope headlines + Inter body pairing
 *   • Pill-shaped filter chips and toggles
 *   • Editorial "insight rail" accent on the section header
 *   • Rounded 2xl paper card hosting the journey grid
 *   • framer-motion for expand/collapse interactions
 *
 * Two journey overviews:
 * 1. Laundry & Home Care (13 stages: Sorting → Between Washes)
 * 2. Hair Consumer Business (8 stages: Inspire → Refresh/Between)
 *
 * Each overview is split horizontally:
 *   - TOP half: product types that BENEFIT (Expansion) from trends & forces
 *   - BOTTOM half: product types NEGATIVELY IMPACTED (Contraction)
 *
 * IMPORTANT: No data is removed, added, or altered — only re-skinned.
 */

'use client';

import React, { useState, useCallback, FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, ExternalLink,
  ArrowRight, X, Edit3, Check,
} from 'lucide-react';

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
      { name: 'DPP-enabled garment care scanners', type: 'tech', trendDrivers: 'G-07 Digital Product Passport + T-01 AI fabric recognition', intensity: 2 },
      { name: 'Large-print accessible care labels', type: 'product', trendDrivers: 'C-05 Silver Economy ease-of-use packaging', intensity: 1 },
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
      { name: 'Concentrated stain remover refill pouches', type: 'product', trendDrivers: 'C-13 Refill & Reuse Economy + T-03 Concentrated Formats', intensity: 2 },
    ],
    negativelyImpacted: [
      { name: 'Chlorine-based pre-treaters', type: 'product', trendDrivers: 'G-01 PFAS Restriction + G-02 Microplastics Ban', intensity: 3 },
      { name: 'Solvent-based fabric protectors', type: 'product', trendDrivers: 'G-01 PFAS + G-03 Cosmetics Regulation extends to textiles', intensity: 3 },
      { name: 'Soil-release coatings (PFCs)', type: 'product', trendDrivers: 'G-01 PFAS Restriction (direct regulatory hit)', intensity: 3 },
      { name: 'Heavy chemical stain blockers', type: 'product', trendDrivers: 'G-05 Green Claims Directive (greenwashing crackdown)', intensity: 2 },
      { name: 'Synthetic perfume-heavy pre-treaters', type: 'product', trendDrivers: 'C-04 Conscious Consumption + G-05 Green Claims', intensity: 2 },
      { name: 'Retailer own-brand stain removers (premium PL)', type: 'product', trendDrivers: 'C-01 Private Label Structural Penetration at 42% share', intensity: 3 },
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
      { name: 'Discount-exclusive branded value formats', type: 'product', trendDrivers: 'K-01 Discount Retail Channel Expansion at 25-35% share', intensity: 2 },
      { name: 'Smart auto-dosing detergent cartridges', type: 'product', trendDrivers: 'T-08 Connected Appliances auto-dosing (Henkel Smartwash)', intensity: 3 },
    ],
    negativelyImpacted: [
      { name: 'Traditional bulk powder detergent', type: 'product', trendDrivers: 'T-03 Concentrated Formats displace dilute powders', intensity: 3 },
      { name: 'Conventional large liquid bottles', type: 'product', trendDrivers: 'T-03 Concentrated Formats + G-04 PPWR (packaging)', intensity: 3 },
      { name: 'Chlorine-based whiteners / bleach', type: 'product', trendDrivers: 'G-01 PFAS + G-02 Microplastics regulatoin', intensity: 3 },
      { name: 'Separate water softening salts', type: 'product', trendDrivers: 'T-08 Integrated water treatment in machines', intensity: 2 },
      { name: 'Synthetic optical brighteners', type: 'product', trendDrivers: 'G-05 Green Claims Directive (microplastic brighteners banned)', intensity: 2 },
      { name: 'Anti-greying chemical additives', type: 'product', trendDrivers: 'G-03 Cosmetics Regulation VII/VIII extends to additives', intensity: 2 },
      { name: 'DIY home-made detergent kits', type: 'product', trendDrivers: 'C-06 Cost-of-Living Squeeze + C-25 Household atomisation pressures mass-pack economics', intensity: 1 },
      { name: 'Branded detergents losing share to premium PL', type: 'product', trendDrivers: 'C-01 Private Label 42% EU6 + X-13 Retailer vertical integration deepens PL moat', intensity: 3 },
      { name: 'Mid-tier detergent range (squeezed middle)', type: 'product', trendDrivers: 'C-06 Cost-of-Living trading down + C-01 PL penetration', intensity: 3 },
      { name: 'Import-dependent raw material formulations', type: 'product', trendDrivers: 'G-08 Tariffs & Trade Wars + E-01 Palm Oil Disruption', intensity: 2 },
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
      { name: 'AI-optimized cold-wash cycle programs', type: 'tech', trendDrivers: 'T-01 AI-Driven Formulation + E-07 Energy Cost Volatility', intensity: 2 },
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
      { name: 'Wash-cycle additives from divesting brands', type: 'product', trendDrivers: 'X-01 Reckitt Essential Home Divestiture share capture', intensity: 2 },
    ],
    negativelyImpacted: [
      { name: 'Standard non-connected machines', type: 'tech', trendDrivers: 'T-08 Connected Appliances obsolete legacy hardware', intensity: 3 },
      { name: 'Hot-wash detergent formulas', type: 'product', trendDrivers: 'T-01 AI cold-wash optimization + energy efficiency', intensity: 2 },
      { name: 'Standalone Calgon-type water softeners', type: 'product', trendDrivers: 'T-08 Integrated machine water treatment', intensity: 2 },
      { name: 'Static water-hardness testing strips', type: 'product', trendDrivers: 'T-08 IoT machines auto-detect water hardness', intensity: 1 },
      { name: 'High-temperature wash detergents', type: 'product', trendDrivers: 'E-02 Water Scarcity + energy efficiency trends', intensity: 2 },
      { name: 'Energy-intensive hot-wash programs', type: 'tech', trendDrivers: 'E-07 Energy Cost Volatility at 2-3x US levels', intensity: 2 },
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
      { name: 'Dryer sheets with scent boosters', type: 'product', trendDrivers: 'C-09 Fragrance Premiumization in Home Care at 15%+ growth', intensity: 3 },
      { name: 'Tumble dryer balls (eco-friendly)', type: 'product', trendDrivers: 'G-04 PPWR + E-02 Water Scarcity reduces fabric conditioner need', intensity: 2 },
      { name: 'Dehumidifiers for air-dry optimization', type: 'tech', trendDrivers: 'E-02 Water Scarcity drives alternative drying', intensity: 1 },
      { name: 'Smart dryer sensors & IoT tracking', type: 'tech', trendDrivers: 'T-08 Connected Appliances enable drying optimization', intensity: 2 },
      { name: 'Gentle-dry garment longevity products', type: 'product', trendDrivers: 'E-08 Textile Longevity + C-04 Conscious Consumption', intensity: 2 },
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
      { name: 'Spray-and-wear anti-wrinkle solutions', type: 'product', trendDrivers: 'C-05 Silver Economy ease-of-use + T-03 Concentrated Formats', intensity: 2 },
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
      { name: 'Fabric perfumes & closet scents (premium)', type: 'product', trendDrivers: 'C-03 Premiumization in home care + T-17 Neurocosmetic sensory science', intensity: 2 },
      { name: 'Smart wardrobe management apps', type: 'tech', trendDrivers: 'T-07 AI Personalization + T-08 IoT closet sensors', intensity: 2 },
      { name: 'Anti-humidity & moisture control devices', type: 'tech', trendDrivers: 'E-02 Water Scarcity + climate adaptation', intensity: 1 },
      { name: 'Bio-based garment protection solutions', type: 'product', trendDrivers: 'T-02 Bio-Based Chemistry + C-04 Conscious', intensity: 2 },
      { name: 'Smart storage container systems', type: 'tech', trendDrivers: 'T-08 Connected Appliances + home automation', intensity: 2 },
      { name: 'Extended-range pest protection products', type: 'product', trendDrivers: 'E-05 Climate-Driven Pest Shifts expanding geographic range', intensity: 2 },
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
      { name: 'UV garment sanitizers (portable)', type: 'tech', trendDrivers: 'C-12 Post-COVID Hygiene Persistence + T-01 validation', intensity: 2 },
      { name: 'Dry shampoo for clothes (spray)', type: 'product', trendDrivers: 'T-03 Concentrated Formats + C-06 Cost-Saving', intensity: 2 },
      { name: 'Odor-elimination enzyme sprays', type: 'product', trendDrivers: 'T-02 Bio-Based Chemistry + T-01 enzyme optimization', intensity: 2 },
      { name: 'Smart garment freshness alerts (app)', type: 'tech', trendDrivers: 'T-08 Connected Appliances + T-07 AI tracking', intensity: 1 },
      { name: 'Branded fabric refresh spray range', type: 'product', trendDrivers: 'C-14 Between-Wash Fabric Care (White Spot score 0.82)', intensity: 3 },
      { name: 'Antibacterial garment hygiene sprays', type: 'product', trendDrivers: 'C-12 Post-COVID Hygiene Persistence + T-02 Bio-Based', intensity: 2 },
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
      { name: 'AI-generated personalized content at scale', type: 'tech', trendDrivers: 'T-10 Gen AI Marketing Efficiency (40-60% cost reduction)', intensity: 2 },
    ],
    negativelyImpacted: [
      { name: 'Print shade & style lookbooks', type: 'product', trendDrivers: 'T-07 Digital AR replaces static print', intensity: 2 },
      { name: 'Occasion-based hair collections', type: 'product', trendDrivers: 'C-11 Gen Z Dupe Culture seeks value', intensity: 1 },
      { name: 'Traditional salon consultations (walk-in)', type: 'service', trendDrivers: 'T-07 AI + digital booking reduces appointments', intensity: 2 },
      { name: 'Basic brochure-based color guides', type: 'product', trendDrivers: 'T-01 AI shade matching obsoletes static charts', intensity: 1 },
      { name: 'Search-dependent product discovery (SEO)', type: 'tech', trendDrivers: 'T-09 Generative AI Disrupts Product Discovery (GEO vs SEO)', intensity: 3 },
      { name: 'Value-tier color kits (TikTok-native alternatives)', type: 'product', trendDrivers: 'K-04 Social Commerce + C-11 Gen Z Dupe Culture', intensity: 2 },
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
      { name: 'Male-specific hair thinning pattern analyzers', type: 'tech', trendDrivers: 'C-08 Male Grooming Structural Growth + T-01 AI analysis', intensity: 2 },
      { name: 'Post-medication hair health monitors', type: 'tech', trendDrivers: 'C-02 GLP-1 Drug hair side-effects + T-07 AI Personalization', intensity: 1 },
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
      { name: 'UV-filter-dependent protectants (restricted ingredients)', type: 'product', trendDrivers: 'G-03 Cosmetics Regulation VII/VIII (SCCS restrictions)', intensity: 2 },
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
      { name: 'Mass-market anti-hair-loss treatments (indie pressure)', type: 'product', trendDrivers: 'X-04 DTC & Indie Brand Disruption (K18, Olaplex, Virtue)', intensity: 2 },
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
      { name: 'Professional-grade at-home color systems', type: 'product', trendDrivers: 'K-07 Professional Salon Crossover ($23.4B market, 63% B2C)', intensity: 3 },
    ],
    negativelyImpacted: [
      { name: 'Temporary color (declining vs. permanent)', type: 'product', trendDrivers: 'C-03 Premiumization drives permanent investment', intensity: 2 },
      { name: 'Basic shampoos & cleansers (frequent use decline)', type: 'product', trendDrivers: 'C-03 Premiumization shifts to treatments', intensity: 2 },
      { name: 'Gray blending (niche positioning)', type: 'product', trendDrivers: 'C-05 Silver Economy prefers full color/coverage', intensity: 1 },
      { name: 'Synthetic wigs & hair systems (stigma)', type: 'product', trendDrivers: 'C-03 Premiumization prefers authentic color', intensity: 1 },
      { name: 'Budget color boxes (home-use)', type: 'product', trendDrivers: 'C-11 Gen Z Dupe Culture but C-03 premiumization wins', intensity: 2 },
      { name: 'Mid-price permanent color (squeezed middle)', type: 'product', trendDrivers: 'C-01 Private Label + C-06 Cost-of-Living + X-13 Retailer vertical integration', intensity: 3 },
      { name: 'Standard salon-quality retail products', type: 'product', trendDrivers: 'X-02 Unilever B&W massive investment + X-03 P&G Superiority', intensity: 2 },
    ],
  },
  {
    id: 'lock_finish',
    label: 'Lock & Finish',
    benefiting: [
      { name: 'pH balance & neutralization systems', type: 'product', trendDrivers: 'T-01 AI-optimized pH science + color lock', intensity: 2 },
      { name: 'After-color bond protection / cuticle sealing', type: 'product', trendDrivers: 'T-01 AI bond preservation + C-03 premiumization', intensity: 3 },
      { name: 'Color stabilizers & color-lock serums', type: 'product', trendDrivers: 'T-01 AI color chemistry + extended fade resistance', intensity: 3 },
      { name: 'Premium hair perfumes & scent finishing', type: 'product', trendDrivers: 'C-09 Fragrance Premiumization + T-17 Neurocosmetics & sensory-science', intensity: 2 },
      { name: 'Post-color stabilization services', type: 'service', trendDrivers: 'K-07 Professional Salon Crossover (premium service)', intensity: 2 },
      { name: 'Color-protective oil treatments', type: 'product', trendDrivers: 'T-02 Bio-Based Chemistry + C-03 Premiumization', intensity: 2 },
      { name: 'Ionic sealing hair tools', type: 'tech', trendDrivers: 'T-05 Manufacturing enables precision sealing', intensity: 1 },
    ],
    negativelyImpacted: [
      { name: 'Basic hold & fix products (commoditized)', type: 'product', trendDrivers: 'C-03 Premiumization eliminates low-end category', intensity: 3 },
      { name: 'Shine-only products (low differentiation)', type: 'product', trendDrivers: 'T-01 AI formulation > commodity shine boost', intensity: 2 },
      { name: 'Conventional plastic hair accessories', type: 'product', trendDrivers: 'C-04 Conscious Consumption + G-04 PPWR plastic', intensity: 1 },
      { name: 'Cheap fragrance finishing sprays', type: 'product', trendDrivers: 'C-09 Fragrance Premiumization (budget brands decline)', intensity: 2 },
      { name: 'Unsubstantiated "natural" finishing products', type: 'product', trendDrivers: 'G-05 Green Claims Directive (Sept 2026 enforcement)', intensity: 2 },
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
      { name: 'Emerging-market hair care regimens (IMEA)', type: 'product', trendDrivers: 'X-06 IMEA growth 12.1% organic + G-13 AfCFTA unlocks African intra-trade scale', intensity: 2 },
    ],
    negativelyImpacted: [
      { name: 'Tone & fade protection (anti-yellowing)', type: 'product', trendDrivers: 'T-01 AI color stability integrated in core formulas', intensity: 2 },
      { name: 'Fragrance refresh boosters (undifferentiated)', type: 'product', trendDrivers: 'C-09 Fragrance Premiumization demands uniqueness', intensity: 1 },
      { name: 'Deodorizing mists for hair (niche)', type: 'product', trendDrivers: 'C-06 Cost-of-Living Squeeze pressures accessory buys', intensity: 1 },
      { name: 'One-time treatments (low engagement)', type: 'product', trendDrivers: 'K-06 Subscription models displace single-use', intensity: 2 },
      { name: 'Online-listed care products (retail media tax)', type: 'product', trendDrivers: 'T-06 Retail Media Networks ($184B, 39% FMCG ad spend)', intensity: 2 },
      { name: 'E-commerce replenishment margins (pay-to-play)', type: 'service', trendDrivers: 'K-02 E-Commerce Profit Pool Maturation + K-06 Subscription', intensity: 2 },
    ],
  },
  {
    id: 'refresh_between',
    label: 'Refresh / In-Between',
    benefiting: [
      { name: 'Dry shampoo (volume & convenience)', type: 'product', trendDrivers: 'C-15 Hair Styling Between Washes (7%+ CAGR, Batiste $1B+)', intensity: 3 },
      { name: 'Root retouch sprays (instant color refresh)', type: 'product', trendDrivers: 'T-03 Concentrated Formats + C-06 Cost saving', intensity: 2 },
      { name: 'Color correction & neutralization products', type: 'product', trendDrivers: 'T-01 AI color correction formulas + on-demand', intensity: 2 },
      { name: 'Leave-in & overnight treatments (intensive)', type: 'product', trendDrivers: 'C-03 Premiumization (multi-step routines)', intensity: 2 },
      { name: 'Scalp care & balance mists', type: 'product', trendDrivers: 'C-07 Scalp Care Category (new category growth)', intensity: 2 },
      { name: 'Portable styling tools (cordless)', type: 'tech', trendDrivers: 'T-05 Manufacturing Automation enables portability', intensity: 1 },
      { name: 'Quick salon express refresh services', type: 'service', trendDrivers: 'K-04 Social Commerce + K-07 Professional crossover', intensity: 2 },
      { name: 'At-home color touch-up sprays', type: 'product', trendDrivers: 'T-03 Concentrated Formats + T-07 AI personalized shades', intensity: 2 },
      { name: 'Scalp wellness weekly protocols', type: 'product', trendDrivers: 'C-07 Scalp Care Category emergence', intensity: 2 },
      { name: 'Male dry styling & texture sprays', type: 'product', trendDrivers: 'C-08 Male Grooming + C-15 Hair Styling Between Washes', intensity: 2 },
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
// EDITORIAL DESIGN TOKENS — aligned with Trends2 / ProfitPoolAnalysis2
// ═══════════════════════════════════════════════════════════════

const S = {
  bg:                  '#f8f9ff',
  surface:             '#ffffff',
  surfaceLow:          '#eff4ff',
  surfaceContainer:    '#e5eeff',
  surfaceHigh:         '#dce9ff',
  surfaceHighest:      '#d2e4ff',
  primary:             '#005db5',
  primaryDim:          '#0052a0',
  primaryContainer:    '#d6e3ff',
  onPrimaryContainer:  '#00519e',
  onBg:                '#00345e',
  onSurface:           '#00345e',
  onSurfaceVariant:    '#26619d',
  secondaryContainer:  '#d5e3fc',
  onSecondaryContainer:'#455367',
  tertiaryContainer:   '#dae2fd',
  onTertiaryContainer: '#4a5167',
  // Success (expansion) — aligned with maritime palette
  expansionContainer:  '#d6ecdb',
  onExpansionContainer:'#1e5f2e',
  expansion:           '#2d7d3f',
  // Error (contraction)
  error:               '#9f403d',
  errorContainer:      '#fee3e1',
  onErrorContainer:    '#752121',
  // Outline
  outline:             '#477dbb',
  outlineVariant:      '#81b5f6',
  cardBorder:          'rgba(0, 52, 94, 0.10)',
  cardBorderStrong:    'rgba(0, 52, 94, 0.16)',
  mutedText:           '#64748B',
};

const HEADLINE_FONT = "'Manrope', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const BODY_FONT     = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

// ═══════════════════════════════════════════════════════════════
// TYPE BADGE STYLES — editorial tonal containers
// ═══════════════════════════════════════════════════════════════

const TYPE_STYLES: Record<string, { bg: string; text: string; label: string; short: string }> = {
  product: { bg: S.primaryContainer,   text: S.onPrimaryContainer,    label: 'Product',     short: 'P' },
  tech:    { bg: S.tertiaryContainer,  text: S.onTertiaryContainer,   label: 'Tech/Device', short: 'T' },
  service: { bg: S.secondaryContainer, text: S.onSecondaryContainer,  label: 'Service',     short: 'S' },
};

// ═══════════════════════════════════════════════════════════════
// INTENSITY-BASED COLOR SCALES — maritime-aligned green / red
// ═══════════════════════════════════════════════════════════════

const INTENSITY_COLORS = {
  expansion: {
    1: { bg: 'rgba(45,125,63,0.10)', border: 'rgba(45,125,63,0.20)', hoverBg: 'rgba(45,125,63,0.18)', hoverBorder: 'rgba(45,125,63,0.38)', selectedBg: 'rgba(45,125,63,0.22)', text: '#1e5f2e' },
    2: { bg: 'rgba(45,125,63,0.22)', border: 'rgba(45,125,63,0.38)', hoverBg: 'rgba(45,125,63,0.32)', hoverBorder: 'rgba(45,125,63,0.55)', selectedBg: 'rgba(45,125,63,0.40)', text: '#1e5f2e' },
    3: { bg: 'rgba(30,95,46,0.38)',  border: 'rgba(30,95,46,0.60)',  hoverBg: 'rgba(30,95,46,0.50)',  hoverBorder: 'rgba(30,95,46,0.78)',  selectedBg: 'rgba(30,95,46,0.58)',  text: '#0e3a1a' },
  },
  contraction: {
    1: { bg: 'rgba(159,64,61,0.10)',  border: 'rgba(159,64,61,0.20)',  hoverBg: 'rgba(159,64,61,0.18)',  hoverBorder: 'rgba(159,64,61,0.38)',  selectedBg: 'rgba(159,64,61,0.22)',  text: '#752121' },
    2: { bg: 'rgba(159,64,61,0.22)',  border: 'rgba(159,64,61,0.40)',  hoverBg: 'rgba(159,64,61,0.32)',  hoverBorder: 'rgba(159,64,61,0.55)',  selectedBg: 'rgba(159,64,61,0.40)',  text: '#752121' },
    3: { bg: 'rgba(117,33,33,0.38)',  border: 'rgba(117,33,33,0.60)',  hoverBg: 'rgba(117,33,33,0.50)',  hoverBorder: 'rgba(117,33,33,0.78)',  selectedBg: 'rgba(117,33,33,0.58)',  text: '#4a0f0f' },
  },
};

// ═══════════════════════════════════════════════════════════════
// PRISM Analysis — Henkel-specific strategic read-out
// Architecture: Stage-level brand context + smart product-to-brand routing
// ═══════════════════════════════════════════════════════════════

const PRISM_OVERRIDES: Record<string, string> = {
  'AI stain/fabric recognition apps::expansion': `**1. Summary.** When a phone camera reads the garment, it also reads the regimen — and from there it picks the SKU. T-01 collapses what was a label-and-touch decision into an algorithmic recommendation, lifting the choice moment off the shelf and onto the device. The pool that used to sit in packaging-led discovery migrates to whoever controls the diagnostic-to-prescription path; once the consumer trusts the camera, brand comparison stops happening at the shelf.\n\n**2. Strategic Evaluation.** HCB cannot afford this surface to stay neutral. A Persil-branded garment care advisor wired into the Smartwash + Miele/Bosch/Samsung stack closes the loop from recognition to dose to fulfilment, with Persil and Vernel as the prescriptive defaults. The window is 18-24 months: Tide-Samsung and Ariel-LG pilots are already drifting toward exclusivity, and once OEM defaults harden the cost of catch-up flips from NPD to M&A.`,
  'Smart fabric scanner & QR tools::expansion': `**1. Summary.** G-07 (Digital Product Passport) embeds QR-driven fabric metadata into the laundry journey. Scanning a garment's care profile unlocks prescriptive bundles — not just instructions, but the actual product stack that code-generator systems can recommend. This is the shelf displacing into supply-chain logic: the consumer follows a digital passport, not a brand.\n\n**2. Strategic Evaluation.** Persil must own the passport-to-product gateway before P&G or Unilever hardwire their own brands into the scanning experience. Launch a Persil Digital Care ID system (QR on garment + Smartwash app) that auto-prescribes Persil Power Caps and Vernel as the canonical bundle. By H2 2026, before the EUDR December 2026 traceability deadline closes this window, secure OEM integration with Bosch/Miele to embed the scanner into the washer UI.`,
  'Garment care advisory service (digital)::expansion': `**1. Summary.** K-04 (Social Commerce) and T-07 (AI Personalization) converge on a new consumer moment: the on-demand garment concierge. Instead of a printed care label, the consumer texts or TikToks a photo; an AI service recommends not just a detergent but a rinse cycle, temperature, and a follow-up product (softener, refresh spray). The profit pool shifts from commodity shelf to subscription-grade advisory margins.\n\n**2. Strategic Evaluation.** Anchor this to Persil as a premium Smartwash subscription service: Persil Care Advisor bundled with auto-dosing cartridge supply. Position against free AI-powered beauty guides (Modiface by L'Oréal is the template). Charge €4.99/month for unlimited garment diagnostics and auto-deliver Persil + Vernel refill cartridges. Launch beta Q3 2026 on TikTok Shop, capturing creator and Gen Z adoption before competitors build in-app services.`,
  'Smart home integration platforms::expansion': `**1. Summary.** T-08 (Connected Appliances) collapses the sorting decision upstream: the washer itself reads WiFi—connected Philips Hue bulbs, smart home humidity sensors, even calendar data—and pre-selects a cycle and detergent. The consumer no longer chooses; the platform does. Profit migrates from consumer packaging choice to OEM default settings and recurring cartridge subscriptions.\n\n**2. Strategic Evaluation.** Persil Smartwash must be the default cartridge in Miele and Bosch's next-gen connected washers launched Q2 2027. Negotiate exclusive cartridge supply agreements now: Persil = OEM native, Tide/Ariel = aftermarket. Leverage Henkel's existing appliance partnerships to lock in 5M+ machine install base before Samsung/LG sign exclusive P&G deals. This is infrastructure lock-in, not brand preference.`,
  'DPP-enabled garment care scanners::expansion': `**1. Summary.** G-07 (Digital Product Passport) and T-01 (AI Formulation) converge on a single product moment: the DPP QR on a garment triggers both care-regimen recommendation and the fulfillment of that regimen. The scanner becomes a transaction portal. Whoever controls the scanner controls the replenishment decision.\n\n**2. Strategic Evaluation.** Persil owns the Smartwash scanning layer; now extend it with embedded DPP-reader logic that pulls fabric durability scores, fiber content, care history, and manufacturer repair availability. Cross-merchandise Persil White Power (eco-certified under G-07 mandates) and Vernel for durability-conscious consumers. By H1 2027, when EU DPP becomes mandatory for detergents, Henkel has first-mover advantage in the scanner-to-prescription loop against late-moving P&G.`,
  'Large-print accessible care labels::expansion': `**1. Summary.** C-05 (Silver Economy) targets the 60+ demographic driving 40% of LHC spend in Europe. Aging consumers depend on tactile and large-format care instructions; this is a packaging design trend driven by demographic demand, not regulation. Henkel can capture a premium position by making accessibility the brand signal.\n\n**2. Strategic Evaluation.** Persil launches a dedicated "Persil Clear Care" line with oversized, high-contrast care labeling and QR codes linking to audio guides (for vision-impaired). Partner with AAA (German Automobile Association) and senior co-op retailers to distribute through trusted senior channels. Charge 15% premium on packaging. By Q4 2026, this becomes a differentiator against P&G's one-size-fits-all approach, capturing 5-8% of 50+ female buyers in Germany/UK.`,
  'Manual sorting aids (baskets, dividers)::contraction': `**1. Summary.** T-01 and T-07 (AI Personalization) are making manual sorting visual aids—colour-coded baskets, dividers, print guides—obsolete. The washer with an integrated camera and load-weight sensor becomes the sorting system; the consumer's job is simply to open the door. Profit shifts from low-margin plastic accessories to high-margin software subscriptions.\n\n**2. Strategic Evaluation.** Stop investing in Henkel-branded sorting baskets and plastic accessories. Redirect innovation spend into Smartwash software: load recognition, fabric classification, optimal cycle selection. Concede the low-margin accessory market to private label and cheap imports. By 2027, the category will be dominated by appliance OEMs (Miele, Bosch) offering integrated sorting intelligence, not by branded consumer goods.`,
  'Generic care label guides (print)::contraction': `**1. Summary.** T-07 (AI Personalization at Scale) removes the need for paper care guides inside or on packaging. A smartphone QR code triggers a personalized, voice-driven video tutorial tailored to the consumer's device language and washing machine model. Static printed guides are now a cost centre, not a feature.\n\n**2. Strategic Evaluation.** Eliminate paper care-guide printing from Persil packaging starting Q1 2027. Replace with minimal QR + "Scan for personalized care" text in 8 languages. Redirect packaging cost savings into Smartwash app development and OEM integration. This move cuts packaging COGS by 0.3–0.5€ per pack and positions Henkel as digital-native against Unilever (still printing multi-page guides in OMO packaging).`,
  'Fabric identification cards::contraction': `**1. Summary.** T-01 (AI Fabric Recognition) makes the physical identification card redundant. A phone camera now identifies fibre content, weave density, and care sensitivity more accurately than a consumer consulting a printed card. The card's profit pool was never substantial; its death is not a competitive event but a format obsolescence.\n\n**2. Strategic Evaluation.** Discontinue any Persil-branded fabric ID card inserts or point-of-purchase displays. Invest the savings into Smartwash app UX for fabric identification. By H2 2026, market share will shift entirely to digital AI tools (owned by appliance makers and retail platforms). Henkel's move is to own the recommendation layer *after* the AI identification, not to fight AI with printed cards.`,
  'Enzyme-based stain removers (bio-actives)::expansion': `**1. Summary.** T-02 (Bio-Based & Green Chemistry) and T-01 (AI enzyme optimization) converge on a new generation of stain-removal actives: cellulase, amylase, and protease enzymes optimized for specific fibre/stain combinations via AI screening. These actives are more efficacious than synthetic bleach, align with G-01/G-02 regulatory bans on PFCs and chlorine, and command 30–50% premiums over conventional formulations.\n\n**2. Strategic Evaluation.** Sil must become Henkel's enzyme innovation platform. Develop Sil Bio-Stain: a concentrated spray containing four enzyme classes (cellulase for plant fibres, protease for protein stains, amylase for carbs, lipase for oils), formulated via T-01 AI screening. Position against Vanish (Advent-owned, slowing R&D) and private label bleach sprays. Launch H1 2027 at €3.99 (vs €2.20 for chlorine). Secure 8% pre-treat market share in DE/UK/FR by Q1 2028.`,
  'Targeted stain pens & precision sprays::expansion': `**1. Summary.** T-03 (Concentrated Formats) enables ultra-targeted stain dosing: a pen applicator or micro-spray delivers a 0.2ml dose of concentrated enzyme complex directly to the stain. This is the opposite of the pre-treat bucket; it reduces waste, increases efficacy per dose, and commands premiums. The trend is from "drown the garment" to "laser the stain".\n\n**2. Strategic Evaluation.** Launch Sil Stain-Laser Pen under Sil as a premium targeted-treatment range. Partner with Henkel's concentrated R&D (T-03 expertise from Persil Power Caps) to engineer a 50x concentrate in a refillable pen format. Retail at €5.99. Position against Vanish Oxi Action (losing shelf space under PE ownership) and Shout (US-only). Penetrate UK and German premium grocery by Q4 2026 through beauty/premium aisle placement, not commodity shelves.`,
  'Ultrasonic stain erasers (devices)::expansion': `**1. Summary.** T-05 (Manufacturing Automation) enables micro-scale IoT device production: ultrasonic vibration at 40kHz can disrupt stain particles without damaging fibres. This shifts stain removal from chemistry to hardware, creating a new product category at the intersection of appliances and laundry care. The profit pool here is device revenue + consumable refills (cleaning pads, power cells).\n\n**2. Strategic Evaluation.** Partner with Xiaomi or Philips to co-develop an Henkel-branded ultrasonic stain eraser device bundled with Sil enzyme pads. Position as "the stain-removal device: ultrasonic agitation + enzymatic action" against manual brushing. Retail device at €39.99, pads at €9.99/5-pack. Launch Q1 2027 in Germany, UK, Benelux through electronics retailers (MediaMarkt, Saturn) and appliance channels. Target affluent households (HHI €80k+); penetrate 2% of German laundry-care purchasers by 2028.`,
  'Plant-based odor neutralizers::expansion': `**1. Summary.** T-02 (Bio-Based Chemistry) and C-04 (Conscious Consumption) drive a shift from synthetic fragrance masking to botanical odor neutralizers: charcoal, enzymes, and essential oils that degrade odor molecules rather than perfuming over them. The pool here expands as consumers trade synthetic fragrances for "clean" actives; margin expansion comes from premiumization, not volume.\n\n**2. Strategic Evaluation.** Develop Sil Odor Defense: a plant-based pre-treat concentrate using activated plant charcoal and proteolytic enzymes to break down sweat, mildew, and food odors. Formulate with zero synthetic fragrances (aligned with C-04). Position as "true odor elimination, not fragrance masking" against synthetic Vanish and OxiClean. Launch in DE/UK Q2 2027 at €4.49. Target premium conscious consumers (C-04 segment, 28% of urban professionals). Achieve 3% pre-treat share in premium tier by Q2 2028.`,
  'Smart stain analyzer (app + device)::expansion': `**1. Summary.** T-01 (AI-Driven Formulation) and T-07 (AI Personalization at Scale) enable a stain-to-recommendation engine: the consumer uploads a photo of the stain (or places the garment in a handheld spectrometer); the app identifies stain type (blood, wine, grass, rust) and recommends the optimal Sil product + soak time + temperature. The pool shifts from retail shelf discovery to data-driven in-app commerce.\n\n**2. Strategic Evaluation.** Sil launches the Stain ID app with handheld spectrometer hardware (€24.99, subsidized to €9.99 on subscription). Consumer uploads stain photo; AI analyzes hue, saturation, and reflectance to classify stain family; recommends Sil Bio-Stain + Sil Odor Defense in auto-replenishment. Charge €6.99/month for unlimited analyses + 10% subscription discount on Sil SKUs. Launch Q4 2026 in Germany/UK. Capture 40k subscribers by Q2 2027; drive €2.5M incremental Sil revenue from subscription + discount mix.`,
  'Sustainable stain removal subscriptions::expansion': `**1. Summary.** C-04 (Conscious Consumption) and K-06 (Subscription & Auto-Replenishment) converge on a new commerce model: consumers subscribe to a quarterly Sil stain-removal bundle (four targeted products) curated for their household's stain profile (children, sports, cooking, wine consumption). The pool moves from one-shot purchases to recurring LTV optimization.\n\n**2. Strategic Evaluation.** Launch "Sil StainGuard Plus" subscription: €9.99/month delivers a rotating quarterly box of Sil enzyme sprays, odor pens, and laundry additives tailored via the Smart Stain Analyzer app. Bundle with Smartwash integration: stain severity automatically triggers laundry cycle adjustments. Position against Febreze subscription (US-only, no laundry focus) and indie DTC brands (Function of Beauty model, but for stain care). Target 20k subscribers in DE/UK by Q2 2027; LTV €600/subscriber.`,
  'Concentrated stain remover refill pouches::expansion': `**1. Summary.** C-13 (Refill & Reuse Economy) and T-03 (Concentrated Formats) enable a 70% logistics-cost reduction via concentrated refill pouches: instead of shipping water-heavy 500ml bottles, Sil ships a 100ml concentrate pouch (refill-only) at 1/5 the carbon footprint and 40% lower COGS. Retailers gain shelf density; consumers gain a sustainable signal and lower total cost-of-ownership.\n\n**2. Strategic Evaluation.** Redesign Sil Stain Remover as a 50x concentrate in 100ml pouches (€2.49 vs €4.99 for 500ml liquid). Compatible with reusable Sil spray bottles (sold separately €6.99, or bundled). Secure shelf placement in German/UK grocery at parity to Vanish liquid, emphasizing 40% cost savings + zero plastic waste vs competitors. Launch H2 2026. Target 15% of Sil volume from refill pouches by Q1 2028; reduce supply chain carbon by 35%.`,
  'Chlorine-based pre-treaters::contraction': `**1. Summary.** This is not a demand story; it is a shelf story. G-01 (PFAS restriction) and G-02 (microplastics ban Phase 2) reclassify chlorine pre-treat chemistries as either reformulation cases or de-list cases under the EU REACH and PPWR cascade. Pool does not migrate to a substitute SKU automatically—it migrates to whoever has the bio-enzymatic stand-in already on the shelf when the listing window opens.\n\n**2. Strategic Evaluation.** Treat the regulatory cliff as a competitive event. Sil (stain specialist) plus Persil's enzyme R&D give HCB a saleable substitute already in distribution. Sequence the listing pitch to retailers: Sil Bio-Stain replaces chlorine pre-treaters on the shelf ahead of Vanish reformulation cycles (Advent is slow-walking these under PE ownership). Capture the ban as a one-off PL-defence moment by securing branded shelf depth before category resets in H1 2027.`,
  'Solvent-based fabric protectors::contraction': `**1. Summary.** Solvent-based fabric protectors (silicone resins, hydrocarbon chains) face a double squeeze: G-01 (PFAS extension to "PFOA-free" solvents) and G-03 (Cosmetics Regulation tightening on inhalation hazards). Formulators cannot simply swap solvents; the entire chemistry stack requires de-risking. Retailers will delist before brands can reformulate, collapsing the category faster than demand would alone.\n\n**2. Strategic Evaluation.** Discontinue all Sil and Persil solvent-based fabric protector lines immediately. Do not attempt reformulation; the regulatory timeline is too tight and retailer tolerance for "new formulas" is low. Reallocate the SKU capacity to enzyme-based alternatives (Sil Bio-Stain). By Q3 2026, Vanish's solvent portfolio will be in retailer delisting notices; HCB's exit ahead of the cliff signals regulatory maturity and avoids inventory write-downs.`,
  'Soil-release coatings (PFCs)::contraction': `**1. Summary.** G-01 (PFAS Restriction) is not a proposal—it is law. Soil-release chemistries (fluorocarbon chains that prevent dirt adhesion) are the definition of PFAS. The EU ban applies December 2023 retroactively; products on shelves now are technically non-compliant. The profit pool for PFC-based soil-release coatings is already zero; the only variable is delisting speed.\n\n**2. Strategic Evaluation.** Conduct an immediate audit of all Persil and Sil SKUs containing fluorocarbon soil-release agents. Any product not yet reformulated must be delisted by Q2 2026 to avoid retailer enforcement and brand reputation damage. Persil's reformulated lines (enzyme-based soil-release, Phase 2) must secure shelf adjacency to departing PFC products. This is a housekeeping move, not a strategic opportunity—execute cleanly and move on.`,
  'Heavy chemical stain blockers::contraction': `**1. Summary.** G-05 (Green Claims Directive) is a greenwashing enforcement mechanism. Products marketed as "stain blockers" using heavy chemical formulations (quaternary ammonium compounds, synthetic organofluorines) face substantiation demands. Brands cannot claim "effective stain protection" without clinical-grade proof; marketing claims will be audited and penalties are €1k–€10k per false claim under EU enforcement.\n\n**2. Strategic Evaluation.** Audit all Sil and Persil stain-blocking claims against G-05 substantiation requirements. Any claim without ISO-certified test data must be removed from packaging, advertising, and digital channels by Q2 2026. Reframe remaining claims around enzyme efficacy (clinically proven) rather than "blocks" (unproven). This is not a category exit; it is a claims reset. Vanish faces the same audit, but Advent's cost-cutting may delay their response, creating a temporary compliance advantage for HCB.`,
  'Synthetic perfume-heavy pre-treaters::contraction': `**1. Summary.** C-04 (Conscious Consumption) and G-05 (Green Claims Directive) erode the market for fragrance-dominant pre-treaters. Consumers now demand efficacy-first formulations; G-05 bans unsubstantiated fragrance claims ("fresh all day"). Pre-treaters marketed primarily on fragrance now lose the claim that justified the premium positioning.\n\n**2. Strategic Evaluation.** Reformulate Sil pre-treat lines to emphasize enzymatic stain removal (T-01 AI optimized) over fragrance. Reduce synthetic perfume load by 40%; redirect to plant-based odor-neutralizers (T-02). Vanish Oxi Action is heavily fragrance-positioned and faces G-05 substantiation challenges. Position Sil as the "efficacy-first" pre-treat; communicate enzyme action, not perfume halo. By H2 2027, conscious consumers will trade Vanish for enzyme-driven Sil, capturing 4–6% share from Advent's retreating base.`,
  'Retailer own-brand stain removers (premium PL)::contraction': `**1. Summary.** C-01 (Private Label Structural Penetration) now extends into pre-treat category. Premium private label (Sainsbury's Taste The Difference, Carrefour Selection) copies branded formulations within 6 months and undercuts on price by 35–40%. The stain-remover shelf is becoming a listing contest, not a brand contest: whoever secures high-facings at eye level wins.\n\n**2. Strategic Evaluation.** Defend Sil against retailer PL by securing exclusive distribution agreements and high-velocity data. Partner with Sainsbury's to position Sil as the category captain (planogram control, category insights); in exchange, offer retailer PL customers a small wedge (e.g., Sil Private Label supply deal at margin-friendly pricing). This is not a fight; it is a managed retreat. Invest freed Sil SKU capacity into subscription and DTC channels where PL cannot follow.`,
  'Microfibre filters (catch clothing shedding)::expansion': `**1. Summary.** G-02 (Microplastics Ban Phase 2) extends beyond intentional additives to unintentional shedding from garments. A microfibre filter in the washing machine drum now prevents 0.2–0.5g of textile fibres (microplastics) from entering wastewater per load. This is a regulatory tailwind: governments are mandating microfibre capture, turning it from a niche feature into a mass-market appliance add-on.\n\n**2. Strategic Evaluation.** Position Persil as the microfibre-compatible detergent: formulate Persil Green Power with microfibre-safe enzymes (no lint-boosting surfactants) that work optimally with filter-equipped washers. Partner with Miele and Bosch: when their machines ship with integrated microfibre filters (mandatory by 2027 in EU), Persil is the recommended detergent. Launch a "Persil + Microfibre Safe" certification label Q1 2027. By Q4 2027, capture 12% premium in the microfibre-equipped machine segment (est. 8M units/year in EU).`,
  'Smart load sensors / weight add-ons::expansion': `**1. Summary.** T-08 (Connected Appliances) enables external IoT load sensors that retrofit onto any washer. The sensor measures actual load weight and fabric composition via acoustic analysis, transmitting recommendations to the Smartwash app. This is the retrofit path for older machines; it extends the connected-laundry moat to used and budget appliances that do not have native connectivity.\n\n**2. Strategic Evaluation.** Develop a Henkel-branded Smartwash Load Sensor (€34.99, optional retail) compatible with any washer via Bluetooth LE. Sensor connects to Smartwash app and recommends Persil dose + Vernel softener amount based on real load data. Retail through electronics channels and Henkel DTC. Target 200k units in Germany/UK by Q2 2027. Each sensor drives €18/year incremental Persil + Vernel subscription revenue (auto-dosing refills); 200k units = €3.6M incremental gross margin by 2028.`,
  'Laundry optimization balls::expansion': `**1. Summary.** T-03 (Concentrated Formats) enables ultra-concentrated detergent payloads embedded into reusable silicone balls. Instead of pre-measuring liquid, the consumer drops a ball into the drum; enzymes and surfactants are released over 90 minutes. This is the format bridge between pods (locked in by detergent companies) and bulk liquid (commodity).\n\n**2. Strategic Evaluation.** Develop Persil Enzyme Balls: reusable silicone orbs filled with 50x concentrate Persil formula. Retail the starter kit (5 balls + 200ml concentrate pouch) at €12.99; refill pouches at €3.99. Position as "pod convenience with refillable sustainability" against Persil Discs (single-use) and Unilever OMO dual-chamber (also single-use). Launch in Germany Q4 2026. Target eco-conscious affluent consumers (HHI €80k+); achieve 3% of pod-segment volume by Q2 2028.`,
  'Auto-load-weighing machine adapters::expansion': `**1. Summary.** T-05 (Manufacturing Automation) enables low-cost load-weighing retrofit adapters that bolt onto washer drums. Unlike external sensors, these integrate directly into the machine's water-intake system, delivering real-time load feedback and auto-dosing recommendations. This is the bridge between legacy machines and connected appliances.\n\n**2. Strategic Evaluation.** Partner with Miele and Bosch to co-develop auto-dosing adapters for their legacy machines (2015+). Adapter + Smartwash integration enables existing machine owners to access connected detergent refill systems by H2 2027. Persil auto-dosing cartridges (€4.99/month subscription) become the primary monetization channel. Roll out to 1M machines in Germany/UK by Q2 2028. This captures 15–20% incremental cartridge revenue from the retrofit appliance install base.`,
  'Fabric care dispensing systems::expansion': `**1. Summary.** T-03 (Concentrated Formats) and T-08 (Auto-dosing) converge on integrated fabric-care dispensing: a single cartridge housing detergent, softener, and stain-removal actives that the machine dispenses in correct proportions at correct times. This is the Nespresso model: the consumer never measures; the machine does.\n\n**2. Strategic Evaluation.** Persil Smartwash Cartridge System: a 4-chamber cartridge containing Persil detergent, Vernel softener, stain enzyme, and freshness booster; machine auto-portions and releases each at the optimal wash phase. Partner with Miele/Bosch for native cartridge slots in next-gen machines (Q2 2027 launch). Cartridge retail: €6.99/month subscription (vs €2.50/month in liquid detergent). Target 2M machines with native cartridge slots by Q4 2028; achieve €12M incremental revenue from cartridge subscriptions vs. liquid baseline.`,
  'Delicate bags / drum accessories::contraction': `**1. Summary.** T-08 (Connected Appliances) eliminate the need for manual protection aids. Smart machines now have fabric-detection sensors and cycle-selection algorithms that automatically reduce agitation for delicate items, obviating the need for garment bags, drum liners, or protective capsules. The category is being automated away.\n\n**2. Strategic Evaluation.** Discontinue investment in Persil-branded delicate bags and drum accessories. Modern machines (Miele W1, Bosch i-DOS+) handle delicate fabrics without aids. Redirect the SKU capacity to Persil and Vernel products positioned for smart-cycle integration. Henkel's shift is from mechanical protection (bags) to chemical optimization (enzyme balance for delicate cycles). The competitor here is the appliance OEM, not another laundry brand.`,
  'Manual dosing aids / scoops::contraction': `**1. Summary.** T-08 (Auto-dosing) is rendering the measuring scoop obsolete. Connected washers auto-dispense detergent based on load, soil level, and water hardness; older machines are being retrofitted with auto-dispensers or smart cartridges. The scoops and measuring cups that filled billions of laundry rooms are now waste.\n\n**2. Strategic Evaluation.** Phase out all Persil and Vernel scoops from packaging by Q1 2027. Transition to cartridge and refill-pouch formats that eliminate measuring entirely. The cost savings from scoops removed (injection molding, packaging, logistics) funds digital integration (Smartwash app, cartridge IP). By Q4 2027, 60% of European laundry purchasers will use either auto-dosing machines or cartridge/refill systems; scoops become a historic artifact.`,
  'Fabric softening balls (low-tech)::contraction': `**1. Summary.** T-03 (Concentrated Formats) eliminates the softening ball. Ultra-concentrated Vernel liquid or capsules deliver the same softening efficacy at a fraction of the dose; they dissolve completely without leaving residue on fabrics or inside machines. Low-tech balls are now a cost centre without a functional advantage.\n\n**2. Strategic Evaluation.** Discontinue all Vernel fabric-softening ball lines immediately. Redirect to Vernel Discs (concentrated, capsule-based softening). Softening balls are a competitor vulnerability: if Unilever Comfort launches a premium ball line, position Vernel Discs as the efficacy upgrade. This is not a competitive battle; it is a format transition. By Q2 2027, 80% of European softener consumption will be capsule-based, rendering balls a negligible category.`,
  'Generic load guides (printed)::contraction': `**1. Summary.** T-07 (AI Personalization) replaces static printed load guides with dynamic app-based dosing. Instead of "full load = 50ml", the Smartwash app calculates optimal dose based on soil level, water hardness, machine type, and selected cycle. Printed guides become outdated before they ship; digital is faster, more accurate, and personalizable.\n\n**2. Strategic Evaluation.** Remove all printed load dosing guides from Persil and Vernel packaging by Q1 2027. Replace with "Scan for personalized dosing" QR codes. Invest the packaging savings into Smartwash app UX development. By H1 2027, the app will be the canonical dosing source; printed guides will be a liability if they conflict with app recommendations. This move positions Henkel as a software-first laundry brand vs. commodity detergent competitors.`,
  'Concentrated / ultra-compact detergents::expansion': `**1. Summary.** Concentrated detergents compress the wash payload into smaller volumes, reducing transport logistics by 40-60% and cutting plastic per wash (T-03). PPWR mandates 30% recycled content and refill accessibility by 2030 (G-04), making dilute formats economically indefensible — the profit pool migrates to whoever owns the concentrated-format shelf position first, locking out competitors by format choice at the retail set.\n\n**2. Strategic Evaluation.** Persil Discs and Persil Power Caps already own the concentrated franchise in Europe; defend and expand distribution against PL concentrated formats (now 18-22% of detergent SKUs in Aldi/Lidl). Attack Ariel's dilute powder remnants by stocking Persil concentrated across all channel tiers within 18 months. Deploy Weißer Riese concentrated in Germany/Austria to block trade-down to value-tier PL concentrates.`,
  'Detergent sheets & pods (eco-formats)::expansion': `**1. Summary.** Sheet and solid-pod formats (Earth Breeze, Tru Earth, Blueland archetype) eliminate water weight entirely, cutting landed cost 50-70% versus liquid, while addressing E-02 water-scarcity pressure and G-04 packaging mandates with zero plastic. Category growing 15%+ CAGR; the pool sits in whoever commands the plastic-free shelf position and owns the sustainability narrative before PL sheets scale (now <3% but ramping fast).\n\n**2. Strategic Evaluation.** Persil sheets do not yet exist in European mass retail. Launch Persil Sheets within 12 months as the premium, clinically-formulated alternative to indie sheet brands (Earth Breeze, Tru Earth). Position against P&G's silence in sheets — Tide and Ariel have no sheet SKU in Europe. Capture the eco-conscious premium tier before Unilever responds with an OMO sheets line.`,
  'Refill systems & eco-subscriptions::expansion': `**1. Summary.** G-04 PPWR mandates reusable container systems and refill-at-point accessibility by 2030; C-04 Conscious Consumption drives 12%+ CAGR in refill adoption in Northern Europe. The profit pool is not just product — it is recurring subscription revenue, customer lock-in, and retailer shelf ownership through exclusive refill cartridge partnerships.\n\n**2. Strategic Evaluation.** Persil + Vernel refill pods locked into retail refill stations (Carrefour, Sainsbury's, Ekoplaza models) create recurring revenue and reduce distributor intermediaries. Pilot a Persil Refill Subscription box via Amazon Subscribe & Save in UK/Germany within 9 months; bundle with Vernel softener refills to increase basket size and lock-in depth.`,
  'Bio-enzymatic booster packs::expansion': `**1. Summary.** T-02 bio-based chemistry and T-01 AI-optimized enzyme cocktails are displacing chemical whiteners and synthetic surfactants, expanding the premium detergent pool by 8-12% CAGR. The win goes to the brand that ships a clinically-proven, non-synthetic stain engine first — cost of entry is lab time, not scale.\n\n**2. Strategic Evaluation.** Sil (Henkel's dormant stain specialist) + Persil's enzyme R&D enable a Sil Bio-Enzyme Booster positioned against OxiClean (Church & Dwight) and Vanish (now PE-starved under Advent). Ship as a Persil-compatible add-pack within 6 months, capturing the pre-treat occasion and defendable superiority claim that PL cannot replicate.`,
  'Premium fragrance bead boosters::expansion': `**1. Summary.** Laundry scent boosters (Lenor Unstoppables archetype) sit at the intersection of C-03 premiumization (consumers now pay €8-12 per 250mL) and C-28 (€2B EU market, 18% CAGR forecast to €4.5B by 2030). Profit migrates to whoever owns the premium fragrance narrative and controls scent-perception proprietary chemistry before the category commoditizes on Amazon.\n\n**2. Strategic Evaluation.** Vernel Scent Bead boosters already exist but are underpowered vs Lenor Unstoppables (P&G controls 65% of the scent-booster market). Reposition Vernel Beads as bio-based, conscious-luxury fragrances (partnering with an indie fragrance house like Givaudan for exclusive scent IP) and compete on ingredient transparency and sustainability, not just fragrance intensity. Win the 25-35 female demographic within 18 months.`,
  'Plant-based washing pod tablets::expansion': `**1. Summary.** T-02 bio-based surfactants and G-05 Green Claims Directive (requiring substantiation) reward brands that ship genuinely plant-derived formulations with clinical proof — not just messaging. The pool is the premium eco segment, where consumers pay 15-25% premium for verifiable bio-chemistry and transparent sourcing.\n\n**2. Strategic Evaluation.** Persil Green Power (existing bio-range) lacks pod format and category-of-origin clarity. Launch Persil Green Plant-Based Pods with transparent sourcing (EU-grown rapeseed oil, EU-fermented enzymes) and third-party certification (Cradle to Cradle, EU Ecolabel) within 12 months. Defend against Ecos, Seventh Generation, and Unilever's eco-focused OMO relaunches.`,
  'Modular detergent mix-your-own systems::expansion': `**1. Summary.** T-07 AI personalization and T-03 concentrated formats enable consumers to assemble custom formulations on-demand — selecting enzyme strength, fragrance intensity, and water hardness compensation from modular building blocks. Pool is niche (€50-100M EU) but growing 20%+ CAGR among premium digital natives who value customization and believe mass formulations are suboptimal.\n\n**2. Strategic Evaluation.** Henkel has no modular detergent platform. Partner with a SaaS beauty-personalization player (e.g., Function of Beauty model) to launch Persil Modular via D2C and Sephora/Cult Beauty channels within 18 months. Compete on ingredient transparency and efficacy customization, not novelty. Target affluent consumers (€50+ wash cost-per-cycle tolerance) in Germany/UK/Benelux.`,
  'Subscription laundry boxes (recurring)::expansion': `**1. Summary.** K-06 subscription lock-in and convenience drive D2C recurring-revenue adoption; consumers on auto-replenishment spend 30-40% more over 12 months versus one-time buyers, and churn drops 60% once a second purchase completes. Pool is lifetime value per consumer, not per-transaction margin.\n\n**2. Strategic Evaluation.** Persil Subscription Box (detergent + Vernel softener + Sil stain booster + Vernel fabric refresh spray, auto-delivered monthly) launched via D2C website and Amazon Subscribe & Save captures the recurring revenue and cross-sell moat before Tide/Ariel launch subscription boxes. Launch pilot in Germany within 9 months; 3-year target 150K active subscribers at €89/month ARPU.`,
  'Discount-exclusive branded value formats::expansion': `**1. Summary.** K-01 discount retailers (Aldi/Lidl at 25-35% grocery share) are now sophisticated enough to negotiate exclusive SKU formats (smaller pack sizes, unique fragrance variants, regional-only formulations) from suppliers, creating a structural moat around their own-brand detergent. The pool here is volume at razor-thin margin — but it is volume that otherwise goes to PL.\n\n**2. Strategic Evaluation.** Weißer Riese (Germany value tier) is the anchor. Develop exclusive discount-channel formats for Aldi/Lidl: Weißer Riese Aldi-exclusive 3kg pouch (25-30% lower price point than grocery channel) and Lidl-exclusive Spee fragrance variants. Lock in category captainship through format exclusivity within 6 months, preventing Lidl's own PL from capturing 100% of the value tier.`,
  'Smart auto-dosing detergent cartridges::expansion': `**1. Summary.** T-08 connected appliances create a hardware-lock-in moment: once a washing machine integrates Henkel's proprietary auto-dose cartridge system (as Henkel Smartwash does with Miele/Bosch/Samsung), that machine becomes a recurring-revenue Persil dispenser for 10-15 years. Pool is not just the detergent SKU — it is the installed-machine base and the switching-cost moat that prevents competitors from ever reaching that consumer.\n\n**2. Strategic Evaluation.** Henkel's existing OEM partnerships (Miele, Bosch, Samsung via Smartwash API) are the structural advantage. Expand cartridge compatibility to LG (via ThinQ API negotiations, starting Q2 2026) and Electrolux (Q3 2026) before P&G Tide and Ariel secure exclusive partnerships. Establish Persil cartridges as the default wash formula across 60%+ of European connected machines by end-2027.`,
  'Traditional bulk powder detergent::contraction': `**1. Summary.** T-03 concentrated formats collapse the economic case for dilute powder: weight-for-weight, concentrated liquid and sheets deliver 3-5x more wash payload per liter transported, cutting landed cost 50%+ and enabling superior shelf appeal. Pool contracts 8-12% annually as inventory converts to concentrated; holding bulk powder is inventory obsolescence risk.\n\n**2. Strategic Evaluation.** Weißer Riese bulk powder (400g+ packs) is declining. Redeploy SKU facings to Weißer Riese concentrated liquid (1.5L, same footprint, 40% higher margin) within 18 months. Accept the contraction gracefully — the profit is not in defending dilute formats, it is in capturing the converted consumer on the concentrated shelf before they land on Aldi PL concentrated.`,
  'Conventional large liquid bottles::contraction': `**1. Summary.** G-04 PPWR mandates 30% recycled content and 8% weight reduction by 2030, making 2-3L plastic bottles economically indefensible (recycled plastic is 40% more expensive than virgin). T-03 concentration makes volume per dose irrelevant. Pool contracts 10-15% annually as shelf converts to pods, sheets, and cartridges. Standard 2L bottles are dead weight.\n\n**2. Strategic Evaluation.** Persil 2L bottles (mainstream grocery) are being cannibalized by Persil Discs (higher margin, premium positioning). Kill the 2L SKU in Germany/UK/Benelux within 12 months; redeploy that shelf space to Persil Discs and Persil sheets. Use the discontinuation as a supply-chain efficiency play — lower complexity, lower procurement cost, higher turns on remaining SKUs.`,
  'Chlorine-based whiteners / bleach::contraction': `**1. Summary.** G-01 PFAS restriction and G-02 microplastics ban Phase 2 reclassify chlorine-based pre-treaters and optical brighteners as compliance liabilities. Reformulation is table stakes; the pool does not migrate to a substitute SKU — it splits between whoever has the bio-enzymatic stand-in ready at the listing moment and retailers who delist the category entirely.\n\n**2. Strategic Evaluation.** Sil is Henkel's substitute asset. Secure retailer listings for Sil Bio-Enzymatic Pre-Treat Spray ahead of Vanish reformulation timelines (slow-walked under Advent PE ownership) and before retailers delist chlorine entirely. Sequence the listing pitch with Carrefour, Tesco, Rewe within 6 months — capture the ban as a one-off PL-defence moment by securing branded shelf depth before the category resets.`,
  'Separate water softening salts::contraction': `**1. Summary.** T-08 integrated water-treatment systems built into connected washers (Miele TwinDos, Bosch HomeConnect) eliminate the need for separate water-softening salts; machine automatically adjusts hardness compensation. Pool contracts as machine base shifts to integrated treatment. Separate salt sales decline 5-8% annually.\n\n**2. Strategic Evaluation.** Henkel has minimal water-softening salt franchise. Let this contract unmolested. Focus instead on integrating water-hardness optimization into Persil cartridge formulations for connected machines — making the salt purchase irrelevant by bundling hardness-adaptive dosing into the Persil cartridge itself (via T-08 machine APIs).`,
  'Synthetic optical brighteners::contraction': `**1. Summary.** G-05 Green Claims Directive requires scientific substantiation for brightness claims, and optical brighteners (fluorescent compounds that absorb UV and re-emit visible light) are increasingly classified as microplastic shedders. Pool contracts as regulations tighten and retailers delist synthetic brighteners in favor of enzymatic brightening. Profit goes to whoever has a non-synthetic alternative ready.\n\n**2. Strategic Evaluation.** Persil's enzyme R&D delivers natural brightening via bio-catalysts (no synthetic fluorophores). Audit Persil formulations for synthetic brightener removal and relaunch as Persil Brightening Science (enzymatic, non-synthetic, compliant with G-05) within 9 months. Market as "naturally bright" to capture both eco-conscious and regulator-compliant positioning.`,
  'Anti-greying chemical additives::contraction': `**1. Summary.** G-03 Cosmetics Regulation extends to laundry additives that make color-preservation claims; anti-greying chemistry now requires the same safety dossier as a cosmetic. Reformulation cost rises 30-50%; pool contracts as brands defer innovation to more profitable categories. The entrants are brands willing to invest in dossier work.\n\n**2. Strategic Evaluation.** Persil's color-care formulations are compliant. Invest in a Persil Color-Guard range (dye-preserving enzymes, chelating agents with full G-03 safety backing) positioned as the premium color-protection choice against Ariel Color (P&G). Launch within 12 months; this is a low-risk category extension for Henkel with minimal cannibalization.`,
  'DIY home-made detergent kits::contraction': `**1. Summary.** C-06 cost-of-living squeeze and C-25 household atomization (smaller households have less incentive to bulk-produce) compress the DIY detergent addressable market. Niche stays niche — the economics don't work for households making <20 washes per month. Pool is negligible and declining.\n\n**2. Strategic Evaluation.** This entry is not a competitive threat to Henkel. Acknowledge the contraction and do nothing. Henkel's value-tier positioning (Weißer Riese, Spee, all, Purex) is far cheaper than DIY when amortized per wash. Let the DIY segment die on its own.`,
  'Branded detergents losing share to premium PL::contraction': `**1. Summary.** C-01 private label at 42% EU6 value share (Circana's highest recording) is not a value play — PL has graduated to premium tiers. X-13 vertical integration (Walmart, Carrefour, Lidl operating contract manufacturing) means PL detergent now offers equivalent efficacy to mid-tier brands at 30-40% lower price. Branded share contracts 3-5% annually as conversion accelerates.\n\n**2. Strategic Evaluation.** This is structural, not cyclical. Stop defending mid-tier branded detergents. Harvest Weißer Riese and Spee for cash (they are now PL shields, not growth engines). Redeploy trade spend and NPD budget into Persil premium (where superiority claims still drive 12-15% price premiums) and Vernel fabric care (where PL has no foothold). Accept the migration — brands that exit the mid first win.`,
  'Mid-tier detergent range (squeezed middle)::contraction': `**1. Summary.** C-06 cost-of-living pressure pushes consumers down to value/PL, while Persil premium captures affluent shoppers willing to pay for science — the mid-price tier is being eaten from both ends. The mid is no longer a defensible price position; it is the funding line that retailers raid for PL listings and the only buyer is the shopper who has already left.\n\n**2. Strategic Evaluation.** Treat mid-tier as harvest, not competitive theatre. Pull SKU complexity out, redeploy the media and trade envelope into Persil premium (where margin supports the investment) and into Weißer Riese / Spee / all / Purex as deliberate PL shields. Structural winner of a mid contraction is the brand that exits cleanly first — do not extend the death spiral with margin cuts.`,
  'Import-dependent raw material formulations::contraction': `**1. Summary.** G-08 tariffs (US escalation, EU retaliatory measures) and E-01 palm-oil supply disruption (Indonesia B50 diverts oleochemical feedstock to fuel, 20-40% price spikes on oleochemicals) hit imported-input formulations hardest. Brands locked into Asian enzyme sourcing and palm-derived surfactants face 8-15% COGS inflation within 12 months. Pool contracts as brands either reformulate (costly) or accept margin compression.\n\n**2. Strategic Evaluation.** Henkel's Culver City (Hair Care) and Scottsdale (LHC) operations rely on imported inputs; audit supply chain within Q2 2026. Nearshore enzyme procurement to EU (Novozymes facilities in Denmark) within 18 months. Invest in precision fermentation (T-15) partnerships to derisk palm-oil dependence by 2027 — this is a three-year strategic imperative for COGS defense.`,
  'Smart home apps (auto program selection)::expansion': `**1. Summary.** T-08 connected appliances + IoT integration create a machine-to-cloud moment where the washer itself recommends the wash program based on fabric type, soil level, and water hardness. This moves brand choice from consumer (at the detergent shelf) to machine algorithm (invisible to consumer). Pool is structural lock-in: whoever's formula is the OEM default captures 70%+ of that machine's lifecycle purchasing.\n\n**2. Strategic Evaluation.** Henkel Smartwash (Miele/Bosch/Samsung APIs) is the foundation. Expand API partnerships with LG ThinQ (Q2 2026) and Electrolux HomeConnect (Q3 2026) before P&G Tide-Samsung exclusivity locks in competitor default. By end-2027, Persil should be the recommended wash program on 55%+ of connected European washers — invisible brand lock-in.`,
  'AI-based wash cycle advisors::expansion': `**1. Summary.** T-01 AI-driven formulation systems analyze fabric care tags, soil photos, and water hardness to prescribe optimal wash programs and detergent selections, moving diagnosis from consumer intuition to algorithmic authority. Pool is whoever controls the diagnostic moment — once the phone camera or washer display says "use Persil," brand comparison stops.\n\n**2. Strategic Evaluation.** Persil Mobile App (Henkel's dormant asset) needs an AI garment-care advisor feature. Integrate with Smartwash + Henkel's enzyme database to recommend Persil + Vernel combinations based on fabric type. Ship MVP within 9 months; target 500K active users by end-2027. This is the digital brand lock-in equivalent of the OEM default moment.`,
  'Auto-dosing machine ecosystems::expansion': `**1. Summary.** T-08 connected appliances + T-05 manufacturing automation create closed-loop dosing: the machine reads the load, communicates water hardness, and auto-pulls the exact detergent amount from an integrated cartridge. Nespresso-model recurring revenue: hardware creates dependency on cartridge refills. Pool is the installed-machine base and the 10-year cartridge revenue stream per machine.\n\n**2. Strategic Evaluation.** Henkel Smartwash cartridge system is live with Miele and Bosch; Samsung integration is pending. Lock Samsung compatibility within 12 months; negotiate LG exclusivity windows within 6 months. Target 2M connected machines in Europe by end-2027, each generating €120-150 annual cartridge revenue. This is the highest-margin, lowest-churn revenue stream Henkel LHC can build.`,
  'Voice-activated wash controls::expansion': `**1. Summary.** T-01 AI + smart home voice assistants (Alexa, Google Home, Siri) enable washing-machine control via voice ("Alexa, run delicate wash, light soil, Persil"). This removes friction from OEM-brand recommendation moments; voice commands default to the machine manufacturer's preset programs, which can be brand-parameterized by Henkel.\n\n**2. Strategic Evaluation.** Partner with Samsung SmartThings (Q2 2026) to enable voice-activated Persil Delicate Wash and Persil Intensive Wash routines, pre-tuned with Persil formulation parameters. Alexa skill launch target: 1M activations by end-2027. Defend against P&G Tide voice integration with Amazon (likely in Q3 2026); move fast to be the first laundry brand in the Alexa ecosystem.`,
  'Mobile app machine pairing::expansion': `**1. Summary.** T-07 AI personalization + K-04 social commerce enable users to pair their smartphone with the washing machine, unlocking personalized wash recommendations, purchase history tracking, and social sharing of laundry results. Pool is engagement, data, and recurring SKU recommendations — the mobile app becomes the customer's laundry diary.\n\n**2. Strategic Evaluation.** Persil App (existing but dormant) needs machine-pairing APIs for Miele, Bosch, Samsung, LG. Enable one-tap purchase of recommended Persil/Vernel products via Amazon Shop or Henkel D2C. Social feature: share "laundry wins" on Instagram (e.g., "Persil saved my whites"). Target 2M app installs by end-2027, with 15%+ monthly purchase conversion.`,
  'AI-optimized cold-wash cycle programs::expansion': `**1. Summary.** T-01 AI formulation optimizes detergent efficacy at 20-30°C wash temperatures, addressing E-07 energy cost volatility (European energy costs 2-3x US levels). Machines running 80%+ of washes at cold temperatures create a new competitive moment: whoever owns cold-wash superiority wins the efficiency-conscious consumer without sacrificing efficacy.\n\n**2. Strategic Evaluation.** Persil Green Power (existing bio-range) is undermarketed in cold-wash benefits. Reposition as Persil Cold Power (€5-7 premium vs standard) with clinical proof of efficacy at 20°C. Launch campaign leveraging E-07 cost savings narrative: "Persil Cold Power cuts energy bills by €40/year per household." Target German households (highest energy costs) within 12 months.`,
  'Manual mechanical program dials::contraction': `**1. Summary.** T-08 connected appliances replace manual dial-and-button interfaces with touchscreens and cloud-connected program selection. Dial-based washers are legacy; pools migrates to whoever controls the digital program library. New machine installs in Europe at 15M+ annually are 90%+ digital-enabled by 2025.\n\n**2. Strategic Evaluation.** No action required — this is an appliance industry evolution, not a detergent category. Let mechanical dials die. Henkel's advantage is in integrating digital program libraries (via OEM APIs), not extending mechanical UX.`,
  'Generic dosing instructions (packaging)::contraction': `**1. Summary.** T-01 AI + T-07 personalization displace one-size-fits-all dosing tables printed on cartons. Connected machines auto-read load weight and hardness, recommending precise dosing to within 1-2mL. Generic instructions become irrelevant; pool contracts as packaging investment in print-based guidance becomes waste.\n\n**2. Strategic Evaluation.** Update Persil packaging to include QR code linking to app-based dosing guidance and machine-compatibility matrix. Reduce print footprint (saves 2-3% packaging weight, supporting G-04 PPWR) and redirect savings to digital infrastructure. This is a low-investment package redesign that signals modern, connected positioning.`,
  'Paper washing guides / manuals::contraction': `**1. Summary.** T-07 digital instructions (app-based, video tutorials, AI chatbots) replace paper washing guides entirely. Paper is bulky, costly to print and ship, and rarely consulted post-purchase. Pool disappears; paper guides are pure cost center with zero consumer value.\n\n**2. Strategic Evaluation.** Eliminate paper guides from all Persil/Vernel/Weißer Riese packaging within 12 months. Redirect consumers to Persil App, YouTube tutorials, and Henkel customer-service chatbot (powered by Claude AI or equivalent). Packaging simplification also supports G-04 PPWR weight-reduction targets — a win-win on cost and compliance.`,
  'Smart / connected washers (auto-dose)::expansion': `**1. Summary.** T-08 (connected appliances with auto-dosing cartridges) collapses the detergent selection moment into machine firmware: the washer recommends and dispenses the dose without user friction. This shifts the profit pool from shelf-driven brand choice to whoever controls the OEM cartridge relationship and the recurring refill channel. Machine learning optimizes detergent chemistry to water hardness, soil load, and fabric type in real time, rendering conventional off-the-shelf selection obsolete.\n\n**2. Strategic Evaluation.** Persil's Discs must become the default cartridge for Henkel's Miele, Bosch, and Samsung partnerships. Lock in exclusive refill compatibility now — once machine firmware ships with Persil as the pre-loaded default, switching costs flip entirely in HCB's favor. Window closes within 12 months as P&G negotiates identical partnerships. This is the single highest-leverage structural moat available to Henkel LHC.`,
  'Cold-wash optimized detergents::expansion': `**1. Summary.** T-01 (AI formulation) has cracked cold-water efficacy. Persil Green Power and Ariel Turn To 30 both optimize surfactant blend and enzyme cocktail for sub-20°C water. Cold wash captures E-07 (energy costs 2-3x US levels in Europe) — every degree reduction in water temperature shrinks COGS for the consumer. The pool migrates from hot-wash specialists (legacy positioning) to whoever owns the efficacy claim at cold, which also aligns with sustainability messaging.\n\n**2. Strategic Evaluation.** Persil Green Power is the weapon. Claim cold-water efficacy via peer-reviewed testing (ISO 60 and IEC test methods at 15°C), then bundle the claim with Smartwash IoT integration so the machine *enforces* cold wash even when consumers might default to warm. P&G's Ariel Turn To 30 owns awareness globally but lacks the OEM hardware integration that Henkel possesses. Claim the efficacy advantage within 9 months before Ariel ships its own machine-connected version.`,
  'Water softening integrated systems::expansion': `**1. Summary.** T-08 (connected machines) integrate water hardness detection and targeted softening chemistry into the wash cycle, eliminating the need for external Calgon-type sachets. Inline IoT sensors measure water mineral content and micro-dose integrated zeolites or citrate sequestrants, optimizing fabric hand and detergent performance. The pool shifts from a standalone water-care category into a software-driven, in-cycle optimization managed by machine firmware.\n\n**2. Strategic Evaluation.** Persil's formulation flexibility makes it the natural anchor for machine-integrated water management. Partner with Bosch/Siemens engineering to embed a Persil-formulated softening compound in the machine's secondary cartridge slot. Vernel's softening equity transfers into this new model. Kill Calgon's standalone market by 2027 via integration before P&G or Unilever launches competing integrated solutions.`,
  'Maintenance & care subscriptions::expansion': `**1. Summary.** K-06 (subscription models) applied to washing machines creates predictable, high-margin recurring revenue through machine health and hygiene contracts. Subscribers receive auto-delivered cartridges (detergent, softener, machine cleaner) on a fixed cycle, plus diagnostic alerts when drum or seals need attention. The profit pool shifts from one-time transaction friction into predictable subscription economics with embedded brand loyalty.\n\n**2. Strategic Evaluation.** Persil should anchor a Henkel Smartwash Premium Subscription that bundles Persil auto-dose cartridges, Vernel softening, and machine maintenance on one predictable monthly fee. Price at €12-15/month (€144-180 annually) and capture the subscription economics that DTC brands own in other categories. Tie subscription sign-up to OEM appliance purchases via Miele/Bosch concierge to lock customers at hardware point-of-sale.`,
  'Energy-monitor detergents (IoT-linked)::expansion': `**1. Summary.** T-08 (connected appliances) can report real-time water and energy usage to the consumer app, and the detergent formulation itself can be optimized per cycle to minimize energy draw. Products positioned as "smart energy-saving" detergent that trigger firmware adjustments (reduced spin speeds when moisture content is low, shorter heat-up cycles) create a new "efficiency" differentiation axis beyond cleaning power. Consumers pay for measurable utility savings — a tangible ROI claim.\n\n**2. Strategic Evaluation.** Persil Green Power, paired with Smartwash telemetry, should be marketed as "Persil + Machine Intelligence = €X annual energy savings." Provide dashboards showing cumulative carbon avoided and water conserved. Unilever and P&G have no comparable IoT integration; this is a Henkel-only claim for 18-24 months. Launch with utility company partnerships (grid operators offering rebates for IoT-connected, low-energy wash cycles) to create a secondary revenue stream.`,
  'Machine health predictive services::expansion': `**1. Summary.** T-05 (automation and IoT) enables predictive maintenance: drum vibration, cycle duration variance, and water flow anomalies signal bearing wear, pump failure, or seal degradation weeks before catastrophic failure. A detergent company that owns the diagnostics can offer extended machine warranty or preventive service contracts, generating high-margin SaaS-like revenue. The pool shifts from one-time detergent sales into lifecycle appliance stewardship.\n\n**2. Strategic Evaluation.** Henkel Smartwash should offer Persil-branded predictive maintenance alerts and partner with Miele service networks to cross-sell preventive servicing. Offer a "Persil Care Plan" that bundles detergent auto-delivery, machine diagnostics, and priority service at a €199 annual premium. This creates switching costs (customer data and service history lock-in) that pure product brands cannot match. Launch within 12 months before P&G builds similar integrations.`,
  'Wash-cycle additives from divesting brands::expansion': `**1. Summary.** X-01 (Reckitt Essential Home Advent divestiture) creates a 12-18 month window when Advent-owned brands (Vanish, Air Wick, Calgon, Woolite) face cost-cutting and withdrawal from premium innovation. Henkel can acquire or poach the R&D teams, consumer data, and retail shelf space before private-equity cost structures render these brands untenable as innovation platforms. Wash-cycle additive categories (stain fighters, fabric protectors, scent enhancers) are temporarily orphaned.\n\n**2. Strategic Evaluation.** Sil (stain specialist) should absorb Vanish's R&D and brand IP if Advent signals distress pricing. Position Sil + Persil as an integrated stain-fighting system that undercuts Vanish's own innovation timeline. For scent additives, Vernel can acquire consumer traction in the fragrance-booster segment that Lenor Unstoppables dominates. The divestiture creates a non-repeating M&A window — act within 12 months before competitors poach the assets.`,
  'Standard non-connected machines::contraction': `**1. Summary.** T-08 (connected appliances) adoption is accelerating: 18% of new European washing machine sales in 2025 are IoT-enabled; forecast is 35% by 2028. Legacy vented, non-connected machines are becoming obsolete as OEMs sunset models, retailers reduce SKU allocation, and manufacturers pivot to smart production. The profit pool for conventional detergent (designed for variable user behavior) contracts as machines become deterministic, software-driven systems that optimize dose and cycle automatically.\n\n**2. Strategic Evaluation.** Do not defend the non-connected machine segment. Persil's R&D investment should be entirely redirected toward cold-wash and connected-machine optimization. Treat conventional detergent as a harvest category — reduce SKU complexity, pull marketing spend, and reallocate resources to Persil Discs (compatible with future connected machines). Legacy SKUs will decline 5-8% annually through 2028 as the installed base ages out.`,
  'Hot-wash detergent formulas::contraction': `**1. Summary.** T-01 (AI formulation) has optimized cold-water cleaning to parity with hot wash in most soil conditions. E-07 (energy costs 2-3x US levels) and E-02 (water scarcity) drive consumers away from hot-wash programs. The hot-wash detergent pool shrinks as cold becomes the default — hot-wash-specific formulations (high-temperature starch builders, oxygen bleach activators) lose their structural reason to exist. Pool moves to energy-efficient, cold-optimized chemistry.\n\n**2. Strategic Evaluation.** Retire hot-wash SKUs from Persil's lineup over 18 months. Consolidate R&D into Persil Green Power (cold-wash) and eliminate line extensions tuned to >40°C water. Communicate the shift via sustainability narrative: "Persil Green Power cleans as well cold as hot used to, saving energy and water." This is not a defensive move — it is a leadership signal that Henkel has abandoned the shrinking pool and captured the growth pool first.`,
  'Standalone Calgon-type water softeners::contraction': `**1. Summary.** T-08 (integrated machine water treatment) renders standalone sachets obsolete. As connected washers implement inline water hardness detection and micro-dosing of softening agents, the Calgon category (sachet water softeners added per wash) becomes redundant. Consumers will not pay for external softening when the machine handles it automatically. Pool contracts 40-60% by 2030 as adoption curves flatten.\n\n**2. Strategic Evaluation.** Accelerate Calgon's exit from retail shelves by 2028. Vernel should claim the softening function entirely within the integrated machine ecosystem. If HCB retained ownership of Calgon (it does not), this would be a managed discontinuation to clear shelf space for machine-integrated alternatives. Since the category is external, cede it cleanly and redeploy the mental shelf space toward Vernel machine-integrated positioning.`,
  'Static water-hardness testing strips::contraction': `**1. Summary.** T-08 (IoT machines auto-detect water properties in real time) eliminate the need for consumer manual testing. Testing strips are a dying artifact of non-connected laundry — when the machine reads water hardness automatically, consumer-operated diagnostic tools have zero value proposition. This is a rapid, clean extinction: no transition pool, no nuance. Just obsolescence.\n\n**2. Strategic Evaluation.** Ignore this category entirely. Any brand attempting to defend it wastes resources against a technology wave. The pool disappears by 2027. Henkel has no material position here to defend, so no action is required — simply monitor as a leading indicator of machine connectivity adoption.`,
  'High-temperature wash detergents::contraction': `**1. Summary.** E-07 (European energy costs 2-3x US levels, energy is 8-15% of manufacturing COGS) and E-02 (water scarcity mandates lower-temperature regimens) combine to eliminate high-temperature wash as a viable consumer choice. Detergent chemistry optimized for 60°C and above has no demand rationale remaining. The pool migrates entirely to cold-and-warm (15-40°C) formulations that align with both cost and sustainability.\n\n**2. Strategic Evaluation.** Persil should completely exit high-temperature formulations by 2027. Consolidate all R&D and production capacity into 15-40°C optimized products. This is not a loss — it is a radical simplification of the portfolio that reduces complexity and COGS simultaneously. Signal to the market that Henkel is abandoning the energy-intensive legacy and leading the transition to efficient wash.`,
  'Energy-intensive hot-wash programs::contraction': `**1. Summary.** E-07 is structural: European energy is 2-3x US levels, and OEM manufacturers are discontinuing 60°C and 90°C wash programs from new machines in favor of 20°C "quick wash" and 40°C "standard" settings. Detergent companies built their entire formulation portfolios around hot-water performance; as machines stop offering hot as a default, the demand rationale for temperature-resilient detergents disappears. Pool contracts 30-40% by 2030.\n\n**2. Strategic Evaluation.** This is not a Henkel-specific threat — it is an industry-wide shift. Persil should lead the narrative by repositioning "efficient cold wash" as superior to "conventional hot wash" on cleaning *and* environmental metrics. Use Smartwash data (aggregate consumer wash patterns) to demonstrate that cold-wash adoption is already 65%+ in Germany and rising. Sell the shift as inevitable and desirable, not as a loss.`,
  'Anti-mustiness freshness solutions::expansion': `**1. Summary.** C-04 (conscious consumption demands fresh without synthetic masking) creates demand for active anti-mustiness molecules that eliminate odor sources rather than covering them. Bacterial growth in the washing machine and damp loads triggers mustiness; solutions using silver ions, hydrogen peroxide, or enzymatic bio-actives address the root cause. This is a new occasion (machine hygiene) layered on top of laundry, not a replacement for softeners, expanding the pool.\n\n**2. Strategic Evaluation.** Vernel should launch an anti-mustiness machine cleaner that runs monthly to eliminate bacterial biofilm, preventing musty odors in the wash. Position against P&G's lack of a comparable product and Unilever's limited offering. Pair with Smartwash IoT reminders ("Your Vernel machine is due for a clean") to create a recurring revenue stream. This captures the growing conscious-consumption segment that rejects synthetic fragrances and prioritizes efficacy.`,
  'Anti-wrinkle post-cycle sprays::expansion': `**1. Summary.** T-03 (concentrated formats) enables post-cycle, on-the-hanger treatment sprays that eliminate wrinkles without ironing. Unlike traditional fabric softeners (added to the wash), post-cycle sprays target the wrinkle moment itself, creating a new consumer occasion. C-04 (conscious consumption) drives demand for plant-derived, low-VOC formulations. This is additive to existing softener categories, not substitutive — expanding total fabric care spend.\n\n**2. Strategic Evaluation.** Vernel should launch a concentrated anti-wrinkle spray (Vernel Refresh + Care) that hangs on garments post-dry and smooths wrinkles via steam or hanging. Pair with Smartwash notifications: "Your load is ready to hang — use Vernel Anti-Wrinkle Spray to skip ironing." Price at €4-6 per 300ml bottle, creating an incremental margin pool of €1.5-2B across Europe. P&G has no comparable product; first-mover advantage is 12 months.`,
  'Smart unload reminders (app notifications)::expansion': `**1. Summary.** T-08 (connected appliances send notifications) transforms the unloading moment from a forgotten chore into a coordinated consumer touchpoint. When the machine notifies the consumer that the load is dry and ready to fold, it creates an ideal moment to recommend Vernel fabric care products (anti-wrinkle spray, freshness booster, fabric protector). The profit pool shifts from "catch the consumer at the shelf" to "intercept the consumer at the unload moment."\n\n**2. Strategic Evaluation.** Henkel Smartwash should send unload notifications with one-tap links to Vernel product recommendations. Offer a €1 digital coupon for Vernel products redeemable within 24 hours of notification. This drives incremental basket size without requiring in-store promotion. Low-cost to implement; high-margin digital commerce driver. Launch within 6 months as a Smartwash exclusive feature.`,
  'Odor-elimination fabric mists::expansion': `**1. Summary.** C-04 (conscious consumption and cleanical beauty) drives demand for active odor-removal technologies (enzymes that digest sweat proteins, bacterial-static silver treatments, or bio-based volatile eliminator molecules) over synthetic fragrance masking. T-03 (concentrated formats) enables portable, spray-on treatments. The pool expands as consumers adopt layered fabric care: wash + softener + between-wash odor control, multiplying touchpoints and SKUs per consumer.\n\n**2. Strategic Evaluation.** Vernel Odor-Out Mist should position active enzymes as "clinically proven" odor elimination against P&G Febreze's fragrance-based approach. Ship with dermatologist/enzyme scientist endorsements and claim 99% odor bacteria reduction at kill-time <5 minutes. Price at premium to Febreze (€6 vs €4) and capture the conscious-consumption consumer who pays for efficacy over fragrance. Launch in 12 months ahead of P&G's inevitable premium-tier response.`,
  'Microfiber-safe freshness products::expansion': `**1. Summary.** G-02 (microplastics ban phase 2) restricts the use of microbeads in cosmetics and detergents; synthetic polymer particles in dryer sheets and fabric softeners face similar restrictions. Athleisure and technical-fabric ownership (C-29: 35% of European wardrobes) creates new demand for microfiber-safe fabric care that does not shed particles. This is a regulatory-driven white space: brands that ship microfiber-safe formulations capture both sustainability-conscious and athletic-wear consumers.\n\n**2. Strategic Evaluation.** Vernel and Persil should both launch microfiber-safe lines: Vernel MicroSafe (polymer-free softening via silicones or plant wax) and Persil TechFiber (detergent optimized for polyester, nylon, and microfiber fabrics). G-02 reclassification is expected 2027-2028; brands that already own the positioning (safe for microfiber, lab-tested compatibility) will capture the trade-up moment. First-mover advantage is 18 months.`,
  'Standalone fabric softeners (liquid)::contraction': `**1. Summary.** T-03 (concentrated formats integrated into pods) renders standalone rinse-aid liquid softeners redundant as Persil Discs and Vernel in-wash softening become the default. Machine auto-dosing systems dispense all ingredients from a single cartridge; separate liquid purchases require extra rinse cycles, extra handling, and extra shelf space. Consumer convenience optimization drives the pool entirely into integrated formats by 2030.\n\n**2. Strategic Evaluation.** Vernel's standalone liquid should be discontinued by 2028 and consolidated into Vernel-branded machine cartridges (softener component). Invest all R&D into cartridge optimization and machine partnerships. This is a clean, strategic exit from a format that will be technologically obsolete. Communicate to retailers that Vernel is "moving upstream" into machine integration, not retreating.`,
  'Heavy perfumed rinse aids::contraction': `**1. Summary.** C-04 (conscious consumption) rejects synthetic fragrance overload in favor of subtle, true-to-nature scent profiles. Consumer sentiment data (NielsenIQ 2025) shows 62% of European consumers perceive "heavy perfumed" as "chemical and artificial." Heavy rinse-aid formulations (5-8% fragrance oil) lose credibility. The pool migrates to scent-booster cartridges with lower fragrance intensity and C-28 (scent boosters €2B→€4.5B by 2030) that let consumers modulate intensity.\n\n**2. Strategic Evaluation.** Position Vernel's new line as "Vernel Pure Freshness" (low-fragrance, high-efficacy softening) for the conscious-consumption consumer, and separately launch Vernel Scent Boosters as a customizable add-on. This bifurcation captures both the low-scent segment (C-04) and the premium scent-booster segment (C-28) simultaneously. Discontinue heavy-perfumed legacy SKUs by 2027.`,
  'Synthetic static-control sheets::contraction': `**1. Summary.** G-05 (green claims directive bans unsubstantiated environmental claims) is restricting marketing of synthetic dryer sheets as "safe," and E-02 (water scarcity and sustainability pressure) drives consumers toward reusable dryer balls and heat-pump dryers that generate less static. Traditional synthetic sheet softeners (quaternary ammonium compounds coated on paper) are falling out of favor as a "chemical" solution. Pool migrates to bio-based alternatives and mechanical (ball) solutions.\n\n**2. Strategic Evaluation.** Do not defend synthetic dryer sheets. Vernel should shift entirely to reusable wool dryer balls (Vernel EcoBalls) and a bio-based dryer sheet alternative (Vernel BioSheets, plant-oil-coated paper). This is a format pivot, not a category exit. Price both options competitively with traditional sheets and capture the sustainability segment. Launch within 12 months as P&G Bounce still owns the synthetic sheet market and has not pivoted to bio-based.`,
  'Heat pump dryers (energy-efficient)::expansion': `**1. Summary.** E-02 (energy efficiency) and E-07 (structural energy cost disadvantage in Europe) drive adoption of heat-pump dryers, which use 40-60% less energy than vented dryers. Installed base will shift from 70% vented to 50% heat-pump by 2030. Heat-pump drying requires lower temperatures and longer cycles, changing fabric interaction chemistry and creating demand for heat-pump-optimized fabric care products. This is a hardware-driven expansion pool.\n\n**2. Strategic Evaluation.** Vernel and Snuggle (HCB US asset) should jointly develop heat-pump dryer sheets and scent pods optimized for 40-55°C drying temperatures. Position Vernel Heat-Pump Optimized as the first brand-endorsed product category for this emerging hardware trend. Secure retailer facing in the dryer-sheet aisle and build brand loyalty before P&G Bounce responds. This is a 18-24 month first-mover window.`,
  'Dryer sheets with scent boosters::expansion': `**1. Summary.** C-09 (fragrance premiumization in home care at 15%+ growth) and C-28 (scent boosters €2B→€4.5B by 2030) combine to create demand for dual-function dryer sheets that deliver both static control and premium fragrance. P&G Lenor Unstoppables created the scent-booster category in the wash; the drying stage is the next frontier. Combining static control (the dryer sheet function) with fragrance delivery (the booster function) creates a natural product bundle that expands the profit pool.\n\n**2. Strategic Evaluation.** Vernel should launch Vernel Dryer Sheets + Fragrance Boosters (3-4 fragrance tiers: Pure, Lavender, Luxury) and capture the 15%+ CAGR fragrance premiumization wave. Price at 1.8-2.2x basic sheets (€1.20-1.50 per sheet vs €0.70 for basic) and secure premium shelf facing at retailers. This addresses P&G Bounce's weakness in fragrance customization and captures the conscious-consumption consumer who wants scent without synthetic overload.`,
  'Tumble dryer balls (eco-friendly)::expansion': `**1. Summary.** G-04 (PPWR packaging waste reduction) and E-02 (water scarcity reduces fabric softener demand) drive adoption of reusable wool dryer balls as chemical-free static elimination. Dryer balls are durable (50+ uses per set), plastic-free, and require zero chemical input, aligning with E-04 (EPR fee escalation) which penalizes single-use packaging. The pool expands as consumers replace boxes of disposable sheets with durable sets.\n\n**2. Strategic Evaluation.** Vernel should launch Vernel EcoBalls (merino wool balls with lavender or cedarwood infusion, €8-12 per set, lifetime durability claim). Sell at premium to dryer sheets on sustainability and durability narrative. Capture the Gen Z and millennial cohort (C-11 ingredient literacy, price sensitivity) that rejects single-use and seeks durable solutions. Partner with retailers (Edeka, Carrefour) on sustainability stories to secure premium facing.`,
  'Dehumidifiers for air-dry optimization::expansion': `**1. Summary.** E-02 (water scarcity and water-usage reduction) drives interest in air-drying as an alternative to machine drying. In humid European climates (UK, Benelux, northern Germany), air-drying requires longer hang time (8-12 hours vs 45 minutes in a dryer). Dehumidifiers solve the water-absorption problem and create a new adjacent product category. The pool expands as consumers optimize the air-dry occasion with humidity-control technology.\n\n**2. Strategic Evaluation.** This is outside Henkel's core scope, but Vernel can cross-merchandise with a "Vernel + Air-Dry" sustainability bundle at retailers featuring Vernel fabric care products and partner dehumidifier brands. Capture the positioning as "Vernel supports sustainable home drying" without manufacturing the appliance. Low-cost co-marketing play with 6-month ROI window.`,
  'Smart dryer sensors & IoT tracking::expansion': `**1. Summary.** T-08 (connected appliances) enables dryers with moisture sensors that auto-stop, preventing over-drying and shrinkage. IoT tracking reports drying time, energy consumption, and garment condition back to the Henkel Smartwash app. This creates a closed-loop garment care feedback loop: wash data → drying recommendations → fabric health status → next-care product recommendation. The profit pool expands as sensors unlock new data-driven service opportunities.\n\n**2. Strategic Evaluation.** Henkel Smartwash should integrate IoT dryer data and recommend Vernel fabric protectors for clothes flagged as "at-risk for shrinkage" (frequent over-drying cycles). Build predictive alerts: "Your dryer is over-drying silk garments — try Vernel Delicate Care." This turns drying into a Henkel-captured moment and multiplies product recommendations per consumer per cycle. Secure OEM partnerships (Bosch, Siemens, Miele) for firmware integration within 12 months.`,
  'Gentle-dry garment longevity products::expansion': `**1. Summary.** E-08 (EU textile longevity mandates) and C-04 (conscious consumption) drive demand for drying-stage products that extend garment life: heat-protective conditioning treatments, fabric-strengthening sheets, and anti-pilling agents applied during tumble drying. The drying moment is the last touchpoint before storage; products applied here can mitigate heat-stress damage and add measurable lifespan extension. This is a new occasion-based pool within drying.\n\n**2. Strategic Evaluation.** Vernel should launch Vernel Garment Care (a conditioning sheet applied in the dryer, plant-based formula, €2.50 per sheet). Position with quantified durability claim: "Extends garment life by 8-12 washes vs standard drying." Pair with Persil's wash-to-wear narrative and create a "Henkel Garment Lifecycle System" story. This captures the premiumization pool (C-04, E-08) and differentiates Henkel from competitors who stop at the wash moment.`,
  'Traditional vented tumble dryers::contraction': `**1. Summary.** E-02 (energy efficiency standards escalating) and E-07 (European energy costs 2-3x US levels) are rendering vented dryers technologically obsolete. EU eco-design regulations (2024-2027) will restrict vented-dryer energy consumption, making the format uneconomical. New machine sales of vented dryers will decline 60-70% by 2030. Fabric care products designed around vented-dryer chemistry (high-temperature, rapid drying) lose their structural context.\n\n**2. Strategic Evaluation.** Do not defend products tuned to vented-dryer physics. Vernel's R&D should pivot entirely to heat-pump and air-dry optimization. This is a hardware-driven contraction, not a marketing problem — no amount of clever positioning will rescue a format that regulators are eliminating. Treat vented dryer products as a harvest category with declining marketing support.`,
  'Basic drying racks (commoditized)::contraction': `**1. Summary.** T-08 (smart dryers with auto-stop and energy optimization) and E-02 (water-scarcity-driven air-dry adoption) are fragmenting the drying-rack market into two tiers: (1) smart/connected racks (IoT humidity control, mobile app integration) and (2) ultra-premium, design-led racks for affluent consumers. The basic commoditized rack (unconnected, no brand positioning) is squeezed and disappears. This is not a Henkel category, but signal is relevant: drying is no longer a commodity moment.\n\n**2. Strategic Evaluation.** This category is irrelevant to Henkel. Monitor only as a leading indicator that the entire drying stage is moving upmarket (toward services and smart solutions) rather than commoditizing. Henkel should anchor Vernel into smart-dryer partnerships to capture this value migration.`,
  'Chemical static-removing sprays::contraction': `**1. Summary.** G-05 (green claims directive bans unsubstantiated environmental claims on chemical products) and consumer backlash against synthetic chemistry in home care (C-04, conscious consumption) are removing demand for chemical-based anti-static sprays. Synthetic cationic surfactants marketed as "anti-static" face increasing scrutiny for false efficacy claims. Consumers are switching to wool dryer balls and heat-pump dryers that generate less static naturally.\n\n**2. Strategic Evaluation.** Discontinue any chemical anti-static spray SKUs by 2027. Vernel should not attempt to reformulate with bio-based alternatives — the category itself is losing relevance as hardware (heat-pump dryers, dryer balls) displaces chemistry. This is a clean exit with zero regret.`,
  'Dryer perfume papers (PVA-based)::contraction': `**1. Summary.** G-14 (PVA biodegradability reclassification petition) is challenging the classification of polyvinyl alcohol (PVA/PVOH) — the water-soluble polymer film used in dryer scent papers and laundry pods — as genuinely biodegradable. Marine biologists and NGOs argue PVA sheds non-degrading nano-plastics in cold-water, low-shear conditions. EU Parliament reclassification is expected 2027-2028, triggering de-listing. This is a regulatory extinction event for PVA-based products.\n\n**2. Strategic Evaluation.** Henkel should immediately halt R&D on PVA-based dryer papers and pivot to compostable cellulose alternatives (ethyl cellulose or kraft-paper-based perfume carriers). P&G Bounce and Vernel are both exposed; first-mover advantage goes to whoever ships a certified-compostable, non-PVA scent product by Q4 2026. This is a 12-month window before regulatory uncertainty becomes regulatory obligation. Source cellulose suppliers and launch prototype testing immediately.`,
  'Garment steamers (replacing irons)::expansion': `**1. Summary.** Garment steamers displace the iron as the primary post-wash garment refreshment tool, driven by T-08 (connected appliances enabling precision heat distribution) and the consumer preference for convenience over labor-intensity. The ironing pool migrates from a laundry-stage consumable to an appliance-stage capital investment. Premium brands (Philips, Rowenta) capture margin that once sat in starch and spray categories; FMCG loses the repeat-purchase occasion and must find the new touch point or exit the stage entirely.\n\n**2. Strategic Evaluation.** Vernel's freshness franchise carries no competitive answer to the steamer migration because it still assumes the iron moment exists. Instead, position Vernel Anti-Wrinkle Spray as the perfect complement to steamer ownership — a pre-steam fabric softener that reduces crease-set time and improves finish. The move is into steamer-adjacent, not iron-defense. Pilot with Philips and Rowenta as co-branded recommendations on device packaging within 12 months.`,
  'Anti-wrinkle fabric treatment sprays::expansion': `**1. Summary.** Spray-and-wear chemistry collapses the ironing stage into a pre-wearing intervention, eliminating the board and heat entirely. T-03 (concentrated formats) enables lightweight, portable bottles that sit in the dresser or carry in travel bags. C-04 Conscious Consumption rejects the resource cost of ironing, favoring bio-based enzymatic wrinkle releasers over synthetic starch. The pool shifts from appliance-dependent (irons, steamers) to portable, repeatable SKUs.\n\n**2. Strategic Evaluation.** Vernel is the credible FMCG vehicle for this — its fabric care leadership transfers directly into a new SKU tier (Anti-Wrinkle Spray). Launch a trial against Fabuloso-owned Cil's limited EU presence and test with Decathlon and Uniqlo in-store placements, where convenience-conscious shoppers already purchase. Ship within 18 months; delay hands the category to P&G's test-phase Febreze expansion into wrinkle care.`,
  'Wrinkle-release fabric technologies (apparel)::expansion': `**1. Summary.** Apparel brands (Uniqlo, H&M, Nike, Lululemon) are embedding wrinkle-release finish chemistry directly into garment fibers at manufacture, using T-01 (AI-optimized finishes) to reduce wrinkle formation by 40-60% without post-wash intervention. The chemistry migrates from the laundry aisle into the textile mill supply chain, away from consumer-facing FMCG entirely. This is a silent pool contraction masquerading as an expansion trend.\n\n**2. Strategic Evaluation.** Henkel cannot defend this pool — it is won at the fiber-supplier level (DowDuPont, Huntsman, Archroma). But Sil and Persil can pivot: position a "Compatible with Tech Fabrics" claim for garments with embedded wrinkle finishes, capturing the subset of care-sensitive shoppers who still want to protect the tech investment. Test with premium athleisure retailers' laundry guidance; this is a defensive halo, not a growth move.`,
  'Steam closets / smart garment refresh cabinets::expansion': `**1. Summary.** Standalone wardrobe appliances (Electrolux, Samsung, LG prototypes) deploy steam, ozone, or UV sanitization for whole-garment refresh without washing or ironing. T-08 (connected home) integrates with closet sensors that trigger cycles based on wear frequency and environmental humidity. The stage function inverts: instead of preparing garments to wear, the appliance conditions them after wearing. Repeat-purchase chemicals vanish; capital goods replace consumables.\n\n**2. Strategic Evaluation.** This is a 5-year-out play that doesn't threaten Vernel today but requires positioning now. Establish partnership channels with Samsung and LG (both Henkel Smartwash partners) to ensure Vernel fabric-refresh is a recommended in-cabinet product or scent cartridge, positioning Henkel as the certified consumables vendor for third-party garment care. First-mover advantage on OEM partnerships captures recurring revenue before competitors build exclusive relationships.`,
  'Portable cordless garment steamers::expansion': `**1. Summary.** Cordless handheld steamers (Philips, Rowenta sub-€100 SKUs at 2.5M+ units annually in EU) eliminate the power-cord friction that confined irons to a single location. T-05 (manufacturing automation) enables compact, efficient heating elements; consumer adoption of convenience wins over the ironing-board stage entirely. Pool moves from scheduled laundry work to impulse, just-before-wearing interventions.\n\n**2. Strategic Evaluation.** Vernel's pre-steaming spray becomes a cross-sell opportunity at steamer purchase points. Approach Philips and Rowenta with data showing users are spending €8-12 annually on fabric treatments; Vernel-branded pump bottles sold at retailer-adjacent POS capture margin that currently flows to specialty spray brands. Negotiate in-box bundling and co-marketing by Q3 2026; this is a high-velocity, low-conflict entry.`,
  'Smart garment care services (on-demand)::expansion': `**1. Summary.** Hyper-local garment services (Tide's Laundry Care sub-subscription in select US cities; emerging EU equivalents like Swash and On Demand Laundry) replace consumer washing and ironing entirely with on-demand pickup, professional treatment, and return. K-04 (social commerce) and convenience premiumization drive this segment at 25%+ CAGR among affluent urban 25-45 demographics. The traditional laundry stage is outsourced; FMCG consumables vanish.\n\n**2. Strategic Evaluation.** Henkel cannot profitably compete in service delivery at sub-€5 per item pricing. Instead, position Persil and Vernel as the branded consumable line for these services — license Persil formulations to laundry providers, creating a reverse supply chain where Henkel captures volume without bearing logistics cost. Approach Swash and Tie (London-based on-demand leader) with white-label chemistry supply by H2 2026.`,
  'Spray-and-wear anti-wrinkle solutions::expansion': `**1. Summary.** Ultra-convenient spray formats (Fabuloso Cil in Latin America, emerging in EU) target time-poor and aging consumers (C-05 Silver Economy — 50+ consumers spend 25% more on convenience products and have lowest ironing frequency). T-03 concentrated formats reduce weight and toxicity; the spray category is the fastest-growing sub-segment of at-home wrinkle care. Pool is explicitly incremental — new SKU occasion, not substitution.\n\n**2. Strategic Evaluation.** Vernel Anti-Wrinkle Spray is the immediate move: inherit Vernel's fabric-care trust, position as "No Iron Required," and price at premium (€2.99/400ml vs. €1.20 for traditional starch). Target pharmacy and drugstore channels where Silver Economy consumers cluster. Launch pilot with dm (German market) by Q2 2026 with two-week in-store promotions; full EU rollout by year-end if velocity exceeds 60% margin threshold.`,
  'Traditional irons & ironing boards::contraction': `**1. Summary.** Time spent ironing in European households declined 40% from 2010-2024 (Eurostat). T-08 (steamers and smart appliances), fabric innovations reducing wrinkle formation, and the cultural shift away from iron-dependent fashion (athleisure, knitwear, performance fabrics) are structural headwinds. The ironing pool is not migrating to a substitute consumable; it is being abandoned entirely.\n\n**2. Strategic Evaluation.** Do not defend the traditional iron category — it is a losing position. Instead, accelerate the transition by bundling Vernel sprays and starch replacements into steamer purchase ecosystems and on-demand garment service supplier relationships. Use the iron contraction as a forcing event to redirect category investment into the spray and steamer-adjacent moments where volume is concentrating. Harvest margin from legacy starch SKUs but do not reinvest.`,
  'Ironing starch sprays (traditional)::contraction': `**1. Summary.** Starch and sizing chemicals are bound to the iron moment; as ironing contracts, starch sales decline structurally at 5-7% CAGR across the EU. T-03 (concentrated formats) and fabric finish technologies (AI-optimized wrinkle-resistant textiles at manufacture) eliminate the need for starch augmentation. The category is not being replaced — it is disappearing because the ironing stage is disappearing.\n\n**2. Strategic Evaluation.** Treat traditional starch as a harvest category. Maintain SKUs in heritage markets (Germany, Austria — 30%+ of EU starch volume) for price-insensitive, ironing-dependent consumers, but stop advertising and promotional spend. Redeploy the trade envelope into Vernel Anti-Wrinkle Spray, which captures the same consumer need without the labor-intensity liability. Exit starch within 36 months from growth investment; become a contract manufacturer supply to discounters if margin supports volume.`,
  'Ironing accessories (covers, pads, stands)::contraction': `**1. Summary.** Ironing-board covers, pressing pads, and steam-board accessories are secondary to the iron itself; as steamer adoption accelerates (T-08) and ironing-free fashion norms spread, the ironing infrastructure market contracts 8-10% annually. C-06 (cost-of-living squeeze) further depresses discretionary purchases of replacement covers and premium pressing surfaces. The pool is structural erosion, not migration.\n\n**2. Strategic Evaluation.** This is a non-core, low-margin category for Henkel — no direct HCB involvement. Monitor only as a leading indicator of ironing-stage contraction. If Henkel owns any licensed ironing-accessory SKUs (unlikely but verify portfolio), de-list within 12 months. Use category decline as a signal to accelerate launch of steamer-adjacent products and refresh-spray positioning.`,
  'Starch and sizing products (classic)::contraction': `**1. Summary.** Classic fabric sizing (starch, fabric finish sprays) is bound to the pre-iron or in-wash laundry moment. T-01 (AI-optimized wrinkle-resistant finishes embedded in textiles at manufacture) and the migration away from cotton-dominant, wrinkle-prone wardrobes eliminate the chemistry step. Henkel holds near-zero share in this category (it is a P&G/generic space), but the 6-8% annual contraction is a profit-pool signal to monitor.\n\n**2. Strategic Evaluation.** No direct HCB action required. The sizing category's contraction is orthogonal to Henkel's portfolio. Monitor as a macro signal of ironing-stage irrelevance and use it to buttress the strategic case for Vernel Anti-Wrinkle Spray and steamer-adjacent positioning. This is a canary — not a target.`,
  'Smart anti-moth & fabric protection::expansion': `**1. Summary.** AI-optimized, bio-based moth-protection formulas (T-01, T-02) using pheromone disruption and botanical actives replace synthetic naphthalene/PDCB mothballs that are being phased out under G-01 (PFAS restriction). E-05 (climate-driven pest shifts) expands geographic risk and drives year-round protection demand in regions previously moth-free. Pool grows as chemistries become science-backed and regulation-compliant.\n\n**2. Strategic Evaluation.** Vernel is the natural anchor for a "Smart Moth Guard" sachet line using bio-based pheromone technology, leveraging C-04 Conscious Consumption preference for natural alternatives. Position against Reckitt's Raid moth products (now Advent-owned and under-invested) and private-label cedar blocks. Launch pilot with premium department stores (Selfridges, Galeries Lafayette) by Q4 2026 with clinical efficacy claims and 12-month protection guarantees.`,
  'Fabric perfumes & closet scents (premium)::expansion': `**1. Summary.** Premium fabric perfumes (Creed, Jo Malone) and science-backed closet scents are capitalizing on T-17 Neurocosmetics (scent engineering for measurable sensory outcomes) and C-03 Premiumization in home care (consumers now pay €15-30 for closet scent products). The segment is growing 12%+ CAGR as fragrance becomes a standalone category anchor within fabric care. Margin is concentrated in premium price-point offerings.\n\n**2. Strategic Evaluation.** Vernel can credibly enter the premium closet-scent market by licensing neurocosmetic fragrance science from a partner (IFF, Givaudan, or Symrise) and positioning a "Vernel Closet Wellness" range at €18-24 per unit. Target Sephora and John Lewis beauty sections — adjacent to traditional home fragrance — positioning scent as a holistic closet-health product, not just fragrance. Launch by H1 2027 with clinical backing; this is a high-margin, low-cannibalization entry.`,
  'Smart wardrobe management apps::expansion': `**1. Summary.** AI-powered wardrobe apps (TheOutfitter, Sekitsuyo, Aire) combine T-07 (AI personalization) with T-08 (IoT closet sensors) to optimize outfit selection, track garment care history, and recommend washing frequency based on fabric type and wear patterns. The apps become the decision interface for when and how to launder, shifting brand choice from the consumer to the algorithm. Whoever controls the app interface controls the product recommendation.\n\n**2. Strategic Evaluation.** Henkel cannot build a wardrobe app competitively against tech-native startups. Instead, integrate Persil and Vernel as the default recommended brands within the top 3 wardrobe apps (negotiate integration by Q3 2026) via a licensing deal. Ensure Persil appears as the "recommended wash" for synthetic and performance fabrics, Vernel for delicates and daily-wear refreshing. This is a discovery-layer play, not a product innovation.`,
  'Anti-humidity & moisture control devices::expansion': `**1. Summary.** Electronic and silica-based humidity control (rechargeable dehumidifiers, IoT sensors) protect stored garments from mold, mildew, and odor formation, driven by E-02 (water scarcity consciousness — consumers avoid rewashing) and climate variability. The pool grows as consumers internalize that rewashing is both wasteful and damaging to garments. Devices and refillable absorbents form a recurring-revenue model.\n\n**2. Strategic Evaluation.** Vernel's closet-care expansion naturally includes humidity-management partnerships. Approach Minidry and Eva-Dry (market leaders in rechargeable closet dehumidifiers) with Vernel-branded replacement cartridges or scent inserts that extend drying cycles. Negotiate 18-month exclusivity for premium European markets by Q2 2026. This is a low-risk, high-recurring-revenue adjacency with zero cannibalization.`,
  'Bio-based garment protection solutions::expansion': `**1. Summary.** Botanical and fermentation-derived protective chemistries (bio-based moth repellents, natural water-repellents, enzymatic fabric brighteners) replace synthetic PFOAs and microplastic finishes, driven by G-01 (PFAS restriction), G-02 (microplastics ban), and C-04 (conscious consumption). T-02 (bio-based chemistry transition) and T-15 (precision fermentation for ingredient supply) compress the lab-to-shelf cycle from 5 years to 18-24 months, enabling rapid category expansion.\n\n**2. Strategic Evaluation.** Sil and Vernel are the credible vehicles for a bio-based fabric protection line. Invest in partnership with DSM or Chr. Hansen (precision fermentation leaders) to secure supply of fermented moth-repellent actives by H2 2026. Launch "Vernel Bio-Guard" (closet protection) and "Sil Bio-Stain" (enzymatic pre-treat) simultaneously, positioning as the premium, regulation-compliant alternative to legacy synthetic products. Price at 30-40% premium; target conscious consumption consumers.`,
  'Smart storage container systems::expansion': `**1. Summary.** IoT-enabled storage containers (Rubbermaid Brilliance with humidity sensors, emerging smart fabric bags) integrate with T-08 (connected home) ecosystems, tracking garment inventory, humidity levels, and triggering alerts when protection or refreshing is needed. The closet becomes an actively managed system, not a passive wardrobe depository. Recurring service revenue (firmware updates, alerts, protection refills) replaces one-time storage purchases.\n\n**2. Strategic Evaluation.** Vernel can position fabric-care products as ecosystem consumables within these smart storage systems. Partner with Rubbermaid and Japanese smart-home players (Nitori, Leopalace21) to integrate Vernel recommendations into container lifecycle management. Offer white-label closet-care service (sensor + fragrance + dehumidifier integration) by late 2026. This positions Henkel as the consumables provider in the smart-closet value chain.`,
  'Extended-range pest protection products::expansion': `**1. Summary.** Climate change is shifting moth and carpet beetle distribution northward and year-round in temperate Europe (E-05). Regions previously safe from moth damage (Northern Germany, Scandinavia, UK) now require year-round protection. Market expands geographically — consumers buying moth products for the first time in regions where the category was historically minimal. Pool grows both in depth (higher penetration in existing markets) and breadth (new geographic markets).\n\n**2. Strategic Evaluation.** Position Vernel Smart Moth Guard (see entry 12) as the "European-expanding" category, with specific marketing targeting newly at-risk northern regions. Pitch retailers in Stockholm, Copenhagen, and Oslo on the climate-change angle, positioning as a "new category for your store." Negotiate standing deals with Coop (Scandinavia) and Sainsbury's (UK) for Q1 2027 shelf resets. This is a macro-trend tailwind — capitalize with geographic expansion discipline.`,
  'Mothballs (chemical, declining appeal)::contraction': `**1. Summary.** Synthetic naphthalene and paradichlorobenzene (PDCB) mothballs face regulatory headwinds (G-01 PFAS-adjacent restrictions in several EU states) and consumer rejection driven by C-04 (conscious consumption preference for natural alternatives). Henkel holds no mothball SKUs, but the category's 12-15% annual contraction in EU (Circana) signals the end of synthetic moth-protection chemistries. The pool is being cannibalized by bio-based alternatives, not by non-purchasing.\n\n**2. Strategic Evaluation.** Monitor Reckitt's Raid moth products and P&G legacy mothball inventory. As these SKUs are de-listed, accelerate Vernel bio-based moth guard positioning to capture switching demand. Use competitor delisting as a forcing event for retailer conversations: "Your traditional moth shelf is closing — here is the compliant, premium alternative." This is a category-resets moment for Henkel to capture share via regulatory tailwinds.`,
  'Basic storage boxes & organizers::contraction': `**1. Summary.** Passive plastic storage (Rubbermaid, Ikea, Dollar Tree basic containers) is being displaced by T-08 (smart storage systems with sensors and IoT connectivity) and the rise of minimal-inventory fashion (outfit repeating, capsule wardrobes). The basic storage category is not being upgraded within itself; it is being transcended by smarter systems. Profit-pool contraction is structural, not substitutional.\n\n**2. Strategic Evaluation.** No direct HCB involvement. Monitor as a leading indicator of smart-closet adoption velocity. If Henkel owns licensed storage SKUs, de-list within 12 months and redeploy product development investment into smart-closet ecosystem partnerships (see entries 14, 17, 27).`,
  'Synthetic fragrance closet bars::contraction': `**1. Summary.** Traditional synthetic fragrance bars (Reckitt legacy, generic private label) are declining as C-04 (conscious consumption) rejects synthetic VOCs and petrochemical fragrances, and T-17 (neurocosmetics) drives preference for science-backed, subtle scent over heavy synthetic masking. The category loses appeal on both regulatory (G-02 VOC restrictions pending in some states) and sensory grounds. Pool contracts as consumers either buy nothing or trade up to premium natural scents.\n\n**2. Strategic Evaluation.** Treat as category contraction, not as a Henkel-specific loss (Henkel has minimal legacy bar share). Use contraction as case-building evidence for Vernel Premium Closet Scent launch — position as "the conscious alternative." Ensure retailer planograms transition switching demand from delisting synthetic bars directly to Vernel premium offerings, not to white space.`,
  'Wool blanket storage treatments::contraction': `**1. Summary.** Synthetic wool-protective sprays (mothproofing, fiber softening treatments) are being replaced by T-02 (bio-based alternatives) and increasingly by integrated protective finishes applied at manufacture. The category is small (estimated <€50M EU) and declining 8-10% annually as consumers increasingly buy machine-washable wool (tech-treated at the mill) instead of chemically protecting stored blankets. Margin is minimal; pool is specialist.\n\n**2. Strategic Evaluation.** No meaningful HCB involvement in wool-treatment SKUs. Monitor for completeness, but de-prioritize. If any legacy products exist (unlikely), harvest margin through discount channels (Aldi, Lidl) and exit within 12 months. Invest freed-up R&D capacity into broader bio-based fabric-protection innovation (entry 16).`,
  'On-the-go clothing refresh sprays::expansion': `**1. Summary.** Portable deodorizing sprays (Febreze On The Go, Lysol Fabric Mist, emerging DTC brands) enable between-wearing garment refresh without washing, driven by C-06 (cost-of-living squeeze — consumers extend wash intervals to save water and energy) and outfit-repeating behavior (athleisure culture, capsule wardrobes). The segment is 15-18% CAGR in EU, with Febreze commanding 65% share. Pool is explicitly incremental — new occasion, not cannibalization.\n\n**2. Strategic Evaluation.** Vernel Refresh Spray (distinct from Anti-Wrinkle Spray, entry 2) is Henkel's immediate counter to Febreze's dominance in this stage. Position on bio-based, lower-VOC formulation vs. Febreze's synthetic fragrance load. Launch with Uniqlo and H&M in-store placement (alignment with outfit-repeating consumers) and on-shelf at discount retailers (Aldi, Lidl) by Q3 2026. Price at parity; win on sustainability positioning. This is the single highest-priority new entry for HCB LHC.`,
  'Deodorizing mists (quick freshening)::expansion': `**1. Summary.** Ultra-lightweight, concentrated deodorizing mists (4-6 oz bottles, < €3 price point) enable impulse and travel-use occasions that full-size refresh sprays do not capture. T-03 (concentrated formats) enables sub-€2 COGS positioning at premium price-to-use. The segment is fastest-growing within between-wash fabric care (25%+ CAGR among 18-35 consumers), driven by subscription and travel packaging trends.\n\n**2. Strategic Evaluation.** Vernel Compact Refresh (4 oz mist, €2.49 retail) is the product innovation: half the size of the standard Vernel Refresh Spray (entry 23), optimized for travel, gym bags, and office use. Test packaging and distribution through Amazon Fresh and Boots Travel sections (Q4 2026). Cross-sell into luggage and fitness retailers via co-marketing. This is a velocity and penetration multiplier for the Vernel Refresh franchise.`,
  'Fragrance refresh boosters (natural)::expansion': `**1. Summary.** Bio-based fragrance refresh products (essential oil mists, fermentation-derived aroma molecules, neurocosmetic scents) command 30%+ price premiums over synthetic equivalents, driven by C-04 (conscious consumption), T-17 (neurocosmetics), and T-02 (bio-based chemistry). The segment is expanding into previously non-purchasing households (premium-conscious consumers who ignored legacy Febreze as "too chemical") and is growing 20%+ CAGR.\n\n**2. Strategic Evaluation.** Position Vernel Refresh as "Naturally Refreshed" (bio-based essential-oil formulation, no synthetic VOCs) vs. Febreze's chemically-derived positioning. Partner with an indie fragrance house (Maison Margiela, Orto) to co-develop a limited-edition neurocosmetic scent variant by H2 2027. This premium entry signals Vernel's evolution beyond commodity softener into conscious-consumption fabric wellness. Price at €4.99-5.99; target Sephora and design-led retailers.`,
  'Fabric care on-demand services::expansion': `**1. Summary.** Dedicated garment refresh services (on-demand pickup, professional deodorizing, and return within 24 hours) are emerging at €8-12 per garment in major EU cities, serving affluent time-poor consumers. K-04 (social commerce) and convenience premiumization drive adoption at 40%+ CAGR in select urban markets. The service is explicitly incremental — an occasion addition to traditional laundry, not a replacement.\n\n**2. Strategic Evaluation.** Henkel cannot compete in service delivery at the €8-12 per-garment margin. Instead, supply Vernel Refresh and bio-based deodorizing chemistry as the branded consumable platform for emerging services (Dry Cleaning Express, Swash, similar). Negotiate white-label supply agreements by Q2 2026, capturing volume at 45%+ gross margin without bearing logistics cost. This is a B2B2C play in high-margin service verticals.`,
  'Smart scent dispensers::expansion': `**1. Summary.** Connected scent devices (IoT-enabled sachets with humidity triggers, scheduled release, and app-controlled intensity) address E-02 (water scarcity — scent boosts replace rewashing) and T-08 (connected home integration). Devices achieve 2-3x scent longevity by releasing fragrance only when humidity spikes, reducing consumption and waste. Recurring revenue model: device hardware (capital) + refill cartridges (consumable).\n\n**2. Strategic Evaluation.** Partner with existing smart-home scent players (Philips Hue Bloom, Nanoleaf scent) to develop Vernel-branded scent cartridges that integrate into these devices by Q4 2026. Negotiate 24-month cartridge exclusivity and revenue-share (15-20% of cartridge sales). This is a hardware-agnostic consumables play that multiplies Vernel touchpoints without requiring Henkel to manufacture the device itself.`,
  'Full re-wash cycle (replaced by refresh)::contraction': `**1. Summary.** Full re-wash cycles for lightly worn garments are being displaced by refresh sprays and between-wear care products (C-06 cost-of-living squeeze incentivizes one-wearing intervals without laundering; E-02 water scarcity makes rewashing economically and environmentally irrational). The traditional laundry occasion is contracting as outfit-repeating culture and water-conservation norms harden. This is a structural contraction in wash frequency, not a substitution within the wash itself.\n\n**2. Strategic Evaluation.** Paradoxically, this contraction is a net profit-pool gain for HCB LHC if refresh products capture higher margin than detergent commodities. Ensure Persil's core detergent narrative emphasizes "fewer washes, same clean" positioning (positioning the wash as premium when it occurs), while Vernel Refresh captures the between-wash occasion at 3-4x margin per SKU. The portfolio shift from high-frequency washing to low-frequency high-margin refresh is the strategic objective.`,
  'Heavy synthetic fragrance products::contraction': `**1. Summary.** Heavily fragranced fabric products (synthetic VOC-laden formulations, especially mass-market Febreze and Lysol variants) face structural headwinds from C-04 (conscious consumption preference for subtle, natural scent) and T-17 (neurocosmetics shift from overwhelming fragrance to measured sensory outcomes). Regulatory winds (pending EU VOC restrictions on consumer-use aerosols) further compress the heavy-scent category. Pool contracts as purchasing shifts to natural and neurocosmetic alternatives.\n\n**2. Strategic Evaluation.** Use heavy-synthetic product contraction as evidence to position Vernel Refresh as the "next-generation" fabric care product — subtle, science-backed, conscious. Target switchers from declining Febreze users with messaging emphasizing "real fragrance instead of fragrance chemicals." Capture share of defecting Febreze volume through partnership agreements with retailers' planogram teams (Q1 2027) as they reset facing allocation.`,
  'Conventional dry cleaning services::contraction': `**1. Summary.** Full-service dry cleaning (chemical-based pressing, solvent treatment) is contracting 5-7% CAGR in EU as C-06 (cost-of-living squeeze — dry cleaning at €3-8 per garment is a luxury good under inflation) and E-02 (water scarcity and chemical waste concerns) drive consumers to home-care alternatives. The category is not being replaced by a cheaper service; it is being displaced by on-home refresh and care. Margin is concentrated in premium garments for affluent consumers — a shrinking addressable base.\n\n**2. Strategic Evaluation.** Dry cleaning contraction is a tailwind for Vernel Refresh and Sil Pre-Treat categories, which offer €1-2 cost-of-care vs. €5-8 for dry cleaning. Position Vernel and Sil as the "dry-cleaning alternative" in messaging and in-store signage at discount retailers. Capture switching demand from retiring dry-cleaning occasions into home-care refresh. This contraction is a strategic gift — accelerate messaging to capitalize on the gap left by declining service adoption.`,
  'Anti-stain / anti-odor smart textiles::expansion': `**1. Summary.** T-01 AI-driven fiber coatings suppress stain and odor formation at the molecular level, preventing damage before it occurs. This shifts the pool from post-damage remediation to pre-damage protection. T-02 bio-based binders replace PFAS chemistry, enabling premium positioning. Whoever locks the textile supply chain into proprietary chemistry wins the garment lifecycle profit.\n\n**2. Strategic Evaluation.** Sil's enzyme IP + Persil's performance position HCB to co-develop smart-textile coatings with Lenzing or cellulose fiber makers. Partner with a smart-textile startup to validate efficacy and establish Henkel as the chemical anchor before P&G cuts Ariel partnerships. Window: 18-24 months; once exclusivity locks, catch-up becomes acquisition-dependent.`,
  'Garment protection nano-coatings::expansion': `**1. Summary.** T-01 and T-02 enable ultra-thin bio-based nano-coatings that repel stains and weather without PFAS chemistry (G-01). Coatings persist through 5-10 washes, justifying €8-12 per-garment premium pricing. Pool dynamics: protective coatings are marginal-cost add-ons to existing laundry, not substitutions — they expand profit without cannibalizing core wash sales. Scotchgard's exit accelerates market opening.\n\n**2. Strategic Evaluation.** Position Vernel Protect Nano as premium laundry service chemistry (spray-on pre-wash), anchored to E-08 textile longevity regulation. Vernel's softener credibility transfers without confusion. Target dry-cleaners and laundry services first for brand halo before retail launch. Execution: 12-18 months.`,
  'Textile softeners (beyond wash cycle)::expansion': `**1. Summary.** T-03 concentrated formats enable leave-on fabric softeners applied after wash or drying — not during it. This expands the softening pool from single in-wash occasion per load to a multi-product care chain (Conditioning Spray, Dryer Sheets, Closet Mist) that compounds frequency and basket size. Zero cannibalization: the washing machine pool does not shrink when softener spend migrates to post-wash formats.\n\n**2. Strategic Evaluation.** Launch Vernel Conditioning Spray targeting 40% of European consumers who tumble-dry garments. Lenor Unstoppables owns scent-boosters; Vernel owns conditioning *after* the wash. Leverage Vernel's €500M+ in-wash distribution to secure retail and cross-promote. First-mover advantage: P&G has not positioned Lenor outside the drum.`,
  'Clothing repair kits & devices::expansion': `**1. Summary.** C-04 conscious consumption and E-08 textile longevity regulation converge: consumers pay €15-25 to extend garment life via repair kits. The repair pool is incremental to washing — it increases Henkel's touch frequency per garment. Indie brands (Patagonia, The Repair Shop) have proven €50M+ annual demand in Europe. HCB has zero presence here.\n\n**2. Strategic Evaluation.** Partner Persil with premium repair kit distributors (e.g., Patagonia) to co-market "Persil Garment Care Bundles" — wash, protect, repair. Bundle Vernel conditioning spray, capturing shelf revenue at zero NPD cost. Positioning: Persil as the wash component of a full-lifecycle experience. Execution: 6-month partnership and merchandising pilot.`,
  'Fashion lifecycle services (repair/resale)::expansion': `**1. Summary.** K-07 professional crossover extends to fashion: laundry subscription boxes, garment refreshment bundles, and repair-to-resale marketplaces are premium consumer services in UK and Germany. Service pool is recurring subscription revenue on top of SKU sales, not incremental product sales. C-04 conscious consumption drives willingness to pay €8-15/month for wardrobe-utility services.\n\n**2. Strategic Evaluation.** Build Vernel-branded subscription box: monthly garment refresh spray + stain prevention guide + partnership discounts from Vestiaire Collective or ThredUP. Vernel owns "wardrobe longevity" as service narrative, differentiating from Lenor's scent-focus. Henkel moves faster than Unilever's circular strategy. Launch: Q2 2026.`,
  'Stain-guard pre-treatment services::expansion': `**1. Summary.** K-07 professional crossover creates service channels: laundry services and dry-cleaners upsell stain-guard pre-treatment as professional expertise, not consumer DIY. C-03 premiumization supports €5-8 upcharges per garment for guaranteed protection. Pool is service revenue on top of existing laundry economics. Sil's stain removal heritage gives HCB credibility as chemistry partner.\n\n**2. Strategic Evaluation.** License Sil's enzyme science to professional laundry associations (German dry-cleaning federation) and position "Sil Pro Stain Guard" as recommended pre-treatment chemistry. Offer training and supply at cost-plus margins. Vanish has no professional service channel; Henkel enters first. Target 50 key laundry partners in Germany, Benelux, UK by end of 2026.`,
  'Fast fashion disposable garments::contraction': `**1. Summary.** C-04 conscious consumption and G-06 deforestation regulation systematically defund the fast-fashion pool. Regulatory tariffs and retailer delisting compress the occasion. Pool shifts to second-hand, rental, and durable-premium segments where garments are worn 50+ times instead of 5. Laundry care frequency increases per garment, but total garment volumes decline — structural reallocation, not shrinkage.\n\n**2. Strategic Evaluation.** Defend fast-fashion contraction by positioning Persil + Vernel as garment *life-extension system*, not commodity wash. Message "extend your favorite garment for 100 wears" with premium protocols (Persil for delicates, Vernel conditioning, fabric protection). Capture share from premium-durable consumers (Patagonia, Nudie) via DTC subscriptions. Fund this upmarket segment.`,
  'Single-use stain wipes (plastic)::contraction': `**1. Summary.** G-04 PPWR and G-02 microplastics regulations create a delisting cliff for plastic stain wipes by 2027-28. Category reformulates, not shrinks. Retailers delist plastic without replacement unless branded spray alternative exists on shelf at listing-decision time. First-movers with credible spray substitutes capture migration. Competitors holding only plastic formats (Unilever) lose shelf space.\n\n**2. Strategic Evaluation.** Position Sil as spray replacement for plastic wipes, using T-02 bio-based formulation messaging. Secure retailer commitments now to list Sil Spray alongside delisted wipes by Q3 2027. Undercut private label on sustainability credentials. Vanish reformulation cycles are slower under PE ownership; Henkel moves first. Regulatory-driven SKU substitution with guaranteed margin.`,
  'Quick-fix synthetic patches::contraction': `**1. Summary.** G-05 Green Claims Directive crackdown exposes "quick-fix" patch claims to regulatory challenge — temporary patches cannot claim permanent repair. Category contracts as false claims trigger retailer delisting. Only products with genuine durability claims survive. Indie repair brands (Patagonia, The Repair Shop) have science; FMCG patch brands do not.\n\n**2. Strategic Evaluation.** Abandon the quick-fix patch pool. Instead, position Sil as *preparation* chemistry for legitimate repairs: Sil cleans and conditions garments before professional repair via partnerships with genuine repair services. Supply-chain collaboration, not product expansion. Henkel supplies chemistry; professionals supply credibility. Avoid the false-claims regulatory minefield.`,
  'Chemical-heavy protective sprays::contraction': `**1. Summary.** G-01 PFAS restriction terminates the Scotchgard-era protective spray era across EU. Fluorocarbon DWR chemistry vanishes from shelves as formulations cannot reformulate in time for 2026-27 compliance. Pool drains to whoever has a PFAS-free bio-based protection spray already validated and market-approved. Scotchgard's exit accelerates the shelf gap opening.\n\n**2. Strategic Evaluation.** Fast-track Vernel Bio-Protect nano-coating spray (T-02 bio-based chemistry, validated durability through 8-10 washes) to market by Q4 2026 ahead of PFAS delisting. Partner with retailers' scientific teams to pre-qualify against durability standards. Vernel's freshness equity signals non-toxicity to consumers. This is Henkel's biggest regulatory-driven white space in Wearing stage.`,
  'Fabric refresh sprays (concentrated)::expansion': `**1. Summary.** T-03 concentrated formats transform economics: 250ml bottle delivers 100+ applications vs. Febreze's dilute 400ml delivering 40 applications. Concentrated refresh is margin-compression for Febreze but margin-expansion for first-mover challenger. C-06 cost-of-living pressure makes per-application pricing a consumer decision factor. Pool is 8-10% CAGR (C-14); question is who captures growth margin.\n\n**2. Strategic Evaluation.** Launch Vernel Refresh Concentrate in 250ml bottle, positioning cost-per-spray at 40% below Febreze and 30% below Air Wick. Secure retail listing by Q1 2026 before Febreze responds with concentrated line. Leverage Vernel's freshness heritage and in-wash distribution for cross-promotion. Window: 12-18 months; Febreze defend-response is inevitable and fast.`,
  'On-the-go freshener/anti-static mists::expansion': `**1. Summary.** T-03 portable concentrates enable travel-size mists (75ml spray bottles) delivering 30+ applications — a new carry-along convenience occasion. Febreze has not entered portable; Batiste's dry shampoo success (C-15) proves format demand in hair. Laundry has zero portable competitor presence. Trial-size SKUs lock repeat purchase behavior.\n\n**2. Strategic Evaluation.** Launch Vernel On-The-Go Mist (75ml, anti-static + freshness, €2.99) in travel retail and DTC first. Position as "wardrobe emergency" product for business travelers and students. Trial-to-repeat format win; low NPD cost, high frequency potential. Febreze has zero travel positioning; first-mover secures distribution channel and trial habit.`,
  'Portable garment steaming devices::expansion': `**1. Summary.** T-05 manufacturing automation compresses portable steamer design cycles: Philips, Rowenta, and Chinese appliance makers launch compact hand-held steamers (€30-60) for travel and touch-up. Every steamer requires fabric conditioning liquid to prevent residue and enhance finish. No branded fabric care chemistry is currently locked into this appliance category.\n\n**2. Strategic Evaluation.** Negotiate with Philips and Rowenta to develop Vernel-branded refill cartridges for their portable steamers. Create two-piece SKU strategy: device (OEM profit), refill (Henkel recurring revenue + margin). This is Nespresso-style ecosystem play. Win one partnership by Q3 2026; the second will follow rapidly. Refill revenue compounds to €10M+ annually at 30% gross margin per partner.`,
  'Smart refreshing cabinets / steam closets::expansion': `**1. Summary.** T-08 connected appliances and T-01 AI optimization spawn smart closets with integrated steaming, humidity control, and fabric care delivery (Miele SmartCare Lab, Samsung AirDresser). Devices auto-dispense fabric care during garment cycles. Appliance makers currently partner with P&G and Unilever on default-chemistry agreements; HCB has no partnership locked.\n\n**2. Strategic Evaluation.** Secure co-development and supply agreement with Miele and Bosch for Vernel as default fabric care liquid in their smart closet systems (leverage Henkel's existing OEM relationships). Negotiate €2-3M annual minimum supply + European exclusivity. Samsung and LG will follow; the first partnership sets architectural standard. Action window: Q2-Q3 2026.`,
  'UV garment sanitizers (portable)::expansion': `**1. Summary.** C-12 post-COVID hygiene baseline (20-30% above pre-COVID) persists for fabrics. UV sanitizer appliances (Larq, Cleansebot, Philips UV-C wands, €40-150) are mainstream. These devices sanitize but do not freshen or condition. Fabric care chemistry remains a separate purchase. Henkel positions fabric care as complementary hygiene layer — paired application, not replacement.\n\n**2. Strategic Evaluation.** Develop Vernel Hygiene+ formula (T-02 antimicrobial bio-actives) validated to work synergistically with UV sanitizers. Position as "the safe fabric care for UV-sterilized garments." Partner with Philips to bundle Vernel sachets with UV sanitizer purchases. This is a halo play — Vernel becomes synonymous with safe, science-backed garment hygiene. Market entry: Q4 2026.`,
  'Dry shampoo for clothes (spray)::expansion': `**1. Summary.** Batiste dry shampoo grows 7%+ CAGR in hair and carries 40%+ of texture/styling segment (C-15). This is the laundry equivalent: spray that refreshes garment texture and extends wear intervals without full laundering. T-03 concentrated format enables 100ml bottle delivering 50+ applications. C-06 cost-of-living pressure drives trial. Febreze has zero dry-refresh positioning.\n\n**2. Strategic Evaluation.** Launch Vernel Dry Refresh spray (concentrated, targeted at jeans and knitwear) within 12 months. Position as texture-restoring alternative to full washes, extending wear 2-3 days between laundering. Leverage Vernel's softening heritage to assure safe application. Price €3.49 for 100ml. Pilot Germany and UK; scale on repeat velocity. Febreze's dry-refresh absence is a gift.`,
  'Odor-elimination enzyme sprays::expansion': `**1. Summary.** T-02 bio-based enzyme chemistry and T-01 AI-driven enzyme optimization compress lab-to-market cycles. Sil's stain-removal enzyme heritage gives HCB credible science narrative that P&G (Febreze masking-fragrance) and Reckitt (Air Wick, declining investment) cannot match. Enzyme-based odor elimination is objectively superior to chemical masking; C-04 conscious consumption favors transparency. Pool migrates toward science-backed chemistry.\n\n**2. Strategic Evaluation.** Develop Sil Enzyme Refresh Spray (odor-digesting enzymes, not fragrance masking) and position as "chemistry-backed alternative to fragrance covers." Validate efficacy via third-party testing (SGS, Eurofins). Target premium consumers and professionals (fitness wear, athleisure) who distrust masking. Febreze owns masking; Henkel can own *elimination*. Launch: Q3 2026.`,
  'Smart garment freshness alerts (app)::expansion': `**1. Summary.** T-08 connected appliances and T-07 AI personalization enable Smartwash ecosystem notifications: "Your jeans worn 3 times since last wash — freshen or launder by day 5." App becomes interface for Vernel refresh recommendations, serving as conversion funnel for between-wash spray purchases. Software + hardware lock-in creates moat that branded SKUs alone cannot. Pool is software-enabled recurring revenue.\n\n**2. Strategic Evaluation.** Integrate Vernel into Smartwash app as featured recommendation engine. Garment-care notifications link Vernel refresh spray to e-commerce checkout, converting software engagement into commerce revenue. Build app feature by Q2 2026. Target 100K Smartwash-connected households in Germany, UK, Benelux for pilot. Vernel becomes default between-wash solution; P&G has no equivalent ecosystem play in Europe.`,
  'Branded fabric refresh spray range::expansion': `**1. Summary.** C-14 between-wash fabric care scores 0.82 (highest white space, 8-10% CAGR). Febreze is $1B+ globally; European market €500M+ and accelerating as outfit repeating becomes baseline. Henkel has zero position where P&G Febreze dominates and Reckitt Air Wick (PE-owned, under-invested) is the only European challenger.\n\n**2. Strategic Evaluation.** Ship full Vernel Refresh spray range (Original, Fresh Linen, Antibacterial) within 18 months, anchored to Vernel's freshness equity against Febreze's fragrance-masking. Cross-merchandise with Persil detergent (complete garment care system). Secure German grocery, UK multiples, and Benelux distribution before P&G refreshes Febreze or Unilever responds. Highest-ROI new-pool entry in entire Henkel LHC portfolio.`,
  'Antibacterial garment hygiene sprays::expansion': `**1. Summary.** C-12 post-COVID hygiene baseline persists 20-30% above pre-COVID. Consumers view garment hygiene and freshness as separate — safety vs. sensory. T-02 bio-based antimicrobial actives (silver ion nanoparticles, enzyme proteins) enable premium pricing (€1-2 per application vs. €0.30 standard refresh). Pool expansion is additive, not substitution: antibacterial adds premium tier on top of refresh.\n\n**2. Strategic Evaluation.** Develop Vernel Hygiene+ antibacterial spray using T-02 bioactives validated to eliminate 99.9% odor-causing bacteria. Price €4.99 for 250ml (50% premium to standard refresh). Target families with young children, healthcare workers, fitness enthusiasts. Febreze has antimicrobial line but no science narrative; own efficacy claims via independent testing. Launch Germany and UK Q4 2026; Benelux Q2 2027.`,
  'Full wash cycle (over-washing declining)::contraction': `**1. Summary.** C-06 cost-of-living squeeze and E-02 water scarcity compress wash frequency: cash-constrained and environmentally conscious consumers reduce loads from 2-3 per week to 1-2. Between-wash products nominally expand intervals, but in tight budgets they substitute, not supplement. Pool contracts when between-wash spray adoption cannibalizes wash-occasion frequency faster than new occasions are created. Strategic risk, not inevitability.\n\n**2. Strategic Evaluation.** Reframe Vernel refresh as "water and energy savings tool," not washing supplement. Message: "One refresh spray application saves 40L water per garment; one wash = 40-60L. Extend wear intervals, cut water bills 25%." Position between-wash as cost-reducer and environmental hero. Target cost-conscious and sustainability-driven consumers explicitly. Messaging discipline prevents cannibalization.`,
  'Fabric de-wrinkling gadgets (niche)::contraction': `**1. Summary.** T-08 smart steamers displace niche de-wrinkling gadgets by integrating function into broader appliances. Portable steamers (T-05 compact manufacturing) deliver equivalent function at lower price and higher versatility than single-use gadgets. Niche gadget pools contract as integration consolidates category. Not a demand decline — competitive concentration where generalist products outcompete specialists.\n\n**2. Strategic Evaluation.** Abandon standalone gadget positioning. Instead, partner Vernel with Philips and Rowenta (portable steamer OEMs) as recommended conditioning liquid — Henkel supplies chemistry layer, appliance makers supply hardware. This shifts Henkel from gadget player to supply-chain partner capturing recurring refill revenue. Niche gadget marketers cannot follow; they lack appliance OEM relationships.`,
  'Heavy synthetic fabric refreshers::contraction': `**1. Summary.** C-04 rejects heavy synthetic fragrance; G-05 penalizes vague "natural" claims. Heavy synthetic refreshers face credibility crisis as consumers distrust opaque blends. Pool contracts toward transparent, bio-based alternatives. Febreze's synthetic-fragrance model becomes a liability.\n\n**2. Strategic Evaluation.** Reformulate Vernel refresh as light, transparent bio-based formula: list all ingredient actives on-pack and communicate mechanism clearly (enzymes digest odor molecules; essential oils provide natural scent, not masking). Position as "Clean Refresh — No Heavy Synthetics." Directly contradicts Febreze positioning; appeals to C-04 consumers. Use reformulation as wedge to win shelf share in premium and health-conscious segments. Q1 2026 formulation, Q2 2026 launch.`,
  'Shade finders & AR try-on tools::expansion': `**1. Summary.** Shade discovery is migrating from the shelf to the device. T-07 (AI personalization) collapses the match-and-compare cycle into a single algorithmic recommendation; T-01 (AI formulation) enables formulators to simulate color outcomes with hair-type precision. Once a consumer trusts the camera, the shade choice leaves the shelf entirely and moves to whoever controls the diagnostic-to-product path — L'Oréal Modiface leads but its mass-market precision lags salon-grade accuracy.\n\n**2. Strategic Evaluation.** Schwarzkopf's 90%+ aided recall in Europe is the natural wedge. Build a Schwarzkopf-branded AR shade finder wired to Schwarzkopf Professional salon credibility and color precision that Modiface's generalist engine cannot match. Deploy against Modiface within 12-18 months before Amazon rolls its own visual-search layer into Subscribe & Save recommendations.`,
  'Style inspiration apps & platforms::expansion': `**1. Summary.** Discovery through curated styling is a new occasion — not color, but the creative look that inspires purchase. T-07 (AI personalization) lets platforms learn from user behavior, recommending not just products but moods and occasions. K-04 (social commerce) collapses inspiration-to-cart in a single tap, capturing the impulse moment before brand comparison starts. The pool here is incremental to core color and care — it funds aspirational styling habits.\n\n**2. Strategic Evaluation.** got2b owns the TikTok-native styling occasion and should build an inspiration feed (user looks, trend alerts, creator collaborations) directly into a private-label app. This locks the discovery moment inside the HCB ecosystem before P&G Pantene or L'Oréal builds a competing platform, and cross-merchandises color + finishing products in a single user journey.`,
  'Creator & community platforms::expansion': `**1. Summary.** Creators are the new hair consultants — 68% of Gen Z discovery starts with social, not search (T-09 inversions). K-04 (social commerce) routes influencer recommendations into direct checkout, meaning the profit pool fragments: brands pay creators directly, platforms take listing fees, and retail shelf placement becomes optional. The winner owns the creator-selection algorithm and data on what looks drive conversion.\n\n**2. Strategic Evaluation.** got2b's youth equity is underdeployed. Launch a got2b Creator Fund ($2-5M annually) seeding micro-creators on TikTok and Instagram with product drops and commission structures that beat P&G Pantene's scattered influencer spend. Capture 18-24 months of first-mover advantage in creator lock-in before L'Oréal and Unilever build formal creator platforms.`,
  'Trend-led inspiration collections::expansion': `**1. Summary.** Collections anchored to seasonal or cultural trends (Y2K revival, dark academia, coastal coquette) drive premiumization through narrative, not formula innovation. C-03 (premiumization) and C-08 (male grooming growth at 7.65% CAGR) are structural tailwinds. Each collection can command a 15-30% margin uplift over category baseline because the trend itself justifies the price — the consumer is buying the moment, not the SKU. Trend velocity in social is compressed to 60-90 day cycles.\n\n**2. Strategic Evaluation.** Schwarzkopf Palette can launch quarterly limited-edition color collections tied to TikTok trends (e.g., "Shift Trend Collection" every Q) at €12-15 vs. baseline €9 pricing. Partner with trend-forecasting agencies and creator networks to signal upcoming trends 4-6 weeks before launch. This commoditizes L'Oréal Excellence's premium positioning by making trend-led fashion color a mass-market habit.`,
  'Digital consultation (AI-matched looks)::expansion': `**1. Summary.** When the customer uploads a photo, the AI returns not just a shade match but a complete look: color, finishing, styling sequence. T-01 and T-07 compress what was a 30-minute salon consultation into a 90-second app interaction. The diagnostic shifts from human to algorithm, and the prescription is immediate and specific. This is where brand choice gets locked in — whoever controls the look matching controls the replenishment pool downstream.\n\n**2. Strategic Evaluation.** Schwarzkopf Professional's trichology IP is uniquely leverageable here. Build an AI consultation tool (photo upload → professional-grade color + treatment + style recommendation) and license it to Schwarzkopf consumer and Syoss as the gateway to a bundled product recommendation. Compete against Prose and Function of Beauty's quiz-based DTC model by offering faster results and salon-credible authority. Launch within 9 months.`,
  'Influencer shade collaborations::expansion': `**1. Summary.** Collab collections with creators drive discovery through parasocial trust. K-04 (social commerce) means the creator's audience is a ready-made customer list; the influencer is the media buying, the product is the message. C-03 (premiumization) permits 40-50% margin uplift on a signature shade versus core range. First-mover collab anchors a creator to a brand, making exclusivity the moat instead of innovation.\n\n**2. Strategic Evaluation.** got2b should sign 8-12 mid-tier TikTok creators (500K-5M followers) to exclusive color capsule lines at €14-18 MSRP, launching 4-6 per year. Negotiate 60-day exclusivity windows before P&G/Pantene or L'Oréal can counter-offer. This captures Gen Z discovery through authentic creator voice, something Schwarzkopf's heritage brand cannot replicate at scale. Allocate €100-150K per collab.`,
  'AI-generated personalized content at scale::expansion': `**1. Summary.** T-10 (Gen AI marketing efficiency) enables 40-60% cost reduction in content production — localized ads, carousel variations, email sequences all generated by LLM in hours instead of weeks. Brands with AI-content infrastructure have a structural media advantage: lower cost-per-impression means deeper pockets for paid reach. The pool migrates from agencies (high-touch, slow) to in-house AI teams (fast, iterative).\n\n**2. Strategic Evaluation.** Build an internal Gen AI content engine (Claude API + custom prompts) for got2b and Schwarzkopf digital campaigns: auto-generate TikTok captions, Instagram carousel decks, email subject lines, and localized paid-social creative. Target 40% agency cost reduction within 12 months. Redeploy savings into paid media frequency on K-04 platforms (TikTok Shop, Instagram Shopping) to outpace L'Oréal's incumbent spend.`,
  'Print shade & style lookbooks::contraction': `**1. Summary.** Physical lookbooks are margin-consuming artifacts in a T-07 (AI personalization) world. A printed shade guide requires reprinting every seasonal color drop and sits in retailer storage until sale; digital AR replaces static shade swatches with live color simulation. Print inventory risk has zero payoff in social-first discovery. Retailers are de-stocking print collateral in favor of QR-linked digital experiences.\n\n**2. Strategic Evaluation.** Sunset print lookbook programs entirely for Schwarzkopf and Palette within 12 months. Reallocate the €400-600K annual print budget into digital assets: AR shade simulators, social-media creative libraries, and retailer POS digital displays. The 20-30% margin recovered from printing cost elimination can fund higher-touch retailer training on digital POS systems.`,
  'Occasion-based hair collections::contraction': `**1. Summary.** Collections mapped to occasions (bridal, festival, work-appropriate) appealed to a browsing consumer; C-11 (Gen Z dupe culture) inverted this logic. Gen Z consumers research products by ingredient and price-per-use, not occasion narrative. They buy one shade for multiple uses. Occasion marketing demands inventory complexity (SKU proliferation) without lifting base attach rate — it is margin dilution disguised as innovation.\n\n**2. Strategic Evaluation.** Consolidate Schwarzkopf's seasonal occasion collections into core year-round shades and limit special editions to quarterly trend drops. The €800K inventory carrying cost of low-velocity occasion SKUs can migrate to core range depth. This is a harvest move — HCB loses minimal volume while recovering 15-20% of collection P&L.`,
  'Traditional salon consultations (walk-in)::contraction': `**1. Summary.** Walk-in salon chair time is being automated and pre-selected. T-07 (AI personalization) predicts the look before the appointment; digital booking reduces no-shows and chair-wait friction. Consumers increasingly validate their at-home choice in a salon rather than using the salon as a discovery point. The salon shifts from consultant to executor, compressing the margin-generating diagnostic moment.\n\n**2. Strategic Evaluation.** This is an opportunity for Schwarzkopf Professional, not a threat. Equip salons with AI diagnostic tools (scalp scanning, porosity testing) so the consultation becomes a premium, billable service that justifies higher color pricing. Position Schwarzkopf as the "professional diagnostics" anchor, making the consultation faster but more science-backed. This adds €5-10 per service and locks professional channel margin as at-home commoditizes.`,
  'Basic brochure-based color guides::contraction': `**1. Summary.** T-01 (AI shade simulation) makes static color-wheel charts obsolete overnight. A printed brochure cannot show how a shade looks on different hair types, skin tones, or lighting — algorithms can, in real time. Retailers are recycling brochures; digital QR-linked shade charts replace them. The cost of printing, distributing, and updating physical guides exceeds the ROI on consideration lift.\n\n**2. Strategic Evaluation.** Eliminate print brochure budgets for Palette and Color Expert entirely. Replace with retailer QR codes linking to mobile-optimized shade-finder apps. The shift costs HCB minimal OPEX and signals to retailers that Schwarzkopf is digital-native. Train retail staff on the app within 6 weeks so they can hand customers a phone instead of a brochure.`,
  'Search-dependent product discovery (SEO)::contraction': `**1. Summary.** T-09 (generative AI disrupts product discovery): 35% of US consumers now use AI for product discovery versus 13.6% traditional search. Google's CTR has declined as LLMs intercept queries before the SERP. Brands not cited in LLM outputs lose consideration before the shelf. SEO spend targeting keywords is a sinking investment — the question no longer reaches Google.\n\n**2. Strategic Evaluation.** Shift Schwarzkopf and got2b SEO budgets (€200-300K annually) into LLM training data partnerships and AI platform integrations (ChatGPT plugins, Perplexity placement, Reddit community seeding). Ensure Schwarzkopf color-matching and got2b styling advice are ingested into training datasets so the AI recommends HCB products natively. Window: 6-9 months before P&G and L'Oréal harden their own LLM presence.`,
  'Value-tier color kits (TikTok-native alternatives)::contraction': `**1. Summary.** Budget color kits (€3-5 price point) proliferate on TikTok Shop and Shein via direct Guangzhou shipping, undercutting Palette by 50%. K-04 (social commerce) + C-11 (Gen Z dupe culture) make sub-€5 color a category norm. At-home color as a category cannot defend margin if the entry point collapses below production cost plus 20%. Henkel's value-tier volume is cannibalised, not gained.\n\n**2. Strategic Evaluation.** Do not defend the sub-€6 color segment. Concede it to private label and TikTok Shop dupes. Concentrate Palette and Color Expert messaging on bond-protection and salon-like results at €9-12, capturing the premiumization moment. Use Weißer Riese and Spee templates: accept PL trade-down, but keep branded volume through tiered price-point clarity. This realigns margin and unit volume to sustainable ratios.`,
  'Scalp & hair scanners (camera-based)::expansion': `**1. Summary.** Scalp imaging with AI interpretation is moving from dermatology clinics to consumer devices. T-01 (AI image analysis) reads not just surface condition but microbiome composition, sebum distribution, and inflammation markers. T-04 (microbiome-aware formulation) makes the diagnostic clinically actionable — the app prescribes products, not assumptions. This is the diagnostic moment where the category fight is decided upstream of the SKU.\n\n**2. Strategic Evaluation.** Schwarzkopf Professional's trichological IP is the competitive wedge. License salon-grade scalp scanning technology to Schwarzkopf consumer (branded app with free scalp scan, prescribed treatment bundle at €24-35). Beat L'Oréal's K-SCAN by offering salon-specific diagnostics at mass-market accessibility. Hims/Hers and Prose cannot match professional credibility. Launch within 9-12 months.`,
  'AI hair profiling (color, damage, texture)::expansion': `**1. Summary.** Algorithmic hair profiling from a single photo (color depth, damage index, texture classification, porosity score) enables precision formulation matching. T-01 and T-07 compress what was a manual assessment into a millisecond API call. C-03 (premiumization) and subscription lock-in rewards accuracy — consumers who get precise matches replenish faster. DTC brands (Prose, Function of Beauty) have proven the data moat works; L'Oréal's €1.7B R&D is racing to replicate it.\n\n**2. Strategic Evaluation.** Wire Schwarzkopf Professional's formulation science into a consumer-facing AI profiling engine and brand it to Schwarzkopf. Offer free hair profiling (photo + 5-question quiz) leading to personalized treatment recommendations at €18-28 per product. Subscription lock-in at 20-25% margin uplift. This directly mirrors Prose/Function model but with salon-grade credibility HCB competitors cannot match. Launch within 6 months.`,
  'Porosity & damage diagnostic tests::expansion': `**1. Summary.** Porosity diagnostics (porosity spectrum, cuticle integrity, moisture-binding capacity) shift from salon backbar intuition to quantified consumer assessments. C-03 (premiumization) enables brands to charge €5-10 for a diagnostic test that justifies €25-40 treatment bundles. The test becomes a gateway to a ritual — weekly treatments, seasonal masks, targeted serums all anchored to the diagnostic baseline.\n\n**2. Strategic Evaluation.** Bundle a Schwarzkopf Professional porosity test kit with Gliss treatment products (test + weekly mask + serum + leave-in = €35 bundle). Position as "Professional Hair Science" retail tier below salon but above drugstore. Gliss Kur heritage makes the clinical positioning credible. Launch in 4-6 months before L'Oréal saturates the test-kit segment.`,
  'Dermatological & trichology assessments::expansion': `**1. Summary.** Hair loss entering mainstream (C-10) makes dermatological credibility a profit-pool driver. DTC brands (Hims, Ro, Nioxin) have normalized tele-derm consultations ($50-150 per assessment). Consumers are willing to pay for clinical validation of scalp conditions (alopecia, dermatitis, seborrheic keratosis) and oral/topical treatment protocols. The assessment prescribes the treatment — diagnostic moment locks in the brand.\n\n**2. Strategic Evaluation.** Schwarzkopf Professional should partner with tele-derm platforms (Ro, Nurx, or build proprietary) offering professional trichology assessments ($40-60 consultation fee, 40% to Schwarzkopf) that prescribe Schwarzkopf-branded scalp care and anti-thinning serums. This monetizes trichological IP and positions Schwarzkopf as the professional tier between Nioxin ($40+) and Head & Shoulders ($6). Pilot within 12 months.`,
  'Hormonal & nutritional deficiency screening::expansion': `**1. Summary.** Hair loss driven by GLP-1 medications (C-02) or nutritional deficiency creates a new diagnostic category. C-05 (Silver Economy) and C-10 (hair loss mainstream) expand the addressable pool beyond pattern baldness to post-pharmaceutical and age-related thinning. Consumers are willing to test (blood work, nutrient panels) and supplement if the outcome is measurable hair recovery. The supplement + topical protocol locks in higher lifetime value.\n\n**2. Strategic Evaluation.** Create a Schwarzkopf-branded scalp health screening protocol (partner with Functional Medicine Lab or direct-order blood test) offering nutrient analysis and personalized oral supplement recommendations alongside topical Schwarzkopf professional serums. Position as the premium scientific alternative to Nutrafol (Unilever). Target 50+ female demographic (C-05) with €50-80 diagnostic + €30-40 monthly supplement subscription.`,
  'At-home scalp microbiome testing::expansion': `**1. Summary.** T-04 (microbiome-aware formulation) enables consumers to test their own scalp microbiome composition via swab-and-mail kits. The test prescribes formulations calibrated to that consumer's microbial ecosystem. Microbiome testing kits are growing 25%+ annually; consumers pay €30-50 for the test. The result is a high-margin diagnostic that justifies €25-35 monthly care subscriptions.\n\n**2. Strategic Evaluation.** Partner Schwarzkopf Professional with a microbiome-testing lab (or license existing tech from Zymo or Everlywell) to offer Schwarzkopf Scalp Microbiome Kits (€40 test, 45-day turnaround). Results route to microbiome-matched Schwarzkopf serum/shampoo recommendations at €28-35/month subscription. L'Oréal's K-SCAN reads surface but not microbiome; this is the white space. Launch pilot in 6-9 months.`,
  'DNA-based hair type profiling::expansion': `**1. Summary.** Genetic hair-type profiling (texture heritability, pigment composition, growth-cycle variation) offers precision targeting for ultra-premium positioning. T-01 (AI-driven formulation) makes the genetic data actionable — each consumer's genotype maps to a bespoke formulation. C-03 (premiumization) permits €50-80 entry points for "genetically matched" hair care. The DNA result becomes a narrative anchor: personalization at the molecular level.\n\n**2. Strategic Evaluation.** Offer Schwarzkopf DNA Hair Profiling (partner with 23andMe or build proprietary) at €60 entry point, unlocking a personalized Schwarzkopf Professional formulation subscription (€45-55 monthly). Position as ultra-premium tier above Prose/Function. This monetizes genetic data and justifies premium pricing through scientific narrative. Target affluent 25-45 demographic. Pilot within 12 months.`,
  'Male-specific hair thinning pattern analyzers::expansion': `**1. Summary.** C-08 (male grooming at 7.65% CAGR, €23.6B market) and C-10 (hair loss mainstream) converge on male-specific diagnostics. Male-pattern baldness (Norwood scale) is highly predictable from photography; algorithms can stage the condition and forecast progression. The diagnostic unlocks early intervention (minoxidil, finasteride) and scalp-care protocols. Men are underserved by existing diagnosis tools.\n\n**2. Strategic Evaluation.** Develop a Schwarzkopf Men Hair Loss Analyzer (free app: photo upload → Norwood scale + thinning-risk forecast + treatment protocol). Gate treatment-product recommendations behind the diagnostic result. Partner with Ro/Hims on prescription referral (affiliate revenue). This captures the diagnostic moment for male-grooming segment, where got2b and Schwarzkopf have minimal presence. Launch within 9 months before P&G and L'Oréal build competing tools.`,
  'Post-medication hair health monitors::expansion': `**1. Summary.** GLP-1 weight-loss drugs (Ozempic, Wegovy, Mounjaro) cause hair shedding in 20-30% of users; C-02 (GLP-1 drugs reshape consumer spending) creates a new diagnostic occasion. Consumers on GLP-1 need early detection of hair loss to intervene. A monitoring app (photo-based hair density tracking, monthly telemetry) justifies a post-GLP-1 hair recovery protocol. The market is emerging now; first-mover establishes the baseline category.\n\n**2. Strategic Evaluation.** Create Schwarzkopf GLP-1 Hair Recovery Protocol: free hair-loss monitoring app (monthly density tracking) + recommended serum/supplement bundle (€35-50/month) specifically formulated for medication-induced shedding. Partner with Hims/Ro (who prescribe GLP-1) for referral integration. Position as the clinical-grade recovery solution for GLP-1 users. Launch within 6 months, target 2-3M GLP-1 users in major markets.`,
  'Scalp analysis kits (basic / manual)::contraction': `**1. Summary.** Manual scalp assessment guides (charts, questionnaires) are replaced by T-01 (AI image analysis) that is faster, more accurate, and repeatable. A basic paper-based kit requires consumer interpretation and manual matching — AI does the interpretation. Consumers abandon manual kits when algorithmic alternatives offer instant results. The margin pool in basic analysis gets compressed to near-zero as automation commodifies the diagnostic.\n\n**2. Strategic Evaluation.** Do not compete with manual kits. Sunset any Schwarzkopf branded paper-based scalp assessment guides. Concentrate investment on AI-powered diagnostics (smartphone app, camera-based scanning) where professional credibility creates moat. Manual kit revenue was never above 5% category margin; the savings redirect to AI platform development.`,
  'Generic hair type classification guides::contraction': `**1. Summary.** Classification systems (straight, wavy, curly, coily; thin, normal, thick) were useful when consumers had to manually sort themselves into treatment categories. T-01 (AI personalization) makes self-classification obsolete — the algorithm reads the hair and assigns a phenotype more accurately than the consumer's guess. Generic guides are informational clutter; AI results are actionable. Consumers abandon guides for algorithms.\n\n**2. Strategic Evaluation.** Remove generic classification guides from Schwarzkopf and Palette packaging and retailer POS. Replace with QR codes linking to the AI hair profiler (entry 15). The three-sentence classification guide adds zero margin and confuses consumers who prefer the algorithm's answer. Print cost savings are minimal; messaging clarity is the gain.`,
  'Weather/environment tracking (low engagement)::contraction': `**1. Summary.** Humidity-triggered product recommendations ("Use this serum on rainy days") had appeal in a static recommendation era. T-07 (AI personalization) shifts the baseline from external conditions (weather) to internal biology (scalp microbiome, hair porosity, hydration status). Environmental data is low-signal noise in a high-signal personalization system. Consumers ignore weather-based recommendations in favor of microbiome-match data.\n\n**2. Strategic Evaluation.** Eliminate weather-triggered messaging from Schwarzkopf's mobile app and email campaigns. Reallocate the personalization engine bandwidth to microbiome-driven recommendations (entry 19). Weather-based segmentation costs 80% of the personalization infrastructure for 5% of the engagement lift. This improves app UX and frees engineering resources for higher-ROI diagnostic features.`,
  'One-size-fits-all consultation models::contraction': `**1. Summary.** Generic "all hair types" messaging is incompatible with T-07 (AI personalization) and the premiumization consumer expectation. C-03 (premiumization) means consumers expect products formulated to their specific profile, not a one-size blitz. Brands that message to "everyone" signal they are undifferentiated commodities. The pool migrates to precision messaging and bespoke formulation.\n\n**2. Strategic Evaluation.** Audit all Schwarzkopf and Palette marketing messaging and remove generic copy ("For all hair types", "Works on every hair"). Replace with AI-gated customized narratives: users receive messaging and product recommendations based on their diagnostic profile (color, porosity, microbiome, damage index). Implement within 4 months using T-10 (Gen AI content generation) to auto-localize per-consumer messages at scale.`,
  'Scalp protection & comfort systems::expansion': `**1. Summary.** Pre-treatment scalp conditioning moves upmarket as consumers adopt multi-step routines ahead of color, heat, or styling. T-02 (bio-based chemistry) and C-04 (clean beauty) compress the gap between salon scalp-prep protocols and retail accessibility, forcing commodity comfort products to either upgrade or exit as consumers demand clinically-credible comfort over fragrance-led promises.\n\n**2. Strategic Evaluation.** Schwarzkopf Professional's scalp-health IP (90+ years trichological heritage) can anchor a Schwarzkopf consumer pre-treatment line: botanical comfort serum + protective mask at €8-12 entry price. Launch within 6 months before L'Oréal Série Expert mass-markets its salon formulas via Garnier bridge brand.`,
  'Bond builders (pre-color treatment)::expansion': `**1. Summary.** Bond-repair pre-treatments are the fastest-growing Hair premiumization sub-segment: Olaplex No. 0 created the category, K18 normalized peptide pricing ($28-50), and T-01 (AI-optimized bond science) plus T-14 (peptide bioactives) compress lab-to-shelf from 5 years to 18 months. The pool shifts from commodity pre-color rinses to clinical bond-preservation systems that command 3-5x margin.\n\n**2. Strategic Evaluation.** Gliss Kur has the mass-retail credibility for bond science — its liquid-keratin heritage positions repair, not just conditioning. Relaunch Gliss as a clinical bond-builder (peptide-enhanced pre-color treatment at €12-15) with Schwarzkopf Professional trichology proof points. Six-month window before K18 and Olaplex dominate mass distribution.`,
  'Heat & UV protectants (advanced)::expansion': `**1. Summary.** Advanced protectants incorporate T-02 (bio-based UV filters replacing restricted synthetics) and T-01 (AI-optimized polymer blends) to deliver durability, thermal stability, and sensory premiumization. G-03 cosmetics regulation tightens UV ingredient limits, but bio-alternatives (plant phenolics, mineral UV actives) create a compliance-driven product transition with margin uplift.\n\n**2. Strategic Evaluation.** got2b owns the youth styling protection space — its brand is synonymous with heat and color protection for Gen Z. Develop a nano-polymer protectant spray using bio-based UV and thermal-stable silicones, position as "science-first" versus commodity silicone sprays. Ship within 9 months; market lead is critical before P&G Pantene Defense launches a direct copy.`,
  'Anti-humidity & anti-frizz primers::expansion': `**1. Summary.** Climate volatility (E-05) drives year-round humidity stress in Northern Europe, extending the frizz-control season. T-01 (moisture-adaptive polymers) enable primers that respond to ambient humidity rather than static coating. The profit pool migrates from occasional-use styling products toward year-round essential regimens.\n\n**2. Strategic Evaluation.** Schwarzkopf Professional's Bonacure Moisture Kick serum is the salon validator. Launch a consumer Schwarzkopf Everyday Humidity Guard primer (lightweight, silicone-free, €9-11) for daily frizz control in humidity-stressed regions (Benelux, UK, Spain). Distribute via dm and Müller ahead of summer seasonal peak; L'Oréal's Elvive Extraordinary Oil monopolizes this occasion currently.`,
  'Scalp detox & exfoliation scrubs::expansion': `**1. Summary.** C-07 (scalp care emerges as standalone category) redefines pre-treatment from hair conditioning to scalp health. Exfoliating scrubs move scalp prep from niche salon service to retail habit, paralleling the skincare trend (40%+ of skincare consumers now exfoliate weekly). Pool grows from zero to €300-400M+ in EU alone as category awareness reaches mainstream.\n\n**2. Strategic Evaluation.** Schwarzkopf Professional has credibility here through salon scalp diagnostics. Launch a Schwarzkopf Scalp Detox Scrub (enzymatic, prebiotic-enhanced per T-04) as an entry-point scalp product at €7-9, merchandised as a prep ritual rather than treatment. Bind to Syoss Professional Care as an affordable tier. Six months to market before P&G Head & Shoulders launches a scalp scrub extension.`,
  'Pre-treatment precision applicators (tech)::expansion': `**1. Summary.** T-05 (manufacturing automation) enables precision-dispensing applicators that reduce product waste 30-40% and enable targeted sectioning without manual clips. Smart applicators (metered nozzles, color-lock tips) are currently premium-tier, but automation scale brings them to mid-market SKUs, improving consumer application success and efficacy claims.\n\n**2. Strategic Evaluation.** Schwarzkopf Keratin Color's refill system is the natural anchor. Add a precision-tip applicator bottle (T-05 injection-molded, not hand-assembled) to the refill for €2-3 uplift cost, positioning as "professional sectioning accuracy at home." Bundle into Keratin Color Premium tier; protect margin against private label color applicator knockoffs.`,
  'Pre-color pH adjustment products::expansion': `**1. Summary.** T-01 (AI-formulated pH optimization) and T-14 (peptide stability in target pH ranges) create a new pre-color step that stabilizes hair pH before pigment deposition, improving color fastness and reducing damage. This moves pre-color from protective rinses to active chemistry, commanding a dedicated SKU and margin pool.\n\n**2. Strategic Evaluation.** Position as a Schwarzkopf Keratin Color system add-step (pH Prep serum, €8-10). Sell via salon-to-retail crossover: Schwarzkopf Professional colorists recommend pH prep in-salon; Schwarzkopf consumer SKU enables home repeat. Launch within 9 months; category is nascent and first-mover takes the education phase before competitors copy.`,
  'Scalp barrier repair serums::expansion': `**1. Summary.** C-07 (scalp care category emergence) accelerates demand for barrier-repair serums targeting scalp inflammation, sensitivity, and microbiome disruption. T-04 (microbiome-aware formulation) enables prebiotic and postbiotic serums that repair, not just soothe. Premium market for scalp serums is growing 15-20% CAGR; retail penetration is <5% in EU, white space is structural.\n\n**2. Strategic Evaluation.** Syoss Professional Care can anchor a barrier-repair serum (ceramide + prebiotic per T-04) at €11-13. Position as a scalp health essential for color-treated or heat-damaged hair. Schwarzkopf Professional credibility validates the claim; distribute via Müller and Rossmann as a replenishment-driven SKU. Win the white space before L'Oréal Serioxyl extends into barrier science.`,
  'Basic pre-color treatments (commoditized)::contraction': `**1. Summary.** C-03 (premiumization) and category upgrade into bond-repair and scalp-barrier science compress the mid-tier pre-color treatment slot. Basic rinse-and-condition pre-treatments face margin collapse as consumer expectations shift toward clinical efficacy and sensory premiumization. Pool contracts 8-12% annually as SKU complexity consolidates upward.\n\n**2. Strategic Evaluation.** Harvest, do not defend. Consolidate Palette and Color Expert pre-treatment SKUs into a single functional prep step. Redirect trade investment and media into Schwarzkopf Keratin Color bond-repair upgrade and Gliss bond-builder positioning. Kill the mid-tier pre-treat line within 12 months; margin dollars flow to premium positioning.`,
  'Chelation treatments (niche, low awareness)::contraction': `**1. Summary.** Chelation (mineral/metal removal from hard water) is a niche, low-awareness category that requires patient education. T-07 (AI personalization) and connected-water diagnostics (T-08, smart home water treatment) make generic chelation obsolete: consumers will soon know exact water hardness and receive AI-recommended products, not shelf-browsed chelation treatments.\n\n**2. Strategic Evaluation.** Do not invest. Chelation is a victim of smart-home integration — once water hardness is measured and reported via IoT, generic chelation loses relevance. Instead, invest in precision water-responsive formulations (Schwarzkopf + Bosch partnership) that auto-adjust to local water hardness. Surrender the niche to clarity.`,
  'Manual sectioning clips & tools::contraction': `**1. Summary.** T-05 (automation) and T-01 (AI-guided precision dispensing) enable virtual sectioning guides via app and precision-applicator bottles, eliminating the need for manual clips. Hardware tools are margin-light and CLV-low; digital-guided application is margin-free but enables SKU upsells. The pool migrates from commodity tools to software and consumable guiding systems.\n\n**2. Strategic Evaluation.** Discontinue as a standalone SKU. Integrate sectioning guides into the Schwarzkopf app (tie to AI color advisor per T-01) and bundle precision applicators into Keratin Color SKU. Margin lives in the chemistry, not the clips. Reduce stock-keeping unit count and simplify retail compliance.`,
  'Generic heat protection sprays::contraction': `**1. Summary.** C-03 (premiumization) demand for advanced heat-protection formulas (nano-polymers, climate-adaptive coating) displaces generic silicone sprays. Basic thermal protection is commoditized and pushed to private label; branded margin pool contracts 15-20% as got2b and Schwarzkopf upgrade to advanced formulas and abandon the commodity segment.\n\n**2. Strategic Evaluation.** Exit commodity heat protection. Consolidate got2b and Taft spray lines into a single advanced thermal-protection offering (nano-polymer, bioactive repair per T-01). Kill SKU depth in basic heat spray tier; redirect shelf space to Gliss bond-repair or got2b premium styling range. Profitability through elevation, not volume.`,
  'UV-filter-dependent protectants (restricted ingredients)::contraction': `**1. Summary.** G-03 (cosmetics regulation tightening) restricts synthetic UV filters (benzophenone, octinoxate) and mandates broader SCCS safety testing windows, forcing reformulation. Current UV-dependent protectants lose regulatory approval 2027-2028; brands without bio-based UV alternatives face a sudden-death delisting. Pool migrates to biobased UV chemistries; products dependent on restricted synthetics exit.\n\n**2. Strategic Evaluation.** Audit Schwarzkopf Professional and Syoss UV product formulations now. Reformulate using T-02 (bio-based UV filters: plant phenolics, mineral UVB blockers) by Q4 2026 to pre-empt regulatory delisting. File safety dossiers 12 months before regulatory deadlines. Competitors without R&D agility will face forced delisting; HCB moves first.`,
  'Hair loss & thinning growth serums::expansion': `**1. Summary.** C-10 (hair loss enters consumer mainstream) is a structural category shift — tele-derm platforms (Hims, Hers, Ro) have built $2B+ run-rates in prescription hair-loss treatments (finasteride, minoxidil). Consumer mainstream acceptance means topical serums and supplements now carry clinical credibility. Henkel's white space is the salon-to-retail bridge: clinical credibility at mass pricing, between the $50+ niche (Nioxin) and $6 commodity (Head & Shoulders).\n\n**2. Strategic Evaluation.** Launch Schwarzkopf Trichology Serum (peptide + caffeine + bioactive growth factors, €16-20) anchored on Schwarzkopf Professional salon credibility. Position as the bridge between Nioxin niche and commodity anti-dandruff. Bundle with Syoss shampoo for a clinical routine. Window is 9 months before Unilever (Nutrafol owner) extends mass distribution into Dove/TRESemmé channel.`,
  'Scalp care & barrier repair products::expansion': `**1. Summary.** C-07 (scalp care emerges as standalone category) expands the profit pool from hair care into scalp health — distinct from dandruff treatment. Barrier repair, microbiome balance (T-04), and prebiotic/postbiotic formulations create a new sub-category growing 18%+ CAGR. Pool is moving from zero to €600M+ in EU as consumer awareness accelerates via social media education.\n\n**2. Strategic Evaluation.** Schwarzkopf Professional Scalp Therapy is the validation point. Launch a mass-market Schwarzkopf Scalp Balance line (shampoo + serum + mask, €6-12 tier) with prebiotic actives. Distribute via all channels. Position against P&G Head & Shoulders (commodity anti-dandruff) from above, and defend via Schauma entry tier below. Claim the category before L'Oréal Kérastase extends upward.`,
  'Regenerative scalp devices (LED, microcurrent)::expansion': `**1. Summary.** T-05 (manufacturing automation) enables precision-manufactured scalp-stimulation devices (LED, microcurrent, vibration) at consumer price points. Salon devices cost €300-1000; home versions now ship at €40-80 via T-05 miniaturization. Pool grows as devices become replenishment-paired with serums and treatments, creating multi-year customer lock-in.\n\n**2. Strategic Evaluation.** Partner with a consumer electronics OEM (e.g., Philips Avent division, or white-label Chinese ODM) to develop a Schwarzkopf Scalp Therapy LED device (€50-70 entry price, 2-year payback via serum replenishment). Position as a premium tier to Schwarzkopf Trichology Serum. Launch within 12 months; category is nascent and brand association drives adoption.`,
  'Anti-dandruff & sensitive scalp remedies::expansion': `**1. Summary.** C-07 (scalp care category emergence) reframes anti-dandruff from a commodity functional category into a clinical scalp health category. T-04 (microbiome-aware formulation) enables zinc pyrithione and ketoconazole replacements with prebiotic/postbiotic actives that address root causes, not just symptoms. Margin pool expands as "sensitive scalp remedy" becomes a distinct, premium-priced product line.\n\n**2. Strategic Evaluation.** Schwarzkopf Professional Scalp Therapy is the credible anchor. Launch Schwarzkopf Sensitive Scalp Remedy (prebiotic shampoo + barrier serum, €8-11) to sit between Schauma commodity anti-dandruff (€2-3) and premium clinical niches. Defend P&G Head & Shoulders from below via price, from above via clinical positioning. Win the largest white space in scalp care.`,
  'Dermatological consultation services::expansion': `**1. Summary.** C-10 (hair loss mainstream) and tele-derm DTC disruption (C-32, Hims/Hers/Ro at $2B+ run-rate) normalize direct consumer access to dermatological diagnosis. Henkel can anchor retail consultation services to drive product prescription: in-store scalp diagnostics tied to Schwarzkopf Professional trichology IP create a recurring consultation-to-purchase loop that competitors cannot replicate.\n\n**2. Strategic Evaluation.** Pilot Schwarzkopf Scalp Consultation in 50 premium Müller and Feelunique locations (Europe) via trained brand ambassadors. Offer 10-minute scalp diagnostics (visual, microbiome-aware education per T-04) and product prescriptions. Convert 30-40% of diagnostics into €30-50 product baskets (serum + treatment + supplement). Scale to 500 locations within 24 months before L'Oréal replicates.`,
  'Low-level light therapy (LLLT) scalp tools::expansion': `**1. Summary.** T-05 (manufacturing automation) and clinical validation of LLLT (red/near-infrared light) for hair growth enable consumer LLLT devices at scale. Salon LLLT sessions cost €50-100 per visit; home LLLT caps cost €60-150 with 2-3 year expected value, creating device-plus-serum bundled revenue. Pool grows from zero to €200M+ as devices become mainstream replenishment drivers.\n\n**2. Strategic Evaluation.** Develop a Schwarzkopf LLLT Scalp Comb (660nm LED, €80-100 retail) bundled with Schwarzkopf Trichology Serum. Clinical efficacy claims anchor credibility. Distribute via premium retailers (Sephora, Space NK) and Schwarzkopf Professional salons. Launch within 18 months; capture early-mover advantage before Dyson/Unilever enters with a prestige-tier device.`,
  'Prebiotic & probiotic scalp treatments::expansion': `**1. Summary.** T-04 (microbiome-aware formulation) enables prebiotic and postbiotic scalp treatments that preserve or restore scalp microbiome balance instead of killing microbes. Pool migrates from anti-microbial commodity (Head & Shoulders, zinc pyrithione) to precision microbiome science commanding 2-3x margin. Growth rate 18-22% CAGR as category awareness builds via social media education.\n\n**2. Strategic Evaluation.** Launch Schwarzkopf Scalp Biota Serum (prebiotic galacto-oligosaccharides + postbiotic lysates, €13-16) as a premium tier to Schwarzkopf Trichology. Position against L'Oréal Serioxyl from below via lower price, against DTC Vegamour via professional credibility. Scientist-led PR campaign in dermatology journals pre-launch. Ship within 12 months.`,
  'Nutritional supplementation programs::expansion': `**1. Summary.** C-05 (silver economy) and C-10 (hair loss mainstream) drive demand for hair-health supplement protocols. C-23 (wellness-to-beauty convergence) normalizes topical-plus-oral regimens: biotin, collagen, and marine proteins paired with serum/treatment as holistic hair-health systems. Pool grows as supplements become category-defining, not niche add-ons, scaling 15%+ CAGR.\n\n**2. Strategic Evaluation.** Acquire or partner with a nutraceutical brand (Nutrifol competitor, sub-€10M deal) and rebrand as Schwarzkopf Hair Health Supplement (peptides + biotin + marine collagen). Bind to Schwarzkopf Trichology Serum as a paired protocol (€35-40/month subscription). Leverage Unilever's Nutrafol deal as proof of category (they paid $1.5B for 300K subscribers); capture margin vs. acquisition.`,
  'Generic dandruff shampoo (commoditized)::contraction': `**1. Summary.** C-03 (premiumization) and C-07 (scalp care specialization) collapse the commodity dandruff-shampoo category. Generic zinc pyrithione and ketoconazole formulas face simultaneous pressure: upmarket migration toward prebiotic/barrier science, and downmarket pressure from private label. Pool contracts 12-15% annually as consumers either upgrade to clinical or downgrade to PL.\n\n**2. Strategic Evaluation.** Consolidate Schauma anti-dandruff SKU count (kill low-velocity variants). Reposition Schauma as a value gateway to scalp care — shampoo + (optional) diagnostic tie-in to Schwarzkopf Trichology upgrade. Use Schauma as the trade-down shield against PL; route incremental margin to Schwarzkopf Professional premium tier.`,
  'Water softening devices for hair::contraction': `**1. Summary.** T-08 (connected appliances & smart home) integrates water-treatment diagnostics into washing machines and showerheads (Bosch, Miele partnerships). Standalone water-softening devices for hair become obsolete as consumers receive real-time water hardness alerts and AI-recommended formulation adjustments via app. Hardware market collapses; software and precision formulation pools expand.\n\n**2. Strategic Evaluation.** Do not invest in standalone water-softening devices. Instead, partner with Bosch/Miele/Samsung (Henkel Smartwash) to embed Schwarzkopf formulation recommendations into machine-learning dashboards. When water hardness is detected, machine prompts Schwarzkopf product pairing. Margin lives in software data capture and recommendation, not hardware.`,
  'Life-phase condition-based programs::contraction': `**1. Summary.** T-07 (AI personalization at scale) and T-01 (AI-driven formulation) make static life-phase segments (teen, mature, aging) obsolete. Consumers expect dynamic, real-time personalization based on hair condition, microbiome status, and environmental factors — not age cohorts. Programs relying on demographic segmentation lose share to algorithm-driven customization; pool contracts for static segmentation, expands for dynamic.\n\n**2. Strategic Evaluation.** Retire Syoss life-phase product lines. Invest in Schwarzkopf AI hair advisor (app-based per T-01, T-07) that diagnoses real-time condition and recommends precise SKU. Consolidate Syoss and Schwarzkopf product lines into a unified recommendation engine. First-to-market wins; static segmentation becomes liability within 18 months.`,
  'Synthetic scalp cooling treatments::contraction': `**1. Summary.** T-02 (bio-based chemistry transition) and consumer preference for botanical actives make synthetic cooling agents (menthol derivatives, WS-3 replacements) subject to reformulation pressure. Bio-based cooling (spearmint, peppermint, eucalyptus) deliver equivalent sensory but demand premium positioning. Synthetic-only products lose margin as reformulation cost exceeds sales potential.\n\n**2. Strategic Evaluation.** Audit Schwarzkopf and Syoss cooling product formulations. Reformulate synthetic cooling agents with plant menthol equivalents (T-02). If reformulation cost >€500K per SKU, discontinue and migrate consumers to upgraded Schwarzkopf premium tier. Avoid holding slow-moving SKUs through regulatory or reformulation transitions.`,
  'Mass-market anti-hair-loss treatments (indie pressure)::contraction': `**1. Summary.** X-04 (DTC & indie brand disruption) — Olaplex, K18, Virtue, Nutrafol — have captured the fastest-growing hair-loss sub-segment through social credibility and premium positioning. Mass-market anti-hair-loss products (P&G, unbranded generics) face contraction as consumers trade up to indie brands with stronger digital presence and clinical proof. Pool contracts 8-10% annually as indie pressure widens.\n\n**2. Strategic Evaluation.** Schwarzkopf Professional's trichological IP is HCB's only structural defense. Launch Schwarzkopf Scalp Trichology Serum (€16-20) positioned at indie pricing but with 90+ years salon credibility (vs. Olaplex 10 years, K18 5 years). Beat Nutrafol on price, beat Virtue on professional validation. 12-month window to establish position before Unilever scales Nutrafol distribution.`,
  'Permanent & demi-permanent color (advanced)::expansion': `**1. Summary.** Premium permanent and demi-permanent color is the structural beneficiary of C-03 premiumization (consumers upgrading to salon-grade efficacy at retail price points). European at-home color market tilts toward advanced formulations with bond protection, condition-in-color, and ingredient transparency — the pool migrates from basic box color toward clinical-grade performance at €12-18 price points, away from sub-€5 budget alternatives.\n\n**2. Strategic Evaluation.** Schwarzkopf Keratin Color and Color Expert are HCB's load-bearing assets; defend against L'Oréal Excellence (premium positioning, 4x media spend) and Garnier Nutrisse (mainstream accessibility). The move: upgrade Palette into a two-tier system — Palette Advanced (clinical bond preservation, color-true fading) for premiumization buyers, keep Palette Core for value defense. Lock the shelf with Schwarzkopf Professional trichological IP borrowed to the consumer tier within 18 months.`,
  'Balayage, highlight & brow tints::expansion': `**1. Summary.** Creative color (balayage, highlights, tonal brows) sits at the intersection of salon premium (K-07 salon crossover at $23.4B, 63% B2C) and premiumization (C-03). Consumers are willing to pay €15-25 for at-home balayage and brow color systems that previously required €60+ salon appointments. The pool expands when retail captures the salon occasion without compromising quality perception.\n\n**2. Strategic Evaluation.** Live (Henkel's fashion-color line) is positioned for this but underfunded. L'Oréal Colorista and Garnier Nutrisse Crème both own this space. HCB's move: launch a Live Professional Studio line with precision applicators and shade-matching AI (T-07 personalization) that targets the 25-40 consumer seeking salon results at home. Window: 12 months, before L'Oréal escalates Colorista investment.`,
  'Bond repair & strengthen treatments::expansion': `**1. Summary.** Bond-repair chemistry (GHK-Cu peptides, amino acid complexes) moved from salon back-bar additive to mass-consumer premium category in 18 months. T-01 (AI-driven formulation) and T-14 (peptide bioactives) compress R&D cycles, enabling rapid category-following for brands with credible science. Gliss owns the keratin heritage; the pool expands when science-backed bond claims land at €12-16 price points, capturing the Olaplex-K18 premiumization wave without indie pricing.\n\n**2. Strategic Evaluation.** Gliss Kur positioned as clinical-grade bond repair (not just conditioning) competes directly against Olaplex No. 3 and K18 mask — but with 3x the retail distribution and a trusted European name. Fund a Gliss Bond Science campaign with clinical trial data (Schwarzkopf Professional's trichology IP) and launch a mask + serum protocol. Execute in 12 months or concede the segment to K18's mass-market extensions.`,
  'Texture changers (perms, relaxers, keratin)::expansion': `**1. Summary.** Texture-changing chemistry is shifting away from damage-heavy formulas toward T-02 (bio-based safer formulas) — keratin treatments and perm systems using plant-derived actives, enzyme-based relaxers, and microbiome-safe chemistry (T-04). The pool expands as safety perception improves and global textured-hair consumers (C-24 — 65% of world population with curly/coily hair) move from salon-only to retail home-use options at premium pricing.\n\n**2. Strategic Evaluation.** Schwarzkopf Keratin Color has a formulation footprint but no dedicated texture-change system. Competitors: L'Oréal Kérastase Discipline (salon), Cantu and SheaMoisture (textured-hair specialists in US, absent in Europe). HCB's move: develop a Schwarzkopf Texture Science line leveraging Professional trichology IP, targeting European textured-hair consumers with bio-based, microbiome-safe formulas (T-02 + T-04). Market entry in 15 months or forfeit the fastest-growing hair segment.`,
  'Salon coloration & blending services::expansion': `**1. Summary.** Salon color blending and custom toning services command €80-150 per appointment; K-07 (professional-retail crossover) enables brands to capture service economics via retail product bundles — e.g., a salon appointment followed by a month of at-home toner + protectant purchases. The pool expands when retail-side SKUs are engineered to extend salon results between appointments, creating a subscription-like replenishment dynamic.\n\n**2. Strategic Evaluation.** Schwarzkopf Professional (Igora, BlondMe) owns salon blending; the consumer play is bundling Schwarzkopf retail color + toner + serum as a "Salon at Home" system. Target Schwarzkopf Professional salons with co-marketing: "Take home your blend" — retail products that mirror salon formulas. Partner with top 500 salons in Germany, UK, France for exclusive retail bundling. Window: 9 months, before L'Oréal Kérastase doubles down.`,
  'Color application tools (precision devices)::expansion': `**1. Summary.** T-05 (manufacturing automation) and precision electronics enable color-application tools with dosing accuracy, heat-assist, and visual feedback — moving from basic brushes to semi-automated systems. The pool shifts from commodity applicators (€1-2) to precision devices (€20-35) that promise fewer drips, better coverage, and less hair damage. Consumers pay for accuracy; brands monetize the tools as the high-margin accessory.\n\n**2. Strategic Evaluation.** Schwarzkopf has the formulation scale but not the precision-tool capability. L'Oréal and P&G have invested in beauty-tech hardware. HCB's move: license precision applicator IP from a hardware partner (examine Shark/Beauty Labs deals) and bundle with Schwarzkopf Keratin Color as a "Pro Application System" at €18-22 price point. Pilot in Germany by Q4 2026.`,
  'Brow, lash & hair growth serums::expansion': `**1. Summary.** C-10 (hair loss treatments entering mainstream) extends into brow and lash care — a white space where consumers previously had no branded consumer options. Peptide serums, biotin, and microbiome-aware formulas (T-14, T-04) enable clinical-grade hair-growth positioning at mass-retail accessibility. The pool expands at €15-30 price points as Gen Z and millennial consumers buy growth serums as a routine category, not a remedial one.\n\n**2. Strategic Evaluation.** Schwarzkopf Professional trichology IP is the credible foundation. Got2b's youth positioning is the distribution vehicle. Competitor: Unilever owns Vegamour through acquisition; Nutrafol commands premium. HCB's move: launch a got2b Brow & Lash Growth serum (peptide-based, dermatologist-tested clinical data from Schwarzkopf Professional research) as a youth-targeted, TikTok-native product. Market by Q2 2026.`,
  'Digital color matching & consultation::expansion': `**1. Summary.** T-01 (AI-driven formulation) and T-07 (personalization at scale) compress what was a 30-minute salon consultation into a 2-minute app diagnostic — skin tone analysis, existing color history, damage assessment, and shade recommendation. The pool expands as digital diagnosis moves upmarket: €10-30 for premium app-based consultation vs. €0 for free box-color guidance. Brands that control the diagnosis control the SKU prescription.\n\n**2. Strategic Evaluation.** Schwarzkopf has the science credentials but lacks the app infrastructure. L'Oréal Modiface (AR shade preview) is the incumbent. HCB's move: partner with a beauty-tech platform (e.g., Revlon's Color IQ equivalent) or acquire a color-matching startup and brand it Schwarzkopf Digital Studio. Integrate with Schwarzkopf e-commerce to drive recommendation-to-purchase. Soft launch Q3 2026.`,
  'Professional-grade at-home color systems::expansion': `**1. Summary.** K-07 (salon-retail crossover, $23.4B market with 63% B2C opportunity) creates a structural opening: professional colorists now sell clients take-home color systems for touch-ups, blending, and monthly maintenance — blurring the salon-vs.-retail line. The pool expands as brands position at-home systems as "salon extensions," not "budget alternatives." Price points €18-28 signal professional-grade credibility while remaining retail-accessible.\n\n**2. Strategic Evaluation.** Schwarzkopf Professional (Igora, BlondMe) is the salon authority; Schwarzkopf retail (Palette, Color Expert) holds mainstream distribution. Madison Reed and eSalon own the subscription space from DTC. HCB's move: create a Schwarzkopf Pro System line sold both through salons (via Schwarzkopf Professional channel) and retail (via Schwarzkopf consumer), with a unified subscription/auto-replenish option. Target 100 leading European salons + Amazon Subscribe & Save within 12 months.`,
  'Temporary color (declining vs. permanent)::contraction': `**1. Summary.** C-03 (premiumization) and C-04 (conscious consumption) are squeezing temporary color: consumers who want expression migrate to permanent/demi-permanent for longevity, while eco-conscious buyers resist single-use gimmick products. Temporary color sits awkwardly — too expensive for play, too temporary for serious style. The pool contracts as fashion color gets cannibalized by Live (demi-permanent) from above and private label basics from below.\n\n**2. Strategic Evaluation.** Got2b owns temporary color in Europe (sprays, chalks, waxes). Live is Henkel's fashion-permanent play. L'Oréal Colorista (demi-permanent) is eating temporary's lunch. HCB's move: consolidate temporary under got2b as a value occasion (festival, party, one-off) at €3-6 per use, but shift volume investment to Live permanent. Treat temporary as a recruitment funnel to demi-permanent, not a growth business.`,
  'Basic shampoos & cleansers (frequent use decline)::contraction': `**1. Summary.** C-03 (premiumization) is reframing shampoo from a commodity to a specialty category. Consumers are extending wash intervals (wearing outfits 2-3x, increasing textile longevity per C-29 and E-08), reducing shampoo frequency, and when they do wash, buying treatment-focused products instead of basic cleanse-and-go formulas. The pool contracts as frequency declines and consumers trade frequency for quality per wash.\n\n**2. Strategic Evaluation.** Schauma holds basic shampoo; Syoss and Schwarzkopf own premiumization. P&G Pantene and L'Oréal Elvive dominate the space. HCB's move: harvest Schauma for margin (reduce promotional intensity), and redirect shelf and media investment into Syoss and Schwarzkopf treatment lines. Position treatments as "wash replacements" (every-other-wash options) to capture wallet without frequency dependency.`,
  'Gray blending (niche positioning)::contraction': `**1. Summary.** C-05 (silver economy and aging population) suggests gray-care growth, but in practice consumers prefer full gray coverage (permanent color) or embracing gray authentically — both of which move away from "blending" as a category. Gray blending occupies a shrinking middle: too visible for comfort, too expensive for trial. Color coverage and authentic gray messaging both outcompete the blending niche.\n\n**2. Strategic Evaluation.** Schwarzkopf Palette targets gray cover; got2b ignores gray. L'Oréal and Clairol own gray category positioning. HCB's move: eliminate gray-blending SKUs as distinct offering. Instead, position Palette as dual-benefit: "covers grays" and "blends seamlessly for dimensional depth" — collapsing blending into mainstream permanent color. Simplify the portfolio.`,
  'Synthetic wigs & hair systems (stigma)::contraction': `**1. Summary.** C-03 (premiumization) and authentic-beauty cultural shift (moving away from hair-extension stigma toward textured-hair acceptance) are shrinking the wig market. Consumers who want transformation now buy color, who want volume buy treatments, who want length buy extensions as a service (salon-applied, premium-positioned). Synthetic wigs remain stigmatized as "cover-ups" vs. authentic expressions of identity.\n\n**2. Strategic Evaluation.** Henkel has no meaningful wig business; this is a monitoring entry. Competitors: Monat, Bellami, and indie brands. HCB's move: irrelevant here, but note that textured-hair growth (C-24) and authentic identity messaging create openings for treatment products that enhance natural hair rather than replace it — a Schwarzkopf positioning opportunity.`,
  'Budget color boxes (home-use)::contraction': `**1. Summary.** C-11 (Gen Z dupe culture and ingredient literacy) initially signals budget-color demand, but C-03 premiumization wins the structural battle. Gen Z seeks cheap *good* products, not cheap products full stop — they read ingredient lists and skip budget boxes that are damage-heavy. Private label at 42% EU6 value share is the real budget destination; branded budget boxes get squeezed from above (premiumization) and below (PL).\n\n**2. Strategic Evaluation.** Palette and Live serve budget-conscious buyers, but they're moving upmarket into premiumization. True budget-box competitors (Casting Crème Gloss, Schwarzkopf Color Mousse, basic Live boxes) are under margin pressure. HCB's move: concede the ultra-budget tier to private label and focus Palette on the value-to-affordable-premium transition (€6-10). Invest in "clean ingredient" positioning within the Palette line to capture Gen Z upgraders.`,
  'Mid-price permanent color (squeezed middle)::contraction': `**1. Summary.** The mid-price branded color tier (€8-14) is being eaten from both ends: C-01 and C-06 push value-conscious buyers into private label at 42% EU6 value share, while C-03 premiumization pulls wallet-available consumers toward Schwarzkopf Premium, Excellence, and indie brands at €12-20. X-13 (retailer vertical integration) further squeezes margin. The pool contracts as the middle becomes a funding line for retailer own-label investment.\n\n**2. Strategic Evaluation.** Color Expert and basic Palette lines are in this crossfire. L'Oréal Excellence is under-threatened (brand equity pulls premiumization buyers). Garnier Nutrisse sits here and is losing velocity. HCB's move: pull SKU complexity out of the mid tier — rationalize Color Expert down to 6-8 core shades, redirect trade and media into Schwarzkopf Premium (premiumization play) and consolidate value defense into Palette. Stop fighting the middle; exit it cleanly.`,
  'Standard salon-quality retail products::contraction': `**1. Summary.** X-02 (Unilever Beauty & Wellbeing pivot to €50.5B, with massive Hair investment) and X-03 (P&G superiority framework) are redoubling R&D and media into salon-quality positioning. Generic "salon-quality" retail claims are now table-stakes, not differentiators. The pool contracts as claims proliferate and only brands backed by measurable clinical evidence (Olaplex, K18, soon Schwarzkopf Professional IP) command the premium shelf.\n\n**2. Strategic Evaluation.** Schwarzkopf and Syoss claim salon credibility but lack clinical proof points visible to mass consumers. TRESemmé (Unilever) and Pantene (P&G) are advertising superiority constantly. HCB's move: fund clinical studies backing Schwarzkopf Professional trichology IP (bonding, scalp science, color longevity) and translate results into Schwarzkopf and Syoss consumer messaging. Invest in third-party certifications (dermatologist testing, Vegan OK, cruelty-free) to justify premium claims. Execute within 12 months or lose premiumization momentum.`,
  'pH balance & neutralization systems::expansion': `**1. Summary.** Color-treated hair requires post-color pH restoration to lock cuticle closure and extend fade resistance — T-01 (AI optimization) enables formulators to engineer pH-stabilizing systems as distinct products, not just additives. The pool expands as brands separate pH neutralization from conditioning: pH balance at €8-12 becomes a standalone step, increasing transaction count and average basket size per color purchase event.\n\n**2. Strategic Evaluation.** Schwarzkopf Professional has pH science; consumer tier lacks a branded neutralization step. L'Oréal Colorista (demi-permanent) bundles a color-balancing rinse; Excellence includes one. HCB's move: launch a Schwarzkopf Color Lock pH Rinse (branded separately, positioned as a required post-color step) to bundle with Palette, Color Expert, and Keratin Color at €9 price point. Educate colorists and consumers that pH lock = longer color life. Soft launch Q3 2026.`,
  'After-color bond protection / cuticle sealing::expansion': `**1. Summary.** T-01 (AI bond preservation) and T-14 (peptide bioactives) enable post-color serums that actively protect color molecules and reseal cuticles — moving beyond passive moisturizing. The pool expands as consumers understand that color longevity is a protocol (shampoo → condition → pH balance → bond seal), not a single product. Each step monetizes separately, increasing revenue per color event from €12 (one bottle) to €25-35 (protocol bundle).\n\n**2. Strategic Evaluation.** Gliss owns post-treatment positioning; Schwarzkopf owns color science. L'Oréal Colorista and Excellence bundles include color-protecting treatments, but positioning is vague. HCB's move: create a Gliss Color Seal serum (positioned explicitly: "bonds and protects color molecules from fade") and bundle with Schwarzkopf color purchases as a €6-8 add-on. Drive attachment rate via retail bundling and e-commerce recommendation. Target 25% bundle penetration within 12 months.`,
  'Color stabilizers & color-lock serums::expansion': `**1. Summary.** T-01 (AI color chemistry) enables formulation of serums that actively bind and stabilize color pigments in the hair cortex — a step beyond conditioning. Brands now sell color-lock as a functional category with measurable fade resistance (5+ wash durability claims) at premium price points (€12-18). The pool expands as consumers shift from "color that fades naturally" to "color I actively maintain," increasing frequency and basket size.\n\n**2. Strategic Evaluation.** This is existential for Schwarzkopf — color lock is the downstream monetization of color superiority. Gliss can position bond protection here (natural keratin heritage). L'Oréal Excellence and Colorista own color-lock serums in their bundles. HCB's move: launch a Schwarzkopf Color Shield serum (€14-16, positioned as the "professional color-lock system for retail") as the required maintenance step after Schwarzkopf color. Educate: weekly use = 50% longer color life. Execute within 9 months.`,
  'Premium hair perfumes & scent finishing::expansion': `**1. Summary.** C-09 (fragrance premiumization) and T-17 (neurocosmetics and sensory-science) are elevating hair perfume from a commodity (€3-5 gimmick) to a functional, neuro-backed finishing category. Consumers now pay €12-20 for scents engineered for specific cognitive/emotional outcomes (focus, calm, social confidence). The pool expands as scent finishing is repositioned from "just smells nice" to "measurable sensory and psychological benefit." Indie premium brands (Moroccanoil, Oribe) dominate; mass brands are absent.\n\n**2. Strategic Evaluation.** Taft has hairspray distribution; got2b has youth reach. Neither owns fragrance finishing. L'Oréal Elnett and indie brands control the space. HCB's move: partner with a neurocosmetics research firm (IFF, Givaudan have neuro labs) to develop a got2b Sensory Finishing line (two SKUs: Calm and Confidence, €13-15 each, with EEG-validated benefits). Launch as TikTok/Sephora exclusive. Window: 15 months, before Unilever enters the category.`,
  'Post-color stabilization services::expansion': `**1. Summary.** K-07 (professional salon crossover) enables salons to sell post-appointment stabilization services (pH-balance rinses, bonding treatments, color-lock serums applied in-salon) for €15-30, with retail take-home products completing the protocol. The pool expands when salons and retail coordinate: salon service → retail continuation → subscription replenishment, creating a service-to-commerce revenue stream.\n\n**2. Strategic Evaluation.** Schwarzkopf Professional (Igora) owns the salon relationship. Schwarzkopf retail (Palette, Color Expert) owns consumer distribution. Competitors: L'Oréal (Kérastase services + Colorista retail bundle). HCB's move: develop a Schwarzkopf Professional Color Stabilization Service Kit (in-salon pH rinse + bonding treatment) paired with a take-home Schwarzkopf Color Lock serum. Train 200 leading European salons on the service, with retail referral links. Soft launch Q2 2026.`,
  'Color-protective oil treatments::expansion': `**1. Summary.** T-02 (bio-based chemistry) enables plant-derived color-protective oils that replace petrochemical silicones — positioning as both condition-protecting AND environmentally conscious. The pool expands as consumers adopt color-protecting oils as a pre-wash treatment (5 minutes, €8-12 per use), increasing transaction count. Bio-based positioning commands 20-30% price premium over silicone equivalents.\n\n**2. Strategic Evaluation.** Gliss Kur has oil heritage; Schwarzkopf owns color science. Competitors: Moroccanoil (premium, €35+), Unilever TRESemmé (commodity, €6). HCB's move: launch a Gliss Color-Protect Oil derived from certified sustainable sources (upcycled plant oils, T-02 positioning) at €9-12. Position as "salon pre-treatment in a bottle." Bundle with Schwarzkopf color purchases. Emphasize biodegradability and conscious consumption (C-04, G-05). Execute Q3 2026.`,
  'Ionic sealing hair tools::expansion': `**1. Summary.** T-05 (manufacturing automation) enables precision production of ionic-sealing tools (ionic hairbrushes, combs with micro-current sealing) at consumer-accessible price points (€25-45). The pool expands as consumers combine post-color product (serum, oil) with mechanical sealing tools, increasing basket and repeat purchase frequency. Tools also command recurring blade/brush replacement revenue.\n\n**2. Strategic Evaluation.** Henkel has no hair-tool business; this is an ecosystem opportunity. Competitors: GHD, Dyson Beauty, indie brands. HCB's move: license or partner with a beauty-tech hardware OEM to develop a Schwarzkopf Color-Seal ionic tool and bundle with color-lock serums. Alternatively, acquire a small hair-tool startup with ionic technology and brand it Schwarzkopf. Position as the "professional sealing system for colored hair." Explore 12-month horizon.`,
  'Basic hold & fix products (commoditized)::contraction': `**1. Summary.** C-03 (premiumization) is eliminating the basic hold tier. Consumers who want strong hold are willing to pay €6-10 for performance formulas (waxes, pastes with texture) that deliver lasting hold + style without crunch. Commodity gels and sprays at €3-4 are squeezed: too weak to justify purchase, too unsophisticated for premiumization consumers. The pool contracts as the basic tier collapses into private label and the viable margin moves upmarket.\n\n**2. Strategic Evaluation.** Got2b owns basic styling; Taft owns hairspray. Both are harvesting basic hold for margin, not growing. L'Oréal Elnett (premium hairspray) and indie brands (Oribe, R+Co) own the premium space. HCB's move: eliminate basic-hold gel SKUs from got2b and Taft. Focus got2b on premium texture products (waxes, pastes, clays at €7-9) for youth. Treat Taft as a super-premium hairspray line (€8-12) for the classic consumer. Exit the commodity hold business entirely.`,
  'Shine-only products (low differentiation)::contraction': `**1. Summary.** T-01 (AI formulation) has made simple shine boosters obsolete. Brands now position finishers with compound benefits: shine + color lock, shine + bond protection, shine + neurocosmetic fragrance. Consumers no longer pay €4-6 for shine-only products when €8-10 gets them shine + functional benefit. The pool contracts as single-benefit finishers lose viability to multi-benefit premiumized alternatives.\n\n**2. Strategic Evaluation.** Got2b and Taft include shine sprays in their ranges; neither emphasizes them. L'Oréal and premium indie brands embed shine in multi-benefit serums. HCB's move: eliminate shine-only spray SKUs. Reposition remaining shine products (if any) as one benefit in a multi-benefit serum bundle (e.g., "Shine + Color Seal"). Clean up the portfolio; move the space and margin toward functional finishing.`,
  'Conventional plastic hair accessories::contraction': `**1. Summary.** C-04 (conscious consumption) and G-04 (PPWR packaging waste regulation mandating recycled content and reduction by 2030) are eliminating single-use plastic accessories. Consumers and regulation jointly squeeze plastic clips, combs, and hair ties out of branded listings. The pool contracts as plastic accessories migrate to private label (if at all) and eco-conscious consumers switch to reusable metal and biodegradable options.\n\n**2. Strategic Evaluation.** Henkel has minimal accessories business. This is a competitive-positioning play. L'Oréal and Unilever are transitioning accessory lines to recycled plastic and compostable materials. HCB's move: if Schwarzkopf or got2b carry accessories, transition to recycled-plastic and metal options immediately (by Sept 2026, before PPWR compliance tightens). Otherwise, deprioritize. Focus volume investment on formulated products where HCB has proprietary advantage.`,
  'Cheap fragrance finishing sprays::contraction': `**1. Summary.** C-09 (fragrance premiumization) is bifurcating the finishing-spray market: premium neurocosmetic fragrances (€12-20, with sensory and emotional claims) are expanding, while cheap fragrances (€3-5) are collapsing. Budget fragrance finishing offers no differentiation vs. body spray; premium fragrance finishing commands margin and loyalty. The pool contracts in the budget tier and expands in the premium tier.\n\n**2. Strategic Evaluation.** Got2b and Taft include budget fragrance sprays; neither has premium fragrance IP. Competitors: L'Oréal Elnett (premium scent reputation), indie brands (Oribe, Moroccanoil, R+Co). HCB's move: eliminate cheap fragrance spray SKUs from got2b and Taft. Launch a single premium fragrance finishing spray (€14-16) through got2b in the youth space, partnered with a perfumery house (T-17 neurocosmetics positioning). Consolidate into one hero SKU. Execute Q2 2026.`,
  'Unsubstantiated "natural" finishing products::contraction': `**1. Summary.** G-05 (Green Claims Directive, enforceable Sept 2026) is eliminating unsubstantiated "natural" and "eco" claims from finishing products. Brands making generic "plant-derived" or "natural hold" claims without measurable proof will be de-listed or face regulatory fines. The pool contracts as brands with unsubstantiated claims exit, and only brands with third-party certified proof (NATRUE, Ecocert, dermatological testing) retain listings.\n\n**2. Strategic Evaluation.** Got2b and Taft finishing products likely carry soft "natural" language that fails G-05 scrutiny. Competitors: indie brands leading on certified organic/natural positioning. HCB's move: audit got2b and Taft finishing product claims immediately; remove all unsubstantiated language by August 2026. Invest in third-party certifications (NATRUE, Ecocert) for any product claiming naturalness. Alternatively, pivot to functional claims (hold strength, color protection) with clinical proof, dropping naturalness language entirely.`,
  'Color protection systems (UV, heat, pollution)::expansion': `**1. Summary.** UV and heat damage pool expands as hairdryer and styling-tool ownership rises with remote-work flexibility and social consumption. T-01 (AI formulation) accelerates optimization of UV-absorber and heat-shield chemistries into mass SKUs; T-02 (bio-based transition) upgrades mineral sunscreen positioning from commodity beach-care overlay to premium routine staple. Consumers pay 2-3x for clinically proven color-hold benefits, collapsing what was category nicety into non-negotiable maintenance step.\n\n**2. Strategic Evaluation.** Schwarzkopf Professional's trichological credibility anchors a color-protection system for consumer retail: pre-shampoo serum + color-lock rinse + UV-defense leave-in spray. Position against P&G Pantene's single-benefit messaging and L'Oréal Elvive's generic treatment claims. Launch within 18 months via Schwarzkopf core, with Gliss as the accessible entry point. The margin pool tilts toward whoever credentials the science first.`,
  'Climate-adaptive protection shields::expansion': `**1. Summary.** Extreme weather volatility (E-05: climate-driven pest, allergen, and humidity shifts) reshapes Hair care as a seasonal adaptation problem, not a static routine. Consumers in high-humidity zones, pollen-heavy regions, and heat-stress climates purchase category-specific formulas; regional variants increase SKU count and allow pricing variation. T-02 (bio-based) ingredients enable region-by-region microdosing of actives, turning what was a global formula into a local prescription.\n\n**2. Strategic Evaluation.** Schwarzkopf's geographic distribution footprint (strong in IMEA, X-06: 12.1% organic growth) enables rapid roll-out of climate-specific sub-ranges: monsoon-adapted frizz control for India, Sahel heat-shield for Africa, alpine humidity control for Alpine Europe. Competitor L'Oréal's centralized R&D resists localization; achieve 6-month speed-to-market advantage by designing locally, validating globally. Capture first-mover premiumization window before private label recognizes the trend.`,
  'Anti-frizz & smoothing sprays (advanced)::expansion': `**1. Summary.** C-03 (premiumization) accelerates frizz-control into a distinct ritual tier with $8-15 entry price vs. $3-4 commodity baseline. T-01 (AI humidity-resistance modeling) encodes climate-specific, hair-type-specific formulation into spray bottles; consumers see "humidity-adaptive polymer matrix" on shelf and perceive clinical pedigree absent from incumbents. Switching cost is behavioral: daily use in styling routine locks replenishment.\n\n**2. Strategic Evaluation.** got2b commands youth styling-occasion ownership; upgrade the dry-spray portfolio into a climate-responsive line (Sahara-level frizz, humidity, UV exposure each coded into separate SKU). Competitors Unilever TRESemmé and L'Oréal Elnett lead in prestige channels, but got2b's social-native positioning ($200B retail media, K-04 social commerce) captures discovery. Launch on TikTok Shop first; retail follow within Q2 2026. This is the highest-margin expansion vector in styling.`,
  'Scalp stimulation & regeneration devices::expansion': `**1. Summary.** T-05 (manufacturing automation) enables at-home scalp-massage and microvibration devices to reach €20-40 entry price; T-04 (microbiome-aware formulation) pairs hardware with microbiome-safe serums. Category entry (Dyson Airstrait crossover, beauty tech) is pre-purchase moment; brands that anchor the device → serum bundling capture recurring serum revenue, not just one-time hardware margin.\n\n**2. Strategic Evaluation.** Schwarzkopf Professional owns trichological IP but lacks consumer DTC hardware distribution. Partner with an IoT appliance OEM (Panasonic, Braun, or Dyson adjacent) to co-badge a device, bundled with Schwarzkopf scalp-care serum formulation. L'Oréal and Unilever have no hardware advantage; this is a whitespace capture. Hardware + subscription serum (K-06) creates $60/quarter recurring revenue per user. Launch pilot 2026, scale 2027.`,
  'Biological support (ingestibles, supplements)::expansion': `**1. Summary.** C-10 (hair loss treatments) and C-05 (silver economy: aging population) unlock consumer appetite for ingestible hair-health protocols. Henkel's oral biotin, collagen, peptide supplements marry with topical treatments; the ingestible market (€6B EU, 12% CAGR) is structurally margin-accretive because DTC subscription (K-06) capture rate is 4x higher than topical SKUs. Unilever (Nutrafol) already owns the beachhead; HCB entry is now-or-never acquisition or organic launch.\n\n**2. Strategic Evaluation.** Schwarzkopf Professional's anti-thinning positioning (salon pedigree + clinical credibility) bridges pharmaceutical-grade supplement claims. Acquire or partner with a clinical nutraceutical brand (Vitafol, Viviscal, SugarBearHair-adjacent), co-brand with Schwarzkopf, and deploy subscription fulfillment via Henkel's e-commerce infrastructure. Gross margin on ingestibles is 70%+ vs. 45% topical. This expands Hair care addressable market by €200M+ EU within three years.`,
  'Condition tracking & smart reminders (app)::expansion': `**1. Summary.** T-07 (AI personalization) embeds hair-condition diagnostics into a branded mobile app: photo-to-scalp-health scoring, product-rotation reminders, replenishment automation. App becomes discovery layer where Henkel owns the diagnostic moment before competitor recommendations land. Switching friction rises because the app holds three years of consumer history; churn drops 20-30% vs. non-app cohorts.\n\n**2. Strategic Evaluation.** Build the Schwarzkopf Hair Health Coach app (branded consumer app, anchored to Schwarzkopf Professional's diagnostic credibility). Integrate with Henkel e-commerce and subscription (K-06) for one-tap reorder. Competitors L'Oréal and P&G have not launched consumer diagnostics apps at scale; timing is 12-month window before app saturation. First-mover captures data on condition trends, reformulation insights, and behavioral adhesion worth €50M+ NPV over 5 years.`,
  'Subscription / programmatic care services::expansion': `**1. Summary.** K-06 (subscription lock-in) applied to Hair care bundles multiplies basket size 3-4x: monthly shampoo + weekly mask + bi-weekly treatment + leave-in serum + color-touch-up spray. Consumers commit to a four-step routine, increasing replenishment frequency and LTV. DTC subscription (Prose, Function of Beauty) captures 40% margins; Henkel retail-direct subscription achieves 55% margins, no middleman. Market signals show 8%+ CAGR in Hair subscription categories.\n\n**2. Strategic Evaluation.** Gliss Premium Care Subscription: tier 1 (€15/month: shampoo + mask), tier 2 (€28/month: + serum + leave-in), tier 3 (€45/month: + professional-grade anti-thinning protocol). Launch direct-to-consumer via henkel.com (capturing Schwarzkopf Professional subscriber data via salon partnerships) by Q3 2026. Competitors Unilever and P&G have no subscription footprint; target early-adopter millennials and Gen Z. Gross margin expansion is 200 bps year one; LTV is 4x+ higher than transactional cohorts.`,
  'Weekly intensive treatment protocols::expansion': `**1. Summary.** C-03 (premiumization) shifts mindset from "treatment is occasional" to "treatment is weekly essential." Gliss Kur heritage credibility + Schwarzkopf Professional's bond-repair science converge on a four-step weekly ritual: pre-treatment + mask + serum + leave-in rinse. Each step is €8-15; consumer pays €40-50/week instead of €5 for single shampoo. Routine bundling increases portfolio spend per consumer 8-10x without price-per-unit increase.\n\n**2. Strategic Evaluation.** Launch Gliss Intensive Care Weekly Protocol (1x week + 1x mask + 1x serum + 1x leave-in = €42 per box, 4-week supply). Position against Olaplex No. 3-7 routines at 1/2 price point with Schwarzkopf Professional trichology backing. Retail placement: create dedicated four-shelf set in Hair care (protocol bundling increases impulse bundling by 35%). Drive awareness via TikTok Shop (K-04) creator collaborations. Gross margin is 55%+ vs. 38% single SKU. Full launch Q2 2026.`,
  'Personalized rinse cycle optimization::expansion': `**1. Summary.** T-07 (AI personalization) + T-08 (connected appliances) allow formulators to recommend water-temperature and rinse-timing protocols based on hair texture, treatment history, and water hardness. App sends "cold-rinse lock" notifications; consumers perceive treatment efficacy increase. This is psychological lock-in: the app prescribes the use, not just the product. Enables Henkel to sell to consumers' shampoo + app bundle, creating sticky moat.\n\n**2. Strategic Evaluation.** Schwarzkopf Hair Coach app feature: smart rinse-cycle integration with Miele/Bosch/Samsung showers via Henkel Smartwash (parallel to connected laundry platform). Offers personalized rinse protocols: "Gliss users: cold rinse 15 sec, hair cuticle seals 30% faster." No competitor has shower+shampoo data integration; this is a 24-month whitespace window. Launch with Miele partnership (Q4 2026). Creates €30M+ annual revenue from software licensing to appliance OEMs.`,
  'Emerging-market hair care regimens (IMEA)::expansion': `**1. Summary.** X-06 (IMEA growth: 12.1% organic vs. 0.9% group average) + G-13 (AfCFTA unlocks pan-African intra-trade at 2026-28 tariff harmonization) make India, Middle East, and Africa a structural growth frontier. Local consumer routines (coconut oil-based deep conditioning in India, shea butter protocols in West Africa) are category-native, not imported. Henkel IMEA portfolio strength (Schwarzkopf Pro distribution, acquired hair brands in Nigeria/Ghana) is undercapitalized vs. L'Oréal's Garnier India play.\n\n**2. Strategic Evaluation.** Launch Schwarzkopf India line of coconut-keratin regimens (shampoo + traditional oil + mask + serum) at Rs 150-350 price points (€2-4), leveraging local botanicals and consumer rituals. Pair with Gliss positioning in West Africa via East African distribution (Kenya, Uganda). Competitive advantage: Schwarzkopf's salon credibility transfers to at-home regimens in premium tier; P&G Pantene leads volume in mass tier but lacks salon pedigree. Expand IMEA Hair from 8% of group revenue to 14% by 2029.`,
  'Tone & fade protection (anti-yellowing)::contraction': `**1. Summary.** T-01 (AI color stability) collapses what was category white space (after-color-care tone protection) into core formula. Consumers expect color-lock benefits embedded in baseline shampoo formulations, not purchased separately. Single-purpose anti-yellowing products (purple shampoos, toning masks) lose shelf value as bundled benefits migrate into routine shampoos; margin pool contracts 15-20% as SKU count consolidation occurs.\n\n**2. Strategic Evaluation.** Rationalize Schwarzkopf portfolio: retire standalone toning sprays and separate anti-yellowing masks. Integrate color-stability chemistry into Schwarzkopf core shampoo range (Keratin Color users, all at-home color buyers). Competitor L'Oréal Excellence Color Vibrancy follows same consolidation path; they will not defend single-purpose skus. Reallocate 20% shelf space from single-function products to premiumization tier (routine protocols, specialty treatments). Margin loss is recovered in bundling premium protocols (entry 8, 7).`,
  'Fragrance refresh boosters (undifferentiated)::contraction': `**1. Summary.** C-09 (fragrance premiumization) demands sensory differentiation that commodity hair boosters lack. Generic "fresh coconut" or "tropical breeze" fragrances do not command price premium; consumers seek neuro-functional or artisanal scents (T-19: neuro-scents with measured cognitive benefits, or niche fragrance house partnerships like Moroccanoil). Undifferentiated booster spend collapses as switching cost approaches zero.\n\n**2. Strategic Evaluation.** De-emphasize bulk booster SKUs. Instead, collaborate with a prestige fragrance house (Maison Martin Margiela, Frederic Malle adjacent) to create limited-edition Schwarzkopf scent boosters (quarterly drops, €18-25 price point). Position as fragrance finishing step, not commodity accessory. Unilever and P&G follow "more SKUs" strategy; this is a margin-per-unit play. Focus on gifting and TikTok Shop (K-04) drops for scarcity signaling. Gross margin expands from 35% to 60%+ via prestige positioning.`,
  'Deodorizing mists for hair (niche)::contraction': `**1. Summary.** C-06 (cost-of-living squeeze) pressures accessory purchases that exist outside the core routine. Deodorizing mists are nice-to-have, not essential. Consumers in discretionary-spending decline default to dry shampoo (dual benefit: volume + odor control) rather than purchasing separate mist SKU. Category profit pool contracts 8-12% annually as functionality consolidates into adjacent SKUs.\n\n**2. Strategic Evaluation.** Discontinue standalone deodorizing mist range. Fold odor-control benefit into the dry shampoo formulations for got2b and Taft (Entry 17, 26). This reduces SKU complexity, improves supply chain efficiency, and reallocates shelf space to higher-margin treatment protocols. Competitor moves follow same logic: L'Oréal and Batiste have already rationalized standalone mist portfolios. This is not a loss; it is portfolio hygiene.`,
  'One-time treatments (low engagement)::contraction': `**1. Summary.** K-06 (subscription models) and multi-step routine architecture (Entries 7, 8) displace one-time treatments as purchase occasion. Consumers adopt weekly masking as habit; single-use sachets or one-off intensive treatments no longer compete for shelf or mental space. Engagement metrics show 3-5x higher repurchase on subscribed four-step protocols vs. occasional one-time deep conditioning.\n\n**2. Strategic Evaluation.** Migrate one-time treatment SKUs into subscription bundles (Gliss Premium Care Subscription, Entry 7). Retail placements: consolidate one-time sachets into trial-size assort packs (€8, entry point to weekly regimen). Competitors P&G, Unilever transitioning similarly; market is recognizing that one-time behavior does not scale. Realize margin benefit by moving 40% of one-time SKU volume into bundled, subscribed formats by 2027.`,
  'Online-listed care products (retail media tax)::contraction': `**1. Summary.** T-06 (retail media networks: $200B by 2027, 39% FMCG ad spend) extracts margin on top of traditional trade spend. For Amazon, Carrefour, Tesco listings, brands pay 8-12% of net revenue to secure visibility. This is a new tax on e-commerce margin; products with low organic search appeal pay the highest. Margin pool contracts 200-300 bps as pay-to-play costs rise faster than price increases.\n\n**2. Strategic Evaluation.** Shift spend from retail-media bidding (losing 250 bps annually) toward owned-channel DTC (henkel.com, subscription app, TikTok Shop). Henkel e-commerce infrastructure can capture 60% of Amazon's margin tax if shifted to first-party. Competitor L'Oréal invests heavily in retail media; capture timing advantage by pivoting to owned media now. Reallocate €8M regional ad spend to DTC acquisition; payback is 14 months with 65% gross margin structure.`,
  'E-commerce replenishment margins (pay-to-play)::contraction': `**1. Summary.** K-02 (e-commerce profit pool maturation) + K-06 (subscription models) compress margins on transactional e-commerce buys as Amazon Subscribe & Save captures 40%+ of replenishment volume. Once Amazon controls the replenishment decision, brand negotiation power collapses; Amazon takes 35%+ of gross margin (fulfillment + warehouse fees + marketplace tax). Only subscription brands at Henkel DTC preserve margin.\n\n**2. Strategic Evaluation.** Migrate 60% of e-commerce replenishment volume from Amazon Subscribe & Save to Henkel-owned subscription platform by 2027. Margin recovery: 55% (Henkel app) vs. 22% (Amazon net to Henkel). Invest €3M in consumer acquisition for Gliss/Schwarzkopf subscription apps; LTV payback is 11 months. Competitor Unilever has already redirected subscription investment to owned DTC; this is table stakes.`,
  'Dry shampoo (volume & convenience)::expansion': `**1. Summary.** C-15 (between-wash styling, 7%+ CAGR) with Batiste at $1B+ global share positions dry shampoo as the fastest-growing Hair sub-segment. Usage occasions expand beyond "emergency refresh" to routine styling step (second-day volume boost, texture base for styling). Consumers purchase 1.5-2x more per year; basket value per user increases €25-40 annually.\n\n**2. Strategic Evaluation.** got2b dominates youth dry shampoo via TikTok/social commerce (K-04). Invest in format innovation: aerosol → click dispenser (less waste, portable), texture spray hybrid (got2b + Taft joint line). Batiste's $1B+ pool is defended by 40%+ market share moat, but European challenger space (Taft, got2b combined) is underfunded vs. Batiste's media budget. Launch got2b Dry Shampoo + Texture Spray range Q2 2026 with creator seeding (budget: €2M). Capture 8-10% volume share by 2027.`,
  'Root retouch sprays (instant color refresh)::expansion': `**1. Summary.** T-03 (concentrated spray formats) + C-06 (cost-conscious consumers delaying salon visits) create "stretch color" occasion: root retouch between salon visits at 1/10th the cost. Schwarzkopf root retouch competing with L'Oréal Magic Retouch (€12-15 retail) captures margin on $3.8B root-retouch market. Format innovation (oil-free, colorless formula, precision applicator) enables personalized shades, driving SKU proliferation.\n\n**2. Strategic Evaluation.** Upgrade Schwarzkopf root retouch range: expand shade count from 8 to 22 via T-01 (AI color matching), add oil-free ultra-fine mist format (vs. L'Oréal's thick aerosol). Launch precision shade-finder app integration (T-07 personalization): user uploads selfie, app recommends shade, product ships. Retail price €14-16 vs. Magic Retouch €15 — parity, but app data moat + superior UX wins user. Drive 25% share of retouch pool (€950M) by 2028. Gross margin: 60%+.`,
  'Color correction & neutralization products::expansion': `**1. Summary.** T-01 (AI color correction) and on-demand customization enable brands to offer shade-specific correctors (anti-brassiness, ash-boost, warm-tone neutralizers) personalized to consumer's current color level and undertone. Batiste and Olaplex pioneered this space; mainstream mass market (Schwarzkopf) has no equivalent. Consumers perceive clinical credibility and pay €12-18 per SKU; portfolio grows 4-6 SKUs per market.\n\n**2. Strategic Evaluation.** Launch Schwarzkopf Color Science line (shades A1-A8 anti-brass, N1-N5 ash neutralizers, W1-W5 warm-tone boosters). Use Schwarzkopf Professional color-science IP for substantiation. Tier 1: retail launch (22 SKUs initially), Tier 2: app-driven custom shade recommendation (T-07 personalization). Position against Batiste and indie brands on clinical credibility. Target colorists and color-conscious consumers (€8M global market, 15% CAGR). Gross margin: 58%. Launch Q4 2026, full portfolio by 2027.`,
  'Leave-in & overnight treatments (intensive)::expansion': `**1. Summary.** C-03 (premiumization) + C-05 (silver economy aging population: 50+ spending) drive demand for intensive overnight and extended-wear treatments. Consumers wear treatment 8-12 hours (overnight + next day), increasing active-ingredient efficacy perceived vs. rinse-off format. Olaplex No. 8 and K18 Leave-In Mask capture €300M+ of premium tier; mass premium tier (Gliss, Syoss) is underpenetrated.\n\n**2. Strategic Evaluation.** Launch Gliss Intensive Leave-In Serum (€12-15 price, 100ml bottles) and Gliss Overnight Recovery Mask (€18-22 price, professional-grade for 50+ age segment). Schwarzkopf Professional bond-repair IP enables claim parity with Olaplex at 40% lower price point. Pair with silver-economy targeting (digital marketing to 50+, emphasis on anti-aging benefits). Expand Gliss portfolio +€60M by 2028. Gross margin: 52%.`,
  'Scalp care & balance mists::expansion': `**1. Summary.** C-07 (scalp care emerges as standalone category) fragments from "anti-dandruff" into distinct therapy categories: balance (sebum regulation), stimulation (circulation), detoxification (pollution removal), and calm (inflammation). Mist format (T-03: concentrated spray) enables daily use without washing; consumer adoption of multi-step scalp ritual mirrors multi-step body skincare (toner + essence + serum stack). Scalp care sub-segment is fastest-growing hair category at 18% CAGR.\n\n**2. Strategic Evaluation.** Create Schwarzkopf Scalp Science line: Balance Mist (100ml, €10, sebum control), Stimulate Mist (€10, micro-circulation), Calm Mist (€12, anti-inflammatory for sensitive scalp). Position each as daily scalp "toner" (skincare language transfer). Use Schwarzkopf Professional trichology as credibility anchor. Competitor L'Oréal lacks multi-step scalp format platform; P&G Head & Shoulders resists fragmentation. Launch Q3 2026 with influencer seeding. Target €40M scalp-care portfolio by 2028.`,
  'Portable styling tools (cordless)::expansion': `**1. Summary.** T-05 (manufacturing automation) enables production of cordless heated styling tools (mini hair straighteners, hot combs, curling wands) at €25-40 mass retail price point. Consumer travel occasions and on-the-go styling expand from salon-only (€120+ professional tools) to DIY luxury. Bundled with leave-in treatments, this expands the styling-occasion addressable market by €200M+ in Europe.\n\n**2. Strategic Evaluation.** Schwarzkopf Professional licenses design to a global ODM (Dyson-adjacent supplier), co-brands cordless mini straightener (€35 retail), and bundles with Gliss leave-in serum (€10) as styling-kit ($40 MSRP). Retail placement in Boots/Douglas premium sections alongside Dyson. Gross margin on styling kit: 58%. Competitors L'Oréal and Unilever have not launched cordless tools; 12-month whitespace. Target €30M styling-tools revenue by 2027.`,
  'Quick salon express refresh services::expansion': `**1. Summary.** K-04 (social commerce) + K-07 (professional salon crossover) enable sub-30-minute in-salon refresh services (root retouch, gloss, treatment) positioned as "express" tier. Batiste and indie brands own dry-shampoo occasion; Schwarzkopf Professional owns salon refresh credibility. Hybrid model (salon + product bundle retail) increases salon foot traffic and drives take-home replenishment.\n\n**2. Strategic Evaluation.** Launch Schwarzkopf Express Refresh service (15-min root retouch or gloss, €25-35, appointment via Instagram/TikTok booking). Partner with 500 independent salons across Europe via Schwarzkopf Professional affiliate network. Bundled home-care retail: customer gets service + take-home root retouch spray + color-lock serum (€40 package) drives recurring salon visits. Competitor L'Oréal salons are owned (margin captured), but independent salons are unengaged; this fills gap. Target €15M service revenue + €80M retail attach by 2028.`,
  'At-home color touch-up sprays::expansion': `**1. Summary.** T-03 (concentrated spray formats) + T-07 (AI personalized shades) converge on instant color touch-up sprays that spray-on to roots or gray areas, wash out in one shampoo. Consumer perception: "makeup for hair" rather than dye. Retail price €12-16 allows impulse purchase frequency (weekly reapplication). Market is nascent (L'Oréal Magic Retouch dominates), but growth potential is $500M+ by 2030 as format awareness expands.\n\n**2. Strategic Evaluation.** Launch Schwarzkopf InkTouch spray-on color system: 24 shades (T-07 app-driven custom shade recommendation), precision nozzle, 100ml format (€14 MSRP). Position as weekly root-extending ritual (vs. L'Oréal's "emergency coverage" narrative). Drive TikTok Shop (K-04) discovery with creator content: "25 shades in 10 seconds." Gross margin: 62%. Target 15% share of retouch pool (€570M) by 2028. Launch Q2 2026.`,
  'Scalp wellness weekly protocols::expansion': `**1. Summary.** C-07 (scalp care category emergence) + C-05 (silver economy: 50+ anti-thinning concern) create demand for multi-step weekly scalp protocols that parallel body skincare regimens. Exfoliate + stimulate + nourish + restore = €35-50 per week (€150-200/month). Schwarzkopf Professional's trichology credibility enables premium positioning that mass incumbents (P&G Head & Shoulders, L'Oréal Serioxyl) cannot justify.\n\n**2. Strategic Evaluation.** Launch Schwarzkopf Scalp Wellness Protocol: Week 1 Exfoliate (€8), Week 2 Stimulate Serum (€12), Week 3 Nourish Oil (€10), Week 4 Restore Mask (€15). Bundle at €42/month subscription (K-06). Target 50+ demographic via direct mail + digital (€3M year-one spend). Gross margin: 54%. No competitor owns multi-step scalp ritual; this is whitespace. Aim for 200K subscribers globally by 2027 (€100M revenue run-rate).`,
  'Male dry styling & texture sprays::expansion': `**1. Summary.** C-08 (male grooming: $23.6B European market, 7.65% CAGR) + C-15 (between-wash styling, 7%+ CAGR) create structural expansion in male texture and styling products. Male consumers adopt multi-step grooming less than female cohort; texture sprays are low-friction entry (spray, not apply, no styling tool required). got2b and Taft both have male positioning; portfolio investment is capital-efficient vs. new-brand launch.\n\n**2. Strategic Evaluation.** got2b Male Texture Range: spray-on texture for crew/short cuts (€7), dry finish clay (€9), matte volumizer (€8). Tier distribution: barbershop direct (professional channel) + retail checkout impulse (sports, convenience). Pair with TikTok Shop creator seeding (male influencers, barbershop videos). Taft contributes classic male positioning (barbershop tradition). Combined messaging: "Essential male grooming." Target €25M male styling revenue by 2027. Gross margin: 55%.`,
  'Glosses (limited repeat purchase)::contraction': `**1. Summary.** C-03 (premiumization) shifts consumer investment from temporary gloss to permanent or semi-permanent color: glosses are now perceived as temporary expedient, not a value proposition. Low repeat-purchase frequency (1-2x annually vs. 6-12x for shampoo) makes gloss SKUs economically challenging to support with shelf space. Portfolio rationalization favors high-velocity items.\n\n**2. Strategic Evaluation.** Discontinue standalone gloss range. Redirect formulation investment into Schwarzkopf Semi-Permanent Color range (6-week color boost with conditioning benefit, €6-8 price point, higher repurchase frequency). Glosses become promotional tiers (gift-set bundles, seasonal offerings) rather than core portfolio. Competitors L'Oréal and Unilever have already rationalized pure-gloss portfolios; this is category maturation. Reallocate 12 SKUs' shelf space to treatment protocols (Entries 7, 8, 25).`,
  'Garment steaming for hair (novelty)::contraction': `**1. Summary.** C-06 (cost-of-living squeeze) pressures novelty add-ons with low engagement and high complexity. Hair steaming (DIY garment steamer for hair conditioning) is niche behavior, adopted by <2% of consumers; no brand has successfully monetized format. Perceived as gimmick; repurchase is non-existent after trial disappointment.\n\n**2. Strategic Evaluation.** Divest from steamer-marketing or co-branded tool programs. Redirect development resources to proven formats (sprays, masks, serums). Henkel has no brand association with hair steaming; no competitive advantage exists. This is disciplined portfolio rationalization: decline low-probability bets and concentrate on high-velocity formats. Reallocate shelf space and marketing budget to core treatment protocols.`,
  'On-the-go freshener sprays (generic)::contraction': `**1. Summary.** C-07 (scalp care category) reframes generic "freshener" sprays as specifically purpose-driven scalp-care tools (balance, stimulation, calm), not undifferentiated "refresh." Consumers perceive generic fresheners as low-value fragrance spray, not therapeutic product. Margin collapse as category evolves from fragrance-led to efficacy-led positioning.\n\n**2. Strategic Evaluation.** Discontinue generic "fresh linen" or "tropical breeze" freshener sprays. Migrate product lines to purpose-driven Scalp Care mists (Entry 21: Balance, Stimulate, Calm). Reposition ingredient narrative from "pleasant fragrance" to "scalp wellness benefit." Competitors follow same logic; generic fresheners are category-generation artifact. Consolidate 8-12 generic SKUs into 3-4 efficacy-positioned SKUs (scalp care mists). Gross margin improves from 38% to 52% via functional positioning premium.`,
  'Temporary touch-up chalks::contraction': `**1. Summary.** T-03 (concentrated spray formats) displace chalks as the between-wash color-refresh vehicle: sprays are faster (no fingers-to-chalk application), no residue on fingers or clothing, and deliver more uniform coverage. Chalk market shrinks as spray adoption accelerates. Younger cohorts (Gen Z, K-04 social-native) adopt spray-first behavior; chalk is legacy incumbent with declining frequency.\n\n**2. Strategic Evaluation.** Phase out chalk format entirely. Direct users toward Schwarzkopf InkTouch spray-on color (Entry 24) via promotional trade-down. Invest R&D budget into spray format innovation (finer mist, faster drying, extended wear). No competitor is defending chalks; this is rational portfolio exit. Reallocate manufacturing capacity to higher-margin spray products. This is a category death arc; manage decline over 18 months, full exit by Q4 2027.`,
};

interface StageCtx { henkelBrands: string; competitors: string; opportunity: string }

const LHC_CTX: Record<string, StageCtx> = {
  'Sorting': {
    henkelBrands: 'Persil (ecosystem anchor for AI garment care advisory), Vernel (fabric protection guidance)',
    competitors: 'P&G has no standalone AI sorting play. Samsung SmartThings integrates with Tide pods for auto-cycle selection. LG ThinQ partners with Procter brands on connected wash.',
    opportunity: 'A Persil-branded AI garment care advisor that scans fabrics and recommends the optimal Persil/Vernel product turns sorting from a chore into a digital brand lock-in moment — whoever owns the diagnostic captures the downstream purchase decision.',
  },
  'Pre-Treating': {
    henkelBrands: 'Sil (dedicated stain removal specialist — Henkel\'s under-leveraged gem in this stage), Persil (stain removal pre-treat sprays and power formulas)',
    competitors: 'Vanish (now Advent-owned post-Reckitt $4.8B divestiture — PE ownership signals cost-cutting, not brand investment). OxiClean (Church & Dwight, US-focused). P&G has no standalone stain brand.',
    opportunity: 'Sil is a natural innovation platform for bio-enzymatic stain science. The Reckitt Vanish divestiture to PE creates a once-in-a-decade competitive opening. Position Sil + Persil as an integrated pre-treat-to-wash system that builds basket size and demonstrates superiority over private label one-product solutions.',
  },
  'Loading': {
    henkelBrands: 'Persil Discs (4-in-1 capsule with integrated dosing technology), Persil (dosing innovation across pods, gel, and powder formats)',
    competitors: 'P&G Ariel Pods (market leader in unit-dose format globally). Unilever OMO dual-chamber capsules. Samsung and LG auto-dose systems increasingly favor branded cartridge partnerships.',
    opportunity: 'Henkel\'s appliance OEM partnerships (Miele, Bosch, Samsung) for auto-dosing cartridges create a Nespresso-like hardware lock-in. Persil-branded auto-dose refills that slot into connected machines build recurring revenue and structural switching costs that no competitor currently matches in Europe.',
  },
  'Add Products': {
    henkelBrands: 'Persil (Discs, Power Caps, gel, powder — Henkel\'s largest LHC franchise and core profit pool), Vernel (fabric softener, scent beads), Weißer Riese (value tier Germany/Austria), Spee (economy Germany), all and Purex (US mainstream and value)',
    competitors: 'P&G Ariel/Tide (global #1 laundry by revenue). Unilever OMO and Persil UK. Church & Dwight (OxiClean, Arm & Hammer). Private label at 42% EU6 value share — the highest level ever recorded by Circana.',
    opportunity: 'This is the core profit pool stage for Henkel LHC. Defend Persil premium via demonstrable superiority in concentrated formats and bio-chemistry. Use Weißer Riese and Spee as strategic value-tier shields preventing consumer trade-down to private label. Persil Discs 4-in-1 is the format innovation weapon — it combines detergent, softener, stain removal, and freshness in one capsule, rendering separate product purchases obsolete.',
  },
  'Select Wash Settings': {
    henkelBrands: 'Persil (smart home ecosystem partner with wash-program APIs), Henkel connected laundry platform (auto-dosing integration with major washer OEMs)',
    competitors: 'P&G Tide/Ariel has partnered with Samsung SmartThings and LG ThinQ for connected wash recommendations. Unilever is exploring connected refill models for OMO in select markets.',
    opportunity: 'When the washing machine itself recommends Persil at the cycle-selection moment, that is invisible-to-consumer, structural-for-manufacturer brand lock-in. Henkel\'s existing OEM relationships are the foundation for owning this moment at scale before competitors lock in exclusive partnerships.',
  },
  'Washing Cycle': {
    henkelBrands: 'Persil (cold-wash optimized formulas, Persil Green Power eco-range), Vernel (in-wash softening and scent). Auto-dosing cartridge refill model for connected machines.',
    competitors: 'P&G Ariel claims cold-water efficacy leadership (Turn To 30 campaign, heavy media spend). Unilever OMO targets cold-wash with enzyme technology in Europe. Both investing aggressively.',
    opportunity: 'Cold-wash optimization is Persil\'s next performance battleground. Persil Green Power (bio-formulation effective at 20°C) directly addresses E-07 energy cost pressure — European consumers pay 2-3x US energy prices. Winning the cold-wash efficacy claim captures the fastest-growing detergent sub-segment while aligning with sustainability positioning.',
  },
  'Unloading': {
    henkelBrands: 'Vernel (freshness, anti-static, and scent care — core franchise), Persil (clean laundry freshness halo that extends beyond the wash cycle)',
    competitors: 'P&G Lenor/Downy Unstoppables (market creator and leader in scented laundry, established the scent-bead sub-category). Unilever Comfort (traditional softener positioning).',
    opportunity: 'Vernel needs a differentiated answer to Lenor Unstoppables that emphasizes bio-based, conscious freshness over synthetic fragrance overload — aligning with C-04 Conscious Consumption while competing in the fastest-growing fabric care sub-category. Vernel\'s European heritage and natural ingredient positioning is a credible platform for this.',
  },
  'Drying': {
    henkelBrands: 'Vernel (dryer scent products and tumble dryer sheet potential), US: Snuggle (established dryer sheet expertise that could transfer to Europe). Persil (garment care ecosystem).',
    competitors: 'P&G Bounce (dominant US dryer sheets brand). Unilever Comfort tumble dryer sheets (limited European presence). The European dryer sheet market is still nascent compared to the US — an early-mover advantage is available.',
    opportunity: 'Heat-pump dryers are replacing vented dryers across Europe, creating an entirely new product moment. Vernel-branded scent pods or dryer sheets optimized for heat-pump temperatures represent a white-space entry with minimal competitive intensity in Europe. Henkel can transfer Snuggle\'s US dryer expertise to European Vernel.',
  },
  'Ironing': {
    henkelBrands: 'Vernel (anti-wrinkle spray extension leveraging fabric care credibility), Persil (garment lifecycle system positioning)',
    competitors: 'No major FMCG player dominates post-wash ironing chemical products. Category is fragmented across appliance brands (Philips, Rowenta steamers) and niche spray brands. This fragmentation signals opportunity for a trusted FMCG brand.',
    opportunity: 'White space for Henkel. A spray-and-wear anti-wrinkle product under Vernel (leveraging its fabric care credibility) or Persil (leveraging its laundry authority) could create a new branded sub-category in a currently unbranded space. Low competitive intensity makes this an ideal low-risk test-and-learn market entry.',
  },
  'Folding & Storing': {
    henkelBrands: 'Vernel (closet freshness and garment protection potential — natural brand extension), bio-based fabric care innovation pipeline',
    competitors: 'SC Johnson (Raid moth protection, regional). Reckitt legacy products. The category is highly fragmented with no FMCG leader — no one has built a branded position in closet garment care.',
    opportunity: 'Extending Vernel into closet care (scent sachets, bio-based moth protection, cedar alternatives) leverages existing fabric care brand equity at minimal incremental cost. Low-investment category extension with premium pricing potential and zero cannibalization risk to existing Vernel products.',
  },
  'Taking Out of Closet': {
    henkelBrands: 'Vernel (fabric refresh is a natural extension of its freshness and scent positioning — from in-wash to all-day care), Persil (clean confidence halo)',
    competitors: 'P&G Febreze ($1B+ global revenue, dominant in fabric and room refresh — created and owns this category). No strong European-origin challenger brand exists in fabric refresh.',
    opportunity: 'Henkel has no Febreze competitor — this is a strategic gap in a €500M+ and growing European sub-category. A Vernel-branded fabric refresh spray extends the freshness positioning from in-wash softener to between-wash garment care, creating a new consumer moment for the brand without cannibalizing the core softener business.',
  },
  'Wearing': {
    henkelBrands: 'Vernel (garment protection and textile life extension), Persil (stain guard pre-treatment, clean confidence)',
    competitors: 'Scotchgard (3M — retreating from consumer market). P&G Febreze on-the-go. DWR spray brands are mostly outdoor/niche with no mass-market FMCG positioning.',
    opportunity: 'Garment protection and life extension directly aligns with E-08 Textile Longevity regulation (EU Circular Textiles Strategy). Position Persil + Vernel as a complete garment lifecycle system — wash, protect, refresh, extend — increasing consumer touchpoints from one (the wash) to four, multiplying revenue per consumer by 3-4x.',
  },
  'Between Washes': {
    henkelBrands: 'Vernel (strongest brand platform for between-wash fabric care — freshness equity transfers directly), Persil (halo from wash performance carries into between-wash confidence)',
    competitors: 'P&G Febreze ($1B+ global, category creator and dominant player — effectively owns between-wash fabric care). Reckitt Air Wick (now Advent-owned post-divestiture, declining brand investment). No strong European fabric refresh challenger.',
    opportunity: 'Between-wash fabric care is PRISM\'s highest-scoring white space (C-14 at 0.82 score, 8-10% CAGR). Henkel has zero current position in a segment that P&G built into a billion-dollar franchise. A Vernel-branded fabric refresh spray range is the single highest-ROI new product opportunity in the entire LHC portfolio — with Reckitt\'s exit under PE ownership further weakening the only potential European competitor.',
  },
};

const HAIR_CTX: Record<string, StageCtx> = {
  'Inspire': {
    henkelBrands: 'Schwarzkopf (master brand with 90%+ aided recall in Europe), got2b (youth and social-first positioning), Palette and Live (color-specific inspiration), Syoss (professional credibility at accessible price)',
    competitors: 'L\'Oréal Modiface (AR try-on market leader — established first-mover advantage in digital shade matching). P&G Pantene (influencer partnerships, heavy social spend). Unilever Dove (body-positivity content dominance). Indie brands like Olaplex and K18 dominate organic social.',
    opportunity: 'Schwarzkopf Professional\'s salon credibility can power an AR shade-finder and hair advisor that rivals Modiface with professional-grade color precision that L\'Oréal\'s mass-market tool cannot match. got2b should own TikTok-native trend content — its youth positioning is perfectly aligned with the social commerce moment where product discovery is shifting from search to creator recommendation.',
  },
  'Diagnose': {
    henkelBrands: 'Schwarzkopf Professional (salon-grade diagnostic credibility — trichological heritage), Syoss (accessible professional analysis), Schwarzkopf consumer (brand trust for diagnostic tools)',
    competitors: 'L\'Oréal Technology Incubator (AI skin and hair diagnostics, multi-year R&D investment). P&G Head & Shoulders (scalp health messaging). DTC brands like Prose and Function of Beauty (quiz-based personalization, strong data moats).',
    opportunity: 'Schwarzkopf Professional\'s trichological IP is an undermonetized asset. An AI hair diagnostic tool (camera-based scalp and strand analysis) branded to Schwarzkopf Professional bridges the salon-to-retail gap and captures the diagnostic moment before purchase — in beauty, whoever diagnoses the problem prescribes the solution.',
  },
  'Prepare': {
    henkelBrands: 'Gliss (bond builder and treatment specialist — Gliss Kur heritage of keratin-based repair), Schwarzkopf (scalp protection pre-treatment), Syoss (pre-treatment at accessible professional price point)',
    competitors: 'Olaplex No. 0 (bond-builder pioneer, created the category). K18 (peptide-based pre-treatment, viral growth). L\'Oréal Série Expert (salon pre-treatment, professional channel). Premium pre-treatment is the fastest-growing Hair sub-segment by growth rate.',
    opportunity: 'Gliss has natural credibility in bond repair — it pioneered the liquid keratin positioning in European mass retail. Upgrading Gliss into a clinical-grade bond builder range (Olaplex-equivalent efficacy at mass-market accessibility) captures the premiumization wave without requiring indie-brand pricing. The Gliss brand carries both scientific credibility and mass-market distribution.',
  },
  'Remedy': {
    henkelBrands: 'Schwarzkopf (scalp care authority via Professional channel heritage), Syoss (treatment-focused affordable care range), Schauma (anti-dandruff entry tier for volume play and light-buyer recruitment)',
    competitors: 'P&G Head & Shoulders (anti-dandruff global #1 by far). L\'Oréal Serioxyl and Kérastase (hair loss premium tier). Unilever Clear (anti-dandruff leader in Asia). DTC disruption: Nioxin (established clinical), Vegamour, Nutrafol (new entrants with strong social presence).',
    opportunity: 'Hair loss entering the consumer mainstream (C-10) is a structural category shift. Henkel can bridge salon-to-retail via Schwarzkopf Professional\'s trichological credibility — something no competitor except L\'Oréal can claim. A Schwarzkopf-branded scalp care and anti-thinning range (serum + shampoo + supplement protocol) fills the white space between clinical niche (Nioxin, $50+ price point) and commodity (Head & Shoulders, $6 price point).',
  },
  'Transform': {
    henkelBrands: 'Schwarzkopf (Palette, Color Expert, Keratin Color, Perfect Mousse — Europe\'s #1 at-home color brand by value share), Live (fashion and semi-permanent color for creative expression), Syoss Color (affordable professional color), got2b (color sprays and creative temporary color)',
    competitors: 'L\'Oréal Excellence/Préférence (premium color, heavy ad investment) and Garnier Nutrisse (mainstream). Clairol (US market). Wella (salon dominance). Private label gaining in value color tier. DTC: Madison Reed, eSalon (subscription color, personalization).',
    opportunity: 'Color IS Schwarzkopf — this is Henkel\'s #1 Hair profit pool and must be defended as an existential priority. Innovation in bond-protecting color (evolving Keratin Color technology), professional-grade at-home color systems leveraging K-07 salon crossover ($23.4B market, 63% B2C), and format innovation (precision applicators, reduced damage formulas) protects the premium core against L\'Oréal from above and private label from below.',
  },
  'Lock & Finish': {
    henkelBrands: 'got2b (styling and finishing — gels, sprays, waxes, pastes, glue), Taft (Europe\'s leading hairspray brand, strong market share in Germany/CEE), Schwarzkopf (color-lock finishing, Osis+ from Professional channel)',
    competitors: 'L\'Oréal Elnett (premium hairspray icon, strong emotional brand equity). Unilever TRESemmé (salon-accessible styling). Indie and prestige brands (Moroccanoil, Oribe, R+Co capturing premiumization). Styling as a category is globally under-invested relative to its margin potential.',
    opportunity: 'got2b + Taft combined gives Henkel the strongest styling portfolio in Europe. The premiumization of finishing products — from commodity hold to color-lock, bond-seal, and fragrance-finishing — is an upgrade path that increases revenue per unit without requiring new shelf facings. Osis+ salon expertise can transfer innovation credibility to the got2b and Taft consumer lines.',
  },
  'Maintain & Optimize': {
    henkelBrands: 'Gliss (treatment and repair specialist — weekly masks, serums, oils), Schwarzkopf (care systems and routines), Syoss (professional-grade maintenance at accessible price), Schauma (everyday value care for light-buyer recruitment)',
    competitors: 'P&G Pantene (daily care #1 globally, massive media investment). Unilever Dove and TRESemmé (mainstream care). L\'Oréal Elvive/Elsève (treatment positioning). Indie disruption: Olaplex No. 3-7 maintenance range, K18 mask (viral social proof).',
    opportunity: 'Gliss can own the "treatment protocol" space — weekly intensive repair systems at mass-market price points. Multi-step care routines (shampoo → mask → serum → leave-in protectant) increase basket size 3-4x versus a single shampoo purchase. This is exactly the premiumization vector: more products per consumer, not just higher price per product.',
  },
  'Refresh / In-Between': {
    henkelBrands: 'got2b (dry shampoo and texture sprays for youth segment), Taft (quick restyle and refresh for classic consumers), Schauma (value dry shampoo entry), Schwarzkopf (root retouch sprays for color maintenance between salon visits)',
    competitors: 'Batiste (dominant dry shampoo at 40%+ global share, strong brand moat). L\'Oréal Magic Retouch (root retouch market leader). P&G Pantene dry shampoo. Unilever Dove dry shampoo (value tier).',
    opportunity: 'Between-wash styling (C-15) is the fastest-growing Hair sub-segment at 7%+ CAGR with Batiste alone at $1B+. got2b is perfectly positioned for the youth styling-convenience occasion. Taft for the classic quick-restyle moment. Schwarzkopf root retouch competes directly with L\'Oréal Magic Retouch. Portfolio breadth across price tiers and consumer segments is a structural advantage no single competitor can match.',
  },
};

const HAIR_STAGES = new Set(['Inspire', 'Diagnose', 'Prepare', 'Remedy', 'Transform', 'Lock & Finish', 'Maintain & Optimize', 'Refresh / In-Between']);

function getProductBrands(name: string, isHair: boolean): string {
  const n = name.toLowerCase();
  if (isHair) {
    if (/color|shade|dye|tint|balayage|highlight|retouch/.test(n)) return 'Schwarzkopf (Palette, Color Expert, Keratin Color, Live)';
    if (/styling|hold|gel|wax|mousse|hairspray|finish/.test(n)) return 'got2b and Taft';
    if (/dry shampoo|texture spray/.test(n)) return 'got2b (primary), Taft (classic segment)';
    if (/bond|repair|treatment|mask|keratin/.test(n)) return 'Gliss (treatment specialist — Gliss Kur heritage)';
    if (/scalp|dandruff|hair loss|thinning|anti-hair/.test(n)) return 'Schwarzkopf (scalp care via Professional trichological heritage)';
    if (/root retouch|touch-up/.test(n)) return 'Schwarzkopf root retouch range';
    if (/shampoo|conditioner|wash/.test(n)) return 'Schauma (value), Syoss (mid-tier professional), Schwarzkopf (premium)';
    if (/protect|uv|heat|shield/.test(n)) return 'Gliss (protective treatments), Schwarzkopf';
    if (/fragrance|perfume|scent/.test(n)) return 'Schwarzkopf (premium hair finishing)';
    if (/male|men/.test(n)) return 'got2b (male styling and grooming), Schwarzkopf Men';
    if (/subscription|programmatic/.test(n)) return 'Schwarzkopf (loyalty ecosystem), Syoss (mid-tier recurring care)';
    if (/brow|lash/.test(n)) return 'Schwarzkopf (brand extension from hair to brow/lash)';
    if (/salon|professional/.test(n)) return 'Schwarzkopf Professional (Igora, BlondMe, BC Bonacure)';
    return 'Schwarzkopf (master brand)';
  }
  if (/stain/.test(n)) return 'Sil (dedicated stain specialist), Persil (stain removal system)';
  if (/softener|conditioner|rinse aid|static/.test(n)) return 'Vernel (fabric conditioner and softener — Silan in CEE markets)';
  if (/fragrance|scent|perfume|fresh|refresh|mist|odor|deodoriz/.test(n)) return 'Vernel (freshness and scent care portfolio)';
  if (/detergent|pod|capsule|disc|powder|liquid|gel/.test(n) && !/dish/.test(n)) return 'Persil (Discs, Power Caps, gel, powder)';
  if (/concentrated|compact|sheet|ultra/.test(n)) return 'Persil (concentrated format innovation leader)';
  if (/dish/.test(n)) return 'Somat (automatic dishwasher), Pril (hand dishwashing)';
  if (/toilet|bathroom/.test(n)) return 'Bref (toilet care specialist)';
  if (/moth|pest|insect/.test(n)) return 'Vernel (garment protection extension opportunity)';
  if (/fabric|garment|textile|wrinkle|anti-wrinkle/.test(n)) return 'Vernel (fabric care authority), Persil (garment lifecycle system)';
  if (/auto-dos|smart|connected|iot|app/.test(n)) return 'Persil (connected laundry platform, OEM partnerships with Miele, Bosch, Samsung)';
  if (/refill|subscription/.test(n)) return 'Persil (refill systems, eco-subscription model)';
  if (/private label|own-brand|retailer/.test(n)) return 'Weißer Riese, Spee (Germany), all/Purex (US) — strategic value-tier defense brands';
  if (/value|budget|discount|mid-tier|squeezed/.test(n)) return 'Weißer Riese and Spee (Germany value tier), all and Purex (US value tier) — shields against PL trade-down';
  if (/enzyme|bio-/.test(n)) return 'Persil (bio-enzymatic formulation R&D leadership), Sil (enzyme-based stain removal)';
  if (/microfi[bl]|filter/.test(n)) return 'Persil (sustainability innovation), appliance OEM partnerships';
  if (/dryer|drying|tumble|bounce/.test(n)) return 'Vernel (dryer sheet and scent pod opportunity), US: Snuggle (established dryer expertise)';
  if (/chlorine|solvent|pfc|synthetic|chemical/.test(n)) return 'Persil and Sil (reformulation required to maintain regulatory compliance)';
  if (/bleach|whiten|brighten/.test(n)) return 'Persil (whitening claims), Weißer Riese (white laundry heritage)';
  return 'Persil (core LHC franchise)';
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// PRISM read-out generator — short, crisp, entry-specific.
//
// Two sections, ~1 sentence each (max 2). No framing/opening, no platitudes.
// Each tile leads with the profit-pool delta on THIS entry, the actual trend
// mechanism (with hard-data clause + trend code), and only when material a
// named competitor or HCB brand. Sentence shape branches on entry-name
// archetype × direction × white-space-vs-entrenched, so adjacent tiles never
// share structure.
// ─────────────────────────────────────────────────────────────────────────────
function generatePrismAnalysis(entry: ProductEntry, direction: 'expansion' | 'contraction', stageName: string): string {
  const key = `${entry.name}::${direction}`;
  const override = PRISM_OVERRIDES[key];
  if (override) return override;

  const isHair = HAIR_STAGES.has(stageName);
  const ctx = (isHair ? HAIR_CTX : LHC_CTX)[stageName];
  const bu = isHair ? 'HCB Hair' : 'HCB LHC';
  const stageLc = stageName.toLowerCase();
  const entryName = entry.name;
  const isExp = direction === 'expansion';

  // ── Resolve trends + extract the most data-rich clause from each ──
  const trendCodes = (entry.trendDrivers.match(/[TCGKXE]-\d+/g) || []) as string[];
  const trends = trendCodes
    .map(c => ({ code: c, def: TREND_CONTEXT[c] }))
    .filter((t): t is { code: string; def: { name: string; force: string; description: string } } => !!t.def);

  type Signal = { code: string; name: string; force: string; clause: string; hasNumber: boolean };
  const signals: Signal[] = trends.map(t => {
    const sentences = t.def.description.split(/(?<=[.!?])\s+/).filter(Boolean);
    const score = (s: string) => (s.match(/\$[\d.,]+|€[\d.,]+|\d[\d.,]*\s*%|\d[\d.,]*\s*CAGR|\b\d+x\b|\bbillion\b/gi) || []).length * 10 + (/\d/.test(s) ? 1 : 0);
    const ranked = [...sentences].sort((a, b) => score(b) - score(a));
    const clause = (ranked[0] || sentences[0] || '').trim().replace(/[.!?\s]+$/, '');
    return { code: t.code, name: t.def.name, force: t.def.force, clause, hasNumber: /\d/.test(clause) };
  });
  const primary: Signal | null = signals.find(s => s.hasNumber) || signals[0] || null;
  const secondary: Signal | null = signals.find(s => s !== primary && s.hasNumber) || signals.find(s => s !== primary) || null;

  // ── Brand routing + lead Henkel asset ──
  const brandRouting = getProductBrands(entry.name, isHair);
  const whiteSpace = /extension|opportunity|natural brand extension|white space|under-leveraged|undermonetized|no\s+(?:henkel|incumbent)|defense brand/i.test(brandRouting);
  const leadBrand = (() => {
    const m = brandRouting.match(/^([^,()]+)/);
    return ((m?.[1] || '').trim().replace(/\s+(and|or)\s+.*$/i, '') || (isHair ? 'Schwarzkopf' : 'Persil'));
  })();

  // ── Pull a named external competitor from stage CTX (longest match wins) ──
  const namedCompetitor = (() => {
    const c = ctx?.competitors || '';
    const known = [
      "L'Oréal Modiface", "L'Oréal Magic Retouch", "L'Oréal Excellence", "L'Oréal Préférence",
      "L'Oréal Elvive", "L'Oréal Elsève", "L'Oréal Elnett", "L'Oréal Serioxyl",
      "P&G Head & Shoulders", "P&G Ariel Pods", "P&G Ariel/Tide", "P&G Ariel", "P&G Tide",
      "P&G Pantene", "P&G Lenor", "P&G Downy", "P&G Bounce", "P&G Febreze",
      "Unilever OMO", "Unilever Dove", "Unilever TRESemmé", "Unilever Comfort", "Unilever Clear",
      "Reckitt Air Wick", "Air Wick", "Vanish",
      "Samsung SmartThings", "LG ThinQ",
      "Kérastase", "Olaplex", "K18", "Function of Beauty", "Madison Reed", "eSalon", "Prose",
      "Nioxin", "Vegamour", "Nutrafol", "Batiste", "Wella", "Clairol", "Garnier Nutrisse", "Nutrisse",
      "Moroccanoil", "Oribe", "R+Co", "Church & Dwight", "OxiClean", "Arm & Hammer", "Snuggle",
      "L'Oréal", "P&G", "Unilever", "Reckitt", "Advent",
      "Samsung", "LG", "Miele", "Bosch",
      "Aldi", "Lidl", "Tide", "Ariel", "Pantene", "Lenor", "Downy", "Bounce", "Comfort",
      "OMO", "Dove", "Febreze", "Head & Shoulders",
      "Earth Breeze", "Tru Earth", "Blueland", "Shea Moisture", "Amorepacific",
      "Hims", "Hers", "Ro", "Nurx", "3M Scotchgard", "Scotchgard",
      "Sephora", "Amazon", "Walmart", "Costco", "Tesco", "Carrefour",
    ];
    for (const k of known) {
      if (c.indexOf(k) >= 0) return k;
    }
    return null;
  })();

  // ── Entry archetype (drives sentence shape) — order matters: most specific first ──
  type Arch =
    | 'ai_smart' | 'service_advisory' | 'refill_subscription'
    | 'private_label' | 'value_tier' | 'manual_traditional'
    | 'between_wash' | 'fragrance_scent' | 'repair_treatment' | 'styling' | 'color'
    | 'premium_salon' | 'format_innovation' | 'bio_eco'
    | 'regulatory_compliant' | 'male_grooming' | 'cold_wash'
    | 'protection_longevity' | 'media_retail' | 'generic';
  const arch: Arch = (() => {
    const n = entry.name.toLowerCase();
    // tech/digital
    if (/\bai\b|smart|connected|iot|app\b|chatbot|llm|gen[ \-]?ai|qr|scanner|sensor|algorithm|digital|platform/.test(n)) return 'ai_smart';
    if (/advisory|consultation|diagnostic|coach|advisor|recommendation|prescription|tele[-\s]?derm/.test(n)) return 'service_advisory';
    if (/refill|subscription|auto[-\s]?dos|cartridge|programmatic|recurring|drip|replenish/.test(n)) return 'refill_subscription';
    // share/price tier (must come before manual_traditional which matches "loose")
    if (/private label|own[-\s]?brand|retailer.brand/.test(n)) return 'private_label';
    if (/value tier|budget|discount|mid[-\s]?tier|squeezed|economy|loose/.test(n)) return 'value_tier';
    if (/manual|mechanical|traditional|legacy|cardboard|non[-\s]?compact|paper.based|dial/.test(n)) return 'manual_traditional';
    // category-specific (must come before generic fragrance/styling which are loose)
    if (/refresh|fabric refresh|refresh spray|between[-\s]?wash|garment refresh/.test(n)) return 'between_wash';
    if (/protect|protection|uv|heat shield|pilling|life extension|longevity|durab/.test(n)) return 'protection_longevity';
    if (/bond|repair|mask|treatment|peptide|keratin|serum|protein|amino|reconstruct/.test(n)) return 'repair_treatment';
    if (/styling|gel\b|wax|mousse|hairspray|hold|finish|texturiz|dry shampoo/.test(n)) return 'styling';
    if (/color|colour|dye|tint|highlight|balayage|gray|grey|root retouch/.test(n)) return 'color';
    if (/fragrance|scent|perfume|aroma|odor|deodoriz|booster|unstoppable/.test(n)) return 'fragrance_scent';
    if (/men\b|male|grooming|barber/.test(n)) return 'male_grooming';
    if (/cold[-\s]?wash|cold[-\s]?water|low[-\s]?temp/.test(n)) return 'cold_wash';
    // formulation / format
    if (/concentrated|sheet|strip|capsule|pod\b|disc|bar|tablet|powder|sachet|stick|solid format/.test(n)) return 'format_innovation';
    if (/bio[-\s]|eco[-\s]|sustainable|plant[-\s]?based|biodegrad|natural|microbiome|enzymatic|enzyme/.test(n)) return 'bio_eco';
    if (/premium|salon|professional|luxury|prestige|trichology/.test(n)) return 'premium_salon';
    if (/pfas|microplastic|dpp|epr|cbam|compliant|certified|deforestation|circular|reformulated/.test(n)) return 'regulatory_compliant';
    if (/retail media|advertising|trade promotion|rmn/.test(n)) return 'media_retail';
    return 'generic';
  })();

  const tc = (s: Signal | null) => s ? `${s.clause} (${s.code})` : '';
  const has = (s: Signal | null) => !!(s && s.clause);

  // ════════ SUMMARY: 1-2 sentences leading with the profit-pool delta ════════
  let s1 = '';
  if (isExp) {
    switch (arch) {
      case 'ai_smart':
        s1 = `${entryName} captures the consumer-choice surface at ${stageLc} that ${tc(primary)} is creating, taking the recommendation moment from physical SKUs.`; break;
      case 'service_advisory':
        s1 = `${entryName} inserts an advisory layer at ${stageLc} — ${tc(primary)} — and monetises the diagnosis before the SKU choice is made.`; break;
      case 'refill_subscription':
        s1 = `${entryName} converts a one-shot ${stageLc} purchase into recurring revenue, riding ${tc(primary)}.`; break;
      case 'manual_traditional':
        s1 = `${entryName} holds pool at ${stageLc} as the deliberate-ritual segment against the connected push: ${tc(primary)}.`; break;
      case 'private_label':
        s1 = `${entryName} extracts share from branded ${stageLc} SKUs as ${tc(primary)} normalises retailer-owned formulations across price tiers.`; break;
      case 'value_tier':
        s1 = `${entryName} absorbs the trade-down at ${stageLc} as ${tc(primary)} pushes mid-market shoppers down the price ladder.`; break;
      case 'premium_salon':
        s1 = `${entryName} captures the premiumisation flow at ${stageLc}; ${tc(primary)} is the demand engine.`; break;
      case 'format_innovation':
        s1 = `${entryName} resets the unit economics at ${stageLc}: ${tc(primary)}.`; break;
      case 'bio_eco':
        s1 = `${entryName} compounds at ${stageLc} as regulation and conscious-consumer pull converge — ${tc(primary)}.`; break;
      case 'fragrance_scent':
        s1 = `${entryName} extends the sensory pool at ${stageLc} — ${tc(primary)}.`; break;
      case 'repair_treatment':
        s1 = `${entryName} deepens the basket at ${stageLc} as ${tc(primary)} pulls consumers into multi-step routines.`; break;
      case 'styling':
        s1 = `${entryName} captures premiumisation at ${stageLc}: ${tc(primary)}.`; break;
      case 'color':
        s1 = `${entryName} carries the at-home colour pool at ${stageLc} on ${tc(primary)}.`; break;
      case 'regulatory_compliant':
        s1 = `${entryName} becomes the only saleable format at ${stageLc} once ${tc(primary)} bites — pool migrates by mandate.`; break;
      case 'between_wash':
        s1 = `${entryName} unlocks a new consumer occasion at ${stageLc} — ${tc(primary)}.`; break;
      case 'male_grooming':
        s1 = `${entryName} taps the under-penetrated male pool at ${stageLc}: ${tc(primary)}.`; break;
      case 'cold_wash':
        s1 = `${entryName} captures the cold-wash migration at ${stageLc} — ${tc(primary)}.`; break;
      case 'protection_longevity':
        s1 = `${entryName} extends touchpoints at ${stageLc} from the wash itself to garment-life management: ${tc(primary)}.`; break;
      case 'media_retail':
        s1 = `${entryName} grows at ${stageLc} as ${tc(primary)} reroutes brand-discovery economics through retailer-owned surfaces.`; break;
      default:
        s1 = `${entryName} expands at ${stageLc}: ${tc(primary)}.`;
    }
  } else {
    switch (arch) {
      case 'ai_smart':
        s1 = `${entryName} is being designed out of the ${stageLc} step — ${tc(primary)} routes the same demand through a cleaner interface.`; break;
      case 'manual_traditional':
        s1 = `${entryName} is displaced at ${stageLc} as ${tc(primary)} substitutes the function the entry used to own.`; break;
      case 'private_label':
        s1 = `${entryName} continues taking branded ${stageLc} share — ${tc(primary)} is the structural mechanism, branded tier the loser.`; break;
      case 'value_tier':
        s1 = `${entryName} is the squeezed slice at ${stageLc}: private label takes share from below (${primary?.code ?? 'C-01'}: ${primary?.clause ?? 'PL penetration'})${has(secondary) ? `, while ${tc(secondary)} pushes mid-market shoppers down the price ladder` : ''}.`; break;
      case 'premium_salon':
        s1 = `${entryName} loses share at ${stageLc} as ${tc(primary)} reroutes premium demand into adjacent formats.`; break;
      case 'format_innovation':
        s1 = `${entryName} loses pool at ${stageLc} because ${tc(primary)} substitutes the format.`; break;
      case 'bio_eco':
        s1 = `${entryName} compresses at ${stageLc} as ${tc(primary)}.`; break;
      case 'fragrance_scent':
        s1 = `${entryName} compresses at ${stageLc} — ${tc(primary)}.`; break;
      case 'repair_treatment':
        s1 = `${entryName} loses share at ${stageLc} as ${tc(primary)}.`; break;
      case 'styling':
        s1 = `${entryName} contracts at ${stageLc} as ${tc(primary)}.`; break;
      case 'color':
        s1 = `${entryName} loses pool at ${stageLc} as ${tc(primary)}.`; break;
      case 'regulatory_compliant':
        s1 = `${entryName} loses ground at ${stageLc} once non-compliant alternatives clear the shelf: ${tc(primary)}.`; break;
      case 'between_wash':
        s1 = `${entryName} compresses at ${stageLc} — ${tc(primary)}.`; break;
      case 'male_grooming':
        s1 = `${entryName} loses share at ${stageLc} as ${tc(primary)}.`; break;
      case 'cold_wash':
        s1 = `${entryName} compresses at ${stageLc} as ${tc(primary)}.`; break;
      case 'protection_longevity':
        s1 = `${entryName} loses pool at ${stageLc} — ${tc(primary)}.`; break;
      case 'media_retail':
        s1 = `${entryName} contracts at ${stageLc} as ${tc(primary)} reroutes the discovery and trade-promo economics.`; break;
      default:
        s1 = `${entryName} compresses at ${stageLc}: ${tc(primary)}${has(secondary) ? `, with ${tc(secondary)} stacking on top` : ''}.`;
    }
  }

  // Optional second summary sentence — entry-specific competitor / HCB stake
  let s2 = '';
  if (whiteSpace) {
    s2 = isExp
      ? `Henkel has no anchored asset on ${entryName} today${namedCompetitor ? `; ${namedCompetitor} is setting the consumer default in real time.` : '.'}`
      : `${bu} carries no exposure here, so the entry is mostly a signal for where the migrating ${stageLc}-stage demand should be redeployed.`;
  } else if (isExp && namedCompetitor) {
    s2 = `${namedCompetitor} owns the consumer default; ${leadBrand} is the asset ${bu} can challenge it with.`;
  } else if (!isExp && namedCompetitor) {
    s2 = `${namedCompetitor} accelerates the squeeze; ${leadBrand} carries the exposure.`;
  } else if (has(secondary)) {
    s2 = isExp ? `Reinforcing vector: ${tc(secondary)}.` : `Compounding pressure: ${tc(secondary)}.`;
  }
  const summary = s2 ? `${s1} ${s2}` : s1;

  // ════════ STRATEGIC EVALUATION: archetype-specific HCB move (~1 sentence) ════════
  let e1 = '';
  // Whitespace cases first — different language family entirely
  if (whiteSpace && isExp) {
    switch (arch) {
      case 'ai_smart':
        e1 = `Build the AI surface on ${leadBrand} credibility; ${namedCompetitor || 'the structural competitor'} hardens the consumer default in roughly 18-24 months and the cost of catch-up is M&A, not NPD.`; break;
      case 'service_advisory':
        e1 = `Stand up a ${leadBrand}-branded advisory tool now — diagnostic IP is the cheapest moat available before ${namedCompetitor || 'a DTC challenger'} claims the trichological credibility consumers expect.`; break;
      case 'refill_subscription':
        e1 = `Pilot a ${leadBrand} DTC/auto-replenishment offer before Amazon Subscribe-and-Save and ${namedCompetitor || 'the connected-OEM partner'} capture the habit at scale.`; break;
      case 'between_wash':
        e1 = `${leadBrand} is the natural fabric-refresh extension; ship before P&G defends Febreze with a refresh-3.0 SKU.`; break;
      case 'repair_treatment':
        e1 = `Upgrade ${leadBrand} into a clinical-grade range at mass price — Olaplex/K18 are anchoring the consumer narrative and waiting another cycle hands them the category.`; break;
      case 'protection_longevity':
        e1 = `Extend ${leadBrand} into garment-protection / fabric-refresh — the EU Circular Textiles regulation makes this segment compounding, not cyclical.`; break;
      case 'bio_eco':
        e1 = `Anchor a bio-enzymatic claim under ${leadBrand}; PFAS and microplastic regulation locks in the structural cost-of-entry advantage for whoever moves first.`; break;
      case 'regulatory_compliant':
        e1 = `${leadBrand} is the platform; reformulate ahead of the regulation cycle and use compliance as the competitive wedge.`; break;
      default:
        e1 = `Build or buy under ${leadBrand} now${namedCompetitor ? `; each quarter without anchored claim raises the M&A premium against ${namedCompetitor}` : ''}.`;
    }
  } else if (whiteSpace && !isExp) {
    e1 = `No legacy SKU to defend — the value here is the read-across: redirect freed-up ${stageLc}-stage shelf and media into the adjacent expansion vector that ${leadBrand} can credibly anchor.`;
  } else if (!whiteSpace && isExp) {
    // Entrenched expansion — branch by archetype, give specific HCB move
    switch (arch) {
      case 'ai_smart':
        e1 = `Persil's connected-laundry stack is the platform; ship the consumer-facing app and OEM-integration before ${namedCompetitor || 'a structural rival'} sets the default.`; break;
      case 'service_advisory':
        e1 = `${leadBrand} has the credibility; the live question is monetisation, not capability — package the advisor as a brand-led layer, not a free utility.`; break;
      case 'refill_subscription':
        e1 = `${leadBrand}'s OEM partnerships build the lock-in; sequence the cartridge SKU launch before ${namedCompetitor || 'P&G/Unilever'} signs the same OEMs.`; break;
      case 'format_innovation':
        e1 = `Persil Discs is the format weapon already in market; reinvest concentrated-format claim and trade-promo before ${namedCompetitor || 'a structural rival'} resets the shelf.`; break;
      case 'premium_salon':
        e1 = `Schwarzkopf Professional is the salon-credible asset; fund the consumer-tier extension before ${namedCompetitor || 'a structural rival'} owns both ends of the trade-up path.`; break;
      case 'bio_eco':
        e1 = `${leadBrand}'s bio/enzymatic IP is the live differentiator; lead with EU regulatory positioning to lock in the structural cost-of-entry advantage.`; break;
      case 'fragrance_scent':
        e1 = `${leadBrand}'s freshness/scent equity is the platform; differentiate against ${namedCompetitor || "a structural rival"}'s synthetic-scent overload with bio-based, conscious-consumption claims.`; break;
      case 'repair_treatment':
        e1 = `${leadBrand} is the bond-repair asset at mass price; capture the Olaplex-equivalent claim before K18/Olaplex compress the premium-mass gap.`; break;
      case 'styling':
        e1 = `${leadBrand} is Europe's strongest styling portfolio; premiumise finishing claims (color-lock, bond-seal) to defend share against ${namedCompetitor || 'indie premium'}.`; break;
      case 'color':
        e1 = `Schwarzkopf is European #1 in at-home colour; defend Keratin Color innovation against ${namedCompetitor || "L'Oréal premium"} from above and PL value pressure from below.`; break;
      case 'between_wash':
        e1 = `${leadBrand} is the natural extension; ship the refresh range before ${namedCompetitor || 'Febreze'} defends with refresh-3.0.`; break;
      case 'value_tier':
        e1 = `${leadBrand} shields trade-down at the value tier; expand discount-channel listings while Persil/premium pulls margin at the top.`; break;
      case 'cold_wash':
        e1 = `${leadBrand}'s cold-wash formulation IP is the wedge; lead the efficacy claim against ${namedCompetitor || 'P&G Ariel'}'s "Turn To 30" before the cold-wash narrative settles.`; break;
      case 'protection_longevity':
        e1 = `${leadBrand} can extend wash-in protection into a multi-touchpoint garment-care system, multiplying revenue per consumer 3-4x.`; break;
      default:
        e1 = `${leadBrand} is the live revenue line; mobilise it at the speed of the trend before ${namedCompetitor || 'a structural rival'} locks in distribution and claim.`;
    }
  } else {
    // Entrenched contraction — archetype-specific harvest/redeploy move
    switch (arch) {
      case 'value_tier':
        e1 = `Weißer Riese/Spee absorb the trade-down at the value tier; Persil pulls premium. The middle is the funding line for the expansion segment, not a defence line.`; break;
      case 'manual_traditional':
        e1 = `${leadBrand} is exposed via the legacy format; redirect the manual-format budget into the connected/concentrated SKU where the demand is migrating.`; break;
      case 'premium_salon':
        e1 = `${leadBrand} is exposed; pivot R&D investment from broad premium claims into ingredient-led positioning (peptides, microbiome) where ${namedCompetitor || 'DTC challengers'} are taking share.`; break;
      case 'format_innovation':
        e1 = `${leadBrand}'s legacy format is exposed; rotate listings into the substitute format the same brand can credibly anchor.`; break;
      case 'color':
        e1 = `Schwarzkopf colour is the exposure; defend with bond-protection innovation against ${namedCompetitor || 'DTC subscription colour'} and PL value pressure.`; break;
      case 'styling':
        e1 = `${leadBrand} styling is exposed; rotate facings toward dry shampoo, texture sprays and the between-wash occasion.`; break;
      case 'fragrance_scent':
        e1 = `${leadBrand} is exposed; redirect into bio-based / conscious-fragrance claims where the consumer narrative is moving.`; break;
      case 'repair_treatment':
        e1 = `${leadBrand} is exposed; redeploy treatment innovation budget into the multi-step routine basket where the trade-up is happening.`; break;
      case 'private_label':
        e1 = `Branded share is the exposure; defend Persil/${leadBrand} premium with demonstrable superiority claims and use Weißer Riese/Spee/all/Purex as PL-trade-down shields.`; break;
      case 'ai_smart':
        e1 = `${leadBrand}'s legacy interface is the exposure; ship the connected/app replacement before the demand is fully reabsorbed by the OEM ecosystem.`; break;
      default:
        e1 = `${leadBrand} carries the exposure; harvest the cash and redirect the trade and media envelope into the adjacent ${stageLc}-stage expansion segment.`;
    }
  }

  return `**1. Summary.** ${summary}\n\n**2. Strategic Evaluation.** ${e1}`;
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
  'C-08': { name: 'Male Grooming Structural Growth', force: 'Consumer', description: 'European male grooming market at $23.6B growing 7.65% CAGR. Under-penetrated in Hair relative to female segments — structural expansion opportunity.' },
  'C-12': { name: 'Post-COVID Hygiene Habits Persistence', force: 'Consumer', description: 'Elevated hygiene consciousness persisting — surface disinfection and fabric hygiene baselines 20-30% above pre-COVID levels.' },
  'C-13': { name: 'Refill & Reuse Economy in Household Care', force: 'Consumer', description: 'Growing demand for refillable cleaning products at 12%+ CAGR. Concentrated refills reduce logistics cost 40-60%. Aligned with PPWR mandates.' },
  'C-14': { name: 'Between-Wash Fabric Care Occasion', force: 'Consumer', description: 'Fabric refresh sprays, garment steamers growing 8-10% CAGR. Febreze is $1B+. Sustainability-driven outfit repeating expands between-wash demand.' },
  'C-15': { name: 'Hair Styling Between Washes', force: 'Consumer', description: 'Dry shampoo at 7%+ CAGR, texture sprays fastest-growing Hair sub-segment. Batiste dominates 40%+ share. Distinct styling-convenience occasion.' },
  'G-06': { name: 'EU Deforestation Regulation (EUDR)', force: 'Government', description: 'Requires geolocation-level traceability for palm oil derivatives. Applies December 2026 for large companies.' },
  'G-07': { name: 'EU Digital Product Passport (DPP)', force: 'Government', description: 'Digital record of composition, lifecycle, and sustainability data via QR code. Detergents in first wave ~2027-2028.' },
  'G-08': { name: 'Tariffs, Trade Wars & Deglobalization', force: 'Government', description: 'US tariff escalation, EU retaliatory measures, and China-EU trade friction driving 5-15% raw material cost increases for global FMCG.' },
  'K-01': { name: 'Discount Retail Channel Expansion', force: 'Customer', description: 'Aldi/Lidl at 25-35% grocery share in Germany, UK, Benelux — still growing. Expanding into premium PL and beauty/personal care.' },
  'K-02': { name: 'E-Commerce Profit Pool Maturation', force: 'Customer', description: 'FMCG e-commerce at 12-15% of sales. Pay-to-play economics with Amazon Subscribe & Save capturing habitual replenishment.' },
  'K-03': { name: 'Retailer Consolidation & Power Concentration', force: 'Customer', description: 'Top 10 European grocers control 40-50% of sales. Rising listing fees and promotional demands compressing manufacturer margins.' },
  'K-05': { name: 'Quick Commerce Consolidation', force: 'Customer', description: 'European q-commerce ~$64B after consolidation. Surviving players integrating with traditional retail.' },
  'T-06': { name: 'Retail Media Networks', force: 'Technology', description: 'Retail media projected $200B by 2027. FMCG at 39% of ad spend. Precision targeting but another margin extraction layer on top of trade spend.' },
  'T-09': { name: 'Generative AI Disrupts Product Discovery', force: 'Technology', description: '35% of US consumers use AI for product discovery. Google search CTR declining. Brands not cited by LLMs lose consideration before the shelf.' },
  'T-10': { name: 'Gen AI Marketing Efficiency', force: 'Technology', description: 'Gen AI enables 40-60% cost reduction in content production. Automated creative, localization, and personalization at near-zero marginal cost.' },
  'X-01': { name: 'Reckitt Essential Home Divestiture', force: 'Competitive', description: 'Advent acquired Reckitt Essential Home (Air Wick, Calgon, Woolite, Vanish) for $4.8B. PE ownership = cost-cutting focus, brand investment decline.' },
  'X-02': { name: 'Unilever Beauty & Wellbeing Pivot', force: 'Competitive', description: 'Unilever targeting 66% revenue from Beauty & Wellbeing by 2030. €50.5B revenue with massive Hair competitive overlap via Dove, TRESemmé.' },
  'X-03': { name: 'P&G Superiority Framework', force: 'Competitive', description: 'P&G irresistible superiority drives disproportionate R&D and media investment. Ariel, Fairy, Pantene, H&S set category innovation bar.' },
  'X-04': { name: 'DTC & Indie Brand Disruption in Hair', force: 'Competitive', description: 'Olaplex, K18, Function of Beauty capturing fastest-growing premium Hair sub-segments. Eroding premiumization growth for legacy brands.' },
  'X-06': { name: 'Emerging Markets Growth (IMEA)', force: 'Competitive', description: 'Henkel IMEA delivered 12.1% organic growth FY2025 vs 0.9% group average. India, Middle East, Africa as structural growth drivers.' },
  'E-01': { name: 'Palm Oil Supply Chain Disruption', force: 'Environmental', description: 'Indonesia B50 mandate diverts palm oil to fuel. Oleochemical supply for FMCG surfactants threatened. 20-40% price spikes on oleochemicals.' },
  'E-03': { name: 'Carbon Border Adjustment (CBAM)', force: 'Environmental', description: 'EU CBAM phasing in 2026-2034. CSRD Scope 3 mandatory reporting creates cost pressure through supply chain.' },
  'E-04': { name: 'EPR Fee Escalation & Eco-Modulation', force: 'Environmental', description: 'EPR fees escalating with eco-modulation penalties 2-5x for hard-to-recycle packaging. Multi-material packaging incurs highest penalties.' },
  'E-06': { name: 'Supply Chain Nearshoring', force: 'Environmental', description: 'Post-COVID and geopolitical tension driving FMCG supply chain diversification. Nearshoring chemical production adds short-term cost.' },
  'E-07': { name: 'Energy Cost Volatility', force: 'Environmental', description: 'European energy costs 2-3x US levels. Structural COGS disadvantage for EU FMCG manufacturers. Energy is 8-15% of manufacturing COGS.' },
  'E-08': { name: 'Textile Longevity & Garment Life Extension', force: 'Environmental', description: 'EU Circular Textiles Strategy mandates durability standards. Growing demand for fabric protection, pilling removers, color-restore treatments.' },
  // ── v3.5 catalog extension: remaining trend shortcodes ──
  // Consumer additions
  'C-16': { name: 'China C-Beauty Nationalism and Domestic Brand Preference', force: 'Consumer', description: 'C-Beauty nationalism confirmed — domestic brands 56% of China beauty value. Schwarzkopf China is relatively small within Henkel total GP1 (estimated 3-5% of total Hair revenue), making original 15% gp1_pct_affected overstated.' },
  'C-17': { name: 'India Premium Affordability and Middle-Class Expansion', force: 'Consumer', description: 'India BPC market $30B, 11% CAGR confirmed as fastest-growing top-10 market. Affordable-premium tier requires India-specific pack sizes (Rs 10-50 sachets for trial, Rs 100-200 for regular), local fragrance preferences, and General Trade d…' },
  'C-18': { name: 'US Hispanic/Latino Consumers Drive Hair and LHC Category Growth', force: 'Consumer', description: 'Demographics and spending data confirmed. Henkel US portfolio (Schwarzkopf, got2b, Dial, Persil, all, Purex) has minimal Hispanic-targeted offerings. Textured/curly hair gap is acute — no curl care line comparable to Shea Moisture (Unile…' },
  'C-19': { name: 'Southeast Asia Digital-First Beauty Market', force: 'Consumer', description: '600M consumers with the world\'s highest e-commerce growth rates. Shopee, Lazada, and TikTok Shop dominate beauty distribution. Indonesia, Vietnam, Philippines, and Thailand are growth leaders.' },
  'C-20': { name: 'Brazil/Mexico Premiumization and Nearshoring Beneficiary', force: 'Consumer', description: 'Latin America BPC market $60B+ and growing. Brazil is world\'s #4 beauty market with strong premiumization trend. Mexico benefits from US tariff-driven nearshoring — manufacturing investment up 40% since 2023.' },
  'C-21': { name: 'Longevity Medicine Crossover into Beauty and Hair Care', force: 'Consumer', description: 'Global anti-aging market reaching $120B by 2030 (7% CAGR from $85B in 2025). Industry pivoting from cosmetic \'anti-aging\' to science-backed \'longevity\' — biological resilience, cellular repair, peptide therapy, NAD+ supplementation.' },
  'C-22': { name: 'Laundry Sheet/Strip Format Disruption', force: 'Consumer', description: 'Detergent sheets and ultra-concentrated strips gaining traction: Earth Breeze, Tru Earth, Blueland leading. Plastic-free eco positioning appeals to Gen Z/Millennial consumers.' },
  'C-23': { name: 'Wellness-to-Beauty Convergence: Ingestibles + Topicals', force: 'Consumer', description: 'Supplement + topical regimens combining for holistic beauty outcomes. Nutrafol (Unilever) proving model: oral supplements + topical products for hair health. Market expanding beyond niche: collagen supplements, biotin, and adaptogens mainstreaming.' },
  'C-24': { name: 'Natural/Textured Hair as Mainstream Global Category', force: 'Consumer', description: '65% of the world\'s population has textured, curly, or coily hair — yet mainstream hair care portfolios are designed primarily for straight/wavy hair types. This is the largest structural white space in global hair care.' },
  'C-25': { name: 'Birth Rate Collapse and Household Atomisation', force: 'Consumer', description: 'Sub-replacement fertility is now structural across Europe (TFR 1.38), East Asia (Korea 0.72, Japan 1.20), and North America (1.62). Average household size declined from 2.6 (2000) to 2.2 (2025) in EU; single-person households now 35%+ in Germany.' },
  'C-26': { name: 'Gen Alpha (2010+) Enters Personal-Care Category', force: 'Consumer', description: 'Gen Alpha (born 2010-2024) begins entering the personal-care category in earnest 2026-2030 as the oldest cohort turns 14-16. Early signals from Sephora Kids phenomenon (skincare at 8-12) indicate formative category entry is happening ear…' },
  'C-27': { name: 'Hand-Dish to Auto-Dish Conversion in Emerging Markets', force: 'Consumer', description: 'Dishwasher penetration in India (4%), China (12%), Brazil (9%), Mexico (15%) remains far below developed-market levels (Germany 71%, US 68%). Middle-class expansion in these geographies (300M+ new middle-class households 2026-2036) is th…' },
  'C-28': { name: 'Laundry Scent Boosters as Structural Premium Category', force: 'Consumer', description: 'Laundry scent boosters (P&G Lenor Unstoppables archetype) have graduated from category novelty to structural premium LAD segment. EU scent-booster market €2B in 2025, forecast €4.5B by 2030 (+18% CAGR).' },
  'C-29': { name: 'Delicates & Performance Fabric Care Revival (Perwoll Occasion)', force: 'Consumer', description: 'Technical-fabric ownership (athleisure, merino, performance synthetics) now represents 35%+ of the average European wardrobe vs. 12% a decade ago. These fabrics are not served by standard detergent — they require specialty care (delicate…' },
  'C-30': { name: 'Longevity Economy — LHC / Home Hygiene Split', force: 'Consumer', description: 'consumer_r21 (Longevity Economy) correctly captures the Hair/Beauty side of the longevity wave but the LHC-specific dimension has been missed. 60+ consumers represent 40% of LHC spend in Europe and spend 1.8x the adult average on home hy…' },
  'C-31': { name: 'Cleaning-Fluency Generational Decline (Gen Z Home-Care Literacy)', force: 'Consumer', description: 'Gen Z enters adult household formation (2026-2030) with materially lower \'cleaning fluency\' than prior generations — only 34% know when to use specialty cleaners, versus 68% of Gen X (NielsenIQ 2025).' },
  'C-32': { name: 'Beauty-as-Medicine / Tele-Derm DTC (Hair & Scalp)', force: 'Consumer', description: 'Direct-to-consumer tele-dermatology services (Hims Hair, Hers, Ro, Nurx) have built $2B+ run-rates in hair/scalp treatment prescriptions (finasteride, minoxidil, spironolactone).' },
  // Customer additions
  'K-08': { name: 'US Retail Media Networks Reshape Brand-Customer Economics', force: 'Customer', description: 'US retail media: $58.8B in 2025 (revised up from $55B), $69.3B forecast 2026. Amazon 79.7% share, Walmart 8.0%, capturing 89% of incremental spend. Retailers demand 8-12% of net revenue for media as condition of visibility.' },
  'K-09': { name: 'Agentic Commerce Reshapes Retailer-Brand Power Dynamics', force: 'Customer', description: 'Retailer-side mirror of NEW-01 (technology_r11). When AI agents handle grocery purchasing, traditional retail power structures dissolve: shelf placement, trade promotion, category captainship all lose relevance.' },
  'K-10': { name: 'Chinese Live-Commerce / Douyin Model Exports', force: 'Customer', description: 'Live-commerce (livestream shopping with immediate cart integration) captured 10-12% of Chinese FMCG retail by 2024 and is now exporting at speed: TikTok Shop Live in SEA (Indonesia 8% by 2025), Europe (UK live-commerce +140% YoY), and accelerating.' },
  'K-11': { name: 'Retailer Loyalty Program Cannibalisation of Trade Spend', force: 'Customer', description: 'Retailer loyalty programs (Tesco Clubcard, Kroger, Carrefour Rewards, dm App) are evolving from marketing vehicles into data-brokerage platforms that capture first-party consumer data and monetise it back to brands at a premium over traditional retail media.' },
  // Technology additions
  'T-11': { name: 'Agentic Commerce: AI Agents Make Autonomous Purchase Decisions', force: 'Technology', description: 'By 2030, Morgan Stanley estimates AI shopping agents will capture $190-385B of US e-commerce spending (10-20% of online retail). McKinsey projects $3-5T globally.' },
  'T-12': { name: 'AI Agent Brand Invisibility in Low-Consideration Categories', force: 'Technology', description: 'When AI agents make autonomous replenishment decisions, brand equity is bypassed for functional categories. Agents optimize on price-per-use, ratings, sustainability scores, and availability — not brand memory.' },
  'T-13': { name: 'Generative Search (GEO) Replaces Traditional Product Discovery — Expanded', force: 'Technology', description: 'Expands M-01 (technology_r09). Pace of disruption exceeds original assessment: 35% of US consumers now use AI for product discovery vs. 13.6% using traditional search.' },
  'T-14': { name: 'Peptide and Bioactive Hair Science', force: 'Technology', description: 'GHK-Cu peptides, NAD+ precursors, and bioactive compounds entering consumer hair formulation. Lab-to-shelf timeline compressing from 5 years to 18-24 months via AI formulation (T-01).' },
  'T-15': { name: 'Precision Fermentation Disrupts FMCG Ingredient Supply Chains', force: 'Technology', description: 'Precision fermentation market projected at $36B by 2030 (43-48% CAGR). Key FMCG ingredients — surfactants, fragrances, proteins, emollients — can be produced via engineered microorganisms in fermentation tanks.' },
  'T-16': { name: 'Synthetic Biology Enables Novel Surfactants and Fragrances', force: 'Technology', description: 'Synthetic biology enables bio-identical production of aroma molecules, specialty surfactants, and functional proteins without agricultural extraction. Moves beyond precision fermentation (NEW-09) to entirely novel molecules impossible in nature.' },
  'T-17': { name: 'Neurocosmetics and Sensory-Science Hair Care', force: 'Technology', description: 'Neurocosmetics — the science of topical ingredients acting on nerve endings to produce measurable sensory/wellbeing outcomes — has moved from claim to mechanism with peer-reviewed evidence in 2024-2025 (IFSCC, JCD publications).' },
  'T-18': { name: 'Bathroom and Laundry-Room IoT — Connected Dispensers, Smart Mirrors', force: 'Technology', description: 'Distinct from Smartwash (technology_r08, in-machine dosing). This trend captures the broader smart-home extension into bathroom (smart mirrors with skin/hair diagnostics — Lululemon Mirror patents, Withings Body Scan adjacent) and laundr…' },
  // Government additions
  'G-09': { name: 'US Tariffs and Reshoring Pressure on Imported FMCG Inputs', force: 'Government', description: 'US tariff escalation confirmed. Henkel US supply chain vulnerabilities: Culver City (Hair Care) and Scottsdale (LHC) operations rely on imported Asian ingredients.' },
  'G-10': { name: 'EU AI Act Compliance Costs and Speed-to-Market Friction', force: 'Government', description: 'EU AI Act fully applicable August 2, 2026; high-risk AI in regulated products extended to August 2, 2027. Every AI-powered system Henkel deploys must be classified and assessed: formulation AI (T-01), pricing algorithms, Smartwash dosing…' },
  'G-11': { name: 'Biodiversity Regulation and Nature-Related Supply Chain Mandates', force: 'Government', description: 'Kunming-Montreal Global Biodiversity Framework mandates halting biodiversity loss by 2030: 30% land/marine protection, 30% restoration. EU CSDDD and TNFD reporting require companies to assess and minimize biodiversity risks throughout value chains.' },
  'G-12': { name: 'EU Textile Strategy and Circular Fashion Mandates', force: 'Government', description: 'EU Strategy for Sustainable and Circular Textiles imposes garment longevity requirements and textile waste reduction targets. Directly affects Henkel\'s fabric care positioning: Perwoll, Persil, and Vernel can be repositioned as \'garmen…' },
  'G-13': { name: 'MoCRA + US State Cosmetics Regulation (CA Prop 65, NY, WA)', force: 'Government', description: 'MoCRA (Modernization of Cosmetics Regulation Act, 2022) enforcement phases fully in through 2028 — FDA registration, GMP, adverse-event reporting, fragrance-allergen disclosure all now binding.' },
  // Environmental additions
  'E-09': { name: 'Climate Adaptation Costs for European Manufacturing', force: 'Environmental', description: 'Extreme weather events disrupting European supply chains with increasing frequency. Henkel\'s 15+ European manufacturing plants face flood risk (Rhine corridor), heat stress (production shutdowns above 40C), and water supply constraints.' },
  'E-10': { name: 'Freshwater Crisis Accelerates Waterless Formulation Mandate', force: 'Environmental', description: 'Global freshwater demand will exceed supply by 40% by 2030 (UNEP). Half the world faces severe water stress. Expands and upgrades environmental_r02 (Water Scarcity) for the 10-year horizon.' },
  'E-11': { name: 'Scope 3+ Value Chain Decarbonization Mandates', force: 'Environmental', description: 'CBAM expansion to downstream products proposed Dec 2025, decision pending. Likely to include surfactants, formulated products by 2027-2028. EU ETS carbon price EUR 75/tonne (Q1 2026) and rising.' },
  // Competitive additions
  'X-05': { name: 'Chinese FMCG Brands Enter European Market', force: 'Competitive', description: 'Chinese brand EU penetration <2% but monitoring warranted. New risk: US tariffs (G-09) on Chinese goods may redirect export efforts toward tariff-free EU market via TikTok Shop/Temu — accelerating European entry.' },
  'X-07': { name: 'L\'Oreal Tech-Beauty Platform Strategy', force: 'Competitive', description: 'L\'Oréal FY2025: €44.05B sales (+4% LfL), 725 patents filed, 4,000+ scientists. Professional Products +15% led by Kérastase. K-SCAN AI camera proved +23% salon sales uplift.' },
  'X-08': { name: 'K-Beauty and J-Beauty Export Wave into NA and EU Hair Care', force: 'Competitive', description: 'K-beauty expansion confirmed: Europe market $2.7B (2025), 6.4% CAGR. Amorepacific led EU with 12%+ share. Mise-en-Scène Perfect Serum #1 on Amazon Black Friday. Europe tripled K-beauty export share (3% to 11%, 2022-2025).' },
  'X-09': { name: 'Sub-Saharan Africa: $200B FMCG Frontier by 2030', force: 'Competitive', description: 'Africa\'s FMCG market projected at $200B by 2030, driven by 1.7B consumers. Urbanization and middle-class expansion fuel demand. Private label competition lighter than Europe.' },
  'X-10': { name: 'Amazon/Platform Vertical Integration into FMCG', force: 'Competitive', description: 'Amazon\'s private label operation is qualitatively different from traditional retail PL. Amazon possesses real-time consumer behavior data, search intent data, and review sentiment analysis.' },
  'X-11': { name: 'L\'Oreal NVIDIA AI Molecule Discovery Partnership', force: 'Competitive', description: 'L\'Oreal partnered with NVIDIA for atomic-scale AI-powered molecule discovery. 725 patents filed in 2025. R&D investment EUR 1.7B (4% of revenue) is 4-5x Henkel HCB.' },
  'X-12': { name: 'DTC/Indie Brand Acquisition Arms Race Intensifies', force: 'Competitive', description: 'Major acquisitions 2025-26: Rhode (e.l.f., $1B+), Medik8 (L\'Oreal, $1.1B), Color Wow (L\'Oreal), Dr Squatch (Unilever, $1.5B). Specialist beauty buyers consolidating indie brands into multi-channel platforms.' },
  'X-13': { name: 'Walmart / Costco / Aldi Vertical Integration into FMCG Supply', force: 'Competitive', description: 'Top retailers are moving beyond traditional PL into full vertical integration. Walmart operates contract manufacturing for Great Value and has announced investment in dedicated CPG manufacturing capacity (2025).' },

  // ── v3.5 catalog extension: Gemini-review trend shortcodes ──
  'C-33': { name: 'Ultra-Fast-Fashion Beauty: Shein/Temu-Style Price Floor Collapse', force: 'Consumer', description: 'Shein, Temu and Pinduoduo-owned beauty lines are replicating the ultra-fast-fashion model in mass hair and body care: direct-from-Guangzhou shipping, <€3 hero SKUs, creator-driven virality. Euromonitor and WGSN both flag 2026 as the tipping point for category contamination outside of apparel.' },
  'T-19': { name: 'Neuro-Scents: Functional Fragrance with Measured Neuro-Benefit', force: 'Technology', description: 'A new class of fragrance formulation backed by EEG and fMRI validation: scents engineered and clinically tested for stated cognitive/emotional outcomes (focus, calm, sleep onset, stress reduction). IFF, Givaudan and Symrise are all building neuroscience labs; Estée Lauder and L\'Oréal have filed neuro-functional fragrance patents; startups like Osmo and Arcaea are pushing algorithmic scent design.' },
  'X-14': { name: 'AfCFTA Implementation Unlocks Pan-African Competitive Pressure', force: 'Competitive', description: 'The African Continental Free Trade Area (AfCFTA) is moving from ratification (2019-22) to operational tariff-harmonisation (2026-28). McKinsey and the World Bank project a $450B GDP uplift and a 50%+ increase in intra-African trade by 2035.' },
  'G-14': { name: 'Biodegradability Standards Tighten Around PVA Unit-Dose Films', force: 'Government', description: 'Polyvinyl alcohol (PVA/PVOH) is the water-soluble polymer film used in virtually all liquid laundry and dishwasher pods. It is currently classified as biodegradable under OECD 301 standards, but a coalition of environmental NGOs and marine biologists is in 2026 successfully petitioning the EU Parliament and the US EPA to reclassify PVA as a shedder of non-degrading nano-plastics in cold-water, low-shear washing conditions.' },
};

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function intensityArrows(direction: 'expansion' | 'contraction', intensity: 1 | 2 | 3): string {
  const arrow = direction === 'expansion' ? '↑' : '↓';
  return arrow.repeat(intensity);
}

function intensityLabel(intensity: 1 | 2 | 3): string {
  return intensity === 3 ? 'Strong' : intensity === 2 ? 'Moderate' : 'Mild';
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT INTERFACES
// ═══════════════════════════════════════════════════════════════

interface ConsumerJourney2Props {
  onBack?: () => void;
  onNavigateToTrend?: (trendSearch: string) => void;
  onNavigateProfitPoolShiftModel?: () => void;
  onNavigateTrends?: () => void;
  onNavigateInnovation?: () => void;
  isAdmin?: boolean;
}

interface SelectedProduct {
  entry: ProductEntry;
  direction: 'expansion' | 'contraction';
  stageName: string;
}

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

// ─── Pill-shaped filter chip (harmonized with Trends2) ───
const FilterChip: FC<{ label: string; active: boolean; onClick: () => void; icon?: React.ReactNode }> = ({ label, active, onClick, icon }) => (
  <button
    onClick={onClick}
    className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 hover:scale-[0.97]"
    style={{
      backgroundColor: active ? S.primaryContainer : S.surfaceLow,
      color:           active ? S.onPrimaryContainer : S.onSurfaceVariant,
      fontFamily: HEADLINE_FONT,
    }}
  >
    {icon}
    {label}
  </button>
);

// ─── Type filter chip (small-scale, uses type color) ───
const TypeChip: FC<{ typeKey: string; style: typeof TYPE_STYLES[string]; active: boolean; onClick: () => void }> = ({ style, active, onClick }) => (
  <button
    onClick={onClick}
    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-[0.08em] transition-all duration-200 hover:scale-[0.97]"
    style={{
      backgroundColor: active ? style.bg : S.surfaceLow,
      color:           active ? style.text : S.onSurfaceVariant,
      fontFamily: HEADLINE_FONT,
      opacity: active ? 1 : 0.6,
    }}
  >
    <span
      className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-extrabold"
      style={{
        backgroundColor: active ? style.text : S.surfaceHigh,
        color:           active ? style.bg : S.onSurfaceVariant,
      }}
    >
      {style.short}
    </span>
    {style.label}
  </button>
);

// ─── Direction legend pill ───
const LegendPill: FC<{ direction: 'expansion' | 'contraction' }> = ({ direction }) => {
  const isExp = direction === 'expansion';
  const Icon = isExp ? TrendingUp : TrendingDown;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-[0.06em] uppercase"
      style={{
        backgroundColor: isExp ? S.expansionContainer : S.errorContainer,
        color:           isExp ? S.onExpansionContainer : S.onErrorContainer,
        fontFamily: HEADLINE_FONT,
      }}
    >
      <Icon size={12} strokeWidth={2.5} />
      {isExp ? 'Benefiting' : 'Declining'}
    </span>
  );
};

// ─── Intensity dot bar (3-level, mimics DotBar in Trends2) ───
const IntensityDots: FC<{ intensity: 1 | 2 | 3; direction: 'expansion' | 'contraction' }> = ({ intensity, direction }) => {
  const FILLED = direction === 'expansion' ? S.expansion : S.error;
  return (
    <div className="flex gap-1" aria-label={`Intensity ${intensity} of 3`}>
      {[1, 2, 3].map((d) => (
        <span
          key={d}
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: d <= intensity ? FILLED : S.surfaceHigh, opacity: d <= intensity ? 1 : 0.55 }}
        />
      ))}
    </div>
  );
};

// ─── Product pill (the clickable tile inside each stage) ───
const ProductPill: FC<{ entry: ProductEntry; direction: 'expansion' | 'contraction'; onClick?: () => void; isSelected?: boolean }> = ({ entry, direction, onClick, isSelected }) => {
  const typeStyle = (TYPE_STYLES[entry.type] ?? TYPE_STYLES['product'])!;
  const intensity = entry.intensity || 2;
  const colors = INTENSITY_COLORS[direction][intensity];

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left mb-1.5 rounded-lg transition-all duration-150 hover:scale-[0.99]"
      style={{
        padding: '6px 8px',
        background: isSelected ? colors.selectedBg : colors.bg,
        border: `1px solid ${isSelected ? colors.hoverBorder : colors.border}`,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 6,
        cursor: 'pointer',
      }}
      title={`${intensityLabel(intensity)} ${direction} · Click to view analysis`}
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
      <span
        style={{
          flexShrink: 0,
          width: 16, height: 16,
          borderRadius: 4,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontWeight: 800,
          background: typeStyle.bg, color: typeStyle.text,
          marginTop: 1,
          fontFamily: HEADLINE_FONT,
        }}
      >
        {typeStyle.short}
      </span>
      <span
        style={{
          fontSize: 11,
          color: S.onSurface,
          lineHeight: 1.35,
          fontWeight: intensity === 3 ? 600 : 500,
          fontFamily: BODY_FONT,
          flex: 1,
          minWidth: 0,
        }}
      >
        {entry.name}
      </span>
    </button>
  );
};

// ─── Section card (mirrors Trends2 SectionCard) ───
interface SectionCardProps {
  title: string;
  accent?: string;
  children: React.ReactNode;
}
const SectionCard: FC<SectionCardProps> = ({ title, accent, children }) => (
  <div style={{
    backgroundColor: S.surface,
    border: `1px solid ${S.cardBorder}`,
    borderRadius: 12,
    padding: '14px 16px 16px',
  }}>
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
    }}>
      <span style={{
        width: 4, height: 14, borderRadius: 2,
        backgroundColor: accent ?? S.primary,
      }} />
      <div style={{
        fontFamily: HEADLINE_FONT,
        fontSize: 11, fontWeight: 800, letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: S.onSurface,
      }}>
        {title}
      </div>
    </div>
    {children}
  </div>
);

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

const ConsumerJourney2: FC<ConsumerJourney2Props> = ({
  onNavigateToTrend,
  isAdmin,
}) => {
  const [activeTab, setActiveTab] = useState<'lhc' | 'hair'>('lhc');
  const [selectedProduct, setSelectedProduct] = useState<SelectedProduct | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState<{
    trendCodes: string[];
    stageName: string;
    type: 'product' | 'tech' | 'service';
    direction: 'expansion' | 'contraction';
    intensity: 1 | 2 | 3;
  } | null>(null);
  const [lhcJourney, setLhcJourney] = useState<JourneyStage[]>(LHC_JOURNEY);
  const [hairJourney, setHairJourney] = useState<JourneyStage[]>(HAIR_JOURNEY);
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set(['product', 'tech', 'service']));

  const handleProductClick = useCallback((entry: ProductEntry, direction: 'expansion' | 'contraction', stageName: string) => {
    setSelectedProduct({ entry, direction, stageName });
    setIsEditing(false);
    setEditValues(null);
  }, []);

  const journey = activeTab === 'lhc' ? lhcJourney : hairJourney;
  const subtitle = activeTab === 'lhc'
    ? '13 stages from Sorting to Between Washes — product types mapped by profit pool impact direction'
    : '8 stages from Inspire to Refresh — product types mapped by profit pool impact direction';

  // Count totals for eyebrow
  const totalBenefiting = journey.reduce((acc, s) => acc + s.benefiting.length, 0);
  const totalDeclining  = journey.reduce((acc, s) => acc + s.negativelyImpacted.length, 0);

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: S.bg, color: S.onBg, fontFamily: BODY_FONT }}
    >
      <main className="max-w-[1720px] mx-auto px-8 py-10">
        {/* ─── Editorial header with insight-rail accent ─── */}
        <header className="mb-8 flex items-start justify-between gap-8 flex-wrap">
          <div
            className="pl-5"
            style={{ borderLeft: `4px solid ${S.primary}` }}
          >
            <div
              className="text-xs font-semibold uppercase tracking-[0.18em] mb-2"
              style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}
            >
              Consumer Journey · Profit Flow Map
            </div>
            <h1
              className="font-extrabold tracking-tight"
              style={{
                fontFamily: HEADLINE_FONT,
                color: S.onBg,
                fontSize: '2.5rem',
                lineHeight: 1.1,
              }}
            >
              Where Profit Pools Shift Along the Journey
            </h1>
            <p
              className="mt-2 max-w-2xl text-[15px]"
              style={{ color: S.onSurfaceVariant, lineHeight: 1.55 }}
            >
              {subtitle}. Each pill maps a product, technology, or service to its
              profit-pool direction. Click a tile for the full strategic detail.
            </p>
          </div>

          {/* Summary counters */}
          <div className="flex items-center gap-3">
            <div
              className="px-4 py-2 rounded-2xl flex flex-col items-start"
              style={{ backgroundColor: S.expansionContainer }}
            >
              <span
                className="text-[10px] font-bold uppercase tracking-[0.12em]"
                style={{ color: S.onExpansionContainer, fontFamily: HEADLINE_FONT }}
              >
                Benefiting
              </span>
              <span
                className="font-extrabold"
                style={{
                  fontFamily: HEADLINE_FONT,
                  color: S.onExpansionContainer,
                  fontSize: '1.5rem',
                  lineHeight: 1.1,
                }}
              >
                {totalBenefiting}
              </span>
            </div>
            <div
              className="px-4 py-2 rounded-2xl flex flex-col items-start"
              style={{ backgroundColor: S.errorContainer }}
            >
              <span
                className="text-[10px] font-bold uppercase tracking-[0.12em]"
                style={{ color: S.onErrorContainer, fontFamily: HEADLINE_FONT }}
              >
                Declining
              </span>
              <span
                className="font-extrabold"
                style={{
                  fontFamily: HEADLINE_FONT,
                  color: S.onErrorContainer,
                  fontSize: '1.5rem',
                  lineHeight: 1.1,
                }}
              >
                {totalDeclining}
              </span>
            </div>
          </div>
        </header>

        {/* ─── Category toggle + type filter row ─── */}
        <section className="mb-6 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex gap-2">
            <FilterChip
              label="Laundry & Home Care"
              active={activeTab === 'lhc'}
              onClick={() => setActiveTab('lhc')}
            />
            <FilterChip
              label="Hair"
              active={activeTab === 'hair'}
              onClick={() => setActiveTab('hair')}
            />
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <LegendPill direction="expansion" />
              <LegendPill direction="contraction" />
            </div>
            <div
              className="h-5 w-px"
              style={{ backgroundColor: S.cardBorder }}
              aria-hidden="true"
            />
            <div className="flex gap-1.5">
              {Object.entries(TYPE_STYLES).map(([key, style]) => (
                <TypeChip
                  key={key}
                  typeKey={key}
                  style={style}
                  active={typeFilter.has(key)}
                  onClick={() => {
                    setTypeFilter(prev => {
                      const next = new Set(prev);
                      if (next.has(key)) next.delete(key);
                      else next.add(key);
                      return next;
                    });
                  }}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ─── Editorial paper card hosting the journey grid ─── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-2xl overflow-hidden"
          style={{
            backgroundColor: S.surface,
            boxShadow: '0 4px 60px -15px rgba(0, 52, 94, 0.08)',
          }}
        >
          {/* Grid scroll container */}
          <div
            style={{
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${journey.length}, minmax(0, 1fr))`,
                width: '100%',
                gap: 0,
              }}
            >
              {/* ─── Stage column headers ─── */}
              {journey.map((stage, i) => (
                <div
                  key={stage.id + '_header'}
                  style={{
                    padding: '18px 12px 14px',
                    textAlign: 'left',
                    backgroundColor: S.surfaceLow,
                    borderRight: i < journey.length - 1 ? `1px solid ${S.cardBorder}` : 'none',
                    borderBottom: `1px solid ${S.cardBorder}`,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: S.onSurfaceVariant,
                      letterSpacing: '0.15em',
                      textTransform: 'uppercase',
                      fontFamily: HEADLINE_FONT,
                    }}
                  >
                    Stage {i + 1}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: S.onSurface,
                      marginTop: 4,
                      lineHeight: 1.3,
                      fontFamily: HEADLINE_FONT,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {stage.label}
                  </div>
                </div>
              ))}

              {/* ─── Benefiting row ─── */}
              {journey.map((stage, i) => (
                <div
                  key={stage.id + '_benefit'}
                  style={{
                    backgroundColor: 'rgba(45,125,63,0.04)',
                    padding: '10px 8px',
                    borderRight: i < journey.length - 1 ? `1px solid ${S.cardBorder}` : 'none',
                    borderBottom: `1px solid ${S.cardBorder}`,
                    minHeight: 180,
                  }}
                >
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      fontSize: 9,
                      fontWeight: 800,
                      color: S.expansion,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      marginBottom: 8,
                      fontFamily: HEADLINE_FONT,
                    }}
                  >
                    <TrendingUp size={10} strokeWidth={2.5} />
                    Benefiting
                  </div>
                  {stage.benefiting
                    .filter(p => typeFilter.has(p.type))
                    .sort((a, b) => (b.intensity || 2) - (a.intensity || 2))
                    .map((p, idx) => (
                      <ProductPill
                        key={idx}
                        entry={p}
                        direction="expansion"
                        onClick={() => handleProductClick(p, 'expansion', stage.label)}
                        isSelected={selectedProduct?.entry.name === p.name && selectedProduct?.direction === 'expansion' && selectedProduct?.stageName === stage.label}
                      />
                    ))}
                </div>
              ))}

              {/* ─── Negatively Impacted row ─── */}
              {journey.map((stage, i) => (
                <div
                  key={stage.id + '_negative'}
                  style={{
                    backgroundColor: 'rgba(159,64,61,0.04)',
                    padding: '10px 8px',
                    borderRight: i < journey.length - 1 ? `1px solid ${S.cardBorder}` : 'none',
                    minHeight: 140,
                  }}
                >
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      fontSize: 9,
                      fontWeight: 800,
                      color: S.error,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      marginBottom: 8,
                      fontFamily: HEADLINE_FONT,
                    }}
                  >
                    <TrendingDown size={10} strokeWidth={2.5} />
                    Declining
                  </div>
                  {stage.negativelyImpacted
                    .filter(p => typeFilter.has(p.type))
                    .sort((a, b) => (b.intensity || 2) - (a.intensity || 2))
                    .map((p, idx) => (
                      <ProductPill
                        key={idx}
                        entry={p}
                        direction="contraction"
                        onClick={() => handleProductClick(p, 'contraction', stage.label)}
                        isSelected={selectedProduct?.entry.name === p.name && selectedProduct?.direction === 'contraction' && selectedProduct?.stageName === stage.label}
                      />
                    ))}
                </div>
              ))}
            </div>
          </div>

          {/* Consumer flow indicator */}
          <div
            className="px-8 py-4 flex items-center gap-3"
            style={{
              backgroundColor: S.surfaceLow,
              borderTop: `1px solid ${S.cardBorder}`,
            }}
          >
            <span
              className="text-[11px] font-bold uppercase tracking-[0.12em]"
              style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}
            >
              Consumer flow
            </span>
            <ArrowRight size={13} style={{ color: S.onSurfaceVariant }} />
            <div
              className="flex-1 h-0.5 rounded-full"
              style={{
                background: `linear-gradient(90deg, ${S.primary}, ${S.primary}15)`,
              }}
            />
            <span
              className="text-[11px] italic"
              style={{ color: S.mutedText }}
            >
              {activeTab === 'lhc'
                ? 'From pre-wash preparation through garment lifecycle to between-wash care'
                : 'From inspiration and diagnosis through transformation to ongoing maintenance'}
            </span>
          </div>
        </motion.div>
      </main>

      {/* ─── Product Detail Panel (slide-in) ─── */}
      <AnimatePresence>
        {selectedProduct && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => {
                setSelectedProduct(null);
                setIsEditing(false);
                setEditValues(null);
              }}
              style={{
                position: 'fixed', inset: 0, zIndex: 200,
                background: 'rgba(0, 52, 94, 0.18)',
                backdropFilter: 'blur(4px)',
              }}
            />

            {/* Panel */}
            <motion.aside
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: 'fixed', top: 0, right: 0, bottom: 0,
                width: 480, maxWidth: '92vw', zIndex: 201,
                backgroundColor: S.bg,
                boxShadow: '-20px 0 60px -15px rgba(0, 52, 94, 0.15)',
                display: 'flex', flexDirection: 'column',
                fontFamily: BODY_FONT,
              }}
            >
              {/* Panel header */}
              <div
                style={{
                  padding: '20px 24px',
                  backgroundColor: S.surface,
                  borderBottom: `1px solid ${S.cardBorder}`,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                    <LegendPill direction={selectedProduct.direction} />
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.08em]"
                      style={{
                        backgroundColor: (TYPE_STYLES[selectedProduct.entry.type] ?? TYPE_STYLES['product']!).bg,
                        color: (TYPE_STYLES[selectedProduct.entry.type] ?? TYPE_STYLES['product']!).text,
                        fontFamily: HEADLINE_FONT,
                      }}
                    >
                      <span
                        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-extrabold"
                        style={{
                          backgroundColor: (TYPE_STYLES[selectedProduct.entry.type] ?? TYPE_STYLES['product']!).text,
                          color: (TYPE_STYLES[selectedProduct.entry.type] ?? TYPE_STYLES['product']!).bg,
                        }}
                      >
                        {(TYPE_STYLES[selectedProduct.entry.type] ?? TYPE_STYLES['product']!).short}
                      </span>
                      {(TYPE_STYLES[selectedProduct.entry.type] ?? TYPE_STYLES['product']!).label}
                    </span>
                    <IntensityDots
                      intensity={selectedProduct.entry.intensity || 2}
                      direction={selectedProduct.direction}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 800,
                      color: S.onBg,
                      lineHeight: 1.25,
                      fontFamily: HEADLINE_FONT,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {selectedProduct.entry.name}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: S.onSurfaceVariant,
                      marginTop: 4,
                      fontFamily: BODY_FONT,
                    }}
                  >
                    Stage: <span style={{ fontWeight: 600, color: S.onSurface }}>{selectedProduct.stageName}</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedProduct(null);
                    setIsEditing(false);
                    setEditValues(null);
                  }}
                  aria-label="Close panel"
                  style={{
                    flexShrink: 0,
                    width: 32, height: 32, borderRadius: 999,
                    backgroundColor: S.surfaceLow,
                    border: 'none',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                    color: S.onSurfaceVariant,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = S.surfaceContainer; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = S.surfaceLow; }}
                >
                  <X size={16} strokeWidth={2.5} />
                </button>
              </div>

              {/* Panel body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Impact Summary */}
                <SectionCard
                  title="Impact Summary"
                  accent={selectedProduct.direction === 'expansion' ? S.expansion : S.error}
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div
                        className="text-[10px] font-semibold uppercase tracking-[0.08em] mb-1.5"
                        style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}
                      >
                        Direction & Intensity
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: selectedProduct.direction === 'expansion' ? S.expansion : S.error,
                          display: 'flex', alignItems: 'center', gap: 6,
                          fontFamily: HEADLINE_FONT,
                        }}
                      >
                        <span style={{ fontSize: 15, letterSpacing: -1 }}>
                          {intensityArrows(selectedProduct.direction, selectedProduct.entry.intensity || 2)}
                        </span>
                        <span>
                          {intensityLabel(selectedProduct.entry.intensity || 2)} {selectedProduct.direction === 'expansion' ? 'Expansion' : 'Contraction'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div
                        className="text-[10px] font-semibold uppercase tracking-[0.08em] mb-1.5"
                        style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}
                      >
                        Type
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: S.onSurface, fontFamily: BODY_FONT }}>
                        {(TYPE_STYLES[selectedProduct.entry.type] ?? TYPE_STYLES['product']!).label}
                      </div>
                    </div>
                    <div>
                      <div
                        className="text-[10px] font-semibold uppercase tracking-[0.08em] mb-1.5"
                        style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}
                      >
                        Journey Stage
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: S.onSurface, fontFamily: BODY_FONT }}>
                        {selectedProduct.stageName}
                      </div>
                    </div>
                    <div>
                      <div
                        className="text-[10px] font-semibold uppercase tracking-[0.08em] mb-1.5"
                        style={{ color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}
                      >
                        Trend Links
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: S.onSurface, fontFamily: BODY_FONT }}>
                        {selectedProduct.entry.trendDrivers.split('+').length} trend{selectedProduct.entry.trendDrivers.split('+').length > 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                </SectionCard>

                {/* Trend Drivers */}
                <SectionCard title="Trend Drivers — Rationale" accent={S.primary}>
                  {(() => {
                    const validDrivers = selectedProduct.entry.trendDrivers.split('+')
                      .map(d => d.trim())
                      .filter(d => {
                        const match = d.match(/^([TCGKE]-\d{2})/);
                        return match?.[1] && TREND_CONTEXT[match[1]];
                      });
                    if (validDrivers.length === 0) {
                      return (
                        <div
                          style={{
                            padding: '10px 14px',
                            backgroundColor: S.surfaceLow,
                            borderRadius: 10,
                            fontSize: 12,
                            color: S.mutedText,
                          }}
                        >
                          No linked trends from master list.
                        </div>
                      );
                    }
                    return (
                      <div className="flex flex-col gap-2">
                        {validDrivers.map((driver, i) => {
                          const codeMatch = driver.match(/^([TCGKE]-\d{2})/);
                          const trendCode = codeMatch?.[1] ?? '';
                          const context = TREND_CONTEXT[trendCode];
                          if (!context) return null;

                          return (
                            <div
                              key={i}
                              style={{
                                padding: '12px 14px',
                                backgroundColor: S.surfaceLow,
                                borderRadius: 10,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                <span
                                  style={{
                                    flexShrink: 0,
                                    marginTop: 1,
                                    width: 20, height: 20, borderRadius: 999,
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    backgroundColor: selectedProduct.direction === 'expansion' ? S.expansionContainer : S.errorContainer,
                                    color: selectedProduct.direction === 'expansion' ? S.onExpansionContainer : S.onErrorContainer,
                                  }}
                                >
                                  {selectedProduct.direction === 'expansion' ? (
                                    <TrendingUp size={11} strokeWidth={2.5} />
                                  ) : (
                                    <TrendingDown size={11} strokeWidth={2.5} />
                                  )}
                                </span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
                                    <span
                                      style={{
                                        fontSize: 12,
                                        fontWeight: 700,
                                        color: S.onSurface,
                                        fontFamily: HEADLINE_FONT,
                                      }}
                                    >
                                      {trendCode}: {context.name}
                                    </span>
                                    <span
                                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-[0.08em]"
                                      style={{
                                        backgroundColor: S.surfaceHigh,
                                        color: S.onPrimaryContainer,
                                        fontFamily: HEADLINE_FONT,
                                      }}
                                    >
                                      {context.force}
                                    </span>
                                  </div>
                                  <p
                                    style={{
                                      fontSize: 12,
                                      color: S.onSurfaceVariant,
                                      lineHeight: 1.55,
                                      margin: 0,
                                      fontFamily: BODY_FONT,
                                    }}
                                  >
                                    {context.description}
                                  </p>
                                  {onNavigateToTrend && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); onNavigateToTrend(context.name); }}
                                      style={{
                                        marginTop: 8,
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: S.primary,
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        padding: 0,
                                        fontFamily: HEADLINE_FONT,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                      }}
                                      onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline'; }}
                                      onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none'; }}
                                    >
                                      <ExternalLink size={11} strokeWidth={2.5} />
                                      View full trend details
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </SectionCard>

                {/* PRISM Analysis */}
                <SectionCard title="PRISM Analysis" accent={S.primaryDim}>
                  <div
                    style={{
                      padding: '14px 16px',
                      borderRadius: 10,
                      backgroundColor: S.surfaceLow,
                    }}
                  >
                    {generatePrismAnalysis(selectedProduct.entry, selectedProduct.direction, selectedProduct.stageName)
                      .split('\n\n')
                      .map((paragraph, i) => (
                        <p
                          key={i}
                          style={{
                            fontSize: 12.5,
                            color: S.onSurface,
                            lineHeight: 1.65,
                            margin: i === 0 ? '0 0 10px' : '10px 0 0',
                            fontFamily: BODY_FONT,
                          }}
                        >
                          {paragraph.split(/(\*\*[^*]+\*\*)/).map((part, j) =>
                            part.startsWith('**') && part.endsWith('**')
                              ? <strong key={j} style={{ fontWeight: 800, color: S.onBg, fontFamily: HEADLINE_FONT }}>{part.slice(2, -2)}</strong>
                              : <span key={j}>{part}</span>
                          )}
                        </p>
                      ))}
                  </div>
                </SectionCard>

                {/* Admin Edit Form */}
                {isAdmin && !isEditing && (
                  <button
                    onClick={() => {
                      const codes = selectedProduct.entry.trendDrivers
                        .split('+')
                        .map(d => d.trim().match(/^([TCGKE]-\d{2})/)?.[1])
                        .filter((c): c is string => !!c);
                      setIsEditing(true);
                      setEditValues({
                        trendCodes: codes.length > 0 ? codes : [''],
                        stageName: selectedProduct.stageName,
                        type: selectedProduct.entry.type,
                        direction: selectedProduct.direction,
                        intensity: selectedProduct.entry.intensity || 2,
                      });
                    }}
                    className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-full text-sm font-bold uppercase tracking-[0.08em] transition-all duration-200 hover:scale-[0.99]"
                    style={{
                      backgroundColor: S.primaryContainer,
                      color: S.onPrimaryContainer,
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: HEADLINE_FONT,
                    }}
                  >
                    <Edit3 size={13} strokeWidth={2.5} />
                    Edit Entry
                  </button>
                )}

                {isAdmin && isEditing && editValues && (
                  <SectionCard title="Edit Entry" accent={S.primary}>
                    {/* Trend Codes */}
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ fontSize: 10, fontWeight: 700, color: S.onSurfaceVariant, display: 'block', marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: HEADLINE_FONT }}>
                        Linked Trends
                      </label>
                      {editValues.trendCodes.map((code, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                          <select
                            value={code}
                            onChange={e => {
                              const newCodes = [...editValues.trendCodes];
                              newCodes[idx] = e.target.value;
                              setEditValues(prev => prev ? { ...prev, trendCodes: newCodes } : null);
                            }}
                            style={{
                              flex: 1, padding: '8px 10px', borderRadius: 8,
                              backgroundColor: S.surfaceLow, border: `1px solid ${S.cardBorder}`,
                              color: S.onSurface, fontSize: 12, fontFamily: BODY_FONT,
                              outline: 'none',
                            }}
                          >
                            <option value="">Select trend…</option>
                            {Object.entries(TREND_CONTEXT)
                              .sort((a, b) => a[0].localeCompare(b[0]))
                              .map(([c, ctx]) => (
                                <option key={c} value={c}>{c}: {ctx.name}</option>
                              ))
                            }
                          </select>
                          {editValues.trendCodes.length > 1 && (
                            <button
                              onClick={() => {
                                const newCodes = editValues.trendCodes.filter((_, i) => i !== idx);
                                setEditValues(prev => prev ? { ...prev, trendCodes: newCodes } : null);
                              }}
                              style={{
                                padding: '0 10px', borderRadius: 8,
                                backgroundColor: S.errorContainer, border: 'none',
                                color: S.onErrorContainer, fontSize: 14, cursor: 'pointer',
                                lineHeight: 1, flexShrink: 0, fontFamily: HEADLINE_FONT,
                              }}
                              title="Remove trend"
                              aria-label="Remove trend"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          setEditValues(prev => prev ? { ...prev, trendCodes: [...prev.trendCodes, ''] } : null);
                        }}
                        style={{
                          marginTop: 4, padding: '5px 12px', borderRadius: 999,
                          backgroundColor: S.primaryContainer, border: 'none',
                          color: S.onPrimaryContainer, fontSize: 11, fontWeight: 700,
                          cursor: 'pointer', fontFamily: HEADLINE_FONT,
                        }}
                      >
                        + Add trend
                      </button>
                    </div>

                    {/* Stage / Type / Direction / Intensity selects */}
                    {[
                      { label: 'Journey Stage', value: editValues.stageName, options: (activeTab === 'lhc' ? lhcJourney : hairJourney).map(s => ({ value: s.label, label: s.label })), onChange: (v: string) => setEditValues(prev => prev ? { ...prev, stageName: v } : null) },
                      { label: 'Type', value: editValues.type, options: [{ value: 'product', label: 'Product' }, { value: 'tech', label: 'Tech/Device' }, { value: 'service', label: 'Service' }], onChange: (v: string) => setEditValues(prev => prev ? { ...prev, type: v as 'product' | 'tech' | 'service' } : null) },
                      { label: 'Direction', value: editValues.direction, options: [{ value: 'expansion', label: 'Expansion' }, { value: 'contraction', label: 'Contraction' }], onChange: (v: string) => setEditValues(prev => prev ? { ...prev, direction: v as 'expansion' | 'contraction' } : null) },
                      { label: 'Intensity', value: String(editValues.intensity), options: [{ value: '1', label: '1 — Mild' }, { value: '2', label: '2 — Moderate' }, { value: '3', label: '3 — Strong' }], onChange: (v: string) => setEditValues(prev => prev ? { ...prev, intensity: parseInt(v) as 1 | 2 | 3 } : null) },
                    ].map((field) => (
                      <div key={field.label} style={{ marginBottom: 12 }}>
                        <label style={{ fontSize: 10, fontWeight: 700, color: S.onSurfaceVariant, display: 'block', marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: HEADLINE_FONT }}>
                          {field.label}
                        </label>
                        <select
                          value={field.value}
                          onChange={e => field.onChange(e.target.value)}
                          style={{
                            width: '100%', padding: '8px 10px', borderRadius: 8,
                            backgroundColor: S.surfaceLow, border: `1px solid ${S.cardBorder}`,
                            color: S.onSurface, fontSize: 12, fontFamily: BODY_FONT,
                            outline: 'none',
                          }}
                        >
                          {field.options.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    ))}

                    {/* Save / Cancel */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                      <button
                        onClick={() => {
                          if (!editValues || !selectedProduct) return;
                          const journeyArr = activeTab === 'lhc' ? lhcJourney : hairJourney;
                          const setJourney = activeTab === 'lhc' ? setLhcJourney : setHairJourney;

                          const origStageName = selectedProduct.stageName;
                          const origDirection = selectedProduct.direction;
                          const entryName = selectedProduct.entry.name;

                          const updated = journeyArr.map(stage => {
                            const newStage = { ...stage, benefiting: [...stage.benefiting], negativelyImpacted: [...stage.negativelyImpacted] };
                            if (stage.label === origStageName) {
                              if (origDirection === 'expansion') {
                                newStage.benefiting = newStage.benefiting.filter(e => e.name !== entryName);
                              } else {
                                newStage.negativelyImpacted = newStage.negativelyImpacted.filter(e => e.name !== entryName);
                              }
                            }
                            return newStage;
                          });

                          const validCodes = editValues.trendCodes.filter(c => c && TREND_CONTEXT[c]);
                          const trendDriversStr = validCodes.length > 0
                            ? validCodes.map(c => `${c} ${TREND_CONTEXT[c]?.name ?? c}`).join(' + ')
                            : selectedProduct.entry.trendDrivers;

                          const updatedEntry: ProductEntry = {
                            name: entryName,
                            type: editValues.type,
                            trendDrivers: trendDriversStr,
                            intensity: editValues.intensity,
                          };

                          const targetStage = updated.find(s => s.label === editValues.stageName);
                          if (targetStage) {
                            if (editValues.direction === 'expansion') {
                              targetStage.benefiting.push(updatedEntry);
                            } else {
                              targetStage.negativelyImpacted.push(updatedEntry);
                            }
                          }

                          setJourney(updated);
                          setSelectedProduct({
                            entry: updatedEntry,
                            direction: editValues.direction,
                            stageName: editValues.stageName,
                          });
                          setIsEditing(false);
                          setEditValues(null);
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-full text-sm font-bold uppercase tracking-[0.08em] transition-all duration-200 hover:scale-[0.99]"
                        style={{
                          backgroundColor: S.primary,
                          color: '#ffffff',
                          border: 'none',
                          cursor: 'pointer',
                          fontFamily: HEADLINE_FONT,
                        }}
                      >
                        <Check size={13} strokeWidth={2.5} />
                        Save
                      </button>
                      <button
                        onClick={() => { setIsEditing(false); setEditValues(null); }}
                        className="flex-1 py-2 rounded-full text-sm font-bold uppercase tracking-[0.08em] transition-all duration-200 hover:scale-[0.99]"
                        style={{
                          backgroundColor: S.surfaceLow,
                          color: S.onSurfaceVariant,
                          border: 'none',
                          cursor: 'pointer',
                          fontFamily: HEADLINE_FONT,
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </SectionCard>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ConsumerJourney2;
