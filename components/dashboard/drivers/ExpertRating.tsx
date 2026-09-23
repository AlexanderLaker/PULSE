/**
 * Expert Rating: the signed-in expert's own proposal for one driver, scored
 * from a blank slate with the baseline on hover. Changes save as they are
 * made, one request at a time with the newest draft.
 */
import { useState, useEffect, useLayoutEffect, useRef, useCallback, type FC } from 'react';
import {
  Cpu, FileText, BarChart3, Clock, Zap, MapPin, Layers, Newspaper, Info, PenLine, MessageSquare,
} from 'lucide-react';
import { saveMyProposal } from '@/lib/apiClient';
import { HORIZON, NO_VALUE, firstPeakYear, fmtPct } from '@/lib/format';
import { S, HEADLINE_FONT, BODY_FONT } from '@/lib/theme';
import type { Driver, DriverProposal } from '@/types';
import SectionCard from '@/components/dashboard/SectionCard';
import { REVIEWED_COLOR, vcStageLabel } from './shared';
import {
  DiffusionPicker, DotBar, EditableCategoryGrid, EditableRegionGrid, EpicentreSlider,
  UncertaintyPicker,
} from './scales';
import { BaselineRef, FIELD_HELP, FieldLabel, ProposalsUnavailable, SourceItem } from './cards';
import { ANALYSIS_FOOTNOTE, PrismAnalysisReading } from './PrismAnalysis';
import { queueProposalSave, useDriverProposals } from './useDriverProposals';


/** A year field for the Expert Rating: the proposal takes the value only while
 *  it is a whole year from `min` (the year after the driver's onset) to the
 *  horizon, so a half-typed year is never sent; leaving the field with
 *  anything else puts the last valid year back. */
