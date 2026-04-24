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
  TrendingUp, TrendingDown, Sparkles, ExternalLink,
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
// PRISM Analysis — Henkel-specific consultancy-grade recommendations
// Architecture: Stage-level brand context + smart product-to-brand routing
// ═══════════════════════════════════════════════════════════════

const PRISM_OVERRIDES: Record<string, string> = {};

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

function generatePrismAnalysis(entry: ProductEntry, direction: 'expansion' | 'contraction', stageName: string): string {
  const key = `${entry.name}::${direction}`;
  const override = PRISM_OVERRIDES[key];
  if (override) return override;

  const isHair = HAIR_STAGES.has(stageName);
  const ctx = (isHair ? HAIR_CTX : LHC_CTX)[stageName];
  const brands = getProductBrands(entry.name, isHair);
  const trendCodes = entry.trendDrivers.match(/[TCGKXE]-\d+/g) || [];
  const trendNames = trendCodes
    .map(code => { const c = TREND_CONTEXT[code]; return c ? `${c.name} (${c.force} force)` : null; })
    .filter(Boolean);
  const trendText = trendNames.length > 0 ? trendNames.join('; ') : entry.trendDrivers;
  const typeWord = entry.type === 'tech' ? 'technology' : entry.type === 'service' ? 'service model' : 'product segment';
  const iw = entry.intensity === 3 ? 'high-conviction' : entry.intensity === 2 ? 'moderate-conviction' : 'emerging-signal';

  if (direction === 'expansion') {
    return (
      `**Trend Mechanism.** "${entry.name}" is a ${iw} growth vector in the ${stageName} stage, driven by: ${trendText}. ` +
      `This ${typeWord} reflects a structural shift — not a cyclical uptick — in ${isHair ? 'consumer hair care behavior, ingredient science, and channel dynamics' : 'laundry and home care habits, sustainability regulation, and appliance technology'}. ` +
      `PRISM projects these tailwinds to compound through 2030 as the underlying forces reinforce each other across the model.\n\n` +

      `**Henkel Portfolio Position.** The relevant Henkel asset is ${brands}. ` +
      (ctx ? `Across the ${stageName} stage, Henkel\'s brand portfolio includes ${ctx.henkelBrands}. ` : '') +
      (brands.includes('extension') || brands.includes('opportunity') || brands.includes('Potential')
        ? `This is currently a portfolio gap — no existing Henkel brand directly addresses this opportunity. Competitors could establish category leadership before Henkel enters. The window for a first-mover or fast-follower play is narrowing as ${isHair ? 'L\'Oréal, P&G, and indie DTC brands' : 'P&G, Unilever, and private label operators'} invest aggressively. `
        : `Henkel has a credible right-to-win here, grounded in ${isHair ? 'Schwarzkopf\'s professional heritage, the established salon-to-retail bridge, and European market leadership in color and styling' : 'Persil\'s brand trust (90%+ awareness in core European markets), over a century of surface chemistry and formulation IP, and established appliance OEM partnerships with Miele, Bosch, and Samsung'}. `) +
      `The ${iw} intensity rating means this warrants ${entry.intensity === 3 ? 'immediate pipeline acceleration and dedicated innovation investment within the current planning cycle' : entry.intensity === 2 ? 'active R&D scoping and launch planning on a 12-18 month horizon' : 'exploratory research and quarterly trend monitoring before committing significant resources'}.\n\n` +

      `**Competitive Dynamics.** ` +
      (ctx ? `${ctx.competitors} ` : '') +
      `For Henkel, speed of execution is critical — the competitive window for establishing category leadership in FMCG typically closes within 18-24 months of trend inflection. ` +
      `${isHair ? 'The premium Hair market is increasingly winner-take-most, with consumers concentrating spend on brands that demonstrate clinically validated efficacy. Second-movers in this space rarely capture more than 15-20% of the pioneer\'s share.' : 'In LHC, the battle is fought on two fronts simultaneously: innovation leadership against P&G above (Ariel, Tide), and value-tier defense against private label below (now at 42% EU6 share). Winning requires excellence on both fronts.'}\n\n` +

      `**Strategic Recommendation.** ` +
      (ctx ? ctx.opportunity + ' ' : '') +
      `Classify this as a ${entry.intensity === 3 ? '**Tier 1 priority** — allocate innovation pipeline resources immediately, target concept validation within 3 months and lead-market launch (Germany, France, UK) within 6-12 months' : entry.intensity === 2 ? '**Tier 2 priority** — initiate consumer concept testing and R&D feasibility within the next planning cycle, targeting a 12-18 month launch window in 2-3 lead markets' : '**Tier 3 monitor item** — track competitive moves and consumer adoption signals quarterly, prepare a contingency innovation brief for rapid activation if the trend accelerates beyond current projections'}. ` +
      `Validate consumer willingness-to-pay through rapid concept testing before scaling — the insight from testing in lead markets should inform the global rollout architecture.`
    );
  }

  return (
    `**Structural Decline Assessment.** "${entry.name}" faces ${iw} headwinds in the ${stageName} stage, driven by: ${trendText}. ` +
    `This is a structural contraction — not a temporary dip — reflecting ${isHair ? 'premiumization displacing commodity tiers, tighter ingredient regulation under EU Cosmetics Regulation amendments, and digital disruption of traditional purchase and discovery journeys' : 'regulatory bans on legacy chemistry (PFAS restriction, microplastics phase-out), format obsolescence as concentrated innovations displace bulky legacy products, and consumer migration toward sustainable and transparent alternatives'}. These forces are mutually reinforcing and accelerating through the simulation model.\n\n` +

    `**Henkel Exposure.** ${brands} has direct exposure to this decline vector and requires proactive management. ` +
    (ctx ? `Within the ${stageName} stage, Henkel\'s portfolio (${ctx.henkelBrands}) faces varying degrees of risk depending on specific SKU positioning and reformulation readiness. ` : '') +
    `The ${iw} rating indicates ${entry.intensity === 3 ? 'material P&L impact within 12-18 months if no defensive action is taken — this is an urgent priority requiring immediate portfolio review, reformulation assessment, and resource reallocation planning' : entry.intensity === 2 ? 'growing margin pressure that will compound through the 2026-2028 period — proactive repositioning is advisable before the contraction accelerates and options narrow' : 'an early warning signal with limited near-term P&L impact, but strategic monitoring is warranted to avoid being caught off-guard by sudden regulatory or competitive acceleration'}.\n\n` +

    `**Competitive Context.** ` +
    (ctx ? `${ctx.competitors} ` : 'Competitors face similar structural pressure in this segment. ') +
    `The strategic question is whether to defend, pivot, or harvest. Competitors who exit declining segments early can redeploy resources to growth vectors; those who defend too long burn investment in a shrinking profit pool and miss the window on adjacent opportunities. ` +
    `${isHair ? 'In Hair, the premium-value polarization means mid-tier positions are especially vulnerable — consumers either trade up to efficacy-proven premium brands (where margins justify the investment) or trade down to value alternatives and private label (where price is the only decision criterion). The squeezed middle offers the worst of both worlds.' : 'In LHC, regulatory-driven reformulation costs compound the margin pressure — brands that reformulate early gain compliance advantage and can claim "clean" positioning, but those that delay face cliff-edge obsolescence when regulation takes effect. The PFAS restriction timeline makes this concrete and urgent.'}\n\n` +

    `**Defensive Action Plan.** ` +
    `${entry.intensity === 3 ? 'Immediate portfolio review required — this is a current-year priority that should be escalated to category leadership.' : entry.intensity === 2 ? 'Initiate a structured evaluation within the next planning cycle with clear decision gates.' : 'Add to the strategic monitoring dashboard for quarterly review by the category team.'} ` +
    `Three response options: (1) **Reformulate** — adapt the product to comply with emerging regulations and evolving consumer preferences, extending the product lifecycle by 2-3 years while maintaining shelf position and retailer relationships. ` +
    `(2) **Pivot** — redirect marketing spend, innovation resources, and negotiated shelf space from this declining segment to adjacent growth vectors within the ${stageName} stage where Henkel has right-to-win. ` +
    `(3) **Managed harvest** — extract remaining margin while progressively reducing investment (media, trade promotion, innovation), and redeploy the freed capital toward ${isHair ? 'premium treatment plays (Gliss bond repair), scalp care innovation (Schwarzkopf), and styling growth (got2b/Taft) that represent structurally expanding profit pools' : 'concentrated format innovation (Persil Discs), bio-enzymatic stain science (Sil), and between-wash fabric care (Vernel refresh range) that represent the highest-ROI expansion opportunities in LHC'}. ` +
    (ctx ? `The opportunity cost of defensive inaction is significant: investment trapped in declining segments cannot fund the growth plays. For context, ${ctx.opportunity}` : '')
  );
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
  // ── v3.4 catalog extension: remaining trend shortcodes ──
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
              profit-pool direction — click any tile for the full PRISM read-out.
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
                    <div
                      className="flex items-center gap-2 mb-3"
                      style={{ color: S.primaryDim }}
                    >
                      <Sparkles size={14} strokeWidth={2.25} />
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                          fontFamily: HEADLINE_FONT,
                          color: S.primaryDim,
                        }}
                      >
                        Consultancy-Grade Read-out
                      </span>
                    </div>
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
