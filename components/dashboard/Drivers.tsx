/**
 * The Drivers page: the Profit Pool Drivers behind the Shift Matrix, with
 * their scores and evidence, the experts' proposals and the admin editor.
 *
 * One table in three modes (see "Scoring modes" below): Driver List shows the
 * scores that feed the model, Expert Rating collects each expert's proposal,
 * and Review & Endorse, for admins, sets the expert aggregate against the
 * baseline. Admins edit a driver in its expanded Driver List panel. The PRISM
 * Analysis card is read-only for every role.
 *
 * Visual language: Maritime tonal layering rather than borders, Manrope
 * headlines over Inter body text, pill filter chips, a force icon tile on
 * every row, dot scales for probability and exposure.
 */

'use client';

import React, { useMemo, useState, useEffect, useLayoutEffect, useRef, useCallback, FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, TrendingUp, Users, Store, Cpu, Landmark,
  Leaf, Swords, ChevronDown,
  FileText, BarChart3, Clock, Zap, MapPin, Layers, Newspaper,
  Globe, ExternalLink, AlertTriangle,
  ArrowUp, ArrowDown, ArrowUpDown,
  Plus, Trash2, Info, Lock, Check, PenLine, MessageSquare,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import usePrism from '@/hooks/usePrism';
import { ApiError, getDriverProposals, saveMyProposal } from '@/api/client';
import {
  CATEGORIES, EXPANSION, EXPANSION_SOFT, NO_VALUE, REGIONS, evidenceLine, fmtPct, fmtShift, shiftColor, shortCat,
} from '@/lib/format';
import { UNCERTAINTY_KAPPA, UNCERTAINTY_LABELS, UNCERTAINTY_PEAK_JITTER } from '@/lib/uncertainty';
import { S, HEADLINE_FONT, BODY_FONT } from '@/lib/theme';
import { VC_STEPS, VC_SHORT_LABELS, canonicalVcProfile, epicentreOf } from '@/lib/valueChain';
import Chip from '@/components/dashboard/Chip';
import type {
  Confidence, Direction, Driver, DriverProposal, DriverProposalsResponse, DriverScores,
  DriverSource, DriverUpdate, ExposureMap, ForceName, ProposalAgg, SourceTier,
} from '@/types';

// ─── Diffusion curves ─────────────────────────────────────────────
const DIFFUSION_LABELS: Record<string, { label: string; description: string }> = {
  s_curve:       { label: 'S-Curve',       description: 'Logistic: slow start, fast middle, plateau.' },
  linear:        { label: 'Linear',        description: 'Steady, constant rate of materialization.' },
  front_loaded:  { label: 'Front-Loaded',  description: 'Fast early impact, flattens over time (√t).' },
  back_loaded:   { label: 'Back-Loaded',   description: 'Slow start, accelerates late (t²).' },
  step_function: { label: 'Step Function', description: 'Near-zero until ~80%, then sudden jump.' },
};
const curveLabel = (curve: string): string => DIFFUSION_LABELS[curve]?.label ?? curve;

// ─── Source kind, read from the link (display only) ───────────────
type SourceKind =
  | 'EUR-Lex' | 'ECHA' | 'SEC EDGAR' | 'Google Trends' | 'Reddit' | 'YouTube'
  | 'Semantic Scholar' | 'GDELT' | 'Consulting' | 'Trade Press' | 'Press';

function classifySource(url: string): SourceKind {
  const u = url.toLowerCase();
  if (u.includes('eur-lex') || u.includes('europa.eu')) return 'EUR-Lex';
  if (u.includes('echa')) return 'ECHA';
  if (u.includes('sec.gov') || u.includes('edgar')) return 'SEC EDGAR';
  if (u.includes('trends.google')) return 'Google Trends';
  if (u.includes('reddit')) return 'Reddit';
  if (u.includes('youtube')) return 'YouTube';
  if (u.includes('scholar') || u.includes('doi.org') || u.includes('nature.com') || u.includes('pubmed')) return 'Semantic Scholar';
  if (u.includes('gdelt')) return 'GDELT';
  if (u.includes('mckinsey') || u.includes('bain') || u.includes('bcg')) return 'Consulting';
  if (u.includes('cosmetics') || u.includes('happi') || u.includes('retaildetail') || u.includes('grocery') || u.includes('packaging')) return 'Trade Press';
  return 'Press';
}

const SOURCE_ICON: Record<SourceKind, LucideIcon> = {
  GDELT: Globe, 'Google Trends': TrendingUp, ECHA: AlertTriangle, 'EUR-Lex': FileText,
  'SEC EDGAR': BarChart3, Reddit: Globe, YouTube: Globe, 'Semantic Scholar': FileText,
  Consulting: FileText, 'Trade Press': Newspaper, Press: Newspaper,
};

// A force's icon and its tonal tile (editorial palette)
const FORCE_TILE: Record<ForceName, { Icon: LucideIcon; bg: string; fg: string }> = {
  Consumer:      { Icon: Users,    bg: S.primaryContainer,   fg: S.primary },
  Customer:      { Icon: Store,    bg: S.secondaryContainer, fg: S.onSecondaryContainer },
  Technology:    { Icon: Cpu,      bg: S.tertiaryContainer,  fg: S.onTertiaryContainer },
  Government:    { Icon: Landmark, bg: S.surfaceHighest,     fg: S.onSurface },
  Environmental: { Icon: Leaf,     bg: S.surfaceHigh,        fg: S.primary },
  Competitive:   { Icon: Swords,   bg: S.surfaceContainer,   fg: S.primaryDim },
};

// ─── Probability dot bar ──────────────────────────────────────────
interface DotBarProps {
  value: number;
  editable?: boolean;
  onChange?: (next: number) => void;
}
const DotBar: FC<DotBarProps> = ({ value, editable = false, onChange }) => (
  <div
    className="flex gap-1.5"
    role={editable ? 'radiogroup' : undefined}
    aria-label={`Probability ${value} of 5`}
  >
    {[1, 2, 3, 4, 5].map((d) => {
      const filled = d <= value;
      // A 24px hit area around the 10px dot: padding 7 with margin -7 keeps
      // the dot-and-gap layout, background-clip paints only the dot, and the
      // global :focus-visible ring marks keyboard focus.
      return (
        <span
          key={d}
          role={editable ? 'radio' : undefined}
          // One radio in the group is checked: the selected value.
          aria-checked={editable ? d === value : undefined}
          aria-label={editable ? `${d} of 5` : undefined}
          tabIndex={editable ? 0 : -1}
          onClick={editable && onChange ? (e) => { e.stopPropagation(); onChange(d); } : undefined}
          onKeyDown={editable && onChange ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(d); }
          } : undefined}
          className="inline-block rounded-full"
          style={{
            width: 24, height: 24, padding: 7, margin: -7,
            boxSizing: 'border-box', backgroundClip: 'content-box',
            backgroundColor: filled ? S.primary : S.surfaceHigh,
            cursor: editable ? 'pointer' : 'default',
            transition: 'background-color 140ms',
          }}
        />
      );
    })}
  </div>
);

// ─── Category exposure grid (read-only), grouped Hair / LHC ───────
const CategoryExposureGrid: FC<{ exposures: ExposureMap }> = ({ exposures }) => {
  const grouped = {
    Hair: CATEGORIES.filter((c) => c.group === 'Hair'),
    LHC:  CATEGORIES.filter((c) => c.group === 'LHC'),
  };
  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([group, cats]) => (
        <div key={group}>
          <div
            className="text-[11px] font-semibold mb-2"
            style={{ color: S.onSurfaceVariant, letterSpacing: '0.08em' }}
          >
            {group.toUpperCase()}
          </div>
          <div className="grid grid-cols-4 gap-3">
            {cats.map((cat) => (
              <div key={cat.name} className="flex flex-col items-center gap-1.5">
                <ReadDots value={exposures[cat.name] ?? 0} color={S.primary} />
                <div
                  className="text-[11px] font-medium text-center"
                  style={{ color: S.onSurface }}
                >
                  {shortCat(cat.name)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Value chain epicentre ─────────────────────────────────────────
// A driver's value chain is entered and read as one stage, the epicentre of
// its impact (lib/valueChain.ts). Review & Endorse treats the stage as a
// category: expert picks are counted as votes, never averaged, since a
// Supply Chain vote and two Commercial votes must not blend into Marketing.

const vcZone = (stage: number): string =>
  stage <= 4 ? 'upstream' : stage === 5 ? 'mid-chain' : 'downstream';
const vcStageLabel = (stage: number | null): string =>
  stage == null ? 'unscored' : `${VC_STEPS[stage - 1]} · ${vcZone(stage)}`;
/** A stage's pin position on the rail: the centre of its eighth. */
const vcPos = (stage: number): string => `${(((stage - 0.5) / 8) * 100).toFixed(2)}%`;

/** The baseline's mark: an outlined diamond, as on the value-chain rails. */
const BaselineMark: FC<{ size?: number }> = ({ size = 9 }) => (
  <span aria-hidden style={{
    display: 'inline-block', flexShrink: 0, width: size, height: size, boxSizing: 'border-box',
    backgroundColor: S.bg, border: `2px solid ${S.onSurface}`, transform: 'rotate(45deg)',
  }} />
);

/** Read-only epicentre rail with its stage labels, for the expanded panel
 *  only: the collapsed rows carry no value-chain cell. A diamond marks the
 *  baseline stage where it differs. */
const EpicentreRail: FC<{ stage: number | null; baseline?: number | null }> = ({ stage, baseline }) => {
  const title = stage == null
    ? 'Value chain: unscored'
    : `Value chain epicentre: ${vcStageLabel(stage)}${baseline != null && baseline !== stage ? ` · baseline: ${VC_STEPS[baseline - 1]}` : ''}`;
  return (
    <div title={title} aria-label={title} style={{ cursor: 'help' }}>
      <div style={{ position: 'relative', height: 40 }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 17, height: 6, borderRadius: 6, backgroundColor: S.surfaceHigh }} />
        {VC_STEPS.map((step, i) => (
          <span key={step} style={{
            position: 'absolute', top: 16, left: vcPos(i + 1),
            width: 8, height: 8, borderRadius: 999,
            backgroundColor: S.surfaceHighest, transform: 'translateX(-50%)',
          }} />
        ))}
        {baseline != null && baseline !== stage && (
          <span style={{
            position: 'absolute', top: 15, left: vcPos(baseline),
            width: 10, height: 10, backgroundColor: S.bg, border: `2px solid ${S.onSurface}`,
            transform: 'translateX(-50%) rotate(45deg)',
          }} />
        )}
        {stage != null && (
          <span style={{
            position: 'absolute', top: 11, left: vcPos(stage),
            width: 18, height: 18, borderRadius: 999,
            backgroundColor: S.primary, border: '3px solid #ffffff',
            outline: `1px solid ${S.cardBorderStrong}`, transform: 'translateX(-50%)',
          }} />
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', marginTop: 2 }}>
        {VC_SHORT_LABELS.map((l, i) => (
          <span key={l} style={{
            fontSize: 11, textAlign: 'center', lineHeight: 1.25,
            color: i + 1 === stage ? S.primary : S.mutedText,
            fontWeight: i + 1 === stage ? 800 : 400,
          }}>
            {l}
          </span>
        ))}
      </div>
    </div>
  );
};

/** Editable epicentre slider (Expert Rating and the admin editor): drag the
 *  pin or click a stage; the value snaps to one of the eight stages. */
const EpicentreSlider: FC<{
  value: number | null;
  baseline?: number | null;
  onChange: (stage: number) => void;
}> = ({ value, baseline, onChange }) => (
  <div>
    <div style={{ position: 'relative', height: 44 }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 19, height: 6, borderRadius: 6, backgroundColor: S.surfaceHigh }} />
      {VC_STEPS.map((step, i) => (
        <span key={step} style={{
          position: 'absolute', top: 17, left: vcPos(i + 1), width: 10, height: 10,
          borderRadius: 999, backgroundColor: S.surfaceHighest, transform: 'translateX(-50%)',
        }} />
      ))}
      {baseline != null && baseline !== value && (
        <span title={`Baseline: ${VC_STEPS[baseline - 1]}`} style={{
          position: 'absolute', top: 17, left: vcPos(baseline), width: 10, height: 10,
          backgroundColor: S.bg, border: `2px solid ${S.onSurface}`,
          transform: 'translateX(-50%) rotate(45deg)', cursor: 'help',
        }} />
      )}
      {value != null && (
        <span style={{
          position: 'absolute', top: 12, left: vcPos(value), width: 20, height: 20,
          borderRadius: 999, backgroundColor: S.primary, border: '3px solid #ffffff',
          outline: `1px solid ${S.cardBorderStrong}`, transform: 'translateX(-50%)',
          pointerEvents: 'none',
        }} />
      )}
      <input
        type="range" min={1} max={8} step={1}
        value={value ?? baseline ?? 5}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        aria-label="Value chain epicentre"
        aria-valuetext={value != null ? vcStageLabel(value) : 'unscored'}
        style={{ position: 'absolute', left: 0, right: 0, top: 8, width: '100%', height: 28, opacity: 0, cursor: 'grab', margin: 0 }}
      />
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', marginTop: 2 }}>
      {VC_STEPS.map((step, i) => (
        <button
          key={step} type="button" onClick={() => onChange(i + 1)}
          aria-pressed={i + 1 === value}
          title={baseline === i + 1 ? `${step} (baseline)` : step}
          style={{
            border: 'none', background: 'transparent', padding: '4px 0', cursor: 'pointer',
            fontFamily: BODY_FONT, fontSize: 11, textAlign: 'center', lineHeight: 1.25,
            color: i + 1 === value ? S.primary : S.mutedText,
            fontWeight: i + 1 === value ? 800 : 400,
          }}
        >
          {VC_SHORT_LABELS[i]}
        </button>
      ))}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: S.neutral, fontWeight: 700 }}>Upstream</span>
      <span title="The driver's baseline stage" style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999,
        backgroundColor: S.surfaceLow, color: S.onSurfaceVariant, fontSize: 11, fontWeight: 700,
        fontFamily: HEADLINE_FONT, whiteSpace: 'nowrap', cursor: 'help',
      }}>
        <BaselineMark /> {baseline != null ? `Baseline: ${VC_STEPS[baseline - 1]}` : `Baseline ${NO_VALUE}`}
      </span>
      <span style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: S.neutral, fontWeight: 700 }}>Downstream</span>
    </div>
  </div>
);

// ─── Section help: an info icon with the field's hint as a native
// tooltip, like the other hovers on this page. ───
const SectionInfoTip: FC<{ text: string }> = ({ text }) => (
  <span
    title={text}
    aria-label={text}
    style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      marginLeft: 1, color: S.onSurfaceVariant, cursor: 'help',
    }}
  >
    <Info size={12} strokeWidth={2.4} />
  </span>
);

// ─── PRISM Analysis ────────────────────────────────────────────────
// The per-driver reading: authored prose around figures that come from the
// model's attribution at the score means, reconciled to the portfolio median
// the basis line names (docs/DRIVER_ANALYSIS.md).
// Paragraphs are separated by a blank line. A paragraph that opens with one
// of the four labels gets the label as a small heading, the basis line
// ("Figures: ...") is set small and muted, and any other paragraph renders
// as plain prose.
const ANALYSIS_LABELS = ['Weight in the answer', 'Where it lands', 'When it lands', 'What the band hinges on'];
const ANALYSIS_BASIS_LABEL = 'Figures';
const ANALYSIS_FOOTNOTE =
  'Attribution at the score means, reconciled to the portfolio median in the basis line; a reading authored on those figures. Read as exposure if nobody acts, not as a forecast.';

export function splitAnalysis(text: string): { label: string | null; body: string }[] {
  const labels = [...ANALYSIS_LABELS, ANALYSIS_BASIS_LABEL];
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const label = labels.find((l) => p.startsWith(`${l}:`));
      return label ? { label, body: p.slice(label.length + 1).trim() } : { label: null, body: p };
    });
}

/** The portfolio median a reading's basis line was reconciled to: {year, percent}; null without one. */
export function basisMedian(text: string): { year: string; percent: number } | null {
  const m = /(\d{4}) portfolio median of (-?\d+(?:\.\d+)?) percent/.exec(text);
  return m ? { year: m[1]!, percent: Number(m[2]) } : null;
}

const PrismAnalysisReading: FC<{ text: string }> = ({ text }) => {
  const { simulation } = usePrism();
  const paragraphs = splitAnalysis(text);
  // The figures of a reading belong to the run its basis line names. When the
  // served run's median differs at the shown precision, the reading says so.
  const basis = basisMedian(text);
  const served = basis ? simulation?.totals.portfolio[basis.year]?.median : undefined;
  const stale = basis != null && served != null && (served * 100).toFixed(1) !== basis.percent.toFixed(1);
  if (paragraphs.length === 0) {
    return (
      <span style={{ color: S.mutedText, fontWeight: 400, fontStyle: 'italic' }}>
        No PRISM Analysis available for this driver.
      </span>
    );
  }
  return (
    <div data-testid="prism-analysis" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {paragraphs.map(({ label, body }, i) => (
        label === ANALYSIS_BASIS_LABEL ? (
          <React.Fragment key={i}>
            <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5, color: S.mutedText, fontWeight: 500 }}>
              <span style={{ fontWeight: 700 }}>{ANALYSIS_BASIS_LABEL}:</span> {body}
            </p>
            {stale && (
              <p role="note" style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5, color: S.onAmberContainer,
                backgroundColor: S.amberContainer, padding: '6px 10px', borderRadius: 8 }}>
                The run shown in the Shift Analysis has a {basis!.year} portfolio median of {fmtShift(served)}, so
                the figures in this reading come from an earlier run. They are brought up to date with the next
                analysis build.
              </p>
            )}
          </React.Fragment>
        ) : (
          <div key={i}>
            {label && (
              <div style={{
                fontFamily: HEADLINE_FONT, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: S.primary, marginBottom: 4,
              }}>
                {label}
              </div>
            )}
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: S.onSurface, fontWeight: 450 }}>
              {body}
            </p>
          </div>
        )
      ))}
    </div>
  );
};

