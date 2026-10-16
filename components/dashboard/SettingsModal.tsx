/**
 * Settings, opened from the gear in the top nav: a rail of sections on the
 * left, the chosen section on the right. Below md the dialog fills the
 * screen and the rail becomes one row of pills, scrolling sideways, above the
 * section.
 *
 *   Account (everyone): profile, password and active sessions. Identity lives
 *     in Clerk, so these sections talk to Clerk directly.
 *   Model (everyone): the model configuration, read-only. The parameters are
 *     the code's (the store's config); the cell weights are the ones the
 *     served run used.
 *   Administration (admins): user management, through the dashboard's
 *     /api/users routes.
 *
 * The page resolves the role once and passes it in as `isAdmin`. The sections
 * and their building blocks live in settings/.
 */

'use client';

import { Fragment, useRef, useState, type CSSProperties, type FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, KeyRound, Monitor, SlidersHorizontal, UsersIcon, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useUser } from '@clerk/nextjs';
import useOverlay from '@/hooks/useOverlay';
import { S, SHADOW, HEADLINE_FONT, BODY_FONT } from '@/lib/theme';
import type { Role } from '@/types';
import { PasswordSection, ProfileSection, SessionsSection } from './settings/AccountSections';
import { ModelSection } from './settings/ModelSection';
import { UsersSection } from './settings/UsersSection';
import { accessLabel } from './settings/parts';

// ─── Sections ───────────────────────────────────────────────────────

type SectionId = 'profile' | 'password' | 'sessions' | 'model' | 'users';
type GroupId = 'account' | 'model' | 'admin';

interface SectionDef {
  id: SectionId;
  label: string;
  subtitle: string;
  icon: LucideIcon;
  group: GroupId;
}

const SECTIONS: SectionDef[] = [
  { id: 'profile',  label: 'Profile',             subtitle: 'Your identity and display name',                icon: User,              group: 'account' },
  { id: 'password', label: 'Password',            subtitle: 'Change your password',                          icon: KeyRound,          group: 'account' },
  { id: 'sessions', label: 'Active sessions',     subtitle: 'Devices and browsers with an active session',   icon: Monitor,           group: 'account' },
  { id: 'model',    label: 'Model configuration', subtitle: "The model's parameters and the served run's cell weights", icon: SlidersHorizontal, group: 'model' },
  { id: 'users',    label: 'User management',     subtitle: 'Team access and roles',                         icon: UsersIcon,         group: 'admin' },
];

const GROUPS: Array<{ id: GroupId; label: string; adminOnly?: boolean }> = [
  { id: 'account', label: 'Account' },
  { id: 'model', label: 'Model' },
  { id: 'admin', label: 'Administration', adminOnly: true },
];

// ═══════════════════════════════════════════════════════════════════
// The dialog
// ═══════════════════════════════════════════════════════════════════

// Shown from md up only: on a phone the pills stand alone in one row.
const RAIL_HEADING: CSSProperties = {
  padding: '4px 10px 6px',
  fontFamily: HEADLINE_FONT, fontSize: 11, fontWeight: 800,
  letterSpacing: '0.12em', textTransform: 'uppercase',
  color: S.onSurfaceVariant,
  alignItems: 'center', gap: 6,
};

/** A section in the rail: a row with its icon from md up, a pill in the row of pills on a phone. */
const RailButton: FC<{ section: SectionDef; active: boolean; onSelect: () => void }> = ({ section, active, onSelect }) => {
  const Icon = section.icon;
  return (
    <button type="button"
      onClick={onSelect}
      aria-current={active ? 'page' : undefined}
      // A pill with a fill on a phone, a plain row from md up; the active one
      // takes its fill inline, which wins over the classes.
      className={'shrink-0 whitespace-nowrap md:whitespace-normal rounded-full md:rounded-[10px] px-3.5 py-[7px] md:px-3 md:py-[9px] text-left '
        + 'transition-colors bg-theme-surface-low md:bg-transparent hover:bg-theme-surface-high md:hover:bg-theme-surface-low'}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        backgroundColor: active ? S.primaryContainer : undefined,
        color: active ? S.onPrimaryContainer : S.onSurface,
        border: 'none', cursor: 'pointer',
        fontFamily: BODY_FONT,
        fontSize: 13, fontWeight: active ? 600 : 500,
      }}
    >
      <Icon size={15} strokeWidth={2.25} aria-hidden />
      {section.label}
    </button>
  );
};

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
}