const ProposalYearInput: FC<{
  value: number | null | undefined; min: number; onChange: (v: number | null) => void; title?: string;
}> = ({ value, min, onChange, title }) => {
  const [text, setText] = useState(value == null ? '' : String(value));
  const [shownFor, setShownFor] = useState(value);
  if (shownFor !== value) {
    setShownFor(value);
    setText(value == null ? '' : String(value));
  }
  const valid = (t: string) => /^\d{4}$/.test(t) && Number(t) >= min && Number(t) <= HORIZON;
  return (
    <input type="text" inputMode="numeric" value={text} placeholder={NO_VALUE} title={title}
      aria-label={`Peak year, ${min} to ${HORIZON}`} aria-invalid={text !== '' && !valid(text)}
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
export const ExpertRatingPanel: FC<{ driver: Driver; onMyChange: (driverId: string, my: DriverProposal) => void }> = ({ driver, onMyChange }) => {
  const { data, loaded, failed, retry } = useDriverProposals(driver.id);
  const [draft, setDraft] = useState<DriverProposal>({});
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const draftRef = useRef<DriverProposal>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Saves go out one at a time through the driver's queue, each with the
  // draft as it is when it starts, so a slow earlier save can never land
  // after a later one; `lastSave` is this panel's newest, for the status.
  const lastSave = useRef<Promise<unknown> | null>(null);
  const sendNow = useCallback(() => {
    const next = queueProposalSave(driver.id, () => saveMyProposal(driver.id, draftRef.current));
    lastSave.current = next;
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
        () => { if (lastSave.current === save && !pendingSave.current) setStatus('saved'); },
        () => { if (lastSave.current === save) setStatus('error'); },
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

  const base = driver.baseline;
  const myVcStage = draft.vc_epicentre ?? null;
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
              <span title={`Baseline ${base.probability} / 5`} style={{ cursor: 'help' }}>
                <DotBar value={draft.probability ?? 0} editable onChange={(v) => patch({ probability: v === draft.probability ? null : v })} />
              </span>
              <BaselineRef value={`${base.probability}/5`} />
            </div>
          </SectionCard>

          <SectionCard title="Impact: GP1 % exposed" icon={BarChart3} info={FIELD_HELP.gp1} footnote="Share of category GP1 this driver can move at full materialisation.">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input type="range" min={1} max={100} step={1} value={gp1Int ?? 1}
                onChange={(e) => patch({ gp1_pct_affected: parseInt(e.target.value, 10) / 100 })}
                title={`Baseline ${fmtPct(base.gp1_pct_affected, 0)}`} style={{ flex: 1, cursor: 'help' }} />
              <input type="number" min={1} max={100} step={1} value={gp1Int ?? ''} placeholder={NO_VALUE}
                aria-label="GP1 percent exposed"
                onChange={(e) => {
                  // A share of 0 moves nothing, so an empty field or 0 clears the score.
                  const n = parseInt(e.target.value, 10);
                  patch({ gp1_pct_affected: Number.isNaN(n) || n <= 0 ? null : Math.min(100, n) / 100 });
                }}
                title={`Baseline ${fmtPct(base.gp1_pct_affected, 0)}`}
                style={{ width: 70, padding: '6px 8px', borderRadius: 8, border: `1px solid ${S.cardBorder}`, backgroundColor: S.surfaceLow, color: S.onSurface, fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 15, textAlign: 'right' }} />
              <span style={{ color: S.mutedText, fontSize: 12 }}>%</span>
              <BaselineRef value={fmtPct(base.gp1_pct_affected, 0)} />
            </div>
          </SectionCard>

          <SectionCard title="Materialisation timing" icon={Clock} info={FIELD_HELP.timing}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <FieldLabel>Peak Year</FieldLabel>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <ProposalYearInput value={draft.peak_year} min={firstPeakYear(driver.start_year)} onChange={(v) => patch({ peak_year: v })}
                    title={`Baseline ${base.peak_year}`} />
                  <BaselineRef value={String(base.peak_year)} />
                </div>
              </div>
              <div>
                <FieldLabel>Diffusion Curve</FieldLabel>
                <DiffusionPicker value={draft.diffusion_curve} baseline={base.diffusion_curve} distribution={dist}
                  onChange={(c) => patch({ diffusion_curve: c })} onClear={() => patch({ diffusion_curve: null })} />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Uncertainty" icon={Zap} info={FIELD_HELP.uncertainty} footnote="0 = fixed · 3 = half or double · 5 = sign open. Sets the band width and the timing jitter of this driver; the mean stays where probability puts it.">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
              <UncertaintyPicker value={draft.uncertainty} baseline={base.uncertainty}
                onChange={(v) => patch({ uncertainty: v })} onClear={() => patch({ uncertainty: null })} />
              <BaselineRef value={`${base.uncertainty}/5`} />
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
              onChange={(e) => patch({ category_exposure: Object.keys(e).length ? e : null })} baseline={base.category_exposure} />
          </SectionCard>
          <SectionCard title="Regional Exposure" icon={MapPin} accent={S.onSecondaryContainer} info={FIELD_HELP.regional}>
            <EditableRegionGrid clearable exposures={draft.regional_exposure ?? {}}
              onChange={(e) => patch({ regional_exposure: Object.keys(e).length ? e : null })} baseline={base.regional_exposure} />
          </SectionCard>
          <SectionCard
            title="Value Chain Epicentre" icon={Cpu} accent={S.onTertiaryContainer} info={FIELD_HELP.vc}
            right={
              <span className="inline-flex items-center gap-2">
                <span style={{ fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 13, color: myVcStage != null ? S.primary : S.mutedText }}>
                  {vcStageLabel(myVcStage)}
                </span>
                {myVcStage != null && (
                  <button type="button" onClick={() => patch({ vc_epicentre: null })}
                    style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontSize: 11, fontWeight: 700, color: S.onSurfaceVariant, textDecoration: 'underline' }}>
                    Clear
                  </button>
                )}
              </span>
            }
            footnote="One choice: the stage where this driver’s impact centres. The value-chain attribution assigns the driver’s whole contribution to this stage; leave it unscored and it is not part of your proposal."
          >
            <EpicentreSlider value={myVcStage} baseline={base.vc_epicentre} onChange={(st) => patch({ vc_epicentre: st })} />
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