// ─── Section card: one boxed sub-section of an expanded panel ──────
interface SectionCardProps {
  title: string;
  icon: LucideIcon;
  accent?: string;
  footnote?: React.ReactNode;
  /** Optional "?" help tooltip (plain hover text) shown next to the title. */
  info?: string;
  /** Optional right-aligned header slot (live value / status chip). */
  right?: React.ReactNode;
  children: React.ReactNode;
}
const SectionCard: FC<SectionCardProps> = ({ title, icon: Icon, accent, footnote, info, right, children }) => (
  <div role="group" aria-label={title} style={{
    backgroundColor: S.surface,
    border: `1px solid ${S.cardBorder}`,
    borderRadius: 12,
    padding: '14px 16px 16px',
  }}>
    <div style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
    }}>
      <span style={{
        width: 26, height: 26, borderRadius: 8,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: S.surfaceLow,
        color: accent ?? S.onSurfaceVariant,
      }}>
        <Icon size={14} strokeWidth={2.25} />
      </span>
      <div style={{
        fontFamily: HEADLINE_FONT,
        fontSize: 12, fontWeight: 800, letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: S.onSurface,
      }}>
        {title}
      </div>
      {info && <SectionInfoTip text={info} />}
      {right != null && <span style={{ marginLeft: 'auto', flexShrink: 0 }}>{right}</span>}
    </div>
    {children}
    {footnote && (
      <div style={{
        marginTop: 10, fontSize: 11, lineHeight: 1.5, color: S.mutedText,
      }}>
        {footnote}
      </div>
    )}
  </div>
);

// ─── Per-field help, shown by the "?" tooltips on the section cards ─
const FIELD_HELP = {
  probability: 'Likelihood this driver materialises at the stated severity. Scale: 1 = Very Unlikely, 3 = Possible, 5 = Almost Certain. The 1–5 score sets a Beta prior whose MEAN is score/6, deliberately shrunk against overconfidence: 1→0.17, 2→0.33, 3→0.50, 4→0.67, 5→0.83 (a "5" means five in six, not certainty). The band width comes from the Beta concentration α+β, which the Uncertainty score sets (6 for an unscored driver), sampled by the Monte Carlo.',
  uncertainty: `How much the SIZE and TIMING of the effect could differ from the modelled values, given its direction: one score per driver. It is not probability (how likely the effect is at all) and not Confidence (how well the present state is evidenced). 0 = fixed by law or contract; 1 = size within about ±25 %, timing dated; 2 = well-evidenced mechanism, size within about ±50 %, timing 1–2 years; 3 = size could be half or double, or the onset depends on an undated trigger; 4 = size could be near zero or more than double; 5 = the sign could differ across scenarios or the effect may not materialise inside the horizon. The engine turns it into the Beta-prior concentration (${UNCERTAINTY_KAPPA.join('/')}; the mean stays probability/6) and the peak-year jitter (${UNCERTAINTY_PEAK_JITTER.join('/')} years). Unscored: concentration 6 and the model-wide ±1-year jitter.`,
  gp1: 'The share of a category’s GP1 (gross profit after cost of goods) this driver can realistically move at full materialization. Multiplied by probability and direction, it produces the Shift.',
  timing: 'When the driver reaches full impact (Peak Year) and the shape of how it builds toward that peak over 2026–2035 (Diffusion Curve).',
  category: 'How hard this driver hits each Hair and Laundry & Home Care category, on a 0–5 scale. Grey = unscored: a cell you leave blank is not part of your proposal.',
  regional: 'How strongly this driver plays out across regions (Europe, North America, Asia, High Growth), on a 0–5 scale.',
  vc: 'The stage of the value chain, from raw materials through to the consumer, where this driver’s impact centres (its epicentre). One stage per driver: the value-chain attribution assigns the driver’s whole contribution to this stage, which is stored as a profile around it (5 at the stage, 3 one stage away, 1 two stages away).',
} as const;

// ─── Meta chip: the confidence and evidence pills of the meta row ──
const MetaChip: FC<{ label: string }> = ({ label }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center',
    padding: '4px 12px', borderRadius: 999,
    fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
    backgroundColor: S.surfaceLow,
    color: S.onSurfaceVariant,
    textTransform: 'uppercase',
  }}>
    {label}
  </span>
);

// ─── Source tier: the credibility scale, from S (official regulators and
// statistics) to E (social, unverified); the tooltip explains each tier. ─
const TIER_CONFIG: Record<SourceTier, { color: string; description: string }> = {
  'S':  { color: '#22c55e', description: 'Official regulatory / statistical authority' },
  'A':  { color: '#3b82f6', description: 'Tier-1 consulting or analyst primary research' },
  'A-': { color: '#60a5fa', description: 'Investment-bank equity research' },
  'B+': { color: '#a78bfa', description: 'Specialist market-research firm' },
  'B':  { color: '#c084fc', description: 'Industry trade press' },
  'B-': { color: '#e879f9', description: 'Company first-party source' },
  'C':  { color: '#f59e0b', description: 'General business press' },
  'D':  { color: '#ef4444', description: 'Aggregator / forecast' },
  'E':  { color: '#991b1b', description: 'Social / unverified' },
};
const TIER_OPTIONS = Object.keys(TIER_CONFIG) as SourceTier[];

// ─── Source item ──────────────────────────────────────────────────
const SourceItem: FC<{ src: DriverSource }> = ({ src }) => {
  const kind = classifySource(src.url);
  const Icon = SOURCE_ICON[kind];
  const tier = src.tier ? TIER_CONFIG[src.tier] : undefined;
  return (
    <a
      href={src.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex', gap: 10, alignItems: 'flex-start',
        padding: '10px 12px',
        backgroundColor: S.surfaceLow,
        borderRadius: 10,
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <span style={{
        flexShrink: 0, width: 28, height: 28, borderRadius: 8,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: S.surface, color: S.primary,
      }}>
        <Icon size={14} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          fontSize: 13, fontWeight: 600,
          color: S.onSurface, lineHeight: 1.35,
        }}>
          <span style={{ fontWeight: 600 }}>{src.title}</span>
          {tier && (
            <span
              title={`Source rating ${src.tier}: ${tier.description}`}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 22, height: 18, padding: '0 6px',
                borderRadius: 4,
                fontFamily: HEADLINE_FONT,
                fontSize: 11, fontWeight: 800, letterSpacing: '0.04em',
                backgroundColor: `${tier.color}22`,
                color: tier.color,
                border: `1px solid ${tier.color}55`,
                textTransform: 'none',
              }}
            >
              {src.tier}
            </span>
          )}
        </span>
        <span style={{
          display: 'block', fontSize: 11, color: S.mutedText, marginTop: 2,
        }}>
          {kind}{src.note ? ` · ${src.note}` : ''}
        </span>
      </span>
      <ExternalLink size={12} style={{ color: S.mutedText, marginTop: 4 }} />
    </a>
  );
};

// ─── Regional exposure grid (read-only) ───────────────────────────
const RegionExposureGrid: FC<{ exposures: ExposureMap }> = ({ exposures }) => (
  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
    {REGIONS.map((region) => (
      <div key={region} className="flex flex-col gap-1.5">
        <div className="text-[11px] font-medium" style={{ color: S.onSurface }}>
          {region}
        </div>
        <ReadDots value={exposures[region] ?? 0} color={S.primary} />
      </div>
    ))}
  </div>
);

// ─── Sort helpers ──────────────────────────────────────────────────
type SortKey = 'name' | 'direction' | 'probability' | 'gp1' | 'shift';
type SortDir = 'asc' | 'desc';

// The direction a column sorts in when first chosen: numbers biggest first,
// text A to Z.
const SORT_DEFAULT_DIR: Record<SortKey, SortDir> = {
  name:        'asc',
  direction:   'asc',
  probability: 'desc',
  gp1:         'desc',
  shift:       'desc',
};

function sortValue(d: Driver, key: SortKey): string | number {
  switch (key) {
    case 'name':        return d.name;
    case 'direction':   return d.direction;
    case 'probability': return d.probability;
    case 'gp1':         return d.gp1_pct_affected;
    case 'shift':       return d.normalized_score;
  }
}

// ═══════════════════════════════════════════════════════════════════
// Scoring modes
//
// One table in three modes; the layout stays, the cells and the expanded
// panel change:
//   list    the scores that feed the model, read-only. A score an admin has
//           changed from the driver's baseline shows in green; hover a score
//           for its baseline.
//   input   any signed-in expert scores a driver from a blank slate in the
//           expanded panel, with the baseline on hover; changes save as they
//           are made.
//   review  admins only: the expert aggregate against the baseline, with the
//           delta and who scored what. The admin endorses one driver at a
//           time, which writes the chosen values through the validated,
//           audited driver edit.
// The model reads only a driver's own scores. Proposals are advisory and are
// never applied on their own.
// ═══════════════════════════════════════════════════════════════════

type ScoringMode = 'list' | 'input' | 'review';

// Column templates per mode. The header and the rows read the same template,
// so the columns align. Driver is the one flexible column (min-width 0; the
// name truncates and shows in full on hover); Probability fits the five dots
// and widens in Review for the expert mean and its delta. The last column is
// the Edited chip (list), the expert's own review status (input) or the
// number of proposals (review).
const ROW_GRID: Record<ScoringMode, string> = {
  list:   'minmax(0, 1fr) 130px 128px 170px 100px 110px',
  input:  'minmax(0, 1fr) 130px 128px 170px 100px 130px',
  review: 'minmax(0, 1fr) 130px 180px 170px 100px 110px',
};

const EXPERT_COLOR   = '#6b4fc4';   // the expert aggregate: violet
const REVIEWED_COLOR = EXPANSION;   // an edited or endorsed value, a finished review: green
const DELTA_COLOR    = '#b07d2b';   // the delta chip: gold

/** A share as a whole percentage: 0.22 reads "22%". */
const pctI = (v: number | null | undefined): string =>
  v == null ? NO_VALUE : `${Math.round(v * 100)}%`;

/** The scores a driver is compared with: its baseline, or its own scores
 *  while no admin has edited it. Null for an edited driver without a baseline. */
const baselineOf = (d: Driver): DriverScores | null => d.baseline ?? (d.scores_edited ? null : d);

// Uncertainty: the labels of the six scores; lib/uncertainty.ts also holds
// what the engine makes of them (the Beta concentration, the peak-year jitter).
const uncLabel = (v: number | null | undefined): string =>
  v == null ? 'unscored' : `${v} · ${UNCERTAINTY_LABELS[Math.max(0, Math.min(5, Math.round(v)))]}`;

/** Uncertainty picker: six labelled buttons, 0 to 5 (0 is a real score,
 *  unlike probability), with the baseline score outlined. */
const UncertaintyPicker: FC<{
  value: number | null | undefined;
  baseline?: number | null;
  onChange: (v: number) => void;
  /** Clicking the selected score again clears it (Expert Rating). */
  onClear?: () => void;
}> = ({ value, baseline, onChange, onClear }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div role="radiogroup" aria-label="Uncertainty score" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}
      title={baseline != null ? `Baseline ${baseline} / 5 (${UNCERTAINTY_LABELS[baseline]})` : undefined}>
      {[0, 1, 2, 3, 4, 5].map((v) => {
        const on = value != null && Math.round(value) === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => (on && onClear ? onClear() : onChange(v))}
            title={`${v}: ${UNCERTAINTY_LABELS[v]}${baseline === v ? ' (baseline)' : ''}${on && onClear ? ', click again to clear' : ''}`}
            style={{
              minWidth: 44, padding: '6px 8px', borderRadius: 8,
              border: `1px solid ${baseline === v && !on ? S.primary : 'transparent'}`,
              backgroundColor: on ? S.primary : S.surfaceLow,
              color: on ? '#fff' : S.onSurface,
              fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 12, cursor: 'pointer',
            }}
          >
            {v}
          </button>
        );
      })}
    </div>
    <span style={{ fontSize: 11, color: S.mutedText }}>{uncLabel(value)}</span>
  </div>
);

/** The hover on an exposure cell: its baseline score; undefined without a
 *  baseline, so the dots keep their own "N / 5" labels. */
const baselineHint = (v: number | undefined): string | undefined =>
  v == null ? undefined : `Baseline ${v} / 5`;

// ─── Edited: the model inputs an admin has moved off the baseline ─
/** One line per model input whose current value differs from the baseline,
 *  compared at display precision; the value chain by its epicentre stage. */
function baselineDifferences(d: Driver, base: DriverScores): string[] {
  const lines: string[] = [];
  const compare = (input: string, now: string, then: string) => {
    if (now !== then) lines.push(`${input}: ${now} (baseline ${then})`);
  };
  const compareCells = (
    input: string, cells: ReadonlyArray<readonly [key: string, label: string]>, now: ExposureMap, then: ExposureMap,
  ) => {
    const changed = cells
      .filter(([key]) => (now[key] ?? 0) !== (then[key] ?? 0))
      .map(([key, label]) => `${label} ${now[key] ?? 0} (baseline ${then[key] ?? 0})`);
    if (changed.length) lines.push(`${input}: ${changed.join(', ')}`);
  };
  const stage = (profile: ExposureMap): string => {
    const s = epicentreOf(profile);
    return s == null ? 'unscored' : VC_STEPS[s - 1];
  };
  compare('Probability', `${d.probability} / 5`, `${base.probability} / 5`);
  compare('GP1 % affected', pctI(d.gp1_pct_affected), pctI(base.gp1_pct_affected));
  compare('Peak year', String(d.peak_year), String(base.peak_year));
  compare('Diffusion curve', curveLabel(d.diffusion_curve), curveLabel(base.diffusion_curve));
  compare('Uncertainty', uncLabel(d.uncertainty), uncLabel(base.uncertainty));
  compareCells('Category exposure', CATEGORIES.map((c) => [c.name, c.short] as const), d.category_exposure, base.category_exposure);
  compareCells('Regional exposure', REGIONS.map((r) => [r, r] as const), d.regional_exposure, base.regional_exposure);
  compare('Value chain epicentre', stage(d.vc_exposure), stage(base.vc_exposure));
  return lines;
}

/** The Edited chip of a driver an admin has changed, listing the changed
 *  inputs with their baseline values; an unedited driver carries no chip. */
const EditedChip: FC<{ driver: Driver }> = ({ driver }) => {
  if (!driver.scores_edited) return null;
  const changes = driver.baseline ? baselineDifferences(driver, driver.baseline) : [];
  const title = !driver.baseline
    ? 'Edited by an admin. This driver has no baseline to compare with.'
    : changes.length > 0
      ? ['Edited by an admin. Changed from the baseline:', ...changes].join('\n')
      : 'Edited by an admin; every score matches the baseline.';
  return <Chip kind="edited" title={title} />;
};

// Dot fill for a fractional score: a full dot is solid, a partial one fills
// from the left (a mean of 3.2 fills a fifth of the fourth dot), an empty one
// is grey.
const dotFill = (frac: number, color: string): string => {
  if (frac >= 0.999) return color;
  if (frac <= 0.001) return S.surfaceHigh;
  const p = Math.round(frac * 100);
  return `linear-gradient(90deg, ${color} ${p}%, ${S.surfaceHigh} ${p}%)`;
};

/** A read-only 1–5 dot scale in any colour, with DotBar's geometry. */
const ColorDots: FC<{ value: number; color: string; title?: string; muted?: boolean }> = ({ value, color, title, muted }) => (
  <div className="flex gap-1.5" title={title} aria-label={`${value} of 5`} style={{ cursor: title ? 'help' : undefined }}>
    {[1, 2, 3, 4, 5].map((d) => (
      <span key={d} className="inline-block w-2.5 h-2.5 rounded-full"
        style={{ background: dotFill(Math.max(0, Math.min(1, value - (d - 1))), color), opacity: muted ? 0.5 : 1 }} />
    ))}
  </div>
);

const DeltaChip: FC<{ value: number; unit?: string; digits?: number }> = ({ value, unit = '', digits = 1 }) => {
  const zero = Math.abs(value) < (digits === 0 ? 0.5 : 0.05);
  const sign = value > 0 ? '+' : '−';
  return (
    <span style={{
      fontSize: 11, fontWeight: 800, padding: '1px 7px', borderRadius: 999, whiteSpace: 'nowrap',
      backgroundColor: zero ? S.surfaceLow : 'rgba(176,125,43,0.15)',
      color: zero ? S.mutedText : DELTA_COLOR,
    }}>
      {zero ? '=' : `${sign}${Math.abs(value).toFixed(digits)}${unit}`}
    </span>
  );
};

const Dash: FC = () => <span style={{ color: S.mutedText, fontSize: 12 }}>{NO_VALUE}</span>;
const Val: FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 14, color: S.onSurface }}>{children}</span>
);

// ── Collapsed-row cells: read-only in every mode; scoring and editing
//    happen in the expanded panel ──
const ProbCell: FC<{ driver: Driver; mode: ScoringMode; myProposal?: DriverProposal }> = ({ driver, mode, myProposal }) => {
  const base = baselineOf(driver)?.probability;
  if (mode === 'list') {
    const edited = driver.scores_edited && base != null && driver.probability !== base;
    return (
      <ColorDots value={driver.probability} color={edited ? REVIEWED_COLOR : S.primary}
        title={base != null ? `Baseline ${base} / 5${edited ? ` · edited to ${driver.probability} / 5` : ''}` : undefined} />
    );
  }
  if (mode === 'input') {
    const my = myProposal?.probability ?? driver.proposal_summary.my?.probability;
    return (
      <ColorDots value={my != null ? Math.round(my) : 0} color={S.primary} muted={my == null}
        title={base != null ? `Baseline ${base} / 5 · open the driver to score` : 'Open the driver to score'} />
    );
  }
  const agg = driver.proposal_summary.probability;
  if (agg?.avg == null) return <Dash />;
  const delta = base != null ? agg.avg - base : null;
  return (
    <div className="flex items-center gap-2">
      <ColorDots value={Math.round(agg.avg)} color={EXPERT_COLOR} title={`Expert average ${agg.avg.toFixed(1)} / 5 · ${agg.count} scored`} />
      <span style={{ fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 12, color: EXPERT_COLOR }}>{agg.avg.toFixed(1)}</span>
      {delta != null && <DeltaChip value={delta} />}
    </div>
  );
};

