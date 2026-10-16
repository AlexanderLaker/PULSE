/**
 * The why-chain of a tile, as numbered steps: the drivers behind the moment,
 * each linked to the Drivers page, then the net effect with the profit-pool
 * impact. It shows the reasoning behind the authored classification without
 * claiming that the classification is simulated: the drivers are real, the
 * read is judgment.
 */
import type { CSSProperties, FC } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { JourneyTile } from '@/data/consumerJourney';
import type { Driver } from '@/types';
import { S, SHADOW, HEADLINE_FONT } from '@/lib/theme';
import { citedDrivers, type Side } from './shared';
import { DriverForceCard } from './tiles';

/** The numbered dot of a step. */
const StepDot: FC<{ n: number }> = ({ n }) => (
  <span style={{
    position: 'absolute', left: 0, top: 0, width: 24, height: 24, borderRadius: 999,
    backgroundColor: S.primary, color: S.onPrimary, fontFamily: HEADLINE_FONT, fontWeight: 800,
    fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1,
  }}>{n}</span>
);

export const WhyChain: FC<{
  tile: JourneyTile;
  side: Side;
  driversById: Map<string, Driver>;
  driversLoaded: boolean;
  onNavigateToDriver?: (query: string) => void;
}> = ({ tile, side, driversById, driversLoaded, onNavigateToDriver }) => {
  const isExp = side === 'benefiting';
  const accent = isExp ? S.expansion : S.error;

  // The net effect counts each cited driver by its own direction, independent
  // of the tile's side. The direction is the live driver's, so the counts wait
  // for the drivers; the forces come with the code map and are known at once.
  const drivers = citedDrivers(tile, driversById);
  const live = drivers.filter(d => d.live);
  const up = live.filter(d => d.live?.direction === 'Expansion').length;
  const down = live.length - up;
  const directionsKnown = live.length === drivers.length;
  const forceCounts: Record<string, number> = {};
  drivers.forEach(d => {
    const force = d.live?.force ?? d.force;
    forceCounts[force] = (forceCounts[force] ?? 0) + 1;
  });
  const dominant = Object.entries(forceCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  const stepWrap: CSSProperties = { position: 'relative', paddingLeft: 38, paddingBottom: 18 };
  const connector: CSSProperties = {
    position: 'absolute', left: 11.5, top: 24, bottom: 0, width: 1.5,
    background: `linear-gradient(${S.outline}, ${S.outline}33)`,  // fades to 20% opacity
  };
  const stepLabel: CSSProperties = {
    fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase',
    color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT,
  };

  return (
    <div className="rounded-2xl p-4" style={{ backgroundColor: S.surface, boxShadow: SHADOW.card }}>
      <h3 style={{ fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: '1.05rem', letterSpacing: '-0.01em', margin: 0, color: S.onBg }}>
        {isExp ? 'Why this moment is expanding' : 'Why this moment is under pressure'}
      </h3>

      <div style={{ marginTop: 14 }}>
        {/* 1: the drivers behind this moment, each linked to the Drivers page */}
        <div style={stepWrap}>
          <StepDot n={1} /><span style={connector} />
          <div style={stepLabel}>Drivers behind this moment</div>
          <div style={{ marginTop: 8 }}>
            {drivers.length === 0 ? (
              <p style={{ fontSize: 12, color: S.mutedText, fontStyle: 'italic', margin: 0 }}>
                No modelled driver is linked to this moment. The Strategist Read below stands as authored
                judgment; nothing here feeds the Shift Matrix.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {drivers.map(d => (
                  <DriverForceCard
                    key={d.code} driver={d} driversLoaded={driversLoaded} onNavigateToDriver={onNavigateToDriver}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 2: net effect */}
        <div style={{ ...stepWrap, paddingBottom: 0 }}>
          <StepDot n={2} />
          <div style={stepLabel}>Net effect</div>
          <div className="rounded-xl" style={{ marginTop: 8, backgroundColor: S.surfaceContainer, padding: '12px 14px' }}>
            {/* A tile that cites no driver has its zero counts at once. */}
            {driversLoaded || drivers.length === 0 ? (
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="inline-flex items-center gap-1" style={{ fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 13, color: S.expansion }}>
                  <TrendingUp size={14} strokeWidth={2.5} /> {up} tailwind
                </span>
                <span className="inline-flex items-center gap-1" style={{ fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 13, color: S.error }}>
                  <TrendingDown size={14} strokeWidth={2.5} /> {down} headwind
                </span>
                {!directionsKnown && (
                  <span style={{ fontSize: 11, color: S.mutedText, fontStyle: 'italic' }}>
                    counting the drivers the service holds
                  </span>
                )}
              </div>
            ) : (
              <p style={{ fontSize: 12, color: S.mutedText, fontStyle: 'italic', margin: 0 }}>
                The tailwind and headwind count follows once the drivers have loaded.
              </p>
            )}
            <p style={{ fontSize: 12.5, color: S.onSurface, lineHeight: 1.5, margin: '9px 0 0' }}>
              {dominant ? <>Dominant force <strong style={{ fontFamily: HEADLINE_FONT }}>{dominant}</strong>. </> : null}
              The strategist classifies this moment as <strong style={{ fontFamily: HEADLINE_FONT, color: accent }}>{isExp ? 'a tailwind' : 'a headwind'}</strong>.
            </p>
            {tile.poolImpact && (
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: S.onSurfaceVariant, fontFamily: HEADLINE_FONT }}>
                  Profit-pool impact
                </span>
                <span className="inline-flex items-center gap-1 rounded-full" style={{ fontSize: 11, fontWeight: 800, padding: '1px 10px', color: S.onPrimary, backgroundColor: accent, fontFamily: HEADLINE_FONT }}>
                  {isExp ? '▲' : '▼'} {tile.poolImpact.grade}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
