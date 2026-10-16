'use client';

/**
 * "the PRISM team", as a link to the feedback address when one is configured
 * (lib/feedback.ts) and as plain words when none is, so the Welcome, the error
 * states and the waiting page never show a link that leads nowhere.
 */
import type { CSSProperties, FC, ReactNode } from 'react';
import { FEEDBACK_URL } from '@/lib/feedback';
import { S } from '@/lib/theme';

const FeedbackLink: FC<{ children?: ReactNode; style?: CSSProperties }> = ({ children = 'the PRISM team', style }) => {
  if (!FEEDBACK_URL) return <span style={style}>{children}</span>;
  const external = !FEEDBACK_URL.startsWith('mailto:');
  return (
    <a
      href={FEEDBACK_URL}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      style={{ color: S.primary, fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 3, ...style }}
    >
      {children}
      {external && <span className="sr-only"> (opens in a new tab)</span>}
    </a>
  );
};

export default FeedbackLink;