const Gp1Cell: FC<{ driver: Driver; mode: ScoringMode; myProposal?: DriverProposal }> = ({ driver, mode, myProposal }) => {
  const base = baselineOf(driver)?.gp1_pct_affected;
  const big: React.CSSProperties = { fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: '1.15rem' };
  if (mode === 'list') {
    const cur = driver.gp1_pct_affected;
    const edited = driver.scores_edited && base != null && Math.round(cur * 100) !== Math.round(base * 100);
    return (
      <span style={{ ...big, color: edited ? REVIEWED_COLOR : S.onSurface, cursor: base != null ? 'help' : undefined }}
        title={base != null ? `Baseline ${pctI(base)}${edited ? ` · edited to ${pctI(cur)}` : ''}` : undefined}>
        {fmtPct(cur)}
      </span>
    );
  }
  if (mode === 'input') {
    const my = myProposal?.gp1_pct_affected ?? driver.proposal_summary.my?.gp1_pct_affected;
    return (
      <span style={{ ...big, color: my != null ? S.onSurface : S.onSurfaceVariant, cursor: 'help' }}
        title={base != null ? `Baseline ${pctI(base)} · open the driver to score` : 'Open the driver to score'}>
        {pctI(my)}
      </span>
    );
  }
  const agg = driver.proposal_summary.gp1_pct_affected;
  if (agg?.avg == null) return <Dash />;
  const delta = base != null ? (agg.avg - base) * 100 : null;
  return (
    <div className="flex items-center gap-2 justify-end">
      <span style={{ fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: '1.05rem', color: EXPERT_COLOR }}
        title={`Expert average ${pctI(agg.avg)} · ${agg.count} scored`}>{pctI(agg.avg)}</span>
      {delta != null && <DeltaChip value={delta} unit="pp" digits={0} />}
    </div>
  );
};

const RowEndCell: FC<{ driver: Driver; mode: ScoringMode; myProposal?: DriverProposal }> = ({ driver, mode, myProposal }) => {
  const [tip, setTip] = useState(false);
  const dirSign = driver.direction === 'Contraction' ? -1 : 1;

  // Expert Rating: the expert's own shift, from their own probability and GP1 %.
  if (mode === 'input') {
    const my = myProposal ?? driver.proposal_summary.my;
    const p = my?.probability;
    const g = my?.gp1_pct_affected;
    if (p == null || g == null) {
      return <span style={{ color: S.onSurfaceVariant, fontSize: 13, fontWeight: 700 }}>{NO_VALUE}</span>;
    }
    const myShift = dirSign * (Math.max(1, Math.min(5, p)) / 6) * g;
    return (
      <span className="font-bold text-[14px]"
        title={`Your shift = (your prob / 6) × your GP1% × direction = (${Math.round(p)}/6) × ${pctI(g)} × ${dirSign > 0 ? '+1' : '−1'}`}
        style={{ color: shiftColor(myShift), cursor: 'help' }}>
        {fmtShift(myShift)}
      </span>
    );
  }

  // Driver List and Review: the driver's own shift, with the arithmetic on hover.
  const shift = driver.normalized_score;
  return (
    <div className="text-right" style={{ position: 'relative' }}
      onMouseEnter={() => setTip(true)} onMouseLeave={() => setTip(false)}>
      <span className="font-bold text-[14px]" style={{
        color: shiftColor(shift),
        borderBottom: `1px dotted ${S.onSurfaceVariant}66`, cursor: 'help',
      }}>
        {fmtShift(shift)}
      </span>
      {tip && (
        <div role="tooltip" onClick={(e) => e.stopPropagation()} style={{
          position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 40, minWidth: 240, maxWidth: 320,
          padding: '10px 12px', borderRadius: 8, backgroundColor: S.onSurface, color: S.surface,
          fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11, lineHeight: 1.5, textAlign: 'left',
          boxShadow: '0 10px 24px rgba(0,52,94,0.28)', pointerEvents: 'none',
        }}>
          Shift = (prob/6) × GP1% × direction
          <br />= ({driver.probability}/6) × {(driver.gp1_pct_affected * 100).toFixed(1)}% × {dirSign > 0 ? '+1' : '−1'} = {fmtShift(shift)}
        </div>
      )}
    </div>
  );
};

// ── Last column: the Edited chip (list), the expert's own review status
//    (input), the number of experts who scored the driver (review) ──
const ReviewStatusCell: FC<{ driver: Driver; mode: ScoringMode; myProposal?: DriverProposal }> = ({ driver, mode, myProposal }) => {
  const pill: React.CSSProperties = {
    fontFamily: HEADLINE_FONT, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
    textTransform: 'uppercase', padding: '4px 11px', borderRadius: 999,
  };
  if (mode === 'input') {
    const my = myProposal ?? driver.proposal_summary.my;
    const hasProb = my?.probability != null;
    const hasGp1 = my?.gp1_pct_affected != null;
    const hasCat = !!my?.category_exposure && Object.keys(my.category_exposure).length > 0;
    const done = hasProb && hasGp1 && hasCat;
    return (
      <div className="flex justify-end">
        <span className="inline-flex items-center gap-1.5"
          title={done
            ? 'Reviewed: you rated probability, GP1% and at least one category exposure'
            : 'To complete: rate probability, GP1% and at least one category exposure'}
          style={{ ...pill, backgroundColor: done ? EXPANSION_SOFT : S.surfaceLow, color: done ? REVIEWED_COLOR : S.onSurfaceVariant }}>
          {done ? <><Check size={11} strokeWidth={2.6} /> Reviewed</> : 'Not reviewed'}
        </span>
      </div>
    );
  }
  if (mode === 'review') {
    const count = driver.proposal_summary.count;
    return (
      <div className="flex justify-end">
        <span style={{ ...pill, backgroundColor: count > 0 ? 'rgba(107,79,196,0.10)' : S.surfaceLow, color: count > 0 ? EXPERT_COLOR : S.onSurfaceVariant }}>
          {count > 0 ? `◆ ${count}` : NO_VALUE}
        </span>
      </div>
    );
  }
  // List: a driver an admin has edited carries the Edited chip; the others stay blank.
  return (
    <div className="flex justify-end">
      <EditedChip driver={driver} />
    </div>
  );
};

// ── Mode toggle; Review & Endorse is for admins ──
const ModeToggle: FC<{ mode: ScoringMode; onChange: (m: ScoringMode) => void; isAdmin: boolean }> = ({ mode, onChange, isAdmin }) => {
  const opts: Array<{ id: ScoringMode; label: string; dot: string }> = [
    { id: 'list', label: 'Driver List', dot: REVIEWED_COLOR },
    { id: 'input', label: 'Expert Rating', dot: S.primary },
    ...(isAdmin ? [{ id: 'review' as ScoringMode, label: 'Review & Endorse', dot: EXPERT_COLOR }] : []),
  ];
  return (
    <div role="tablist" aria-label="Scoring mode" style={{
      display: 'inline-flex', gap: 4, padding: 5, borderRadius: 999, backgroundColor: S.surface, border: `1px solid ${S.cardBorder}`,
    }}>
      {opts.map((o) => {
        const active = mode === o.id;
        return (
          <button key={o.id} role="tab" aria-selected={active} onClick={() => onChange(o.id)}
            className="inline-flex items-center gap-2 transition-colors"
            style={{
              padding: '9px 18px', borderRadius: 999, border: 'none', cursor: 'pointer',
              fontFamily: HEADLINE_FONT, fontSize: 13, fontWeight: 700,
              backgroundColor: active ? S.primary : 'transparent', color: active ? '#fff' : S.onSurfaceVariant,
            }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: active ? '#ffffff' : o.dot }} />
            {o.label}
          </button>
        );
      })}
    </div>
  );
};

// ── Diffusion-curve glyphs and the curve picker ──
const CURVE_PATHS: Record<string, string> = {
  s_curve: 'M2,16 C9,15 11,3 26,2',
  linear: 'M2,16 L26,2',
  front_loaded: 'M2,16 Q6,3 26,2',
  back_loaded: 'M2,16 Q22,15 26,2',
  step_function: 'M2,16 L18,16 L18,2 L26,2',
};
const DiffusionGlyph: FC<{ curve: string; color: string }> = ({ curve, color }) => (
  <svg width="30" height="18" viewBox="0 0 28 18" aria-hidden="true">
    <path d={CURVE_PATHS[curve] ?? CURVE_PATHS.s_curve} fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
  </svg>
);
const DiffusionPicker: FC<{
  value?: string | null;
  baseline?: string;
  distribution?: Record<string, number>;
  onChange: (curve: string) => void;
  /** Clicking the selected curve again clears it (Expert Rating). */
  onClear?: () => void;
}> = ({ value, baseline, distribution, onChange, onClear }) => (
  <div className="flex flex-wrap gap-2">
    {Object.entries(DIFFUSION_LABELS).map(([key, meta]) => {
      const selected = value === key;
      const n = distribution?.[key];
      return (
        <button key={key} type="button" onClick={() => (selected && onClear ? onClear() : onChange(key))}
          title={`${baseline === key ? `${meta.label} (baseline): ` : ''}${meta.description}${selected && onClear ? ' (click again to clear)' : ''}`}
          aria-pressed={selected} style={{
            position: 'relative', minWidth: 78, textAlign: 'center', padding: '8px 10px 6px', borderRadius: 9, cursor: 'pointer',
            backgroundColor: S.surface, border: `1px solid ${selected ? S.primary : S.cardBorder}`,
            boxShadow: selected ? `inset 0 0 0 1px ${S.primary}` : 'none',
          }}>
          {baseline === key && (
            <span style={{ position: 'absolute', top: 6, right: 6, display: 'inline-flex' }}><BaselineMark size={8} /></span>
          )}
          <DiffusionGlyph curve={key} color={selected ? S.primary : S.onSurfaceVariant} />
          <div style={{ fontSize: 11, fontWeight: 700, color: S.onSurface, marginTop: 3 }}>{meta.label}</div>
          {n != null && n > 0 && <div style={{ fontSize: 11, fontWeight: 800, color: EXPERT_COLOR, marginTop: 2 }}>×{n}</div>}
        </button>
      );
    })}
  </div>
);

/** The baseline beside an Expert Rating field; `value` is null without one. */
const BaselineRef: FC<{ value: string | null }> = ({ value }) => (
  <span title="The driver's baseline score" style={{
    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999,
    backgroundColor: S.surfaceLow, color: S.onSurfaceVariant, fontSize: 11, fontWeight: 700, fontFamily: HEADLINE_FONT, whiteSpace: 'nowrap', cursor: 'help',
  }}>
    <BaselineMark /> {`Baseline ${value ?? NO_VALUE}`}
  </span>
);

/** A driver's proposals, loaded when its panel opens. `failed` is set when the
 *  request failed; `retry` asks again. */
function useDriverProposals(driverId: string): {
  data: DriverProposalsResponse | null; loaded: boolean; failed: boolean; retry: () => void;
} {
  const [data, setData] = useState<DriverProposalsResponse | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // A new driver id invalidates the previous payload: `loaded` resets during
  // render (the documented React pattern), so no pass reports the old
  // proposals as loaded for the new driver. The fetch stays in the effect and
  // sets state only from its promise callbacks.
  const [fetchingFor, setFetchingFor] = useState(driverId);
  if (fetchingFor !== driverId) {
    setFetchingFor(driverId);
    setLoaded(false);
    setFailed(false);
  }
  useEffect(() => {
    let cancelled = false;
    getDriverProposals(driverId)
      .then((r) => { if (!cancelled) { setData(r); setFailed(false); setLoaded(true); } })
      .catch(() => { if (!cancelled) { setData(null); setFailed(true); setLoaded(true); } });
    return () => { cancelled = true; };
  }, [driverId, attempt]);
  const retry = useCallback(() => { setLoaded(false); setAttempt((n) => n + 1); }, []);
  return { data, loaded, failed, retry };
}

/** Shown in place of a panel whose proposals could not be loaded. */
const ProposalsUnavailable: FC<{ what: string; onRetry: () => void }> = ({ what, onRetry }) => (
  <div role="alert" style={{ padding: '26px 0', textAlign: 'center', color: S.onSurfaceVariant }}>
    <AlertTriangle size={20} style={{ color: S.error }} />
    <div style={{ marginTop: 8, fontSize: 14 }}>The proposals for this driver could not be loaded, so {what}.</div>
    <button type="button" onClick={onRetry} style={{
      marginTop: 12, padding: '7px 16px', borderRadius: 999, border: `1px solid ${S.cardBorder}`,
      background: S.surface, color: S.primary, fontFamily: HEADLINE_FONT, fontSize: 12, fontWeight: 700, cursor: 'pointer',
    }}>
      Try again
    </button>
  </div>
);

/** A year field for the Expert Rating: the proposal takes the value only while
 *  it is a whole year from 2025 to 2035, so a half-typed year is never sent;
 *  leaving the field with anything else puts the last valid year back. */
const ProposalYearInput: FC<{ value: number | null | undefined; onChange: (v: number | null) => void; title?: string }> = ({
  value, onChange, title,
}) => {
  const [text, setText] = useState(value == null ? '' : String(value));
  const [shownFor, setShownFor] = useState(value);
  if (shownFor !== value) {
    setShownFor(value);
    setText(value == null ? '' : String(value));
  }
  const valid = (t: string) => /^\d{4}$/.test(t) && Number(t) >= 2025 && Number(t) <= 2035;
  return (
    <input type="text" inputMode="numeric" value={text} placeholder={NO_VALUE} title={title}
      aria-label="Peak year, 2025 to 2035" aria-invalid={text !== '' && !valid(text)}
      onChange={(e) => {
        const t = e.target.value.trim();
        setText(t);
        if (t === '') onChange(null);
        else if (valid(t)) onChange(Number(t));
      }}
      onBlur={() => { if (text !== '' && !valid(text)) setText(value == null ? '' : String(value)); }}
      style={{ width: 110, padding: '8px 10px', borderRadius: 8, border: `1px solid ${text !== '' && !valid(text) ? S.error : S.cardBorder}`,
        backgroundColor: S.surfaceLow, color: S.onSurface, fontSize: 13, fontWeight: 700 }} />
  );
};

