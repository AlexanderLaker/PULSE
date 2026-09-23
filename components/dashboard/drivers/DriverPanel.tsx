/**
 * The expanded Driver List panel: everything about one driver, read-only for
 * viewers. Two columns: the description, PRISM Analysis, GP1 %, probability,
 * timing, uncertainty and sources on the left; the category, regional and
 * value-chain exposure on the right. Admins get an Edit button that turns
 * every field except the PRISM Analysis into a form; Save sends one
 * DriverUpdate with the fields that changed and the revision it started from.
 */
import { useState, type FC } from 'react';
import {
  Cpu, FileText, BarChart3, Clock, Zap, MapPin, Layers, Newspaper, Plus, Trash2, Lock,
} from 'lucide-react';
import { ApiError } from '@/lib/apiClient';
import { HORIZON, SOURCE_FIELD_LIMITS, SOURCE_URL, evidenceLine, firstPeakYear, fmtPct } from '@/lib/format';
import { UNCERTAINTY_KAPPA, UNCERTAINTY_PEAK_JITTER } from '@/lib/uncertainty';
import { S, HEADLINE_FONT, BODY_FONT } from '@/lib/theme';
import Chip from '@/components/dashboard/Chip';
import type { Confidence, Direction, Driver, DriverSource, DriverUpdate, ExposureMap } from '@/types';
import SectionCard from '@/components/dashboard/SectionCard';
import { curveLabel, DIFFUSION_LABELS, uncLabel, vcStageLabel } from './shared';
import {
  CategoryExposureGrid, DiffusionGlyph, DotBar, EditableCategoryGrid, EditableRegionGrid,
  EpicentreRail, EpicentreSlider, RegionExposureGrid, UncertaintyPicker,
} from './scales';
import {
  EditedChip, FIELD_HELP, FieldLabel, MetaChip, SourceItem, TIER_CONFIG, TIER_OPTIONS,
} from './cards';
import { ANALYSIS_FOOTNOTE, PrismAnalysisReading } from './PrismAnalysis';


interface ExpandedPanelProps {
  driver: Driver;
  isAdmin: boolean;
  updateDriver: (driverId: string, update: DriverUpdate) => Promise<void>;
}

// ─── The admin editor's working copy ──────────────────────────────
type Draft = Pick<Driver,
  | 'description' | 'direction' | 'confidence' | 'probability' | 'gp1_pct_affected' | 'peak_year'
  | 'diffusion_curve' | 'uncertainty' | 'category_exposure' | 'regional_exposure' | 'vc_epicentre' | 'sources'>;

const sourceCopy = (s: DriverSource): DriverSource => ({ title: s.title, url: s.url, tier: s.tier, published: s.published });

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
  vc_epicentre: d.vc_epicentre,
  sources: d.sources.map(sourceCopy),
});

/** The cells the draft scores differently from the stored map; undefined when
 *  there are none. The API changes only the cells an edit names. */
const changedCells = (draft: ExposureMap, stored: ExposureMap): ExposureMap | undefined => {
  const out: ExposureMap = {};
  for (const [k, v] of Object.entries(draft)) if (stored[k] !== v) out[k] = v;
  return Object.keys(out).length ? out : undefined;
};

const sameSources = (a: DriverSource[], b: DriverSource[]): boolean =>
  a.length === b.length && a.every((s, i) => (
    s.title === b[i].title && s.url === b[i].url && s.tier === b[i].tier && s.published === b[i].published
  ));

/** Whether a year is a whole year the peak may take: after the onset, by the horizon. */
const validPeak = (text: string, min: number): boolean =>
  /^\d{4}$/.test(text) && Number(text) >= min && Number(text) <= HORIZON;

/** Whether a source's link is one the API accepts: none, or an http(s) address. */
const validLink = (url: string): boolean => url.trim() === '' || SOURCE_URL.test(url.trim());

/** The DriverUpdate of a save: the revision the draft was taken from, and only
 *  the fields the admin changed (of an exposure map, only the changed cells),
 *  and only sources with a title or a link. The form lets nothing outside the
 *  API's ranges through. The PRISM Analysis is never part of it. */
