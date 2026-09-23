/**
 * The admin editor of one tile, inline in its dialog: the name, intensity,
 * driver note, linked driver codes and Strategist Read. The edits go into the
 * board's draft; the board saves the whole tile map.
 */
import { useId, useMemo, useState, type CSSProperties, type FC } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import type { JourneyTile } from '@/data/consumerJourney';
import { DRIVER_CODE_MAP } from '@/data/driverCodeMap';
import { S, HEADLINE_FONT, BODY_FONT } from '@/lib/theme';
import { currentMonth, INTENSITY_LABELS, type TileEdits } from './shared';

export const TileEditor: FC<{
  initial: JourneyTile;
  onSave: (edits: TileEdits) => void;
  onCancel: () => void;
  onRemove: () => void;
}> = ({ initial, onSave, onCancel, onRemove }) => {
  const [edits, setEdits] = useState<TileEdits>({
    name: initial.name,
    intensity: initial.intensity,
    driverNote: initial.driverNote,
    driverCodes: initial.driverCodes.length ? [...initial.driverCodes] : [''],
    analysis: initial.analysis ?? '',
  });

  const allCodes = useMemo(() => Object.keys(DRIVER_CODE_MAP).sort((a, b) => a.localeCompare(b)), []);
  const id = useId();
  const labelStyle: CSSProperties = {
    fontSize: 10, fontWeight: 700, color: S.onSurfaceVariant, display: 'block',
    marginBottom: 5, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: HEADLINE_FONT,
  };
  const inputStyle: CSSProperties = {
    width: '100%', padding: '8px 10px', borderRadius: 8, backgroundColor: S.surface,
    border: `1px solid ${S.cardBorder}`, color: S.onSurface, fontSize: 12, fontFamily: BODY_FONT,
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label htmlFor={`${id}-name`} style={labelStyle}>Tile name</label>
        <input id={`${id}-name`} style={inputStyle} value={edits.name}
          onChange={e => setEdits(p => ({ ...p, name: e.target.value }))} />
      </div>

      <div>
        <span id={`${id}-intensity`} style={labelStyle}>Intensity</span>
        <div role="group" aria-labelledby={`${id}-intensity`} style={{ display: 'flex', gap: 6 }}>
          {([1, 2, 3] as const).map(n => (
            <button type="button"
              key={n}
              aria-pressed={edits.intensity === n}
              onClick={() => setEdits(p => ({ ...p, intensity: n }))}
              className="flex-1 py-1.5 rounded-lg text-[11px] font-bold"
              style={{
                backgroundColor: edits.intensity === n ? S.primaryContainer : S.surfaceLow,
                color: edits.intensity === n ? S.onPrimaryContainer : S.mutedText,
                border: 'none', cursor: 'pointer', fontFamily: HEADLINE_FONT,
              }}
            >
              {n} · {INTENSITY_LABELS[n]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor={`${id}-note`} style={labelStyle}>Driver note</label>
        <input id={`${id}-note`} style={inputStyle} value={edits.driverNote}
          onChange={e => setEdits(p => ({ ...p, driverNote: e.target.value }))} />
      </div>

      <div>
        <span style={labelStyle}>Linked driver codes</span>
        {edits.driverCodes.map((code, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <select
              aria-label={`Linked driver ${idx + 1}`}
              value={code}
              onChange={e => setEdits(p => {
                const next = [...p.driverCodes]; next[idx] = e.target.value; return { ...p, driverCodes: next };
              })}
              style={{ ...inputStyle, backgroundColor: S.surfaceLow }}
            >
              <option value="">Select driver…</option>
              {allCodes.map(c => (
                <option key={c} value={c}>{c}: {DRIVER_CODE_MAP[c].name}</option>
              ))}
            </select>
            {edits.driverCodes.length > 1 && (
              <button type="button"
                onClick={() => setEdits(p => ({ ...p, driverCodes: p.driverCodes.filter((_, i) => i !== idx) }))}
                style={{ padding: '0 10px', borderRadius: 8, backgroundColor: S.errorContainer, border: 'none', color: S.onErrorContainer, cursor: 'pointer', flexShrink: 0 }}
                title="Remove driver"
                aria-label="Remove driver"
              >
                <Trash2 size={13} strokeWidth={2.5} />
              </button>
            )}
          </div>
        ))}
        <button type="button"
          onClick={() => setEdits(p => ({ ...p, driverCodes: [...p.driverCodes, ''] }))}
          className="inline-flex items-center gap-1.5 rounded-full font-bold"
          style={{ marginTop: 2, padding: '5px 12px', backgroundColor: S.primaryContainer, color: S.onPrimaryContainer, border: 'none', cursor: 'pointer', fontSize: 11, fontFamily: HEADLINE_FONT }}
        >
          <Plus size={12} strokeWidth={2.5} /> Add driver
        </button>
      </div>

      <div>
        <label htmlFor={`${id}-analysis`} style={labelStyle}>Strategist Read (authored analysis)</label>
        <textarea
          id={`${id}-analysis`}
          value={edits.analysis}
          onChange={e => setEdits(p => ({ ...p, analysis: e.target.value }))}
          rows={7}
          placeholder="**1. Summary.** …  **2. Strategic Evaluation.** …"
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
        />
        <p style={{ fontSize: 10, color: S.mutedText, margin: '4px 0 0', fontStyle: 'italic' }}>
          Supports **bold** and blank-line paragraph breaks. Saving stamps this tile {currentMonth()}.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button"
          onClick={() => onSave({ ...edits, driverCodes: edits.driverCodes.filter(Boolean) })}
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-full text-sm font-bold"
          style={{ backgroundColor: S.primary, color: S.onPrimary, border: 'none', cursor: 'pointer', fontFamily: HEADLINE_FONT }}
        >
          <Check size={13} strokeWidth={2.5} /> Apply
        </button>
        <button type="button"
          onClick={onCancel}
          className="flex-1 py-2 rounded-full text-sm font-bold"
          style={{ backgroundColor: S.surfaceLow, color: S.onSurfaceVariant, border: 'none', cursor: 'pointer', fontFamily: HEADLINE_FONT }}
        >
          Cancel
        </button>
        <button type="button"
          onClick={onRemove}
          className="px-3 py-2 rounded-full"
          style={{ backgroundColor: S.errorContainer, color: S.onErrorContainer, border: 'none', cursor: 'pointer' }}
          title="Remove this tile"
          aria-label="Remove this tile"
        >
          <Trash2 size={14} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
};