// ── Expert Rating panel: the expert's own proposal, scored from a blank
//    slate and saved automatically, with the baseline on hover ──
const ExpertInputPanel: FC<{ driver: Driver; onMyChange: (driverId: string, my: DriverProposal) => void }> = ({ driver, onMyChange }) => {
  const { data, loaded, failed, retry } = useDriverProposals(driver.id);
  const [draft, setDraft] = useState<DriverProposal>({});
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const draftRef = useRef<DriverProposal>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Saves go out one at a time, each with the draft as it is when it starts,
  // so a slow earlier save can never land after a later one.
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const sendNow = useCallback(() => {
    const next = chain.current.catch(() => undefined).then(() => saveMyProposal(driver.id, draftRef.current));
    chain.current = next;
    return next;
  }, [driver.id]);

  // The draft takes the stored proposal once, in the first render after it
  // has loaded. Adjusting during render means the panel's first visible frame
  // already shows the stored proposal rather than a blank draft.
  const [hydrated, setHydrated] = useState(false);
  if (loaded && !failed && !hydrated) {
    setHydrated(true);
    setDraft(data?.my ?? {});
  }
  // `draftRef` is the merge base for `patch` and what the unmount flush
  // saves. `patch` keeps it current while the expert types; refs may not be
  // written during render, so the stored proposal above reaches it here, in
  // a layout effect: it runs right after the commit, before any click can.
  useLayoutEffect(() => { draftRef.current = draft; }, [draft]);
  // The row's copy of "my proposal" is the parent's state, so it is seeded
  // from an effect once the draft holds the stored proposal.
  useEffect(() => {
    if (hydrated) onMyChange(driver.id, draftRef.current);
  }, [hydrated, onMyChange, driver.id]);
  // A pending autosave is sent, not dropped, when the panel unmounts:
  // collapsing the row inside the 0.6 s debounce would otherwise lose an edit
  // already on screen. `pendingSave` marks a save the debounce has not sent
  // yet, so none goes out twice.
  const pendingSave = useRef(false);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    if (pendingSave.current) {
      pendingSave.current = false;
      // The panel is gone, but the write must still land.
      void sendNow().catch(() => undefined);
    }
  }, [sendNow]);

  const flush = useCallback(() => {
    setStatus('saving');
    pendingSave.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      pendingSave.current = false;
      const save = sendNow();
      save.then(
        () => { if (chain.current === save && !pendingSave.current) setStatus('saved'); },
        () => { if (chain.current === save) setStatus('error'); },
      );
    }, 600);
  }, [sendNow]);
  const patch = useCallback((p: Partial<DriverProposal>) => {
    const next = { ...draftRef.current, ...p };
    draftRef.current = next;
    setDraft(next);
    onMyChange(driver.id, next);
    flush();
  }, [flush, onMyChange, driver.id]);

  const base = baselineOf(driver);
  const baseVcStage = epicentreOf(base?.vc_exposure);
  const myVcStage = epicentreOf(draft.vc_exposure);
  const gp1Int = draft.gp1_pct_affected != null ? Math.round(draft.gp1_pct_affected * 100) : undefined;
  const dist = data?.aggregate.diffusion_curve?.distribution;
  const statusText = status === 'saving' ? 'Saving…'
    : status === 'saved' ? '✓ All changes saved'
    : status === 'error' ? '⚠ Save failed; it retries on your next change'
    : 'Changes auto-save';

  // Until the stored proposal has loaded nothing can be edited: a save made
  // from a blank draft would overwrite what the expert entered before.
  if (!hydrated) {
    return (
      <div onClick={(e) => e.stopPropagation()} style={{ padding: '0 32px', backgroundColor: S.surface, borderTop: `1px solid ${S.cardBorder}` }}>
        {failed
          ? <ProposalsUnavailable what="your proposal cannot be edited right now" onRetry={retry} />
          : <div style={{ padding: '26px 0', textAlign: 'center', fontSize: 14, color: S.onSurfaceVariant }}>Loading your proposal…</div>}
      </div>
    );
  }

  return (
    <div onClick={(e) => e.stopPropagation()} style={{ padding: '24px 32px 32px', backgroundColor: S.surface, borderTop: `1px solid ${S.cardBorder}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <span className="inline-flex items-center gap-2" style={{ fontFamily: HEADLINE_FONT, fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: S.primary }}>
          <PenLine size={13} strokeWidth={2.4} /> Expert Rating · your proposal
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: status === 'error' ? S.error : status === 'saved' ? REVIEWED_COLOR : S.onSurfaceVariant }}>{statusText}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.05fr) minmax(0,1fr)', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SectionCard title="Context" icon={FileText}>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: S.onSurface, whiteSpace: 'pre-wrap' }}>
              {driver.description || <em style={{ color: S.mutedText }}>No description documented.</em>}
            </p>
          </SectionCard>

          <SectionCard title="PRISM Analysis" icon={BarChart3} accent={S.primary} footnote={ANALYSIS_FOOTNOTE}>
            <div style={{ padding: '12px 16px', borderRadius: 10, borderLeft: `3px solid ${S.primary}`, backgroundColor: S.surfaceLow }}>
              <PrismAnalysisReading text={driver.analysis} />
            </div>
          </SectionCard>

          <SectionCard title="Probability" icon={Zap} info={FIELD_HELP.probability} footnote="1 = Very Unlikely · 3 = Possible · 5 = Almost Certain. Hover the dots for the baseline; click the selected dot again to clear your score.">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <span title={base != null ? `Baseline ${base.probability} / 5` : undefined} style={{ cursor: base != null ? 'help' : undefined }}>
                <DotBar value={draft.probability ?? 0} editable onChange={(v) => patch({ probability: v === draft.probability ? null : v })} />
              </span>
              <BaselineRef value={base != null ? `${base.probability}/5` : null} />
            </div>
          </SectionCard>

          <SectionCard title="Impact: GP1 % exposed" icon={BarChart3} info={FIELD_HELP.gp1} footnote="Share of category GP1 this driver can move at full materialization.">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input type="range" min={0} max={100} step={1} value={gp1Int ?? 0}
                onChange={(e) => patch({ gp1_pct_affected: parseInt(e.target.value, 10) / 100 })}
                title={base != null ? `Baseline ${pctI(base.gp1_pct_affected)}` : undefined} style={{ flex: 1, cursor: base != null ? 'help' : undefined }} />
              <input type="number" min={0} max={100} step={1} value={gp1Int ?? ''} placeholder={NO_VALUE}
                aria-label="GP1 percent exposed"
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  patch({ gp1_pct_affected: Number.isNaN(n) ? null : Math.max(0, Math.min(100, n)) / 100 });
                }}
                title={base != null ? `Baseline ${pctI(base.gp1_pct_affected)}` : undefined}
                style={{ width: 70, padding: '6px 8px', borderRadius: 8, border: `1px solid ${S.cardBorder}`, backgroundColor: S.surfaceLow, color: S.onSurface, fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 15, textAlign: 'right' }} />
              <span style={{ color: S.mutedText, fontSize: 12 }}>%</span>
              <BaselineRef value={base != null ? pctI(base.gp1_pct_affected) : null} />
            </div>
          </SectionCard>

          <SectionCard title="Materialization timing" icon={Clock} info={FIELD_HELP.timing}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <FieldLabel>Peak Year</FieldLabel>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <ProposalYearInput value={draft.peak_year} onChange={(v) => patch({ peak_year: v })}
                    title={base != null ? `Baseline ${base.peak_year}` : undefined} />
                  <BaselineRef value={base != null ? String(base.peak_year) : null} />
                </div>
              </div>
              <div>
                <FieldLabel>Diffusion Curve</FieldLabel>
                <DiffusionPicker value={draft.diffusion_curve} baseline={base?.diffusion_curve} distribution={dist}
                  onChange={(c) => patch({ diffusion_curve: c })} onClear={() => patch({ diffusion_curve: null })} />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Uncertainty" icon={Zap} info={FIELD_HELP.uncertainty} footnote="0 = fixed · 3 = half or double · 5 = sign open. Sets the band width and the timing jitter of this driver; the mean stays where probability puts it.">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
              <UncertaintyPicker value={draft.uncertainty} baseline={base?.uncertainty}
                onChange={(v) => patch({ uncertainty: v })} onClear={() => patch({ uncertainty: null })} />
              <BaselineRef value={base?.uncertainty != null ? `${base.uncertainty}/5` : null} />
            </div>
          </SectionCard>

          {driver.sources.length > 0 && (
            <SectionCard title={`Sources · ${driver.sources.length}`} icon={Newspaper}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {driver.sources.map((src, i) => <SourceItem key={i} src={src} />)}
              </div>
            </SectionCard>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SectionCard title="Category Exposure" icon={Layers} info={FIELD_HELP.category} footnote="Grey = unscored. A cell you leave blank is not part of your proposal; click a selected dot again to clear it.">
            <EditableCategoryGrid clearable exposures={draft.category_exposure ?? {}}
              onChange={(e) => patch({ category_exposure: Object.keys(e).length ? e : null })} baseline={base?.category_exposure} />
          </SectionCard>
          <SectionCard title="Regional Exposure" icon={MapPin} accent={S.onSecondaryContainer} info={FIELD_HELP.regional}>
            <EditableRegionGrid clearable exposures={draft.regional_exposure ?? {}}
              onChange={(e) => patch({ regional_exposure: Object.keys(e).length ? e : null })} baseline={base?.regional_exposure} />
          </SectionCard>
          <SectionCard
            title="Value Chain Epicentre" icon={Cpu} accent={S.onTertiaryContainer} info={FIELD_HELP.vc}
            right={
              <span className="inline-flex items-center gap-2">
                <span style={{ fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 13, color: myVcStage != null ? S.primary : S.mutedText }}>
                  {vcStageLabel(myVcStage)}
                </span>
                {myVcStage != null && (
                  <button type="button" onClick={() => patch({ vc_exposure: null })}
                    style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontSize: 11, fontWeight: 700, color: S.onSurfaceVariant, textDecoration: 'underline' }}>
                    Clear
                  </button>
                )}
              </span>
            }
            footnote="One choice: the stage where this driver’s impact centres. The value-chain attribution assigns the driver’s whole contribution to this stage; leave it unscored and it is not part of your proposal."
          >
            <EpicentreSlider value={myVcStage} baseline={baseVcStage} onChange={(st) => patch({ vc_exposure: canonicalVcProfile(st) })} />
          </SectionCard>

          <SectionCard title="Comment" icon={MessageSquare} accent={S.primary} footnote="Optional. Shared with the reviewers under Review &amp; Endorse: explain your reasoning, flag a caveat or note evidence.">
            <textarea
              value={draft.comment ?? ''}
              onChange={(e) => patch({ comment: e.target.value })}
              placeholder="Add a comment for the reviewers…"
              rows={4}
              maxLength={2000}
              style={{
                width: '100%', resize: 'vertical', minHeight: 84,
                padding: '10px 12px', borderRadius: 8,
                border: `1px solid ${S.cardBorder}`, backgroundColor: S.surfaceLow,
                color: S.onSurface, fontFamily: BODY_FONT, fontSize: 13.5, lineHeight: 1.55,
              }}
            />
            <div style={{ marginTop: 4, textAlign: 'right', fontSize: 11, color: S.mutedText }}>
              {(draft.comment ?? '').length}/2000
            </div>
          </SectionCard>
        </div>
      </div>

      <div className="inline-flex items-center gap-1.5" style={{ marginTop: 18, padding: '8px 14px', borderRadius: 10, backgroundColor: S.surfaceLow, color: S.onSurfaceVariant, fontSize: 12.5, lineHeight: 1.5 }}>
        <Info size={13} style={{ flexShrink: 0, color: S.primary }} />
        <span>Your scores are a proposal and never change the driver: the model reads the driver&apos;s own scores. An admin endorses a proposal by editing the driver.</span>
      </div>
    </div>
  );
};

// ── Read-only 0–5 dot scale: six dots including the 0 dot, like EditableDots ──
const ReadDots: FC<{ value?: number; color: string }> = ({ value, color }) => (
  <div className="flex gap-1" aria-label={value != null ? `${value} of 5` : 'unscored'}>
    {[0, 1, 2, 3, 4, 5].map((d) => {
      const bg = d === 0
        ? (value === 0 ? color : S.surfaceHigh)
        : dotFill(value == null ? 0 : Math.max(0, Math.min(1, value - (d - 1))), color);
      return (
        <span key={d} className="inline-block rounded-full"
          style={{ width: 14, height: 14, background: bg, opacity: d === 0 ? 0.4 : 1 }} />
      );
    })}
  </div>
);

// ── Mini 0–100% bar (the GP1 % comparison) ──
const MiniBar: FC<{ v?: number; color: string }> = ({ v, color }) => (
  <div className="flex items-center gap-2" style={{ flex: 1 }}>
    <div style={{ position: 'relative', height: 7, borderRadius: 7, backgroundColor: S.surfaceHigh, flex: 1, maxWidth: 150 }}>
      {v != null && <div style={{ position: 'absolute', inset: 0, width: `${Math.min(100, Math.round(v * 100))}%`, backgroundColor: color, borderRadius: 7 }} />}
    </div>
    <span style={{ fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 13, color: v != null ? color : S.onSurfaceVariant }}>{pctI(v)}</span>
  </div>
);

// ── Baseline over expert mean: the baseline row (ink) on top, the expert
//    mean (green) below, with who scored what on hover ──
const CompareStack: FC<{ baseline: React.ReactNode; expert: React.ReactNode; who?: string }> = ({ baseline, expert, who }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div className="flex items-center gap-2.5">
      <span style={{ fontSize: 11, fontWeight: 800, color: S.onSurface, width: 30, flexShrink: 0, letterSpacing: '0.04em' }}>Base</span>
      {baseline}
    </div>
    <div className="flex items-center gap-2.5" title={who} style={{ cursor: who ? 'help' : undefined }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: REVIEWED_COLOR, width: 30, flexShrink: 0, letterSpacing: '0.04em' }}>ø</span>
      {expert}
    </div>
  </div>
);

// ── One exposure cell: its label, the baseline dots (ink) over the expert
//    mean (green), and the manual override ──
/** An exposure cell of the Review panel: its key and label, the baseline
 *  score and the experts' aggregate. */
interface ExposureRow { key: string; label: string; baseV?: number; curV: number; expert?: ProposalAgg }

const ExposureCompareCell: FC<{ label: string; baseVal?: number; expert?: ProposalAgg; manualVal?: number; onManual: (v: number) => void }> = ({ label, baseVal, expert, manualVal, onManual }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '9px 11px', border: `1px solid ${S.cardBorder}`, borderRadius: 9, backgroundColor: S.surface }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: S.onSurface }}>{label}</span>
      {expert?.count ? <span style={{ fontSize: 11, fontWeight: 700, color: S.mutedText }} title={`${expert.count} expert(s) scored`}>n{expert.count}</span> : null}
    </div>
    <div className="flex items-center gap-2">
      <span style={{ fontSize: 11, fontWeight: 800, color: S.onSurface, width: 38, flexShrink: 0, textAlign: 'right' }}>Base</span>
      <ReadDots value={baseVal} color={S.onSurface} />
    </div>
    <div className="flex items-center gap-2">
      <span style={{ fontSize: 11, fontWeight: 800, color: REVIEWED_COLOR, width: 38, flexShrink: 0, textAlign: 'right' }}>ø</span>
      <ReadDots value={expert?.avg} color={REVIEWED_COLOR} />
    </div>
    <div className="flex items-center gap-2" style={{ paddingTop: 5, borderTop: `1px solid ${S.surfaceLow}` }}>
      {/* Tightened tracking so "Manual" fits the 38px label gutter at 11px. */}
      <span style={{ fontSize: 11, letterSpacing: '-0.02em', fontWeight: 800, color: S.primary, width: 38, flexShrink: 0, textAlign: 'right' }} title="Manual override: click a dot to set">Manual</span>
      <EditableDots value={manualVal} onChange={(v) => { if (v != null) onManual(v); }} label={`${label} manual score`} />
    </div>
  </div>
);

// ── Per-field endorse choice: keep the current value, the baseline, the expert mean or a manual value ──
type EndorseSource = 'current' | 'baseline' | 'expert' | 'manual';
const ENDORSE_OPTIONS: Array<[EndorseSource, string]> = [
  ['current', 'Keep'], ['baseline', 'Baseline'], ['expert', 'Expert ø'], ['manual', 'Manual'],
];
/** What an exposure grid endorses, by its choice. */
const EXPOSURE_RESULT: Record<EndorseSource, string> = {
  current: 'Keep the current scores', baseline: 'Baseline', expert: 'Expert ø where scored, current elsewhere',
  manual: 'Manual (custom)',
};

const manInput: React.CSSProperties = {
  width: 66, padding: '5px 8px', borderRadius: 7, border: `1px solid ${S.primary}`,
  background: S.surface, color: S.onSurface, fontFamily: HEADLINE_FONT, fontWeight: 700, fontSize: 13,
};
const Decide: FC<{
  cur: EndorseSource;
  onPick: (s: EndorseSource) => void;
  baselineOk: boolean; expertOk: boolean;
  manual?: React.ReactNode;
  result?: React.ReactNode;
}> = ({ cur, onPick, baselineOk, expertOk, manual, result }) => (
  <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${S.surfaceLow}`, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
    <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: S.mutedText }}>Endorse</span>
    <div style={{ display: 'inline-flex', border: `1px solid ${S.cardBorder}`, borderRadius: 999, overflow: 'hidden' }}>
      {ENDORSE_OPTIONS.map(([k, lab], i) => {
        const on = cur === k;
        const disabled = (k === 'baseline' && !baselineOk) || (k === 'expert' && !expertOk);
        const bg = on
          ? (k === 'current' ? S.onSurfaceVariant : k === 'baseline' ? S.onSurface : k === 'expert' ? REVIEWED_COLOR : S.primary)
          : S.surface;
        return (
          <button key={k} type="button" disabled={disabled} onClick={() => onPick(k)} aria-pressed={on}
            style={{ border: 'none', borderRight: i < ENDORSE_OPTIONS.length - 1 ? `1px solid ${S.cardBorder}` : 'none',
              cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: HEADLINE_FONT, fontSize: 11, fontWeight: 700,
              padding: '6px 11px', background: bg, color: on ? '#fff' : (disabled ? S.mutedText : S.onSurfaceVariant), opacity: disabled ? 0.45 : 1 }}>
            {lab}
          </button>
        );
      })}
    </div>
    {cur === 'manual' && manual}
    {result != null && <span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 800, fontFamily: HEADLINE_FONT, color: S.onSurface }}>→ {result}</span>}
  </div>
);

