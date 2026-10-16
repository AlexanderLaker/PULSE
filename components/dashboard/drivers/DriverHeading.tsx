/**
 * The head of an opened driver, the same in all three modes: the descriptor
 * (what the driver covers), the boundary sentence of a driver readers confuse
 * with a neighbour, each cited code a link to that driver, and the technical
 * scope, the precise title the driver was reviewed under (docs/DRIVERS.md,
 * Names).
 */
import type { FC } from 'react';
import usePrism from '@/hooks/usePrism';
import { boundaryParts, driverNames, namesForCode, type NamedDriver } from '@/lib/driverNames';
import { S, HEADLINE_FONT } from '@/lib/theme';

/** The label of the technical scope while readers still know the driver by it. */
export const TECHNICAL_SCOPE_LABEL = 'Technical scope (the name until now)';

export const DriverHeading: FC<{
  driver: NamedDriver;
  /** Opens another driver on the Drivers page; without it the cited codes are plain text. */
  onOpenCode?: (code: string) => void;
}> = ({ driver, onOpenCode }) => {
  const names = driverNames(driver);
  // A cited code is labelled with its driver's short name, from the loaded drivers.
  const { drivers } = usePrism();
  return (
    <div style={{ marginBottom: 20, maxWidth: '64rem' }}>
      {names.descriptor && (
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, fontWeight: 500, color: S.onSurface }}>
          {names.descriptor}
        </p>
      )}
      {names.boundary && (
        <p style={{ margin: '4px 0 0', fontSize: 13, lineHeight: 1.55, color: S.onSurface }}>
          {boundaryParts(names.boundary).map((part, i) => {
            if (part.kind === 'text') return <span key={i}>{part.text}</span>;
            const label = `${part.code} ${namesForCode(part.code, drivers)?.shortName ?? ''}`.trim();
            return onOpenCode ? (
              <button key={i} type="button"
                onClick={(e) => { e.stopPropagation(); onOpenCode(part.code); }}
                style={{
                  display: 'inline', padding: 0, border: 'none', background: 'none', cursor: 'pointer',
                  fontFamily: HEADLINE_FONT, fontSize: 13, fontWeight: 700, color: S.primary,
                  textDecoration: 'underline', textUnderlineOffset: 2,
                }}
              >
                {label}
              </button>
            ) : <strong key={i} style={{ fontFamily: HEADLINE_FONT }}>{label}</strong>;
          })}
        </p>
      )}
      <p style={{ margin: '4px 0 0', fontSize: 12.5, lineHeight: 1.5, color: S.mutedText }}>
        {TECHNICAL_SCOPE_LABEL}: {names.technicalScope}
      </p>
    </div>
  );
};
