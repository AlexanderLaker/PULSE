/**
 * The glossary behind the Drivers page's helper line: how a driver's names
 * work (docs/DRIVERS.md, Names), the words that mean the same thing in every
 * short name, and EU against European.
 */
import { useRef, type FC } from 'react';
import useOverlay from '@/hooks/useOverlay';
import usePrism from '@/hooks/usePrism';
import { namesForCode } from '@/lib/driverNames';
import { S, SHADOW, HEADLINE_FONT, BODY_FONT, FIGURES } from '@/lib/theme';

/** The family words of the short names: each means the same thing in every short name it appears in. */
export const NAME_WORDS: Array<{ words: string; meaning: string }> = [
  { words: 'Demand', meaning: 'more buying of something' },
  { words: 'Premium', meaning: 'shoppers pay more per unit for it' },
  { words: 'Adoption', meaning: 'more households take it up' },
  { words: 'Share Gain', meaning: 'someone else takes share from HCB' },
  { words: 'Uplift', meaning: 'more sales through a new channel, counted in the base case' },
  { words: 'Upside', meaning: 'a gain only partly under way; the rest needs a threshold such as cost parity' },
  { words: 'Loss', meaning: 'HCB loses something' },
  { words: 'Decline', meaning: 'fewer units sold' },
  { words: 'Squeeze', meaning: 'something compresses what shoppers spend or what brands can charge' },
  { words: 'Costs, Fee, Fees, Ban, Bans, Rules', meaning: 'a cost burden from an input, a rule or a channel' },
  { words: 'Pressure, Power, Push', meaning: 'retailers push prices down or push their own label' },
  { words: 'Growth', meaning: 'the High Growth region (C-36, C-37) or population movement (C-18, C-34)' },
];

const heading = {
  fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 13, color: S.onBg, margin: '18px 0 6px',
} as const;
const body = { fontSize: 13, lineHeight: 1.6, color: S.onSurfaceVariant, margin: 0 } as const;

export const NamesGlossary: FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  // The shared overlay behaviour: Escape, focus trap, initial focus, focus
  // return, scroll lock.
  useOverlay(open, onClose, ref);
  // The examples name drivers by their code and, once the drivers have loaded,
  // their short name: no name ships in the dashboard's code.
  const { drivers } = usePrism();
  const example = (code: string) => {
    const shortName = namesForCode(code, drivers)?.shortName;
    return shortName ? `${code} ${shortName}` : code;
  };
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1120,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, background: S.scrim,
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="names-glossary-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 600, width: '100%', maxHeight: '88vh', overflowY: 'auto',
          background: S.surface, borderRadius: 16, boxShadow: SHADOW.dialog, padding: 24,
          fontFamily: BODY_FONT, color: S.onSurface,
        }}
      >
        <h2
          id="names-glossary-title"
          style={{ fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 20, color: S.onBg, margin: '0 0 8px', letterSpacing: -0.2 }}
        >
          How the driver names work
        </h2>
        <p style={body}>
          Every driver has a short name, the one to quote, and under it a long name that says who or what acts and
          what changes. Opening a driver shows its descriptor, one sentence on what it covers, and its technical
          scope, the precise title it was reviewed under. Drivers that are easily confused carry a sentence naming the
          effects other drivers count.
        </p>

        <h3 style={heading}>Codes</h3>
        <p style={body}>
          A code such as <span style={{ ...FIGURES, fontWeight: 700, color: S.onSurface }}>C-01</span> is the force letter
          and the driver&rsquo;s number: C Consumer, K Customer, T Technology, G Government, E Environmental,
          X Competitive. Search for a code to open that driver.
        </p>

        <h3 style={heading}>Words that mean the same in every name</h3>
        <table aria-label="Words that mean the same in every name" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead className="sr-only">
            <tr><th scope="col">Word</th><th scope="col">What it means</th></tr>
          </thead>
          <tbody>
            {NAME_WORDS.map((w) => (
              <tr key={w.words}>
                <th scope="row" style={{ textAlign: 'left', verticalAlign: 'top', padding: '3px 16px 3px 0', width: '31%',
                  fontFamily: HEADLINE_FONT, fontWeight: 700, fontSize: 12.5, color: S.onSurface }}>{w.words}</th>
                <td style={{ padding: '3px 0', fontSize: 12.5, lineHeight: 1.5, color: S.onSurfaceVariant }}>{w.meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 style={heading}>EU and European</h3>
        <p style={body}>
          EU marks EU law or a price the EU sets, as in {example('E-03')}. European marks a market fact across
          Europe, as in {example('E-07')}.
        </p>

        <h3 style={heading}>Direction</h3>
        <p style={body}>
          A name reads in the driver&rsquo;s direction; the Direction column says whether it expands or contracts the
          profit pool.
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <button type="button"
            onClick={onClose}
            style={{
              padding: '9px 18px', borderRadius: 999, border: 'none',
              background: S.surfaceLow, color: S.primary,
              fontFamily: HEADLINE_FONT, fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