// ── Value-chain epicentre votes (Review & Endorse) ──
// Stages are categories: each expert's pick is a stacked dot on its stage,
// counted and never averaged (a Supply Chain vote and two Commercial votes
// must not blend into Marketing). The admin keeps the current stage, endorses
// the majority or the baseline stage, or clicks any stage on the rail; a tie
// leaves no majority and stays visible.
const EpicentreVotePanel: FC<{
  baseline: number | null;
  /** The driver's stage now. */
  current: number | null;
  votes: Array<{ name: string; stage: number }>;
  majority: { stage: number; n: number } | null;
  endorsed: number | null;
  onEndorse: (stage: number) => void;
}> = ({ baseline, current, votes, majority, endorsed, onEndorse }) => {
  const byStage = new Map<number, Array<{ name: string }>>();
  for (const v of votes) {
    const l = byStage.get(v.stage) ?? [];
    l.push(v);
    byStage.set(v.stage, l);
  }
  const srcText = endorsed == null ? null
    : endorsed === current ? 'kept as it is'
    : majority != null && endorsed === majority.stage ? `Expert majority (${majority.n} of ${votes.length})`
    : baseline != null && endorsed === baseline ? 'Baseline'
    : 'Manual pick';
  const pillStyle = (on: boolean, disabled = false): React.CSSProperties => ({
    border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: HEADLINE_FONT, fontSize: 11, fontWeight: 700, padding: '6px 12px',
    background: on ? S.onSurface : S.surface,
    color: on ? '#fff' : disabled ? S.mutedText : S.onSurfaceVariant,
    opacity: disabled ? 0.45 : 1,
  });
  return (
    <div>
      <div style={{ position: 'relative', height: 78 }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 54, height: 6, borderRadius: 6, backgroundColor: S.surfaceHigh }} />
        {VC_STEPS.map((step, i) => (
          <button
            key={step} type="button" onClick={() => onEndorse(i + 1)}
            title={`Endorse ${step}`} aria-label={`Endorse ${step}`}
            style={{
              position: 'absolute', top: 52, left: vcPos(i + 1), width: 10, height: 10,
              borderRadius: 999, backgroundColor: S.surfaceHighest, border: 'none',
              padding: 0, cursor: 'pointer', transform: 'translateX(-50%)',
            }}
          />
        ))}
        {[...byStage.entries()].map(([stage, list]) => {
          const who = list.map((v) => v.name).join('\n');
          return (
            <React.Fragment key={stage}>
              <span title={who} style={{ position: 'absolute', top: 48, left: vcPos(stage), width: 2, height: 5, backgroundColor: EXPERT_COLOR, opacity: 0.35, transform: 'translateX(-50%)', cursor: 'help' }} />
              {list.slice(0, 3).map((v, j) => (
                <span
                  key={`${stage}-${j}`}
                  title={j === 2 && list.length > 3 ? who : `${v.name} → ${VC_STEPS[stage - 1]}`}
                  style={{
                    position: 'absolute', top: 36 - 13 * j, left: vcPos(stage), width: 10, height: 10,
                    borderRadius: 999, backgroundColor: EXPERT_COLOR, opacity: 0.65,
                    transform: 'translateX(-50%)', cursor: 'help',
                  }}
                />
              ))}
              {list.length > 3 && (
                <span title={who} style={{ position: 'absolute', top: 8, left: vcPos(stage), transform: 'translateX(-50%)', fontSize: 11, fontWeight: 800, color: EXPERT_COLOR, cursor: 'help' }}>
                  ×{list.length}
                </span>
              )}
            </React.Fragment>
          );
        })}
        {baseline != null && (
          <span title={`Baseline · ${VC_STEPS[baseline - 1]}`} style={{ position: 'absolute', top: 64, left: vcPos(baseline), width: 9, height: 9, backgroundColor: S.bg, border: `2px solid ${S.onSurface}`, transform: 'translateX(-50%) rotate(45deg)', cursor: 'help' }} />
        )}
        {endorsed != null && (
          <span title={`Endorsed · ${VC_STEPS[endorsed - 1]}`} style={{ position: 'absolute', top: 47, left: vcPos(endorsed), width: 20, height: 20, borderRadius: 999, backgroundColor: REVIEWED_COLOR, border: '3px solid #ffffff', outline: '1px solid rgba(31,122,61,0.45)', transform: 'translateX(-50%)', pointerEvents: 'none' }} />
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', marginTop: 2 }}>
        {VC_STEPS.map((step, i) => (
          <button
            key={step} type="button" onClick={() => onEndorse(i + 1)}
            aria-pressed={i + 1 === endorsed}
            title={`Endorse ${step}`}
            style={{
              border: 'none', background: 'transparent', padding: '4px 0', cursor: 'pointer',
              fontFamily: BODY_FONT, fontSize: 11, textAlign: 'center', lineHeight: 1.25,
              color: i + 1 === endorsed ? REVIEWED_COLOR : S.mutedText,
              fontWeight: i + 1 === endorsed ? 800 : 400,
            }}
          >
            {VC_SHORT_LABELS[i]}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10, flexWrap: 'wrap', fontSize: 11, color: S.mutedText }}>
        <span className="inline-flex items-center gap-1.5"><span style={{ width: 9, height: 9, borderRadius: 999, backgroundColor: EXPERT_COLOR, opacity: 0.65 }} /> One dot = one expert vote</span>
        <span className="inline-flex items-center gap-1.5"><BaselineMark size={12} /> Baseline</span>
        <span className="inline-flex items-center gap-1.5"><span style={{ width: 11, height: 11, borderRadius: 999, backgroundColor: REVIEWED_COLOR, border: '2px solid #fff', outline: '1px solid rgba(31,122,61,0.45)' }} /> Endorsed stage</span>
      </div>
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${S.surfaceLow}`, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: S.mutedText }}>Endorse</span>
        <div style={{ display: 'inline-flex', border: `1px solid ${S.cardBorder}`, borderRadius: 999, overflow: 'hidden' }}>
          <button
            type="button" disabled={current == null}
            onClick={() => { if (current != null) onEndorse(current); }}
            aria-pressed={current != null && endorsed === current}
            style={{ ...pillStyle(current != null && endorsed === current, current == null), borderRight: `1px solid ${S.cardBorder}` }}
          >
            {current != null ? `Keep · ${VC_STEPS[current - 1]}` : `Keep ${NO_VALUE}`}
          </button>
          <button
            type="button" disabled={baseline == null}
            onClick={() => { if (baseline != null) onEndorse(baseline); }}
            aria-pressed={baseline != null && endorsed === baseline}
            style={{ ...pillStyle(baseline != null && endorsed === baseline, baseline == null), borderRight: `1px solid ${S.cardBorder}` }}
          >
            {baseline != null ? `Baseline · ${VC_STEPS[baseline - 1]}` : `Baseline ${NO_VALUE}`}
          </button>
          <button
            type="button" disabled={majority == null}
            onClick={() => { if (majority) onEndorse(majority.stage); }}
            aria-pressed={majority != null && endorsed === majority.stage}
            style={pillStyle(majority != null && endorsed === majority.stage, majority == null)}
          >
            {majority != null
              ? `Majority · ${VC_STEPS[majority.stage - 1]} (${majority.n}/${votes.length})`
              : votes.length > 0 ? 'No majority: a tie' : 'No expert votes yet'}
          </button>
        </div>
        <span style={{ fontSize: 11.5, color: S.mutedText }}>or click a stage on the rail</span>
        {endorsed != null && srcText && (
          <span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 800, fontFamily: HEADLINE_FONT, color: S.onSurface }}>
            → <span style={{ color: REVIEWED_COLOR }}>{VC_STEPS[endorsed - 1]}</span> · {srcText}
          </span>
        )}
      </div>
    </div>
  );
};

// ── Review & Endorse panel (admins) ──
const ReviewPanel: FC<{ driver: Driver; updateDriver: (driverId: string, update: DriverUpdate) => Promise<void> }> = ({ driver, updateDriver }) => {
  const { data, loaded, failed, retry } = useDriverProposals(driver.id);
  const [src, setSrc] = useState<Record<string, EndorseSource>>({});
  const [man, setMan] = useState<Record<string, string>>({});
  const [manExpo, setManExpo] = useState<Record<string, ExposureMap>>({});
  // The value chain is endorsed as one stage: the admin's pick, else the
  // expert majority, else the baseline stage. Never an average (see
  // EpicentreVotePanel).
  const [endorsedVc, setEndorsedVc] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const agg = data?.aggregate;
  // Memoised so the vote memo below does not rerun on every render while the
  // proposals load (`data?.scorers ?? []` is a new array each time).
  const scorers = useMemo(() => data?.scorers ?? [], [data]);
  const count = scorers.length || driver.proposal_summary.count;
  // Every expert's comment from the Expert Rating panel; blank ones are skipped.
  const comments = scorers.filter((s) => (s.comment ?? '').trim().length > 0);

  // The baseline (see baselineOf) and the expert aggregate.
  const base = baselineOf(driver);
  const bP = base?.probability, bG = base?.gp1_pct_affected, bPk = base?.peak_year, bCv = base?.diffusion_curve;
  const bU = base?.uncertainty;
  const baseCat = base?.category_exposure;
  const baseReg = base?.regional_exposure;
  const baseVc = base?.vc_exposure;
  const baseVcStage = epicentreOf(baseVc);
  const eP = agg?.probability?.avg, eG = agg?.gp1_pct_affected?.avg, ePk = agg?.peak_year?.median, eCv = agg?.diffusion_curve?.mode;
  const eU = agg?.uncertainty?.median;
  // One value-chain vote per expert: the epicentre of the expert's profile.
  const vcVotes = useMemo(
    () => scorers
      .map((s) => ({ name: s.name, stage: epicentreOf(s.vc_exposure) }))
      .filter((v): v is { name: string; stage: number } => v.stage != null),
    [scorers],
  );
  const vcMajority = useMemo(() => {
    const counts = new Map<number, number>();
    for (const v of vcVotes) counts.set(v.stage, (counts.get(v.stage) ?? 0) + 1);
    let best: { stage: number; n: number } | null = null;
    let tied = false;
    for (const [stage, n] of counts) {
      if (best == null || n > best.n) { best = { stage, n }; tied = false; }
      else if (n === best.n) tied = true;
    }
    return tied ? null : best;
  }, [vcVotes]);
  // The stage the driver has now; endorsing it leaves the stored profile as it is.
  const currentVcStage = epicentreOf(driver.vc_exposure);
  const endorsedVcStage = endorsedVc ?? vcMajority?.stage ?? currentVcStage;
  const grouped = { Hair: CATEGORIES.filter((c) => c.group === 'Hair'), LHC: CATEGORIES.filter((c) => c.group === 'LHC') };
  const grpLabel: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: S.onSurfaceVariant, margin: '2px 0 8px' };

  const whoFor = (field: 'probability' | 'gp1_pct_affected' | 'peak_year' | 'diffusion_curve' | 'uncertainty'): string | undefined => {
    const rows = scorers.filter((s) => s[field] != null);
    if (rows.length === 0) return undefined;
    return rows.map((s) => `${s.name}: ${field === 'gp1_pct_affected' ? pctI(s[field] as number) : s[field]}`).join('\n');
  };
  // The expert mean of every cell an expert scored. The API changes only the
  // cells an edit names, so a cell nobody scored keeps its current value.
  const expertMap = (cells: ExposureRow[]): ExposureMap | undefined => {
    const out: ExposureMap = {};
    for (const c of cells) {
      if (c.expert?.avg != null) out[c.key] = Math.round(c.expert.avg);
    }
    return Object.keys(out).length ? out : undefined;
  };
  // Per-field endorse choice. A field defaults to the expert mean when an
  // expert scored it; a field nobody scored keeps its current value (an
  // admin's earlier edit stands). The admin can switch each field to the
  // baseline or enter a manual value.
  const hasCatE = !!(agg?.category_exposure && Object.keys(agg.category_exposure).length);
  const hasRegE = !!(agg?.regional_exposure && Object.keys(agg.regional_exposure).length);
  const srcOf = (key: string, hasExpert: boolean): EndorseSource => src[key] ?? (hasExpert ? 'expert' : 'current');
  const setS = (key: string, s: EndorseSource) => setSrc((p) => ({ ...p, [key]: s }));
  const setM = (key: string, v: string) => setMan((p) => ({ ...p, [key]: v }));
  const setAll = (s: EndorseSource) => {
    // "Set all to Manual" seeds the scalar inputs with the expert mean, else
    // the current value, so each field starts from a sensible value; exposure
    // cells default the same way through manCell.
    if (s === 'manual') {
      const numStr = (v: number | null | undefined) => (v == null ? '' : String(v));
      setMan({
        probability: numStr(eP != null ? Math.round(eP) : driver.probability),
        gp1: numStr(Math.round((eG ?? driver.gp1_pct_affected) * 100)),
        peak: numStr(ePk != null ? Math.round(ePk) : driver.peak_year || undefined),
        curve: eCv || driver.diffusion_curve || '',
        uncertainty: numStr(eU != null ? Math.round(eU) : driver.uncertainty),
      });
    }
    setSrc({ probability: s, gp1: s, peak: s, curve: s, uncertainty: s, category: s, region: s });
    // The value chain follows where a value exists; its manual choice is a
    // click on the rail, so "manual" leaves it alone.
    if (s === 'current') setEndorsedVc(currentVcStage);
    else if (s === 'baseline') setEndorsedVc(baseVcStage);
    else if (s === 'expert' && vcMajority != null) setEndorsedVc(vcMajority.stage);
  };
  // Manual exposure cells default to the expert mean (rounded) where scored,
  // else the current score; editing a cell switches its grid to Manual.
  const manCell = (kind: string, key: string, curV: number | undefined, expAvg: number | undefined): number | undefined => {
    const ex = manExpo[kind]?.[key];
    if (ex != null) return ex;
    if (expAvg != null) return Math.round(expAvg);
    return curV;
  };
  const setManCell = (kind: string, key: string, v: number) => {
    setManExpo((p) => ({ ...p, [kind]: { ...(p[kind] ?? {}), [key]: v } }));
    setS(kind, 'manual');
  };
  const catCells = CATEGORIES.map((c) => ({
    key: c.name, label: shortCat(c.name), group: c.group,
    baseV: baseCat == null ? undefined : (baseCat[c.name] ?? 0),
    curV: driver.category_exposure[c.name] ?? 0,
    expert: agg?.category_exposure[c.name],
  }));
  const regCells = REGIONS.map((r) => ({
    key: r, label: r,
    baseV: baseReg == null ? undefined : (baseReg[r] ?? 0),
    curV: driver.regional_exposure[r] ?? 0,
    expert: agg?.regional_exposure[r],
  }));
  const buildManualMap = (kind: string, cells: ExposureRow[]): ExposureMap | undefined => {
    const out: ExposureMap = {};
    for (const c of cells) { const v = manCell(kind, c.key, c.curV, c.expert?.avg); if (v != null) out[c.key] = v; }
    return Object.keys(out).length ? out : undefined;
  };

  // What each field endorses, within the ranges the API accepts; a field
  // that resolves to nothing is left out and keeps its value.
  const resolveProb = (): number | undefined => {
    const s = srcOf('probability', eP != null);
    if (s === 'current') return undefined;
    if (s === 'manual') { const n = parseInt(man.probability ?? '', 10); return isNaN(n) ? undefined : Math.max(1, Math.min(5, n)); }
    if (s === 'baseline') return bP;
    return eP != null ? Math.round(eP) : undefined;
  };
  // A GP1 share in (0, 1]: a zero share is left out.
  const resolveGp1 = (): number | undefined => {
    const s = srcOf('gp1', eG != null);
    if (s === 'current') return undefined;
    let v: number | undefined;
    if (s === 'manual') { const n = parseInt(man.gp1 ?? '', 10); v = isNaN(n) ? undefined : Math.min(100, n) / 100; }
    else v = s === 'baseline' ? bG : eG;
    return v != null && v > 0 ? Math.min(1, v) : undefined;
  };
  // A whole year in 2025–2035; anything else (such as the 0 of a driver
  // without a peak year) is left out, so the driver keeps its timing.
  const resolvePeak = (): number | undefined => {
    const s = srcOf('peak', ePk != null);
    if (s === 'current') return undefined;
    let n: number | undefined;
    if (s === 'manual') { const m = parseInt(man.peak ?? '', 10); n = isNaN(m) ? undefined : Math.max(2026, Math.min(2035, m)); }
    else if (s === 'baseline') n = bPk;
    else n = ePk != null ? Math.round(ePk) : undefined;
    if (n == null || !Number.isFinite(n) || n < 2025 || n > 2035) return undefined;
    return n;
  };
  const resolveCurve = (): string | undefined => {
    const s = srcOf('curve', !!eCv);
    if (s === 'current') return undefined;
    if (s === 'manual') return man.curve || undefined;
    if (s === 'baseline') return bCv;
    return eCv;
  };
  // A whole score 0–5; left out when nothing resolves, so an unscored driver
  // stays unscored.
  const resolveUnc = (): number | undefined => {
    const s = srcOf('uncertainty', eU != null);
    if (s === 'current') return undefined;
    let n: number | null | undefined;
    if (s === 'manual') { const m = parseInt(man.uncertainty ?? '', 10); n = isNaN(m) ? undefined : m; }
    else if (s === 'baseline') n = bU;
    else n = eU != null ? Math.round(eU) : undefined;
    if (n == null || !Number.isFinite(n)) return undefined;
    return Math.max(0, Math.min(5, n));
  };
  const resolved = {
    probability: resolveProb(),
    gp1: resolveGp1(),
    peak: resolvePeak(),
    curve: resolveCurve(),
    uncertainty: resolveUnc(),
  };

  const endorse = async () => {
    setErr(null); setSaving(true);
    const u: DriverUpdate = { revision: driver.revision };
    if (resolved.probability != null) u.probability = resolved.probability;
    if (resolved.gp1 != null) u.gp1_pct_affected = resolved.gp1;
    if (resolved.peak != null) u.peak_year = resolved.peak;
    if (resolved.curve) u.diffusion_curve = resolved.curve;
    if (resolved.uncertainty != null) u.uncertainty = resolved.uncertainty;
    const sc = srcOf('category', hasCatE);
    if (sc === 'manual') { const m = buildManualMap('category', catCells); if (m) u.category_exposure = m; }
    else if (sc === 'baseline') { if (baseCat) u.category_exposure = baseCat; }
    else if (sc === 'expert') { const c = expertMap(catCells); if (c) u.category_exposure = c; }
    const sr = srcOf('region', hasRegE);
    if (sr === 'manual') { const m = buildManualMap('region', regCells); if (m) u.regional_exposure = m; }
    else if (sr === 'baseline') { if (baseReg) u.regional_exposure = baseReg; }
    else if (sr === 'expert') { const r = expertMap(regCells); if (r) u.regional_exposure = r; }
    // A stage that does not move leaves the stored profile as it is; the
    // baseline stage writes the baseline profile itself, any other stage its
    // canonical profile.
    if (endorsedVcStage != null && endorsedVcStage !== currentVcStage) {
      u.vc_exposure = baseVcStage != null && endorsedVcStage === baseVcStage && baseVc
        ? baseVc
        : canonicalVcProfile(endorsedVcStage);
    }
    try { await updateDriver(driver.id, u); setDone(true); }
    catch (e) {
      setErr(e instanceof ApiError && e.status === 409
        ? 'The driver changed after this panel loaded; it now shows the current version. Check it and endorse again.'
        : (e as Error)?.message ?? 'Endorse failed');
    }
    finally { setSaving(false); }
  };

  const exposureCell = (kind: 'category' | 'region', c: ExposureRow) => (
    <ExposureCompareCell key={c.key} label={c.label} baseVal={c.baseV} expert={c.expert}
      manualVal={manCell(kind, c.key, c.curV, c.expert?.avg)} onManual={(v) => setManCell(kind, c.key, v)} />
  );
  // What "Keep" writes for a scalar field: nothing; shown as the current value.
  const keep = (v: React.ReactNode) => `keep ${v}`;
  const resultOf = (key: string, hasExpert: boolean, resolvedText: React.ReactNode, currentText: React.ReactNode) =>
    srcOf(key, hasExpert) === 'current' ? keep(currentText) : resolvedText;

  return (
    <div onClick={(e) => e.stopPropagation()} style={{ padding: '24px 32px 30px', backgroundColor: S.surface, borderTop: `1px solid ${S.cardBorder}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <span className="inline-flex items-center gap-2" style={{ fontFamily: HEADLINE_FONT, fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: EXPERT_COLOR }}>
          <Users size={13} strokeWidth={2.4} /> Review &amp; Endorse · {count} expert{count === 1 ? '' : 's'} scored
        </span>
        <span className="inline-flex items-center gap-3" style={{ fontSize: 11, fontWeight: 700 }}>
          <span className="inline-flex items-center gap-1.5" style={{ color: S.onSurface }}><span style={{ width: 9, height: 9, borderRadius: 9, backgroundColor: S.onSurface }} /> Baseline</span>
          <span className="inline-flex items-center gap-1.5" style={{ color: REVIEWED_COLOR }}><span style={{ width: 9, height: 9, borderRadius: 9, backgroundColor: REVIEWED_COLOR }} /> Expert ø</span>
        </span>
      </div>

      {failed ? (
        <ProposalsUnavailable what="there is nothing to endorse right now" onRetry={retry} />
      ) : loaded && count === 0 ? (
        <div style={{ padding: '26px 0', textAlign: 'center', color: S.onSurfaceVariant }}>
          <Users size={20} style={{ color: S.primary }} />
          <div style={{ marginTop: 8, fontSize: 14 }}>No expert proposals yet for this driver.</div>
        </div>
      ) : (
        <>
          {/* Laid out like the Expert Rating panel; every field shows the
              baseline (ink) over the expert mean (green). */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.05fr) minmax(0,1fr)', gap: 20 }}>
            {/* Left: context, the core scores and timing */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <SectionCard title="Context" icon={FileText}>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: S.onSurface, whiteSpace: 'pre-wrap' }}>
                  {driver.description || <em style={{ color: S.mutedText }}>No description documented.</em>}
                </p>
              </SectionCard>

              <SectionCard title="Probability" icon={Zap} footnote="1 = Very Unlikely · 3 = Possible · 5 = Almost Certain.">
                <CompareStack who={whoFor('probability')}
                  baseline={<><ColorDots value={bP ?? 0} color={S.onSurface} /><span style={{ fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 12, color: S.onSurfaceVariant }}>{bP ?? NO_VALUE}</span></>}
                  expert={<><ColorDots value={eP != null ? Math.round(eP) : 0} color={REVIEWED_COLOR} /><span style={{ fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 12, color: REVIEWED_COLOR }}>{eP != null ? eP.toFixed(1) : NO_VALUE}</span>{eP != null && bP != null ? <DeltaChip value={eP - bP} /> : null}</>} />
                <Decide cur={srcOf('probability', eP != null)} onPick={(s) => setS('probability', s)} baselineOk={bP != null} expertOk={eP != null}
                  manual={<input type="number" min={1} max={5} value={man.probability ?? ''} onChange={(e) => setM('probability', e.target.value)} placeholder="1–5" style={manInput} />}
                  result={resultOf('probability', eP != null, resolved.probability ?? NO_VALUE, driver.probability)} />
              </SectionCard>

              <SectionCard title="Impact: GP1 % exposed" icon={BarChart3} footnote="Share of category GP1 this driver can move at full materialization.">
                <CompareStack who={whoFor('gp1_pct_affected')}
                  baseline={<MiniBar v={bG} color={S.onSurface} />}
                  expert={<><MiniBar v={eG} color={REVIEWED_COLOR} />{eG != null && bG != null ? <DeltaChip value={(eG - bG) * 100} unit="pp" digits={0} /> : null}</>} />
                <Decide cur={srcOf('gp1', eG != null)} onPick={(s) => setS('gp1', s)} baselineOk={bG != null} expertOk={eG != null}
                  manual={<span className="inline-flex items-center gap-1"><input type="number" min={1} max={100} value={man.gp1 ?? ''} onChange={(e) => setM('gp1', e.target.value)} placeholder="%" style={manInput} /><span style={{ fontSize: 12, color: S.mutedText }}>%</span></span>}
                  result={resultOf('gp1', eG != null, pctI(resolved.gp1), pctI(driver.gp1_pct_affected))} />
              </SectionCard>

              <SectionCard title="Materialization timing" icon={Clock}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <FieldLabel>Peak Year</FieldLabel>
                    <CompareStack who={whoFor('peak_year')}
                      baseline={<Val>{bPk ?? NO_VALUE}</Val>}
                      expert={<><span style={{ fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 14, color: REVIEWED_COLOR }}>{ePk != null ? Math.round(ePk) : NO_VALUE}</span>{ePk != null && bPk != null ? <DeltaChip value={ePk - bPk} unit="y" digits={0} /> : null}</>} />
                    <Decide cur={srcOf('peak', ePk != null)} onPick={(s) => setS('peak', s)} baselineOk={bPk != null} expertOk={ePk != null}
                      manual={<input type="number" min={2026} max={2035} value={man.peak ?? ''} onChange={(e) => setM('peak', e.target.value)} placeholder="year" style={{ ...manInput, width: 80 }} />}
                      result={resultOf('peak', ePk != null, resolved.peak ?? NO_VALUE, driver.peak_year || NO_VALUE)} />
                  </div>
                  <div>
                    <FieldLabel>Diffusion Curve</FieldLabel>
                    <CompareStack who={whoFor('diffusion_curve')}
                      baseline={<span className="inline-flex items-center gap-2">{bCv ? <DiffusionGlyph curve={bCv} color={S.onSurface} /> : null}<Val>{bCv ? curveLabel(bCv) : NO_VALUE}</Val></span>}
                      expert={<span className="inline-flex items-center gap-2">{eCv ? <DiffusionGlyph curve={eCv} color={REVIEWED_COLOR} /> : null}<span style={{ fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 14, color: REVIEWED_COLOR }}>{eCv ? curveLabel(eCv) : NO_VALUE}</span>{eCv ? <DeltaChip value={eCv === bCv ? 0 : 1} digits={0} /> : null}</span>} />
                    <Decide cur={srcOf('curve', !!eCv)} onPick={(s) => setS('curve', s)} baselineOk={!!bCv} expertOk={!!eCv}
                      manual={<select value={man.curve ?? ''} onChange={(e) => setM('curve', e.target.value)} style={{ ...manInput, width: 'auto' }}><option value="">{NO_VALUE}</option>{Object.entries(DIFFUSION_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>}
                      result={resultOf('curve', !!eCv, resolved.curve ? curveLabel(resolved.curve) : NO_VALUE,
                        driver.diffusion_curve ? curveLabel(driver.diffusion_curve) : NO_VALUE)} />
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Uncertainty" icon={Zap} footnote="0 = fixed · 3 = half or double · 5 = sign open. The expert scores are summarised by their median.">
                <CompareStack who={whoFor('uncertainty')}
                  baseline={<Val>{bU != null ? uncLabel(bU) : NO_VALUE}</Val>}
                  expert={<><span style={{ fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 14, color: REVIEWED_COLOR }}>{eU != null ? uncLabel(Math.round(eU)) : NO_VALUE}</span>{eU != null && bU != null ? <DeltaChip value={Math.round(eU) - bU} digits={0} /> : null}</>} />
                <Decide cur={srcOf('uncertainty', eU != null)} onPick={(s) => setS('uncertainty', s)} baselineOk={bU != null} expertOk={eU != null}
                  manual={<input type="number" min={0} max={5} value={man.uncertainty ?? ''} onChange={(e) => setM('uncertainty', e.target.value)} placeholder="0–5" style={manInput} />}
                  result={resultOf('uncertainty', eU != null, resolved.uncertainty != null ? uncLabel(resolved.uncertainty) : NO_VALUE,
                    driver.uncertainty != null ? uncLabel(driver.uncertainty) : NO_VALUE)} />
              </SectionCard>
            </div>

            {/* Right: the exposure grids, baseline over expert mean in every cell */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <SectionCard title="Category Exposure" icon={Layers}>
                <div style={grpLabel}>HAIR</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(174px, 1fr))', gap: 10 }}>
                  {catCells.filter((c) => c.group === 'Hair').map((c) => exposureCell('category', c))}
                </div>
                <div style={{ ...grpLabel, marginTop: 14 }}>LAUNDRY &amp; HOME CARE</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(174px, 1fr))', gap: 10 }}>
                  {catCells.filter((c) => c.group === 'LHC').map((c) => exposureCell('category', c))}
                </div>
                <Decide cur={srcOf('category', hasCatE)} onPick={(s) => setS('category', s)} baselineOk={!!baseCat} expertOk={hasCatE}
                  result={EXPOSURE_RESULT[srcOf('category', hasCatE)]} />
              </SectionCard>
              <SectionCard title="Regional Exposure" icon={MapPin} accent={S.onSecondaryContainer}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(174px, 1fr))', gap: 10 }}>
                  {regCells.map((c) => exposureCell('region', c))}
                </div>
                <Decide cur={srcOf('region', hasRegE)} onPick={(s) => setS('region', s)} baselineOk={!!baseReg} expertOk={hasRegE}
                  result={EXPOSURE_RESULT[srcOf('region', hasRegE)]} />
              </SectionCard>
              <SectionCard
                title="Value Chain Epicentre" icon={Cpu} accent={S.onTertiaryContainer} info={FIELD_HELP.vc}
                right={
                  <span title="Stages are categories: votes are counted, never averaged" style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, backgroundColor: S.amberContainer, color: S.onAmberContainer, whiteSpace: 'nowrap', cursor: 'help' }}>
                    {baseVcStage != null ? `Baseline ${VC_SHORT_LABELS[baseVcStage - 1]}` : `Baseline ${NO_VALUE}`}
                    {vcMajority != null ? ` · Majority ${VC_SHORT_LABELS[vcMajority.stage - 1]} ×${vcMajority.n}` : vcVotes.length > 0 ? ' · no majority' : ' · no votes'}
                  </span>
                }
              >
                <EpicentreVotePanel baseline={baseVcStage} current={currentVcStage} votes={vcVotes} majority={vcMajority}
                  endorsed={endorsedVcStage} onEndorse={setEndorsedVc} />
              </SectionCard>
            </div>
          </div>

          {/* Every expert's note from the Expert Rating tab: context for the
              review, never part of the endorsement. */}
          <div style={{ marginTop: 16 }}>
            <SectionCard
              title={`Expert Comments · ${comments.length}`}
              icon={MessageSquare}
              accent={EXPERT_COLOR}
              footnote="Free-text notes experts leave on the Expert Rating tab. They are context for the review and are not written into the driver on endorse."
            >
              {comments.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: S.mutedText }}>
                  <em>No comments left yet.</em>
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {comments.map((s) => (
                    <div key={s.user_id} style={{
                      padding: '10px 12px', borderRadius: 10,
                      backgroundColor: S.surfaceLow, border: `1px solid ${S.cardBorder}`,
                    }}>
                      <div style={{ fontFamily: HEADLINE_FONT, fontSize: 12.5, fontWeight: 800, color: S.onSurface, marginBottom: 5 }}>
                        {s.name}
                      </div>
                      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: S.onSurface, whiteSpace: 'pre-wrap' }}>
                        {s.comment}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginTop: 16 }}>
            <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: S.mutedText }}>Set all to:</span>
              <button type="button" onClick={() => setAll('current')}
                style={{ border: `1px solid ${S.cardBorder}`, cursor: 'pointer', fontFamily: HEADLINE_FONT, fontSize: 11.5, fontWeight: 700, padding: '6px 13px', borderRadius: 999, background: S.surface, color: S.onSurfaceVariant }}>
                Keep current
              </button>
              <button type="button" onClick={() => setAll('expert')}
                style={{ border: `1px solid ${S.cardBorder}`, cursor: 'pointer', fontFamily: HEADLINE_FONT, fontSize: 11.5, fontWeight: 700, padding: '6px 13px', borderRadius: 999, background: S.surface, color: REVIEWED_COLOR }}>
                Experts ø
              </button>
              <button type="button" onClick={() => setAll('baseline')}
                style={{ border: `1px solid ${S.cardBorder}`, cursor: 'pointer', fontFamily: HEADLINE_FONT, fontSize: 11.5, fontWeight: 700, padding: '6px 13px', borderRadius: 999, background: S.surface, color: S.onSurface }}>
                Baseline
              </button>
              <button type="button" onClick={() => setAll('manual')}
                style={{ border: `1px solid ${S.cardBorder}`, cursor: 'pointer', fontFamily: HEADLINE_FONT, fontSize: 11.5, fontWeight: 700, padding: '6px 13px', borderRadius: 999, background: S.surface, color: S.primary }}>
                Manual
              </button>
            </div>
            <div className="flex items-center gap-3">
              {err && <span style={{ color: S.error, fontSize: 12 }}>{err}</span>}
              {done && !err && <span style={{ color: REVIEWED_COLOR, fontSize: 12, fontWeight: 700 }}>✓ Endorsed</span>}
              <button type="button" onClick={endorse} disabled={saving}
                style={{ padding: '9px 20px', borderRadius: 999, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                  fontFamily: HEADLINE_FONT, fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase',
                  backgroundColor: S.onSurface, color: '#fff', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Endorsing…' : done ? 'Endorse again' : 'Endorse driver →'}
              </button>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5" style={{ marginTop: 14, padding: '8px 14px', borderRadius: 10, backgroundColor: S.surfaceLow, color: S.onSurfaceVariant, fontSize: 12.5, lineHeight: 1.5 }}>
            <Check size={13} style={{ flexShrink: 0, color: REVIEWED_COLOR }} />
            <span>Endorsing writes the selected values into the driver (validated and audited). Shifts refresh after the next model run.</span>
          </div>
        </>
      )}
    </div>
  );
};

