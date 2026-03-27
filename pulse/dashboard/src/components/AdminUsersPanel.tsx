/**
 * AdminUsersPanel — Professional user management panel.
 * Full CRUD: view, search, edit roles, delete users.
 * Apple-grade white/slate design matching War Room aesthetic.
 */
import { useState, useEffect, useCallback, type FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getUsers, updateUser, deleteUser } from '../api/client';
import type { AuthUser } from '../api/client';

/* ── Design tokens ───────────────────────────────────────────── */
const T = {
  bg: '#FFFFFF',
  bg1: '#F5F5F7',
  bg2: '#FBFBFD',
  border: 'rgba(0,0,0,0.06)',
  border2: 'rgba(0,0,0,0.12)',
  accent: '#0071E3',
  green: '#34C759',
  orange: '#FF9500',
  red: '#FF3B30',
  purple: '#AF52DE',
  text: '#1D1D1F',
  text2: '#6E6E73',
  text3: '#AEAEB2',
  sans: "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
};

const ROLES = ['admin', 'analyst', 'viewer'] as const;
type Role = typeof ROLES[number];

const ROLE_CONFIG: Record<Role, { label: string; color: string; bg: string; icon: string }> = {
  admin:   { label: 'Admin',   color: '#AF52DE', bg: 'rgba(175,82,222,0.08)', icon: '⚡' },
  analyst: { label: 'Analyst', color: '#0071E3', bg: 'rgba(0,113,227,0.06)',  icon: '📊' },
  viewer:  { label: 'Viewer',  color: '#6E6E73', bg: 'rgba(110,110,115,0.08)', icon: '👁' },
};

interface AdminUsersPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId?: string;
}

