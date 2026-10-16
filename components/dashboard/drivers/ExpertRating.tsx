/**
 * Expert Rating: the signed-in expert's own proposal for one driver, scored
 * from a blank slate with the baseline on hover. Changes save as they are
 * made, one request at a time with the newest draft.
 */
import { useState, useEffect, useId, useLayoutEffect, useRef, useCallback, type FC } from 'react';
import {
  Cpu, FileText, BarChart3, Clock, Zap, MapPin, Layers, Newspaper, Info, PenLine, MessageSquare, Check, AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { saveMyProposal } from '@/lib/apiClient';
import { queueProposalSave, registerPendingSave } from '@/lib/proposalSaves';
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
import { useDriverProposals } from './useDriverProposals';


/** A year field for the Expert Rating: the proposal takes the value only while
 *  it is a whole year from `min` (the year after the driver's onset) to the
 *  horizon, so a half-typed year is never sent; anything else stays in the
 *  field with a message under it until it is corrected or cleared. */
const ProposalYearInput: FC<{
  value: number | null | undefined; min: number; onChange: (v: number | null) => void; title?: string;
}> = ({ value, min, onChange, title }) => {
  const [text, setText] = useState(value == null ? '' : String(value));
  const [shownFor, setShownFor] = useState(value);
  const msgId = useId();
  if (shownFor !== value) {
    setShownFor(value);
    setText(value == null ? '' : String(value));
  }
  const valid = (t: string) => /^\d{4}$/.test(t) && Number(t) >= min && Number(t) <= HORIZON;
  const invalid = text !== '' && !valid(text);
  return (
    <div>
      <input type="text" inputMode="numeric" value={text} placeholder={NO_VALUE} title={title}
        aria-label={`Peak year, ${min} to ${HORIZON}`} aria-invalid={invalid} aria-describedby={msgId}
        onChange={(e) => {
          const t = e.target.value.trim();
          setText(t);
          if (t === '') onChange(null);
          else if (valid(t)) onChange(Number(t));
        }}
        style={{ width: 110, padding: '8px 10px', borderRadius: 8, border: `1px solid ${invalid ? S.error : S.cardBorder}`,
          backgroundColor: S.surfaceLow, color: S.onSurface, fontSize: 13, fontWeight: 700 }} />
      <div id={msgId} style={{ fontSize: 11, color: invalid ? S.error : S.mutedText, marginTop: 4 }}>
        {invalid
          ? `A whole year from ${min} (after the onset) to ${HORIZON}; your proposal keeps ${value == null ? 'no year' : value} until this is one`
          : `A whole year from ${min} to ${HORIZON}`}
      </div>
    </div>
  );
};

/** The next unrated driver in the list's order (Drivers.tsx): its id, or why
 *  there is none, and how to open it. */
export interface NextUnrated {
  id: string | null;
  reason: string | null;
  go: () => void;
}

// ── Expert Rating panel: the expert's own proposal, scored from a blank
//    slate and saved automatically, with the baseline on hover ──
export const ExpertRatingPanel: FC<{
  driver: Driver;
  onMyChange: (driverId: string, my: DriverProposal) => void;
  nextUnrated?: NextUnrated;
}> = ({ driver, onMyChange, nextUnrated }) => {
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
  // `pendingSave` marks an edit the 0.6 s debounce has not sent yet, so none
  // goes out twice. Such an edit is sent, not dropped, when the panel
  // unmounts (collapsing the row inside the debounce would otherwise lose an
  // edit already on screen) and when the user signs out (lib/session.ts sends
  // every held-back edit before it expires the viewer cookie).
  const pendingSave = useRef(false);
  const sendPending = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    pendingSave.current = false;
    const save = sendNow();
    save.then(
      () => { if (lastSave.current === save && !pendingSave.current) setStatus('saved'); },
      () => { if (lastSave.current === save) setStatus('error'); },
    );
  }, [sendNow]);
  useEffect(() => registerPendingSave(() => { if (pendingSave.current) sendPending(); }), [sendPending]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    if (pendingSave.current) {
      pendingSave.current = false;
      // The panel is gone, but the write must still land.
      void sendNow().catch(() => undefined);
    }
  }, [sendNow]);

  // "Retry" after a failed save: the newest draft goes out again at once.
  const retrySave = useCallback(() => {
    setStatus('saving');
    pendingSave.current = true;
    sendPending();
  }, [sendPending]);

  const flush = useCallback(() => {
    setStatus('saving');
    pendingSave.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(sendPending, 600);
  }, [sendPending]);
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
  const statusText = status === 'saving' ? 'Saving'
    : status === 'saved' ? 'All changes saved'
    : status === 'error' ? 'Save failed'
    : 'Changes save as you make them';

  // Until the stored proposal has loaded nothing can be edited: a save made
  // from a blank draft would overwrite what the expert entered before.
  if (!hydrated) {
    return (
      <div onClick={(e) => e.stopPropagation()} style={{ padding: '0 32px', backgroundColor: S.surface, borderTop: `1px solid ${S.cardBorder}` }}>
        {failed
          ? <ProposalsUnavailable what="your proposal cannot be edited right now" onRetry={retry} />
          : <div role="status" style={{ padding: '26px 0', textAlign: 'center', fontSize: 14, color: S.onSurfaceVariant }}>Loading your proposal…</div>}
      </div>
    );
  }

  return (
    <div onClick={(e) => e.stopPropagation()} className="px-4 pt-6 pb-8 md:px-8" style={{ backgroundColor: S.surface, borderTop: `1px solid ${S.cardBorder}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <span className="inline-flex items-center gap-2" style={{ fontFamily: HEADLINE_FONT, fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: S.primary }}>
          <PenLine size={13} strokeWidth={2.4} /> Expert Rating · your proposal
        </span>
        <span className="inline-flex items-center gap-2 flex-wrap">
          <span role="status" className="inline-flex items-center gap-1.5"
            style={{ fontSize: 12, fontWeight: 700, color: status === 'error' ? S.error : status === 'saved' ? REVIEWED_COLOR : S.onSurfaceVariant }}>
            {status === 'saved' && <Check size={12} strokeWidth={2.6} aria-hidden />}
            {status === 'error' && <AlertTriangle size={12} strokeWidth={2.4} aria-hidden />}
            {statusText}
          </span>
          {status === 'error' && (
            <button type="button" onClick={retrySave} style={{
              padding: '4px 12px', borderRadius: 999, border: `1px solid ${S.error}`, background: 'transparent',
              color: S.error, fontFamily: HEADLINE_FONT, fontSize: 11, fontWeight: 700, cursor: 'pointer', minHeight: 24,
            }}>
              Retry
            </button>
          )}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] gap-5">
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

          <SectionCard title="Probability" icon={Zap} info={FIELD_HELP.probability} footnote="1 = Very Unlikely, 3 = Possible, 5 = Almost Certain. The ring marks the baseline; click the selected dot again to clear your score.">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <span title={`Baseline ${base.probability} / 5`}>
                <DotBar value={draft.probability ?? 0} editable baseline={base.probability}
                  onChange={(v) => patch({ probability: v === draft.probability ? null : v })} />
              </span>
              <BaselineRef value={`${base.probability}/5`} />
            </div>
          </SectionCard>

          <SectionCard title="GP1 % affected" icon={BarChart3} info={FIELD_HELP.gp1} footnote="Share of category GP1 this driver can move at full materialisation.">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {/* While unscored the slider sits muted at the baseline: moving
                  it scores the share, nothing is scored by its position alone. */}
              <input type="range" min={1} max={100} step={1} value={gp1Int ?? Math.round(base.gp1_pct_affected * 100)}
                aria-label="GP1 % affected"
                aria-valuetext={gp1Int == null ? 'not scored' : `${gp1Int}%`}
                onChange={(e) => patch({ gp1_pct_affected: parseInt(e.target.value, 10) / 100 })}
                title={`Baseline ${fmtPct(base.gp1_pct_affected, 0)}`}
                style={{ flex: '1 1 160px', minWidth: 120, cursor: 'pointer', opacity: gp1Int == null ? 0.45 : 1 }} />
              <input type="number" min={1} max={100} step={1} value={gp1Int ?? ''} placeholder={NO_VALUE}
                aria-label="GP1 % affected, in percent"
                onChange={(e) => {
                  // A share of 0 moves nothing, so an empty field or 0 clears the score.
                  const n = parseInt(e.target.value, 10);
                  patch({ gp1_pct_affected: Number.isNaN(n) || n <= 0 ? null : Math.min(100, n) / 100 });
                }}
                title={`Baseline ${fmtPct(base.gp1_pct_affected, 0)}`}
                style={{ width: 70, padding: '6px 8px', borderRadius: 8, border: `1px solid ${S.cardBorder}`, backgroundColor: S.surfaceLow, color: S.onSurface, fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 15, textAlign: 'right' }} />
              <span style={{ color: S.mutedText, fontSize: 12 }}>%</span>
              {gp1Int == null && <span style={{ color: S.mutedText, fontSize: 11 }}>not scored</span>}
              <BaselineRef value={fmtPct(base.gp1_pct_affected, 0)} />
            </div>
          </SectionCard>

          <SectionCard title="Materialisation timing" icon={Clock} info={FIELD_HELP.timing}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <FieldLabel>Peak year</FieldLabel>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                  <ProposalYearInput value={draft.peak_year} min={firstPeakYear(driver.start_year)} onChange={(v) => patch({ peak_year: v })}
                    title={`Baseline ${base.peak_year}`} />
                  <span style={{ marginTop: 8 }}><BaselineRef value={String(base.peak_year)} /></span>
                </div>
              </div>
              <div>
                <FieldLabel>Diffusion curve</FieldLabel>
                <DiffusionPicker value={draft.diffusion_curve} baseline={base.diffusion_curve} distribution={dist}
                  onChange={(c) => patch({ diffusion_curve: c })} onClear={() => patch({ diffusion_curve: null })} />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Uncertainty" icon={Zap} info={FIELD_HELP.uncertainty} footnote="0 = fixed by law or contract, 3 = size could be half or double, 5 = the sign could differ. Sets the band width and the timing jitter of this driver; the mean stays where probability puts it.">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
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
          <SectionCard title="Category exposure" icon={Layers} info={FIELD_HELP.category} footnote="Grey means unscored; the ring marks the baseline score. A cell you leave blank is not part of your proposal; click a selected dot again to clear it.">
            <EditableCategoryGrid clearable exposures={draft.category_exposure ?? {}}
              onChange={(e) => patch({ category_exposure: Object.keys(e).length ? e : null })} baseline={base.category_exposure} />
          </SectionCard>
          <SectionCard title="Regional exposure" icon={MapPin} accent={S.onSecondaryContainer} info={FIELD_HELP.regional} footnote="The ring marks the baseline score.">
            <EditableRegionGrid clearable exposures={draft.regional_exposure ?? {}}
              onChange={(e) => patch({ regional_exposure: Object.keys(e).length ? e : null })} baseline={base.regional_exposure} />
          </SectionCard>
          <SectionCard
            title="Value-chain epicentre" icon={Cpu} accent={S.onTertiaryContainer} info={FIELD_HELP.vc}
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

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginTop: 18 }}>
        <div className="inline-flex items-center gap-1.5" style={{ padding: '8px 14px', borderRadius: 10, backgroundColor: S.surfaceLow, color: S.onSurfaceVariant, fontSize: 12.5, lineHeight: 1.5 }}>
          <Info size={13} style={{ flexShrink: 0, color: S.primary }} />
          <span>Your scores are a proposal and never change the driver: the model reads the driver&apos;s own scores. An admin endorses a proposal by editing the driver.</span>
        </div>
        {nextUnrated && (
          <span className="inline-flex items-center gap-2 flex-wrap" data-print-hide>
            {nextUnrated.id == null && nextUnrated.reason && (
              <span id={`next-unrated-${driver.id}`} style={{ fontSize: 11.5, color: S.mutedText }}>{nextUnrated.reason}</span>
            )}
            <button type="button" onClick={nextUnrated.go} disabled={nextUnrated.id == null}
              aria-describedby={nextUnrated.id == null ? `next-unrated-${driver.id}` : undefined}
              className="inline-flex items-center gap-1.5"
              style={{
                padding: '8px 16px', borderRadius: 999, border: 'none',
                backgroundColor: S.primary, color: S.onPrimary, fontFamily: HEADLINE_FONT,
                fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                cursor: nextUnrated.id == null ? 'not-allowed' : 'pointer', opacity: nextUnrated.id == null ? 0.5 : 1,
              }}>
              Next unrated <ArrowRight size={12} strokeWidth={2.6} aria-hidden />
            </button>
          </span>
        )}
      </div>
    </div>
  );
};