// ─── The page ──────────────────────────────────────────────────────
/** A search another view opens the page with; `seq` goes up with every
 *  opening, so opening the same driver twice counts twice. */
export interface DriverSearch {
  query: string;
  seq: number;
}

interface DriversProps {
  /** A search to apply on arrival: the drill-through from the Consumer
   *  Journey and the Shift Analysis hands down a driver name. */
  search?: DriverSearch | null;
  /** Admins get the driver editor and the Review & Endorse mode. */
  isAdmin?: boolean;
}

const Drivers: FC<DriversProps> = ({ search: opened, isAdmin = false }) => {
  const { drivers, driversError, loading, backendAvailable, updateDriver, reload } = usePrism();
  // The category a driver must be exposed to, by its API name; null shows all.
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [search, setSearch] = useState(opened?.query ?? '');

  // Adopt a drill-through whenever a new one arrives: its query replaces the
  // search and the category filter is cleared, so the driver is never hidden
  // by a filter left from an earlier visit. Adjusted during render against
  // the last one adopted, so the list is already filtered in the pass that
  // follows the navigation.
  const [adoptedSeq, setAdoptedSeq] = useState(opened?.seq ?? 0);
  if (opened && opened.seq !== adoptedSeq) {
    setAdoptedSeq(opened.seq);
    setSearch(opened.query);
    setCategoryFilter(null);
  }
  // The driver whose row is expanded.
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [mode, setMode] = useState<ScoringMode>('list');
  // Review & Endorse is for admins. The rule is applied during render rather
  // than corrected after the commit, so the toggle never paints a mode the
  // user may not use.
  if (!isAdmin && mode === 'review') setMode('list');

  // Each driver's "my proposal", kept live so a collapsed row shows what the
  // expert just entered in the Expert Rating panel (the driver list carries
  // the proposal as of its load). Seeded during render whenever the store
  // hands down a new drivers array, with `seededFrom` holding the array last
  // seeded from; entries already in the map, the live edits, always win.
  const [myMap, setMyMap] = useState<Record<string, DriverProposal>>({});
  const [seededFrom, setSeededFrom] = useState(drivers);
  const seedMyMap = (prev: Record<string, DriverProposal>) => {
    let changed = false;
    const next = { ...prev };
    for (const d of drivers) {
      const m = d.proposal_summary.my;
      if (next[d.id] === undefined && m) { next[d.id] = m; changed = true; }
    }
    return changed ? next : prev;
  };
  if (seededFrom !== drivers) {
    setSeededFrom(drivers);
    setMyMap(seedMyMap);
  }
  const setMyProposal = useCallback((driverId: string, my: DriverProposal) => {
    setMyMap((prev) => ({ ...prev, [driverId]: my }));
  }, []);

  // Sort state: no key keeps the API's order. Clicking a header sorts by that
  // column, clicking it again flips the direction, and a different column
  // starts from its own default direction.
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(SORT_DEFAULT_DIR[key]);
    }
  };

  const filtered = useMemo<Driver[]>(() => {
    const q = search.trim().toLowerCase();
    return drivers.filter((d) => {
      if (categoryFilter != null && (d.category_exposure[categoryFilter] ?? 0) <= 0) return false;
      if (!q) return true;
      return (
        d.name.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.force.toLowerCase().includes(q)
      );
    });
  }, [drivers, categoryFilter, search]);

  // The sort applies on top of the filter; without a sort key the API's order
  // (by driver id, which groups the forces) stays.
  const sorted = useMemo<Driver[]>(() => {
    if (!sortKey) return filtered;
    const cmp = (a: Driver, b: Driver): number => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      const order = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).toLowerCase().localeCompare(String(bv).toLowerCase());
      return sortDir === 'asc' ? order : -order;
    };
    return [...filtered].sort(cmp);
  }, [filtered, sortKey, sortDir]);

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: S.bg, color: S.onBg, fontFamily: BODY_FONT }}
    >
      <main className="max-w-[1440px] mx-auto px-8 py-10">
        {/* Editorial header with the insight-rail accent */}
        <header className="mb-8 flex items-start justify-between gap-8">
          <div
            className="pl-5"
            style={{ borderLeft: `4px solid ${S.primary}` }}
          >
            <div
              className="text-xs font-semibold uppercase tracking-[0.18em] mb-2"
              style={{ color: S.onSurfaceVariant }}
            >
              Drivers
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
              The Forces Shaping FMCG
            </h1>
            <p
              className="mt-2 max-w-2xl text-[15px]"
              style={{ color: S.onSurfaceVariant, lineHeight: 1.55 }}
            >
              {drivers.length ? `The ${drivers.length} Profit Pool Drivers` : 'The Profit Pool Drivers'} behind each category&apos;s
              shift to 2035.
            </p>
          </div>

          {/* Search */}
          <div className="relative w-full max-w-xs">
            <Search
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2"
              style={{ color: S.onSurfaceVariant }}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search drivers…"
              className="w-full pl-11 pr-4 py-2.5 rounded-full text-sm focus:outline-none focus:ring-2"
              style={{
                backgroundColor: S.surfaceLow,
                color: S.onSurface,
                border: 'none',
              }}
            />
          </div>
        </header>

        {/* Scoring mode toggle and what the mode shows */}
        <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
          <ModeToggle mode={mode} onChange={setMode} isAdmin={isAdmin} />
          <p style={{ fontSize: 13, color: S.onSurfaceVariant, maxWidth: '42rem', lineHeight: 1.5 }}>
            {mode === 'list'
              ? 'The scores that feed the model. Scores an admin has changed from the baseline show in green; hover a score for its baseline.'
              : mode === 'input'
              ? 'Score any driver from a blank slate: open a row and your changes auto-save. Hover a grey dot or blank field to see the baseline.'
              : 'Compare the expert average with the baseline and endorse one driver at a time. Hover an expert score to see who scored what.'}
          </p>
        </div>

        {/* Category filter chips */}
        <section className="mb-8">
          <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
            <FilterChip
              label="All"
              active={categoryFilter == null}
              onClick={() => setCategoryFilter(null)}
            />
            {CATEGORIES.map((c) => (
              <FilterChip
                key={c.name}
                label={c.short}
                active={categoryFilter === c.name}
                onClick={() => setCategoryFilter(c.name)}
              />
            ))}
          </div>
        </section>

        {/* Editorial "paper" card holding the driver list */}
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
          {/* Column header: every column sorts */}
          <div
            className="grid items-center px-8 py-2.5 text-[11px] font-bold uppercase tracking-[0.15em]"
            style={{
              gridTemplateColumns: ROW_GRID[mode],
              backgroundColor: S.surfaceLow,
              color: S.onSurfaceVariant,
            }}
          >
            <SortHeader label="Driver"          sortKey="name"        currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} />
            <SortHeader label="Direction"      sortKey="direction"   currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} />
            <SortHeader label="Probability"    sortKey="probability" currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} />
            <span className="inline-flex items-center justify-end w-full">
              <SortHeader label="GP1 % Affected" sortKey="gp1"         currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} align="right" />
              <Gp1InfoTip />
            </span>
            <SortHeader label="Shift"          sortKey="shift"       currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} align="right" />
            <span className="inline-flex items-center justify-end w-full text-[11px] font-bold uppercase tracking-[0.15em]" style={{ color: S.onSurfaceVariant }}>
              {mode === 'input' ? 'Your review' : mode === 'review' ? 'Proposals' : 'Edited'}
            </span>
          </div>

          {/* Rows */}
          <div>
            {loading && drivers.length === 0 && (
              <EmptyRow text="Loading drivers…" icon={<Layers size={20} />} />
            )}
            {!loading && !backendAvailable && drivers.length === 0 && (
              <EmptyRow text="The PRISM service cannot be reached; the drivers show once it answers." icon={<AlertTriangle size={20} />} />
            )}
            {!loading && backendAvailable && driversError && drivers.length === 0 && (
              <EmptyRow text={`The drivers could not be loaded: ${driversError}`} icon={<AlertTriangle size={20} />}
                action={{ label: 'Try again', onClick: () => { void reload(); } }} />
            )}
            {!loading && drivers.length > 0 && sorted.length === 0 && (
              <EmptyRow text="No drivers match the current search and filter." icon={<Search size={20} />}
                action={{ label: 'Clear search and filter', onClick: () => { setSearch(''); setCategoryFilter(null); } }} />
            )}
            {sorted.map((d, idx) => {
              const expanded = expandedId === d.id;
              return (
                <DriverRow
                  key={d.id}
                  driver={d}
                  isLast={idx === sorted.length - 1}
                  expanded={expanded}
                  onToggle={() => setExpandedId(expanded ? null : d.id)}
                  mode={mode}
                  myProposal={myMap[d.id]}
                  onMyChange={setMyProposal}
                  isAdmin={isAdmin}
                  updateDriver={updateDriver}
                />
              );
            })}
          </div>
        </motion.div>
      </main>
    </div>
  );
};

