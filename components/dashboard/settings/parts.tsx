/**
 * The Settings sheet's building blocks: status lines and banners, labelled
 * fields, the input and button styles, the role pill, and the table cells
 * the model tables share.
 */
import type { CSSProperties, FC, ReactNode } from 'react';
import { ShieldCheck, Check, AlertCircle, Info } from 'lucide-react';
import { S, HEADLINE_FONT, BODY_FONT, MONO_FONT } from '@/lib/theme';
import type { Role } from '@/types';

export type Status = { kind: 'success' | 'error' | 'info'; message: string };

/** The message of a failed call, or a fallback line. */
export const errorText = (err: unknown, fallback: string): string =>
  err instanceof Error && err.message ? err.message : fallback;

export const Muted: FC<{ children: ReactNode }> = ({ children }) => (
  <div style={{ color: S.mutedText, fontSize: 13 }}>{children}</div>
);

export const RolePill: FC<{ role: Role }> = ({ role }) => {
  const isAdmin = role === 'admin';
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase"
      style={{
        backgroundColor: isAdmin ? S.primaryContainer : S.secondaryContainer,
        color: isAdmin ? S.onPrimaryContainer : S.onSecondaryContainer,
      }}
    >
      {isAdmin && <ShieldCheck size={11} strokeWidth={2.5} />}
      {role}
    </span>
  );
};

export const LABEL_STYLE: CSSProperties = {
  fontFamily: HEADLINE_FONT,
  fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: S.onSurfaceVariant,
};

/** A form control with its label; the <label> wraps the control. */
export const Field: FC<{ label: string; hint?: string; children: ReactNode }> = ({ label, hint, children }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <span style={LABEL_STYLE}>{label}</span>
    {children}
    {hint && <span style={{ fontSize: 11, color: S.mutedText }}>{hint}</span>}
  </label>
);

/** A labelled value, table or note that is not a form control. */
export const SubBlock: FC<{ label: string; hint?: string; children: ReactNode }> = ({ label, hint, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <span style={LABEL_STYLE}>{label}</span>
    {children}
    {hint && <span style={{ fontSize: 11, lineHeight: 1.55, color: S.mutedText }}>{hint}</span>}
  </div>
);

export const INPUT_STYLE: CSSProperties = {
  fontFamily: BODY_FONT,
  fontSize: 13.5,
  color: S.onSurface,
  backgroundColor: S.surfaceLow,
  border: `1px solid ${S.cardBorder}`,
  borderRadius: 10,
  padding: '9px 12px',
  // No outline override: the focus indicator comes from globals.css (the
  // input:focus ring, and :focus-visible for every control, <select> included).
  transition: 'border-color 0.15s, background-color 0.15s',
};

/** A value shown in a field's frame, not editable. */
export const VALUE_STYLE: CSSProperties = {
  ...INPUT_STYLE,
  backgroundColor: S.surfaceContainer,
  color: S.mutedText,
};

export const READONLY_INPUT_STYLE: CSSProperties = { ...VALUE_STYLE, cursor: 'not-allowed' };

const BUTTON: CSSProperties = {
  fontFamily: HEADLINE_FONT,
  fontSize: 12.5,
  fontWeight: 700,
  letterSpacing: '0.02em',
  border: 'none',
  borderRadius: 999,
  padding: '9px 18px',
  cursor: 'pointer',
  transition: 'background-color 0.15s, opacity 0.15s',
};
export const PRIMARY_BUTTON: CSSProperties = { ...BUTTON, color: S.onPrimary, backgroundColor: S.primary };
export const DESTRUCTIVE_BUTTON: CSSProperties = { ...BUTTON, color: S.error, backgroundColor: S.errorContainer };

export const StatusBanner: FC<{ kind: Status['kind']; children: ReactNode }> = ({ kind, children }) => {
  const { bg, fg, Icon } = kind === 'success'
    ? { bg: S.successContainer, fg: S.success, Icon: Check }
    : kind === 'error'
      ? { bg: S.errorContainer, fg: S.onErrorContainer, Icon: AlertCircle }
      : { bg: S.surfaceLow, fg: S.primary, Icon: Info };
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px', borderRadius: 10,
      backgroundColor: bg, color: fg,
      fontSize: 12.5, fontWeight: 500,
    }}>
      <Icon size={14} strokeWidth={2.25} />
      <span>{children}</span>
    </div>
  );
};

export const CELL_TH: CSSProperties = {
  fontFamily: HEADLINE_FONT, fontSize: 10.5, fontWeight: 800,
  letterSpacing: '0.06em', textTransform: 'uppercase',
  color: S.onSurfaceVariant, backgroundColor: S.surfaceContainer,
  padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap',
};
export const CELL_LABEL: CSSProperties = {
  ...CELL_TH,
  textAlign: 'left', backgroundColor: S.surfaceLow,
  position: 'sticky', left: 0, zIndex: 1,
};
export const ROW_LABEL: CSSProperties = {
  ...CELL_LABEL, borderTop: `1px solid ${S.cardBorder}`,
  textTransform: 'none', letterSpacing: 0, fontSize: 11.5,
};
export const CELL_NUM: CSSProperties = {
  fontFamily: MONO_FONT, fontSize: 12, color: S.onSurface,
  padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap',
  fontVariantNumeric: 'tabular-nums',
  borderTop: `1px solid ${S.cardBorder}`,
};
export const CELL_SUM: CSSProperties = { ...CELL_NUM, fontWeight: 700, color: S.onSurfaceVariant };

/** Scrolls a wide table sideways instead of clipping it. */
export const TableScroller: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <div
    role="region"
    aria-label={label}
    tabIndex={0}
    style={{
      overflowX: 'auto',
      border: `1px solid ${S.cardBorder}`,
      borderRadius: 10,
      backgroundColor: S.surface,
    }}
  >
    <table style={{ borderCollapse: 'collapse', width: '100%' }}>{children}</table>
  </div>
);
