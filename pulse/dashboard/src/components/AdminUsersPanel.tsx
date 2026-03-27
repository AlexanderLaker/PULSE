/**
 * AdminUsersPanel — Shows registered users to admin users.
 * White / slate design matching War Room aesthetic.
 */
import { useState, useEffect, type FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getUsers } from '../api/client';
import type { AuthUser } from '../api/client';

interface AdminUsersPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const AdminUsersPanel: FC<AdminUsersPanelProps> = ({ isOpen, onClose }) => {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    getUsers()
      .then(setUsers)
      .catch((e) => setError(e.message || 'Failed to load users'))
      .finally(() => setLoading(false));
  }, [isOpen]);

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
              background: 'rgba(0, 0, 0, 0.15)',
              backdropFilter: 'blur(4px)',
            }}
          />
          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            style={{
              position: 'fixed', top: 60, right: 16, zIndex: 10001,
              width: 420, maxHeight: 'calc(100vh - 100px)',
              background: '#FFFFFF',
              borderRadius: 14,
              border: '1px solid rgba(0, 0, 0, 0.08)',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0,0,0,0.03)',
              overflow: 'hidden',
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            }}
          >
            {/* Header */}
            <div style={{
              padding: '18px 20px 14px',
              borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#1D1D1F' }}>
                  Registered Users
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#999' }}>
                  {users.length} user{users.length !== 1 ? 's' : ''} registered
                </p>
              </div>
              <button
                onClick={onClose}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#999', fontSize: 18, padding: 4,
                }}
              >
                &times;
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '12px 20px 20px', overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
              {loading && (
                <p style={{ color: '#999', fontSize: 13, textAlign: 'center', padding: 20 }}>
                  Loading users...
                </p>
              )}
              {error && (
                <p style={{ color: '#CC3730', fontSize: 13, textAlign: 'center', padding: 20 }}>
                  {error}
                </p>
              )}
              {!loading && !error && users.map((u) => (
                <div
                  key={u.id}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 14px', borderRadius: 10, marginBottom: 6,
                    background: '#F5F5F7',
                    border: '1px solid rgba(0, 0, 0, 0.04)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: '#1D1D1F' }}>
                      {u.name}
                    </div>
                    <div style={{ fontSize: 12, color: '#6E6E73', marginTop: 2 }}>
                      {u.email}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      display: 'inline-block', padding: '3px 8px', borderRadius: 6,
                      fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      background: u.role === 'admin'
                        ? 'rgba(212, 168, 71, 0.1)' : 'rgba(0, 113, 227, 0.08)',
                      color: u.role === 'admin' ? '#B8922E' : '#0071E3',
                    }}>
                      {u.role}
                    </span>
                    <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                      Joined {new Date(u.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AdminUsersPanel;