const AdminUsersPanel: FC<AdminUsersPanelProps> = ({ isOpen, onClose, currentUserId }) => {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<Role>('analyst');
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    setError(null);
    getUsers()
      .then(setUsers)
      .catch((e) => setError(e.message || 'Failed to load users'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (isOpen) fetchUsers();
  }, [isOpen, fetchUsers]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q);
  });

  const stats = {
    total: users.length,
    admins: users.filter((u) => u.role === 'admin').length,
    analysts: users.filter((u) => u.role === 'analyst').length,
    viewers: users.filter((u) => u.role === 'viewer').length,
  };

  const handleStartEdit = (u: AuthUser) => {
    setEditingUser(u.id);
    setEditRole(u.role as Role);
    setEditName(u.name);
    setDeleteConfirm(null);
  };

  const handleSave = async (userId: string) => {
    setSaving(true);
    try {
      await updateUser(userId, { name: editName, role: editRole });
      setToast({ msg: 'User updated', type: 'success' });
      setEditingUser(null);
      fetchUsers();
    } catch (e: any) {
      setToast({ msg: e.message || 'Update failed', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (userId: string) => {
    setSaving(true);
    try {
      await deleteUser(userId);
      setToast({ msg: 'User removed', type: 'success' });
      setDeleteConfirm(null);
      fetchUsers();
    } catch (e: any) {
      setToast({ msg: e.message || 'Delete failed', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (d: string | null | undefined) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return '—'; }
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0, zIndex: 10000,
              background: 'rgba(0, 0, 0, 0.25)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ type: 'spring', stiffness: 350, damping: 32 }}
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 10001,
              width: Math.min(520, window.innerWidth - 40),
              background: T.bg,
              borderLeft: `1px solid ${T.border}`,
              boxShadow: '-20px 0 60px rgba(0, 0, 0, 0.08)',
              display: 'flex', flexDirection: 'column',
              fontFamily: T.sans,
              overflow: 'hidden',
            }}
          >
            {/* ─── Header ─── */}
            <div style={{
              padding: '20px 24px 16px',
              borderBottom: `1px solid ${T.border}`,
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: T.text, letterSpacing: '-0.02em' }}>
                    User Management
                  </h2>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: T.text2 }}>
                    Manage team access and roles
                  </p>
                </div>
                <button
                  onClick={onClose}
                  style={{
                    width: 32, height: 32, borderRadius: 8,
                    border: 'none', background: T.bg1, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: T.text2, fontSize: 16, transition: 'background 0.15s',
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.background = '#ECECEE')}
                  onMouseOut={(e) => (e.currentTarget.style.background = T.bg1)}
                >
                  ✕
                </button>
              </div>

              {/* Stats Row */}
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                {([
                  { label: 'Total', value: stats.total, color: T.text },
                  { label: 'Admins', value: stats.admins, color: '#AF52DE' },
                  { label: 'Analysts', value: stats.analysts, color: '#0071E3' },
                  { label: 'Viewers', value: stats.viewers, color: '#6E6E73' },
                ] as const).map((s) => (
                  <div key={s.label} style={{
                    flex: 1, padding: '10px 12px', borderRadius: 10,
                    background: T.bg1, textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: s.color, letterSpacing: '-0.02em' }}>
                      {s.value}
                    </div>
                    <div style={{ fontSize: 10, color: T.text3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 2 }}>
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Search */}
              <div style={{ position: 'relative', marginTop: 14 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.text3} strokeWidth="2.5" strokeLinecap="round" style={{ position: 'absolute', left: 12, top: 11 }}>
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, email, or role..."
                  style={{
                    width: '100%', padding: '10px 14px 10px 36px',
                    borderRadius: 10, border: `1px solid ${T.border2}`,
                    background: T.bg1, color: T.text, fontSize: 13,
                    outline: 'none', boxSizing: 'border-box',
                    fontFamily: T.sans,
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = T.accent; e.target.style.boxShadow = `0 0 0 3px rgba(0,113,227,0.1)`; }}
                  onBlur={(e) => { e.target.style.borderColor = 'rgba(0,0,0,0.12)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            </div>

            {/* ─── User List ─── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 24px 24px' }}>
              {loading && (
                <div style={{ textAlign: 'center', padding: 40, color: T.text3 }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>⟳</div>
                  <div style={{ fontSize: 13 }}>Loading users...</div>
                </div>
              )}

              {error && (
                <div style={{
                  padding: '14px 16px', borderRadius: 12, marginBottom: 12,
                  background: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.12)',
                  color: '#CC3730', fontSize: 13,
                }}>
                  {error}
                </div>
              )}

              {!loading && !error && filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, color: T.text3 }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>🔍</div>
                  <div style={{ fontSize: 13 }}>No users found</div>
                </div>
              )}

              {!loading && !error && filtered.map((u) => {
                const isEditing = editingUser === u.id;
                const isDeleting = deleteConfirm === u.id;
                const isSelf = u.id === currentUserId;
                const rc = ROLE_CONFIG[u.role as Role] || ROLE_CONFIG.viewer;

                return (
                  <motion.div
                    key={u.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 12,
                      border: `1px solid ${isEditing ? T.accent : T.border}`,
                      background: isEditing ? 'rgba(0,113,227,0.02)' : T.bg,
                      marginBottom: 8,
                      transition: 'all 0.2s',
                      boxShadow: isEditing ? `0 0 0 2px rgba(0,113,227,0.08)` : 'none',
                    }}
                    onMouseOver={(e) => {
                      if (!isEditing) e.currentTarget.style.background = T.bg1;
                    }}
                    onMouseOut={(e) => {
                      if (!isEditing) e.currentTarget.style.background = T.bg;
                    }}
                  >
                    {/* Main Row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {/* Avatar */}
                      <div style={{
                        width: 40, height: 40, borderRadius: 10,
                        background: rc.bg,
                        color: rc.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, fontWeight: 700, flexShrink: 0,
                        letterSpacing: '-0.01em',
                      }}>
                        {getInitials(u.name)}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{
                            fontSize: 14, fontWeight: 600, color: T.text,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {u.name}
                          </span>
                          {isSelf && (
                            <span style={{
                              fontSize: 10, fontWeight: 600, color: T.green,
                              background: 'rgba(52,199,89,0.1)', padding: '1px 6px',
                              borderRadius: 4, letterSpacing: '0.02em',
                            }}>
                              YOU
                            </span>
                          )}
                        </div>
                        <div style={{
                          fontSize: 12, color: T.text2, marginTop: 2,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {u.email}
                        </div>
                      </div>

                      {/* Role Badge */}
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '4px 10px', borderRadius: 8,
                        fontSize: 11, fontWeight: 600,
                        background: rc.bg, color: rc.color,
                        letterSpacing: '0.02em', textTransform: 'uppercase',
                        flexShrink: 0,
                      }}>
                        <span style={{ fontSize: 10 }}>{rc.icon}</span>
                        {rc.label}
                      </span>

                      {/* Actions */}
                      {!isEditing && !isDeleting && (
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button
                            onClick={() => handleStartEdit(u)}
                            title="Edit user"
                            style={{
                              width: 32, height: 32, borderRadius: 8, border: 'none',
                              background: 'transparent', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: T.text3, fontSize: 14, transition: 'all 0.15s',
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.background = T.bg1; e.currentTarget.style.color = T.accent; }}
                            onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.text3; }}
                          >
                            ✏️
                          </button>
                          {!isSelf && (
                            <button
                              onClick={() => setDeleteConfirm(u.id)}
                              title="Remove user"
                              style={{
                                width: 32, height: 32, borderRadius: 8, border: 'none',
                                background: 'transparent', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: T.text3, fontSize: 14, transition: 'all 0.15s',
                              }}
                              onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,59,48,0.06)'; e.currentTarget.style.color = T.red; }}
                              onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.text3; }}
                            >
                              🗑
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Meta Row */}
                    <div style={{ display: 'flex', gap: 16, marginTop: 8, paddingLeft: 52 }}>
                      <span style={{ fontSize: 11, color: T.text3 }}>
                        Joined {formatDate(u.created_at)}
                      </span>
                      {u.last_login && (
                        <span style={{ fontSize: 11, color: T.text3 }}>
                          Last active {formatDate(u.last_login)}
                        </span>
                      )}
                    </div>

                    {/* ─── Edit Mode ─── */}
                    <AnimatePresence>
                      {isEditing && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          style={{ overflow: 'hidden' }}
                        >
                          <div style={{
                            marginTop: 12, paddingTop: 12,
                            borderTop: `1px solid ${T.border}`,
                          }}>
                            {/* Name Field */}
                            <div style={{ marginBottom: 10 }}>
                              <label style={{ fontSize: 11, fontWeight: 600, color: T.text2, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Display Name
                              </label>
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                style={{
                                  width: '100%', padding: '8px 12px', borderRadius: 8,
                                  border: `1px solid ${T.border2}`, background: T.bg1,
                                  color: T.text, fontSize: 13, outline: 'none',
                                  boxSizing: 'border-box', fontFamily: T.sans,
                                }}
                                onFocus={(e) => { e.target.style.borderColor = T.accent; e.target.style.boxShadow = `0 0 0 3px rgba(0,113,227,0.1)`; }}
                                onBlur={(e) => { e.target.style.borderColor = 'rgba(0,0,0,0.12)'; e.target.style.boxShadow = 'none'; }}
                              />
                            </div>

                            {/* Role Selector */}
                            <div style={{ marginBottom: 12 }}>
                              <label style={{ fontSize: 11, fontWeight: 600, color: T.text2, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Role
                              </label>
                              <div style={{ display: 'flex', gap: 6 }}>
                                {ROLES.map((r) => {
                                  const c = ROLE_CONFIG[r];
                                  const sel = editRole === r;
                                  return (
                                    <button
                                      key={r}
                                      onClick={() => setEditRole(r)}
                                      style={{
                                        flex: 1, padding: '8px 0', borderRadius: 8,
                                        border: sel ? `2px solid ${c.color}` : `1px solid ${T.border2}`,
                                        background: sel ? c.bg : T.bg,
                                        color: sel ? c.color : T.text2,
                                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                        transition: 'all 0.15s',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                                      }}
                                    >
                                      <span style={{ fontSize: 11 }}>{c.icon}</span>
                                      {c.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                              <button
                                onClick={() => setEditingUser(null)}
                                disabled={saving}
                                style={{
                                  padding: '7px 16px', borderRadius: 8,
                                  border: `1px solid ${T.border2}`, background: T.bg,
                                  color: T.text2, fontSize: 12, fontWeight: 600,
                                  cursor: 'pointer', transition: 'all 0.15s',
                                }}
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSave(u.id)}
                                disabled={saving}
                                style={{
                                  padding: '7px 20px', borderRadius: 8,
                                  border: 'none', background: T.accent,
                                  color: '#fff', fontSize: 12, fontWeight: 600,
                                  cursor: saving ? 'not-allowed' : 'pointer',
                                  opacity: saving ? 0.6 : 1,
                                  transition: 'all 0.15s',
                                  boxShadow: '0 1px 4px rgba(0,113,227,0.2)',
                                }}
                              >
                                {saving ? 'Saving...' : 'Save Changes'}
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* ─── Delete Confirm ─── */}
                    <AnimatePresence>
                      {isDeleting && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          style={{ overflow: 'hidden' }}
                        >
                          <div style={{
                            marginTop: 12, padding: 12,
                            borderRadius: 10,
                            background: 'rgba(255,59,48,0.04)',
                            border: '1px solid rgba(255,59,48,0.12)',
                          }}>
                            <p style={{ margin: '0 0 10px', fontSize: 13, color: T.text, fontWeight: 500 }}>
                              Remove <strong>{u.name}</strong> from the team?
                            </p>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                disabled={saving}
                                style={{
                                  padding: '7px 16px', borderRadius: 8,
                                  border: `1px solid ${T.border2}`, background: T.bg,
                                  color: T.text2, fontSize: 12, fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleDelete(u.id)}
                                disabled={saving}
                                style={{
                                  padding: '7px 20px', borderRadius: 8,
                                  border: 'none', background: T.red,
                                  color: '#fff', fontSize: 12, fontWeight: 600,
                                  cursor: saving ? 'not-allowed' : 'pointer',
                                  opacity: saving ? 0.6 : 1,
                                  boxShadow: '0 1px 4px rgba(255,59,48,0.2)',
                                }}
                              >
                                {saving ? 'Removing...' : 'Remove User'}
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>

            {/* ─── Footer ─── */}
            <div style={{
              padding: '12px 24px',
              borderTop: `1px solid ${T.border}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 11, color: T.text3 }}>
                Invite codes: PULSE-2026 · HENKEL-STRATEGY · WARROOM-ACCESS
              </span>
              <button
                onClick={fetchUsers}
                style={{
                  padding: '6px 12px', borderRadius: 6,
                  border: `1px solid ${T.border2}`, background: T.bg,
                  color: T.text2, fontSize: 11, fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = T.bg1; }}
                onMouseOut={(e) => { e.currentTarget.style.background = T.bg; }}
              >
                ↻ Refresh
              </button>
            </div>
          </motion.div>

          {/* ─── Toast Notification ─── */}
          <AnimatePresence>
            {toast && (
              <motion.div
                initial={{ opacity: 0, y: 20, x: '-50%' }}
                animate={{ opacity: 1, y: 0, x: '-50%' }}
                exit={{ opacity: 0, y: 20, x: '-50%' }}
                style={{
                  position: 'fixed', bottom: 24, left: '50%',
                  zIndex: 10002,
                  padding: '10px 20px', borderRadius: 10,
                  background: toast.type === 'success' ? '#1D1D1F' : T.red,
                  color: '#fff', fontSize: 13, fontWeight: 600,
                  boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontFamily: T.sans,
                }}
              >
                <span>{toast.type === 'success' ? '✓' : '✕'}</span>
                {toast.msg}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
};

export default AdminUsersPanel;
