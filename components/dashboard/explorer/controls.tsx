/**
 * The Explorer's navigation: Laundry & Home Care or Hair, and the view within it.
 */
import type { FC } from 'react';
import { groupDisplay } from '@/lib/format';
import type { PoolViewKind, PoolGroup } from '@/lib/profitPoolData';
import { S, HEADLINE_FONT } from '@/lib/theme';

const GROUPS: { id: PoolGroup; label: string }[] = [
  { id: 'LHC', label: groupDisplay('LHC') },
  { id: 'Hair', label: 'Hair' },
];

export const KINDS: { id: PoolViewKind; label: string }[] = [
  { id: 'ValueChain', label: 'Value Chain' },
  { id: 'Categories', label: 'Categories' },
  { id: 'CoreAdjacent', label: 'Core + Adjacent' },
];

export const GroupToggle: FC<{ group: PoolGroup; onSelect: (g: PoolGroup) => void }> = ({ group, onSelect }) => (
  <div
    role="tablist"
    aria-label="Category"
    style={{
      display: 'inline-flex', gap: 4, padding: 4,
      background: S.surfaceLow, borderRadius: 12,
      border: `1px solid ${S.cardBorder}`,
    }}
  >
    {GROUPS.map(g => {
      const active = g.id === group;
      return (
        <button type="button"
          key={g.id}
          role="tab"
          aria-selected={active}
          onClick={() => onSelect(g.id)}
          style={{
            padding: '9px 22px', borderRadius: 9, border: 'none',
            background: active ? S.primary : 'transparent',
            color: active ? S.onPrimary : S.onBg,
            fontFamily: HEADLINE_FONT, fontWeight: 800, fontSize: 13,
            cursor: 'pointer', transition: 'all 0.15s', letterSpacing: -0.2,
          }}
        >
          {g.label}
        </button>
      );
    })}
  </div>
);

export const KindPills: FC<{ kind: PoolViewKind; onSelect: (k: PoolViewKind) => void }> = ({ kind, onSelect }) => (
  <div role="tablist" aria-label="View" style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
    {KINDS.map(k => {
      const active = k.id === kind;
      return (
        <button type="button"
          key={k.id}
          role="tab"
          aria-selected={active}
          onClick={() => onSelect(k.id)}
          style={{
            padding: '7px 14px', borderRadius: 999,
            border: `1px solid ${active ? S.primary : S.cardBorder}`,
            background: active ? S.primarySoft : S.surface,
            color: active ? S.primary : S.onSurfaceVariant,
            fontFamily: HEADLINE_FONT, fontWeight: 700, fontSize: 12,
            cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          {k.label}
        </button>
      );
    })}
  </div>
);