// ─── Filter chip ───────────────────────────────────────────────────
const FilterChip: FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className="flex-shrink-0 px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 hover:scale-[0.97]"
    style={{
      backgroundColor: active ? S.primaryContainer : S.surfaceLow,
      color:           active ? S.onPrimaryContainer : S.onSurfaceVariant,
    }}
  >
    {label}
  </button>
);

// ─── Sort header: a clickable column header with its sort direction ──
const SortHeader: FC<{
  label: string;
  sortKey: SortKey;
  currentKey: SortKey | null;
  currentDir: SortDir;
  onToggle: (key: SortKey) => void;
  align?: 'left' | 'right';
}> = ({ label, sortKey, currentKey, currentDir, onToggle, align = 'left' }) => {
  const isActive = currentKey === sortKey;
  const Icon = !isActive ? ArrowUpDown : currentDir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onToggle(sortKey)}
      // aria-sort is valid only on a column header, and this header row is a
      // CSS grid rather than a table, so the sort state is in the name.
      aria-label={`Sort by ${label}${isActive ? `, currently ${currentDir === 'asc' ? 'ascending' : 'descending'}` : ''}`}
      className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.15em] transition-colors"
      style={{
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        color: isActive ? S.onSurface : S.onSurfaceVariant,
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        width: '100%',
        textAlign: align,
      }}
    >
      <span>{label}</span>
      <Icon size={12} style={{ opacity: isActive ? 1 : 0.45 }} />
    </button>
  );
};

// ─── GP1 column header tooltip ─────────────────────────────────────
const Gp1InfoTip: FC = () => {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex items-center">
      <button type="button" aria-label="What does GP1 % Affected mean?"
        onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', padding: 0, marginLeft: 6,
          color: S.onSurfaceVariant, cursor: 'help' }}>
        <Info size={11} strokeWidth={2.4} />
      </button>
      {open && (
        <span role="tooltip" style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 40,
          width: 280, padding: '10px 12px', borderRadius: 8, backgroundColor: S.onSurface, color: S.surface,
          fontFamily: BODY_FONT, fontSize: 11.5, lineHeight: 1.5, fontWeight: 500, textTransform: 'none',
          letterSpacing: 0, textAlign: 'left', boxShadow: '0 10px 24px rgba(0, 52, 94, 0.28)',
          pointerEvents: 'none', whiteSpace: 'normal' }}>
          <b>GP1 % Affected</b>: the share of a category&apos;s GP1 (gross profit after cost of goods)
          that this driver can realistically move at full materialization. Multiplied by probability and
          direction, it produces the Shift column.
        </span>
      )}
    </span>
  );
};

// ─── Driver row ────────────────────────────────────────────────────
interface DriverRowProps {
  driver: Driver;
  isLast: boolean;
  expanded: boolean;
  onToggle: () => void;
  mode: ScoringMode;
  myProposal?: DriverProposal;
  onMyChange: (driverId: string, my: DriverProposal) => void;
  isAdmin: boolean;
  updateDriver: (driverId: string, update: DriverUpdate) => Promise<void>;
}

const DriverRow: FC<DriverRowProps> = ({
  driver, isLast, expanded, onToggle, mode, myProposal, onMyChange, isAdmin, updateDriver,
}) => {
  const tile = FORCE_TILE[driver.force];
  const { Icon } = tile;

  return (
    <div style={{ boxShadow: isLast && !expanded ? 'none' : `inset 0 -1px 0 ${S.surfaceLow}` }}>
      {/* The row toggles the expanded panel. It is a div with role=button
          rather than a <button> because it lays out block content in a grid,
          which a button may not contain. */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); }
        }}
        aria-expanded={expanded}
        className="w-full grid items-center px-8 py-2 text-left transition-colors"
        style={{
          gridTemplateColumns: ROW_GRID[mode],
          backgroundColor: expanded ? S.surfaceLow : S.surface,
          cursor: 'pointer',
          border: 'none',
        }}
      >
        {/* Driver identity */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-8 h-8 flex-shrink-0 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: tile.bg, color: tile.fg }}
          >
            <Icon size={16} strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="font-bold text-[15px] flex items-center gap-2 min-w-0"
              style={{ fontFamily: HEADLINE_FONT, color: S.onSurface }}
            >
              {/* The ellipsis sits on the name span (truncate on a flex
                  container never ellipsizes); the title shows the full name. */}
              <span className="truncate" title={driver.name}>{driver.name}</span>
              <ChevronDown
                size={14}
                style={{
                  flexShrink: 0,
                  color: S.onSurfaceVariant,
                  transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 180ms ease',
                }}
              />
            </div>
          </div>
        </div>

        {/* Direction */}
        <div><Chip kind={driver.direction === 'Expansion' ? 'expansion' : 'contraction'} compact /></div>

        {/* Probability, GP1 % and Shift: read-only here */}
        <div><ProbCell driver={driver} mode={mode} myProposal={myProposal} /></div>

        <div className="text-right">
          <Gp1Cell driver={driver} mode={mode} myProposal={myProposal} />
        </div>

        <div className="text-right">
          <RowEndCell driver={driver} mode={mode} myProposal={myProposal} />
        </div>

        {/* The Edited chip, your review status or the proposal count */}
        <div className="text-right">
          <ReviewStatusCell driver={driver} mode={mode} myProposal={myProposal} />
        </div>
      </div>

      {/* Expanded panel: your proposal (Expert Rating), the review (Review &
          Endorse) or the driver's detail and editor (Driver List). */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden', backgroundColor: S.surfaceLow }}
          >
            {mode === 'input' ? (
              <ExpertInputPanel driver={driver} onMyChange={onMyChange} />
            ) : mode === 'review' ? (
              <ReviewPanel driver={driver} updateDriver={updateDriver} />
            ) : (
              <ExpandedPanel driver={driver} isAdmin={isAdmin} updateDriver={updateDriver} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Expanded detail panel (Driver List) ───────────────────────────
// Two columns: the description, PRISM Analysis, GP1 %, probability, timing,
// uncertainty and sources on the left; the category, regional and
// value-chain exposure on the right. Admins get an Edit button that turns
// every field except the PRISM Analysis into a form; Save sends one
// DriverUpdate with the fields that changed.
interface ExpandedPanelProps {
  driver: Driver;
  isAdmin: boolean;
  updateDriver: (driverId: string, update: DriverUpdate) => Promise<void>;
}

// A label over an edit control
const FieldLabel: FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
    textTransform: 'uppercase', color: S.mutedText, marginBottom: 6,
  }}>
    {children}
  </div>
);

// Editable 0–5 dot scale for the category, regional and manual exposure cells.
// An unscored cell (value undefined) shows no dot at all, never a 0.
const EditableDots: FC<{
  value: number | undefined;
  /** The value chosen; undefined when a clearable cell's selected dot is clicked again. */
  onChange: (next: number | undefined) => void;
  /** What the cell scores, for screen readers ("Hair: Care exposure"). */
  label: string;
  /** Clicking the selected dot again clears the cell (Expert Rating). */
  clearable?: boolean;
  /** When set (e.g. "Baseline 3 / 5"), hovering the dots shows it, the same
   *  plain hover the Probability and GP1 % fields use, instead of the
   *  per-dot "N / 5" label. */
  hint?: string;
}> = ({ value, onChange, label, clearable = false, hint }) => (
  <div className="flex gap-1" role="radiogroup"
    aria-label={`${label}: ${value == null ? 'not scored' : `${value} of 5`}`}
    title={hint} style={{ cursor: hint ? 'help' : undefined }}>
    {/* A 24px hit area per dot: padding and background-clip keep the painted
        dot at 14px, the negative margin keeps the 4px gap, and the global
        :focus-visible ring marks keyboard focus. */}
    {[0, 1, 2, 3, 4, 5].map((d) => (
      <button
        key={d}
        type="button"
        onClick={() => onChange(clearable && d === value ? undefined : d)}
        aria-checked={d === value}
        aria-label={`${d} of 5`}
        role="radio"
        title={hint ?? (clearable && d === value ? `${d} / 5, click again to clear` : `${d} / 5`)}
        style={{
          width: 24, height: 24, borderRadius: 999,
          border: 'none', padding: 5, margin: -5,
          boxSizing: 'border-box', backgroundClip: 'content-box',
          cursor: hint ? 'help' : 'pointer',
          backgroundColor: value == null
            ? S.surfaceHigh
            : d === 0
              ? (value === 0 ? S.primary : S.surfaceHigh)
              : (d <= value ? S.primary : S.surfaceHigh),
          opacity: d === 0 ? 0.35 : 1,
          transition: 'background-color 120ms',
        }}
      />
    ))}
  </div>
);

// ─── The admin editor's working copy ──────────────────────────────
type Draft = Pick<Driver,
  | 'description' | 'direction' | 'confidence' | 'probability' | 'gp1_pct_affected' | 'peak_year'
  | 'diffusion_curve' | 'uncertainty' | 'category_exposure' | 'regional_exposure' | 'vc_exposure' | 'sources'>;

const sourceCopy = (s: DriverSource): DriverSource => ({ title: s.title, url: s.url, tier: s.tier, note: s.note });

const draftOf = (d: Driver): Draft => ({
  description: d.description,
  direction: d.direction,
  confidence: d.confidence,
  probability: d.probability,
  gp1_pct_affected: d.gp1_pct_affected,
  peak_year: d.peak_year,
  diffusion_curve: d.diffusion_curve,
  uncertainty: d.uncertainty,
  category_exposure: { ...d.category_exposure },
  regional_exposure: { ...d.regional_exposure },
  vc_exposure: { ...d.vc_exposure },
  sources: d.sources.map(sourceCopy),
});

/** Two exposure maps score every cell the same; a missing cell scores 0. */
const sameExposure = (a: ExposureMap, b: ExposureMap): boolean =>
  [...new Set([...Object.keys(a), ...Object.keys(b)])].every((k) => (a[k] ?? 0) === (b[k] ?? 0));

const sameSources = (a: DriverSource[], b: DriverSource[]): boolean =>
  a.length === b.length && a.every((s, i) => (
    s.title === b[i].title && s.url === b[i].url && s.tier === b[i].tier && s.note === b[i].note
  ));

/** The DriverUpdate of a save: the revision the draft was taken from, and only
 *  the fields the admin changed, within the ranges the API accepts, and only
 *  sources with a title or a link. The PRISM Analysis is never part of it. */
function updateFrom(draft: Draft, d: Driver): DriverUpdate {
  const update: DriverUpdate = { revision: d.revision };
  if (draft.description !== d.description) update.description = draft.description;
  if (draft.direction !== d.direction) update.direction = draft.direction;
  if (draft.confidence !== d.confidence) update.confidence = draft.confidence;
  if (draft.probability !== d.probability) update.probability = draft.probability;
  if (draft.gp1_pct_affected !== d.gp1_pct_affected) update.gp1_pct_affected = draft.gp1_pct_affected;
  if (draft.peak_year !== d.peak_year) update.peak_year = Math.max(2025, Math.min(2035, Math.round(draft.peak_year)));
  if (draft.diffusion_curve !== d.diffusion_curve) update.diffusion_curve = draft.diffusion_curve;
  if (draft.uncertainty !== d.uncertainty) update.uncertainty = draft.uncertainty;
  if (!sameExposure(draft.category_exposure, d.category_exposure)) update.category_exposure = draft.category_exposure;
  if (!sameExposure(draft.regional_exposure, d.regional_exposure)) update.regional_exposure = draft.regional_exposure;
  if (!sameExposure(draft.vc_exposure, d.vc_exposure)) update.vc_exposure = draft.vc_exposure;
  const sources = draft.sources.filter((s) => s.title.trim() || s.url.trim());
  if (!sameSources(sources, d.sources)) update.sources = sources;
  return update;
}

