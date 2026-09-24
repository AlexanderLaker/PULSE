/**
 * Settings, opened from the gear in the top nav: a rail of sections on the
 * left, the chosen section on the right.
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

import { useRef, useState, type CSSProperties, type FC } from 'react';
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

const RAIL_HEADING: CSSProperties = {
  padding: '4px 10px 6px',
  fontFamily: HEADLINE_FONT, fontSize: 11, fontWeight: 800,
  letterSpacing: '0.12em', textTransform: 'uppercase',
  color: S.onSurfaceVariant,
  display: 'flex', alignItems: 'center', gap: 6,
};

const RailButton: FC<{ section: SectionDef; active: boolean; onSelect: () => void }> = ({ section, active, onSelect }) => {
  const Icon = section.icon;
  return (
    <button type="button"
      onClick={onSelect}
      aria-current={active ? 'page' : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 12px', borderRadius: 10,
        backgroundColor: active ? S.primaryContainer : 'transparent',
        color: active ? S.onPrimaryContainer : S.onSurface,
        border: 'none', cursor: 'pointer',
        textAlign: 'left',
        fontFamily: BODY_FONT,
        fontSize: 13, fontWeight: active ? 600 : 500,
        transition: 'background-color 0.15s',
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = S.surfaceLow; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = 'transparent'; }}
    >
      <Icon size={15} strokeWidth={2.25} />
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
            style={{
              position: 'fixed',
              inset: '3vh 3vw',
              zIndex: 101,
              backgroundColor: S.bg,
              borderRadius: 18,
              boxShadow: SHADOW.dialog,
              overflow: 'hidden',
              display: 'grid',
              gridTemplateColumns: '260px 1fr',
              // The explicit row size keeps both panes inside the dialog: an
              // implicit row would grow with its content, the dialog would clip
              // it and <main> would never scroll.
              gridTemplateRows: 'minmax(0, 1fr)',
              fontFamily: BODY_FONT,
            }}
          >
            <aside style={{
              backgroundColor: S.surface,
              borderRight: `1px solid ${S.cardBorder}`,
              display: 'flex', flexDirection: 'column',
              padding: '24px 16px',
              overflow: 'auto',
            }}>
              <div style={{
                padding: '0 10px 16px',
                fontFamily: HEADLINE_FONT,
                fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em',
                color: S.onBg,
              }}>
                Settings
              </div>

              {groups.map((group) => (
                <div key={group.id} style={{ marginBottom: 16 }}>
                  <div style={RAIL_HEADING}>
                    {group.adminOnly && <ShieldCheck size={11} />}
                    {group.label}
                  </div>
                  <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {visible.filter((s) => s.group === group.id).map((section) => (
                      <RailButton
                        key={section.id}
                        section={section}
                        active={section.id === active.id}
                        onSelect={() => setChosen(section.id)}
                      />
                    ))}
                  </nav>
                </div>
              ))}

              <div style={{ marginTop: 'auto', paddingTop: 20, borderTop: `1px solid ${S.cardBorder}` }}>
                {isLoaded && user && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px' }}>
                    <div style={{
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
                      <div style={{ fontSize: 11, color: S.mutedText }}>{role}</div>
                    </div>
                  </div>
                )}
              </div>
            </aside>

            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
              <header style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '20px 28px', borderBottom: `1px solid ${S.cardBorder}`,
                backgroundColor: S.surface,
              }}>
                <div>
                  <div style={{
                    fontFamily: HEADLINE_FONT,
                    fontSize: 18, fontWeight: 800, color: S.onBg,
                    letterSpacing: '-0.01em',
                  }}>
                    {active.label}
                  </div>
                  <div style={{ fontSize: 12, color: S.mutedText, marginTop: 2 }}>{active.subtitle}</div>
                </div>
                <button type="button"
                  onClick={onClose}
                  aria-label="Close settings"
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
                  <X size={18} />
                </button>
              </header>

              <main style={{
                flex: 1, minHeight: 0, overflow: 'auto',
                padding: '24px 28px 32px',
                backgroundColor: S.bg,
              }}>
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