function updateFrom(draft: Draft, d: Driver): DriverUpdate {
  const update: DriverUpdate = { revision: d.revision };
  if (draft.description !== d.description) update.description = draft.description;
  if (draft.direction !== d.direction) update.direction = draft.direction;
  if (draft.confidence !== d.confidence) update.confidence = draft.confidence;
  if (draft.probability !== d.probability) update.probability = draft.probability;
  if (draft.gp1_pct_affected !== d.gp1_pct_affected) update.gp1_pct_affected = draft.gp1_pct_affected;
  if (draft.peak_year !== d.peak_year) update.peak_year = draft.peak_year;
  if (draft.diffusion_curve !== d.diffusion_curve) update.diffusion_curve = draft.diffusion_curve;
  if (draft.uncertainty !== d.uncertainty) update.uncertainty = draft.uncertainty;
  const category = changedCells(draft.category_exposure, d.category_exposure);
  if (category) update.category_exposure = category;
  const regional = changedCells(draft.regional_exposure, d.regional_exposure);
  if (regional) update.regional_exposure = regional;
  if (draft.vc_epicentre !== d.vc_epicentre) update.vc_epicentre = draft.vc_epicentre;
  const sources = draft.sources
    .filter((s) => s.title.trim() || s.url.trim())
    .map((s) => ({ ...s, url: s.url.trim() }));
  if (!sameSources(sources, d.sources)) update.sources = sources;
  return update;
}