const SettingsModal: FC<SettingsModalProps> = ({ open, onClose, isAdmin }) => {
  const { user, isLoaded } = useUser();
  const [chosen, setChosen] = useState<SectionId>('profile');
  const modalRef = useRef<HTMLDivElement | null>(null);
  useOverlay(open, onClose, modalRef);

  const role: Role = isAdmin ? 'admin' : 'viewer';
  const groups = GROUPS.filter((g) => !g.adminOnly || isAdmin);
  const visible = SECTIONS.filter((s) => groups.some((g) => g.id === s.group));
  // A chosen section the role now hides gives way to the first visible one.
  const active = visible.find((s) => s.id === chosen) ?? visible[0];

  const renderSection = () => {
    switch (active.id) {
      case 'profile':  return <ProfileSection role={role} />;
      case 'password': return <PasswordSection />;
      case 'sessions': return <SessionsSection />;
      case 'model':    return <ModelSection />;
      case 'users':    return <UsersSection currentUserId={user?.id ?? null} />;
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0, zIndex: 100,
              backgroundColor: S.scrim,
              backdropFilter: 'blur(4px)',
            }}
          />
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
            tabIndex={-1}
            // Full screen below md; from md up a sheet with the rail beside the
            // section. The explicit row size keeps both panes inside the dialog:
            // an implicit row would grow with its content, the dialog would clip
            // it and <main> would never scroll.
            className="inset-0 md:inset-[3vh_3vw] rounded-none md:rounded-[18px] grid-cols-1 grid-rows-[auto_minmax(0,1fr)] md:grid-cols-[260px_1fr] md:grid-rows-[minmax(0,1fr)]"
            style={{
              position: 'fixed',
              zIndex: 101,
              backgroundColor: S.bg,
              boxShadow: SHADOW.dialog,
              overflow: 'hidden',
              display: 'grid',
              fontFamily: BODY_FONT,
            }}
          >
            <aside
              className="flex flex-col border-b md:border-b-0 md:border-r md:overflow-auto md:px-4 md:py-6"
              style={{ backgroundColor: S.surface, borderColor: S.cardBorder }}
            >
              <div className="px-4 pt-3.5 pb-2 pr-16 md:px-[10px] md:pt-0 md:pb-4">
                <div
                  className="text-[20px] md:text-[22px]"
                  style={{ fontFamily: HEADLINE_FONT, fontWeight: 800, letterSpacing: '-0.02em', color: S.onBg }}
                >
                  Settings
                </div>
              </div>

              <nav
                aria-label="Settings sections"
                // The row's padding leaves room for a pill's focus ring inside the scroller.
                className="flex flex-row md:flex-col gap-1.5 md:gap-0 overflow-x-auto md:overflow-visible px-4 pt-1 pb-3 md:px-0 md:pt-0 md:pb-0"
              >
                {groups.map((group) => (
                  <Fragment key={group.id}>
                    <div className="hidden md:flex" style={RAIL_HEADING}>
                      {group.adminOnly && <ShieldCheck size={11} aria-hidden />}
                      {group.label}
                    </div>
                    <div className="contents md:flex md:flex-col md:gap-0.5 md:mb-4">
                      {visible.filter((s) => s.group === group.id).map((section) => (
                        <RailButton
                          key={section.id}
                          section={section}
                          active={section.id === active.id}
                          onSelect={() => setChosen(section.id)}
                        />
                      ))}
                    </div>
                  </Fragment>
                ))}
              </nav>

              <div className="hidden md:block" style={{ marginTop: 'auto', paddingTop: 20, borderTop: `1px solid ${S.cardBorder}` }}>
                {isLoaded && user && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px' }}>
                    <div aria-hidden style={{
                      width: 32, height: 32, borderRadius: 16,
                      backgroundColor: S.primaryContainer,
                      color: S.onPrimaryContainer,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: HEADLINE_FONT, fontSize: 12, fontWeight: 800,
                    }}>
                      {(user.primaryEmailAddress?.emailAddress?.[0] ?? '?').toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{
                        fontSize: 12, fontWeight: 600, color: S.onSurface,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {user.primaryEmailAddress?.emailAddress ?? 'Signed in'}
                      </div>
                      <div style={{ fontSize: 11, color: S.mutedText }}>{accessLabel(role)}</div>
                    </div>
                  </div>
                )}
              </div>
            </aside>

            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
              <header
                className="px-4 py-3.5 md:px-7 md:py-5 md:pr-20"
                style={{ borderBottom: `1px solid ${S.cardBorder}`, backgroundColor: S.surface }}
              >
                <h2 style={{
                  fontFamily: HEADLINE_FONT,
                  fontSize: 18, fontWeight: 800, color: S.onBg,
                  letterSpacing: '-0.01em', margin: 0,
                }}>
                  {active.label}
                </h2>
                <div style={{ fontSize: 12, color: S.mutedText, marginTop: 2 }}>{active.subtitle}</div>
                {/* Top right of the dialog in both layouts: beside the Settings
                    title on a phone, in this header from md up. */}
                <button type="button"
                  onClick={onClose}
                  aria-label="Close settings"
                  className="absolute top-3 right-3 md:top-[22px] md:right-7"
                  style={{
                    width: 34, height: 34, borderRadius: 10,
                    border: 'none', backgroundColor: S.surfaceLow,
                    color: S.onSurfaceVariant, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background-color 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = S.surfaceHigh; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = S.surfaceLow; }}
                >
                  <X size={18} aria-hidden />
                </button>
              </header>

              <main
                className="px-4 pt-5 pb-8 md:px-7 md:pt-6"
                style={{ flex: 1, minHeight: 0, overflow: 'auto', backgroundColor: S.bg }}
              >
                {renderSection()}
              </main>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default SettingsModal;
