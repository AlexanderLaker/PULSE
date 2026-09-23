/**
 * SectionCard: one boxed section of a panel or sheet. An icon and an
 * uppercase title head it, with optional help behind an info button and a
 * slot on the right; a description can follow the title and a footnote the
 * content. The Drivers panels use the compact size, the Settings sheet the
 * regular one.
 */
import { useState, type FC, type ReactNode } from 'react';
import { Info, type LucideIcon } from 'lucide-react';
import { S, HEADLINE_FONT } from '@/lib/theme';

interface SectionCardProps {
  title: string;
  icon: LucideIcon;
  /** The icon's colour. */
  accent?: string;
  /** A line under the title, before the content. */
  description?: ReactNode;
  /** A note under the content. */
  footnote?: ReactNode;
  /** Help text behind an info button next to the title: its tooltip, and
   *  shown under the title when the button is pressed (keyboard included). */
  info?: string;
  /** A slot at the right of the header (a live value, a status chip). */
  right?: ReactNode;
  size?: 'compact' | 'regular';
  children: ReactNode;
}

const SIZES = {
  compact: {
    radius: 12, padding: '14px 16px 16px', gap: 8, headerGap: 10,
    iconBox: 26, iconRadius: 8, icon: 14, titleSize: 12, tracking: '0.1em', accent: S.onSurfaceVariant,
  },
  regular: {
    radius: 14, padding: '18px 20px 20px', gap: 10, headerGap: 6,
    iconBox: 30, iconRadius: 9, icon: 16, titleSize: 13, tracking: '0.08em', accent: S.primary,
  },
} as const;

const SectionCard: FC<SectionCardProps> = ({
  title, icon: Icon, accent, description, footnote, info, right, size = 'compact', children,
}) => {
  const z = SIZES[size];
  const [showInfo, setShowInfo] = useState(false);
  return (
    <div role="group" aria-label={title} style={{
      backgroundColor: S.surface,
      border: `1px solid ${S.cardBorder}`,
      borderRadius: z.radius,
      padding: z.padding,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: z.gap, marginBottom: z.headerGap }}>
        <span style={{
          width: z.iconBox, height: z.iconBox, borderRadius: z.iconRadius,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: S.surfaceLow,
          color: accent ?? z.accent,
        }}>
          <Icon size={z.icon} strokeWidth={2.25} />
        </span>
        <div style={{
          fontFamily: HEADLINE_FONT,
          fontSize: z.titleSize, fontWeight: 800, letterSpacing: z.tracking,
          textTransform: 'uppercase',
          color: S.onSurface,
        }}>
          {title}
        </div>
        {info && (
          <button type="button" title={info} aria-label={`About ${title}`} aria-expanded={showInfo}
            onClick={() => setShowInfo((v) => !v)}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              marginLeft: 1, padding: 2, border: 'none', borderRadius: 999, background: 'none',
              color: S.onSurfaceVariant, cursor: 'help',
            }}>
            <Info size={12} strokeWidth={2.4} />
          </button>
        )}
        {right != null && <span style={{ marginLeft: 'auto', flexShrink: 0 }}>{right}</span>}
      </div>
      {info && showInfo && (
        <div style={{ marginBottom: 12, fontSize: 12, lineHeight: 1.55, color: S.onSurfaceVariant }}>
          {info}
        </div>
      )}
      {description && (
        <div style={{ marginBottom: 14, fontSize: 12.5, lineHeight: 1.55, color: S.mutedText }}>
          {description}
        </div>
      )}
      {children}
      {footnote && (
        <div style={{ marginTop: 10, fontSize: 11, lineHeight: 1.5, color: S.mutedText }}>
          {footnote}
        </div>
      )}
    </div>
  );
};

export default SectionCard;