export const ExpandedPanel: FC<ExpandedPanelProps> = ({ driver, isAdmin, updateDriver }) => {
  const base = driver.baseline;

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // A save that timed out may have been stored: no second save before the
  // admin has seen the driver as it is stored now.
  const [uncertain, setUncertain] = useState(false);
  const [draft, setDraft] = useState(() => draftOf(driver));
  const edit = (patch: Partial<Draft>) => setDraft((prev) => ({ ...prev, ...patch }));
  // The peak year as typed: the draft takes it only while it is a year the
  // peak may take, and Save waits until it is.
  const [peakText, setPeakText] = useState(String(driver.peak_year));

  // The driver the draft was taken from. Outside editing it follows every new
  // driver object (after a save the store reloads the drivers); while editing
  // it stays put, so a save names the revision the admin started from and a
  // change made meanwhile is refused instead of overwritten.
  const [draftBase, setDraftBase] = useState(driver);
  if (!isEditing && draftBase !== driver) {
    setDraftBase(driver);
    setDraft(draftOf(driver));
    setPeakText(String(driver.peak_year));
  }
  const changedMeanwhile = isEditing && draftBase.revision !== driver.revision;
  const peakMin = firstPeakYear(draftBase.start_year);
  const peakOk = validPeak(peakText, peakMin);
  const linksOk = draft.sources.every((src) => validLink(src.url));
  const formOk = peakOk && linksOk;

  const startEditing = () => {
    setDraftBase(driver);
    setDraft(draftOf(driver));
    setPeakText(String(driver.peak_year));
    setSaveError(null);
    setUncertain(false);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setDraftBase(driver);
    setDraft(draftOf(driver));
    setPeakText(String(driver.peak_year));
    setSaveError(null);
    setUncertain(false);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!formOk) return;
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
      if (e instanceof ApiError && e.timedOut) setUncertain(true);
      setSaveError(e instanceof ApiError && e.timedOut
        ? 'The save did not answer in time and may still have been stored. Discard your edits to see the '
          + 'driver as it is stored now, and make the change again if it is missing.'
        : e instanceof ApiError && e.status === 409
          ? 'This driver was changed by someone else while you were editing. Your edits are still here; '
            + 'discard them to see the current version, then make your change again.'
          : (e as Error)?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const addSource = () =>
    edit({ sources: [...draft.sources, { title: '', url: '', tier: '', published: '' }] });
  const removeSource = (idx: number) =>
    edit({ sources: draft.sources.filter((_, i) => i !== idx) });
  const patchSource = (idx: number, patch: Partial<DriverSource>) =>
    edit({ sources: draft.sources.map((s, i) => (i === idx ? { ...s, ...patch } : s)) });

  const curve = isEditing ? draft.diffusion_curve : driver.diffusion_curve;
  const vcStage = isEditing ? draft.vc_epicentre : driver.vc_epicentre;

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
                aria-label="Description"
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
                materialisation?
              </>
            }
          >
            {isEditing ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="range"
                  aria-label="GP1 % affected"
                  min={1} max={100} step={1}
                  value={Math.round(draft.gp1_pct_affected * 100)}
                  onChange={(e) => edit({ gp1_pct_affected: parseInt(e.target.value, 10) / 100 })}
                  style={{ flex: 1 }}
                />
                <input
                  type="number"
                  aria-label="GP1 % affected, in percent"
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
                  {fmtPct(driver.gp1_pct_affected, 0)}
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Probability"
            icon={Zap}
            footnote={
              <>Likelihood that this driver materialises as described.
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
            title="Materialisation Timing"
            icon={Clock}
            footnote="When does this driver reach full impact, and how does it build over time?"
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <FieldLabel>Peak Year</FieldLabel>
                {isEditing ? (
                  <input
                    type="text"
                    inputMode="numeric"
                    aria-label={`Peak year, ${peakMin} to ${HORIZON}`}
                    aria-invalid={!peakOk}
                    aria-describedby={`peak-year-${driver.id}`}
                    value={peakText}
                    onChange={(e) => {
                      const t = e.target.value.trim();
                      setPeakText(t);
                      if (validPeak(t, peakMin)) edit({ peak_year: Number(t) });
                    }}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 8,
                      border: `1px solid ${peakOk ? S.cardBorder : S.error}`,
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
                <div id={`peak-year-${driver.id}`} style={{ fontSize: 11, color: isEditing && !peakOk ? S.error : S.mutedText, marginTop: 4 }}>
                  {isEditing && !peakOk
                    ? `A whole year from ${peakMin} (after the onset) to ${HORIZON}`
                    : 'Year when 100% of impact materialises'}
                </div>
              </div>
              <div>
                <FieldLabel>Diffusion Curve</FieldLabel>
                {isEditing ? (
                  <select
                    aria-label="Diffusion curve"
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
                  {DIFFUSION_LABELS[curve].description}
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
              <UncertaintyPicker value={draft.uncertainty} baseline={base.uncertainty} onChange={(v) => edit({ uncertainty: v })} />
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
                  Beta concentration {UNCERTAINTY_KAPPA[driver.uncertainty]} · peak-year jitter ±{UNCERTAINTY_PEAK_JITTER[driver.uncertainty]} y
                </span>
              </div>
            )}
          </SectionCard>

          {/* Sources; edit mode gives each a title, link, publication date and tier */}
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
                          aria-label="Source title"
                          value={s.title}
                          maxLength={SOURCE_FIELD_LIMITS.title}
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
                          aria-label="Source rating"
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
                          aria-label="Remove source"
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
                          aria-label="Source link"
                          aria-invalid={!validLink(s.url)}
                          value={s.url}
                          maxLength={SOURCE_FIELD_LIMITS.url}
                          onChange={(e) => patchSource(i, { url: e.target.value })}
                          style={{
                            flex: 2, padding: '6px 10px', borderRadius: 6,
                            border: `1px solid ${validLink(s.url) ? S.cardBorder : S.error}`,
                            backgroundColor: S.surface, color: S.onSurface,
                            fontSize: 12,
                          }}
                        />
                        <input
                          type="text"
                          placeholder="Published (e.g. Apr 2026)"
                          aria-label="Published"
                          value={s.published}
                          maxLength={SOURCE_FIELD_LIMITS.published}
                          onChange={(e) => patchSource(i, { published: e.target.value })}
                          style={{
                            flex: 3, padding: '6px 10px', borderRadius: 6,
                            border: `1px solid ${S.cardBorder}`,
                            backgroundColor: S.surface, color: S.onSurface,
                            fontSize: 12,
                          }}
                        />
                      </div>
                      {!validLink(s.url) && (
                        <div style={{ fontSize: 11, color: S.error }}>
                          A link starts with http:// or https:// and has no spaces; leave it empty for a source without one.
                        </div>
                      )}
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
              <span style={{ fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 13, color: S.primary }}>
                {vcStageLabel(vcStage)}
              </span>
            }
          >
            {isEditing ? (
              <EpicentreSlider value={vcStage} baseline={base.vc_epicentre} onChange={(st) => edit({ vc_epicentre: st })} />
            ) : (
              <EpicentreRail stage={vcStage} baseline={base.vc_epicentre} />
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
          {isEditing && !saveError && !changedMeanwhile && !formOk && (
            <span style={{ color: S.error, fontSize: 12, marginRight: 4, maxWidth: 520 }}>
              {!peakOk ? 'The peak year needs correcting before the driver can be saved.'
                : 'A source link needs correcting before the driver can be saved.'}
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
                {changedMeanwhile || uncertain ? 'Discard edits' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !formOk || uncertain}
                style={{
                  padding: '8px 20px',
                  borderRadius: 999,
                  fontFamily: HEADLINE_FONT,
                  fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  backgroundColor: S.primary,
                  color: S.onPrimary,
                  border: 'none',
                  cursor: saving || !formOk || uncertain ? 'not-allowed' : 'pointer',
                  opacity: saving || !formOk || uncertain ? 0.5 : 1,
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