const ExpandedPanel: FC<ExpandedPanelProps> = ({ driver, isAdmin, updateDriver }) => {
  const vcStage = epicentreOf(driver.vc_exposure);
  const base = baselineOf(driver);
  const baseVcStage = epicentreOf(base?.vc_exposure);

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [draft, setDraft] = useState(() => draftOf(driver));
  const edit = (patch: Partial<Draft>) => setDraft((prev) => ({ ...prev, ...patch }));

  // The driver the draft was taken from. Outside editing it follows every new
  // driver object (after a save the store reloads the drivers); while editing
  // it stays put, so a save names the revision the admin started from and a
  // change made meanwhile is refused instead of overwritten.
  const [draftBase, setDraftBase] = useState(driver);
  if (!isEditing && draftBase !== driver) {
    setDraftBase(driver);
    setDraft(draftOf(driver));
  }
  const changedMeanwhile = isEditing && draftBase.revision !== driver.revision;

  const startEditing = () => {
    setDraftBase(driver);
    setDraft(draftOf(driver));
    setSaveError(null);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setDraftBase(driver);
    setDraft(draftOf(driver));
    setSaveError(null);
    setIsEditing(false);
  };

  const handleSave = async () => {
    const update = updateFrom(draft, draftBase);
    if (Object.keys(update).length === 1) {   // the revision alone: nothing changed
      handleCancel();
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await updateDriver(driver.id, update);
      setIsEditing(false);
    } catch (e) {
      setSaveError(e instanceof ApiError && e.status === 409
        ? 'This driver was changed by someone else while you were editing. Your edits are still here; '
          + 'discard them to see the current version, then make your change again.'
        : (e as Error)?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const addSource = () =>
    edit({ sources: [...draft.sources, { title: '', url: '', tier: '', note: '' }] });
  const removeSource = (idx: number) =>
    edit({ sources: draft.sources.filter((_, i) => i !== idx) });
  const patchSource = (idx: number, patch: Partial<DriverSource>) =>
    edit({ sources: draft.sources.map((s, i) => (i === idx ? { ...s, ...patch } : s)) });

  const curve = isEditing ? draft.diffusion_curve : driver.diffusion_curve;
  const editVcStage = epicentreOf(draft.vc_exposure);

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        padding: '28px 32px 36px',
        backgroundColor: S.surface,
        borderTop: `1px solid ${S.cardBorder}`,
      }}
    >
      {/* Meta row: direction, confidence, the Edited chip, the evidence summary */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
        marginBottom: 24,
      }}>
        {isEditing ? (
          <>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <FieldLabel>Direction</FieldLabel>
              <select
                value={draft.direction}
                onChange={(e) => edit({ direction: e.target.value as Direction })}
                style={{
                  padding: '4px 10px', borderRadius: 999, fontSize: 11,
                  fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
                  backgroundColor: S.surfaceLow, color: S.onSurface,
                  border: `1px solid ${S.cardBorder}`,
                }}
              >
                <option value="Expansion">Expansion</option>
                <option value="Contraction">Contraction</option>
              </select>
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <FieldLabel>Confidence</FieldLabel>
              <select
                value={draft.confidence}
                onChange={(e) => edit({ confidence: e.target.value as Confidence })}
                style={{
                  padding: '4px 10px', borderRadius: 999, fontSize: 11,
                  fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
                  backgroundColor: S.surfaceLow, color: S.onSurface,
                  border: `1px solid ${S.cardBorder}`,
                }}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </label>
          </>
        ) : (
          <>
            <Chip kind={driver.direction === 'Expansion' ? 'expansion' : 'contraction'} />
            <MetaChip label={`Confidence · ${driver.confidence}`} />
          </>
        )}
        <EditedChip driver={driver} />
        {!isEditing && driver.sources.length > 0 && <MetaChip label={evidenceLine(driver.sources)} />}
      </div>

      {/* Two columns: the editorial detail on the left, the exposure grids on
          the right in the order Category, Region, Value Chain. */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 1fr)',
        gap: 20,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SectionCard title="Description" icon={FileText}>
            {isEditing ? (
              <textarea
                value={draft.description}
                onChange={(e) => edit({ description: e.target.value })}
                rows={6}
                maxLength={20000}
                style={{
                  width: '100%', padding: '10px 12px',
                  borderRadius: 8, border: `1px solid ${S.cardBorder}`,
                  backgroundColor: S.surfaceLow, color: S.onSurface,
                  fontSize: 14, lineHeight: 1.6, fontFamily: BODY_FONT,
                  resize: 'vertical',
                }}
              />
            ) : (
              <p style={{
                margin: 0, fontSize: 14, lineHeight: 1.6, color: S.onSurface,
                whiteSpace: 'pre-wrap',
              }}>
                {driver.description || <em style={{ color: S.mutedText }}>No description documented.</em>}
              </p>
            )}
          </SectionCard>

          {/* The PRISM Analysis is read-only for every role: its figures come
              from the model and its text is rendered from a reviewed template
              (docs/DRIVER_ANALYSIS.md), never typed here. */}
          <SectionCard title="PRISM Analysis" icon={BarChart3} accent={S.primary} footnote={ANALYSIS_FOOTNOTE}>
            <div style={{
              padding: '12px 16px',
              borderRadius: 10,
              borderLeft: `3px solid ${S.primary}`,
              backgroundColor: S.surfaceLow,
            }}>
              <PrismAnalysisReading text={driver.analysis} />
            </div>
            {isEditing && (
              <div style={{
                marginTop: 8, fontSize: 11, letterSpacing: '0.06em',
                textTransform: 'uppercase', color: S.mutedText, fontWeight: 700,
              }}>
                The figures of the PRISM Analysis come from the model and the reading is authored on them; it cannot be edited here.
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="GP1 % Affected: Economic Anchoring"
            icon={BarChart3}
            footnote={
              <>
                What fraction of a category&apos;s GP1 can this driver realistically affect at full
                materialization?
              </>
            }
          >
            {isEditing ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="range"
                  min={1} max={100} step={1}
                  value={Math.round(draft.gp1_pct_affected * 100)}
                  onChange={(e) => edit({ gp1_pct_affected: parseInt(e.target.value, 10) / 100 })}
                  style={{ flex: 1 }}
                />
                <input
                  type="number"
                  min={1} max={100} step={1}
                  value={Math.round(draft.gp1_pct_affected * 100)}
                  onChange={(e) => edit({ gp1_pct_affected: Math.max(1, Math.min(100, parseInt(e.target.value || '1', 10))) / 100 })}
                  style={{
                    width: 72, padding: '6px 8px', borderRadius: 8,
                    border: `1px solid ${S.cardBorder}`, backgroundColor: S.surfaceLow,
                    color: S.onSurface, fontFamily: HEADLINE_FONT, fontWeight: 800,
                    fontSize: 15, textAlign: 'right',
                  }}
                />
                <span style={{ color: S.mutedText, fontSize: 12 }}>%</span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  flex: 1, height: 6, borderRadius: 4,
                  backgroundColor: S.surfaceHigh, position: 'relative',
                }}>
                  {/* The bar runs 0–100 %, at the value's own scale. */}
                  <div style={{
                    position: 'absolute', inset: 0,
                    width: `${Math.min(100, Math.round(driver.gp1_pct_affected * 100))}%`,
                    backgroundColor: S.primary, borderRadius: 4,
                  }} />
                </div>
                <div style={{
                  minWidth: 64,
                  padding: '6px 12px', borderRadius: 8,
                  backgroundColor: S.surfaceLow,
                  border: `1px solid ${S.cardBorder}`,
                  textAlign: 'center',
                  fontFamily: HEADLINE_FONT,
                  fontWeight: 800, fontSize: 15, color: S.primary,
                }}>
                  {pctI(driver.gp1_pct_affected)}
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Probability"
            icon={Zap}
            footnote={
              <>Likelihood this driver materialises at the stated severity.
              Scale: 1 = Very Unlikely, 3 = Possible, 5 = Almost Certain.</>
            }
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
              <DotBar
                value={isEditing ? draft.probability : driver.probability}
                editable={isEditing}
                onChange={isEditing ? (v) => edit({ probability: v }) : undefined}
              />
              <div style={{
                padding: '6px 12px', borderRadius: 8,
                backgroundColor: S.surfaceLow,
                border: `1px solid ${S.cardBorder}`,
                fontFamily: HEADLINE_FONT,
                fontWeight: 800, fontSize: 15, color: S.primary,
              }}>
                {isEditing ? draft.probability : driver.probability} / 5
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Materialization Timing"
            icon={Clock}
            footnote="When does this driver reach full impact, and how does it build over time?"
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <FieldLabel>Peak Year</FieldLabel>
                {isEditing ? (
                  <input
                    type="number"
                    min={2025} max={2035} step={1}
                    value={draft.peak_year}
                    onChange={(e) => edit({ peak_year: parseInt(e.target.value || '2030', 10) })}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 8,
                      border: `1px solid ${S.cardBorder}`,
                      backgroundColor: S.surfaceLow, color: S.onSurface,
                      fontSize: 13, fontWeight: 700,
                    }}
                  />
                ) : (
                  <div style={{
                    padding: '8px 10px', borderRadius: 8,
                    fontSize: 13, fontWeight: 700, color: S.onSurface,
                    backgroundColor: S.surfaceLow,
                    border: `1px solid ${S.cardBorder}`,
                  }}>
                    {driver.peak_year}
                  </div>
                )}
                <div style={{ fontSize: 11, color: S.mutedText, marginTop: 4 }}>
                  Year when 100% of impact materializes
                </div>
              </div>
              <div>
                <FieldLabel>Diffusion Curve</FieldLabel>
                {isEditing ? (
                  <select
                    value={draft.diffusion_curve}
                    onChange={(e) => edit({ diffusion_curve: e.target.value })}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 8,
                      border: `1px solid ${S.cardBorder}`,
                      backgroundColor: S.surfaceLow, color: S.onSurface,
                      fontSize: 13, fontWeight: 700,
                    }}
                  >
                    {Object.entries(DIFFUSION_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                ) : (
                  <div style={{
                    padding: '8px 10px', borderRadius: 8,
                    fontSize: 13, fontWeight: 700, color: S.onSurface,
                    backgroundColor: S.surfaceLow,
                    border: `1px solid ${S.cardBorder}`,
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <DiffusionGlyph curve={driver.diffusion_curve} color={S.primary} />
                    {curveLabel(driver.diffusion_curve)}
                  </div>
                )}
                <div style={{ fontSize: 11, color: S.mutedText, marginTop: 4 }}>
                  {DIFFUSION_LABELS[curve]?.description}
                </div>
              </div>
            </div>
          </SectionCard>

          {/* One uncertainty score per driver: it sets the Beta concentration
              (the band width) and the peak-year jitter. */}
          <SectionCard
            title="Uncertainty"
            icon={Zap}
            info={FIELD_HELP.uncertainty}
            footnote="0 = fixed by law or contract · 3 = size could be half or double · 5 = the sign could differ. Band width and timing jitter follow this score; the mean stays where probability puts it."
          >
            {isEditing ? (
              <UncertaintyPicker value={draft.uncertainty} baseline={base?.uncertainty} onChange={(v) => edit({ uncertainty: v })} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{
                  padding: '8px 10px', borderRadius: 8, minWidth: 160,
                  fontSize: 13, fontWeight: 700, color: S.onSurface,
                  backgroundColor: S.surfaceLow, border: `1px solid ${S.cardBorder}`,
                }}>
                  {uncLabel(driver.uncertainty)}
                </div>
                <span style={{ fontSize: 11, color: S.mutedText }}>
                  {driver.uncertainty == null
                    ? 'Unscored: concentration 6 and the model-wide ±1-year jitter.'
                    : `Beta concentration ${UNCERTAINTY_KAPPA[Math.max(0, Math.min(5, driver.uncertainty))]} · peak-year jitter ±${UNCERTAINTY_PEAK_JITTER[Math.max(0, Math.min(5, driver.uncertainty))]} y`}
                </span>
              </div>
            )}
          </SectionCard>

          {/* Sources; edit mode gives each a title, link, note and tier */}
          {(isEditing || driver.sources.length > 0) && (
            <SectionCard title={`Sources · ${isEditing ? draft.sources.length : driver.sources.length}`} icon={Newspaper}>
              {isEditing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {draft.sources.map((s, i) => (
                    <div key={i} style={{
                      padding: 10, borderRadius: 10,
                      backgroundColor: S.surfaceLow,
                      border: `1px solid ${S.cardBorder}`,
                      display: 'flex', flexDirection: 'column', gap: 8,
                    }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          type="text"
                          placeholder="Source title"
                          value={s.title}
                          maxLength={500}
                          onChange={(e) => patchSource(i, { title: e.target.value })}
                          style={{
                            flex: 2, padding: '6px 10px', borderRadius: 6,
                            border: `1px solid ${S.cardBorder}`,
                            backgroundColor: S.surface, color: S.onSurface,
                            fontSize: 13, fontWeight: 600,
                          }}
                        />
                        <select
                          value={s.tier}
                          onChange={(e) => patchSource(i, { tier: e.target.value as DriverSource['tier'] })}
                          title="Source rating"
                          style={{
                            padding: '6px 10px', borderRadius: 6,
                            border: `1px solid ${S.cardBorder}`,
                            backgroundColor: S.surface, color: S.onSurface,
                            fontSize: 12, fontWeight: 700,
                          }}
                        >
                          <option value="">Rating…</option>
                          {TIER_OPTIONS.map((t) => (
                            <option key={t} value={t}>{t} · {TIER_CONFIG[t].description}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => removeSource(i)}
                          title="Remove source"
                          style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 30, height: 30, borderRadius: 6,
                            border: `1px solid ${S.cardBorder}`,
                            backgroundColor: S.surface, color: S.error,
                            cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          type="url"
                          placeholder="https://…"
                          value={s.url}
                          maxLength={2000}
                          onChange={(e) => patchSource(i, { url: e.target.value })}
                          style={{
                            flex: 2, padding: '6px 10px', borderRadius: 6,
                            border: `1px solid ${S.cardBorder}`,
                            backgroundColor: S.surface, color: S.onSurface,
                            fontSize: 12,
                          }}
                        />
                        <input
                          type="text"
                          placeholder="Publication date or note"
                          value={s.note}
                          maxLength={500}
                          onChange={(e) => patchSource(i, { note: e.target.value })}
                          style={{
                            flex: 3, padding: '6px 10px', borderRadius: 6,
                            border: `1px solid ${S.cardBorder}`,
                            backgroundColor: S.surface, color: S.onSurface,
                            fontSize: 12,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addSource}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      alignSelf: 'flex-start',
                      padding: '6px 12px', borderRadius: 999,
                      fontFamily: HEADLINE_FONT, fontSize: 11, fontWeight: 700,
                      letterSpacing: '0.04em', textTransform: 'uppercase',
                      backgroundColor: S.primaryContainer,
                      color: S.onPrimaryContainer,
                      border: 'none', cursor: 'pointer',
                    }}
                  >
                    <Plus size={12} strokeWidth={2.5} />
                    Add source
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {driver.sources.map((src, i) => <SourceItem key={i} src={src} />)}
                </div>
              )}
            </SectionCard>
          )}
        </div>

        {/* Right column: the exposure grids, Category, Region, Value Chain */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SectionCard title="Category Exposure" icon={Layers}>
            {isEditing ? (
              <EditableCategoryGrid exposures={draft.category_exposure} onChange={(m) => edit({ category_exposure: m })} />
            ) : (
              <CategoryExposureGrid exposures={driver.category_exposure} />
            )}
          </SectionCard>
          <SectionCard title="Regional Exposure" icon={MapPin} accent={S.onSecondaryContainer}>
            {isEditing ? (
              <EditableRegionGrid exposures={draft.regional_exposure} onChange={(m) => edit({ regional_exposure: m })} />
            ) : (
              <RegionExposureGrid exposures={driver.regional_exposure} />
            )}
          </SectionCard>
          <SectionCard
            title="Value Chain Epicentre" icon={Cpu} accent={S.onTertiaryContainer} info={FIELD_HELP.vc}
            right={
              <span style={{ fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 13, color: (isEditing ? editVcStage : vcStage) != null ? S.primary : S.mutedText }}>
                {vcStageLabel(isEditing ? editVcStage : vcStage)}
              </span>
            }
          >
            {isEditing ? (
              <EpicentreSlider value={editVcStage} baseline={baseVcStage} onChange={(st) => edit({ vc_exposure: canonicalVcProfile(st) })} />
            ) : (
              <EpicentreRail stage={vcStage} baseline={baseVcStage} />
            )}
          </SectionCard>
        </div>
      </div>

      {/* Viewers see that the panel is read-only rather than finding it inert. */}
      {!isAdmin && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: 24 }}>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{ backgroundColor: S.surfaceLow, color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT,
              fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}
            title="Driver inputs are maintained by PRISM admins. Ask an administrator for changes.">
            <Lock size={11} strokeWidth={2.4} />
            Read-only · admin-maintained
          </span>
        </div>
      )}

      {/* Admin toolbar: pill buttons at the lower right, without icons */}
      {isAdmin && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          gap: 10, marginTop: 24,
        }}>
          {isEditing && (saveError || changedMeanwhile) && (
            <span role="alert" style={{ color: S.error, fontSize: 12, marginRight: 4, maxWidth: 520 }}>
              {saveError ?? 'This driver was changed by someone else while you were editing; saving would be refused. '
                + 'Discard your edits to see the current version.'}
            </span>
          )}
          {!isEditing && (
            <button
              type="button"
              onClick={startEditing}
              style={{
                padding: '8px 20px',
                borderRadius: 999,
                fontFamily: HEADLINE_FONT,
                fontSize: 11, fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                backgroundColor: S.primaryContainer,
                color: S.onPrimaryContainer,
                border: 'none', cursor: 'pointer',
              }}
            >
              Edit
            </button>
          )}
          {isEditing && (
            <>
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                style={{
                  padding: '8px 20px',
                  borderRadius: 999,
                  fontFamily: HEADLINE_FONT,
                  fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  backgroundColor: S.surfaceLow,
                  color: S.onSurfaceVariant,
                  border: 'none',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.5 : 1,
                }}
              >
                {changedMeanwhile ? 'Discard edits' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '8px 20px',
                  borderRadius: 999,
                  fontFamily: HEADLINE_FONT,
                  fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  backgroundColor: S.primary,
                  color: '#ffffff',
                  border: 'none',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Editable exposure grids (the admin editor and Expert Rating) ──
/** The map with one cell set, or removed when `val` is undefined. */
const withCell = (exposures: ExposureMap, key: string, val: number | undefined): ExposureMap => {
  const next = { ...exposures };
  if (val == null) delete next[key]; else next[key] = val;
  return next;
};

const EditableCategoryGrid: FC<{
  exposures: ExposureMap;
  onChange: (next: ExposureMap) => void;
  baseline?: ExposureMap;
  /** Cells may be left unscored and cleared again (Expert Rating). */
  clearable?: boolean;
}> = ({ exposures, onChange, baseline, clearable = false }) => {
  const grouped = {
    Hair: CATEGORIES.filter((c) => c.group === 'Hair'),
    LHC:  CATEGORIES.filter((c) => c.group === 'LHC'),
  };
  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([group, cats]) => (
        <div key={group}>
          <div
            className="text-[11px] font-semibold mb-2"
            style={{ color: S.onSurfaceVariant, letterSpacing: '0.08em' }}
          >
            {group.toUpperCase()}
          </div>
          <div className="grid grid-cols-4 gap-3">
            {cats.map((cat) => (
              <div key={cat.name} className="flex flex-col items-center gap-1.5">
                <EditableDots
                  value={clearable ? exposures[cat.name] : (exposures[cat.name] ?? 0)}
                  onChange={(v) => onChange(withCell(exposures, cat.name, v))}
                  label={`${cat.name} exposure`}
                  clearable={clearable}
                  hint={baselineHint(baseline == null ? undefined : (baseline[cat.name] ?? 0))}
                />
                <div
                  className="text-[11px] font-medium text-center"
                  style={{ color: S.onSurface }}
                >
                  {shortCat(cat.name)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const EditableRegionGrid: FC<{
  exposures: ExposureMap;
  onChange: (next: ExposureMap) => void;
  baseline?: ExposureMap;
  /** Cells may be left unscored and cleared again (Expert Rating). */
  clearable?: boolean;
}> = ({ exposures, onChange, baseline, clearable = false }) => (
  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
    {REGIONS.map((region) => (
      <div key={region} className="flex flex-col gap-1.5">
        <div className="text-[11px] font-medium" style={{ color: S.onSurface }}>
          {region}
        </div>
        <EditableDots
          value={clearable ? exposures[region] : (exposures[region] ?? 0)}
          onChange={(v) => onChange(withCell(exposures, region, v))}
          label={`${region} exposure`}
          clearable={clearable}
          hint={baselineHint(baseline == null ? undefined : (baseline[region] ?? 0))}
        />
      </div>
    ))}
  </div>
);

// ─── Empty and loading row ─────────────────────────────────────────
const EmptyRow: FC<{ text: string; icon: React.ReactNode; action?: { label: string; onClick: () => void } }> = ({
  text, icon, action,
}) => (
  <div
    className="px-8 py-16 flex flex-col items-center justify-center gap-3"
    style={{ color: S.onSurfaceVariant }}
  >
    <div style={{ color: S.primary }}>{icon}</div>
    <div className="text-sm">{text}</div>
    {action && (
      <button type="button" onClick={action.onClick} style={{
        padding: '7px 16px', borderRadius: 999, border: `1px solid ${S.cardBorder}`, background: S.surface,
        color: S.primary, fontFamily: HEADLINE_FONT, fontSize: 12, fontWeight: 700, cursor: 'pointer',
      }}>
        {action.label}
      </button>
    )}
  </div>
);

export default Drivers;
