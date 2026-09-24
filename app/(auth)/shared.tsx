/**
 * What the sign-in and sign-up pages share inside the card of
 * app/(auth)/layout.tsx: the card's heading and the appearance that seats
 * Clerk's form in it.
 */
import type { ReactNode } from 'react';
import { S, HEADLINE_FONT } from '@/lib/theme';

/** Clerk's form inside the card: full width, without its own frame, header,
 *  logo, page links or badge, which the card and its heading replace. */
export const EMBEDDED_FORM = {
  elements: {
    rootBox: 'w-full',
    cardBox: 'shadow-none bg-transparent border-none p-0 w-full',
    card: 'shadow-none bg-transparent border-none p-0 w-full',
    main: 'gap-4',
    header: 'hidden',
    logoBox: 'hidden',
    footerPages: 'hidden',
    badge: 'hidden',
  },
};

/** The card's heading: a small label over the page's title, and a line of text where one is given. */
export function CardHeading({ label, title, children }: { label: string; title: string; children?: ReactNode }) {
  return (
    <div className="text-center mb-8">
      <div className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: S.onSurfaceVariant }}>
        {label}
      </div>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight" style={{ color: S.onSurface, fontFamily: HEADLINE_FONT }}>
        {title}
      </h1>
      {children && (
        <p className="mt-3 text-sm leading-relaxed" style={{ color: S.onSurfaceVariant }}>
          {children}
        </p>
      )}
    </div>
  );
}
