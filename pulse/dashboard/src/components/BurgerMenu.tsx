import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  X,
  Users,
  Settings,
  Download,
  Clock,
  Lock,
  LogOut,
  Shield,
  Map,
} from 'lucide-react';

interface BurgerMenuProps {
  user: { name: string; email?: string; role?: string; id?: string } | null;
  isAdmin: boolean;
  onLogout: () => void;
  onShowUsers: () => void;
  onShowConfig: () => void;
  onShowExport: () => void;
  onShowDelphi: () => void;
  onShowSnapshots: () => void;
  onShowJourney: () => void;
  onChangePassword: () => void;
}

export const BurgerMenu: React.FC<BurgerMenuProps> = ({
  user,
  isAdmin,
  onLogout,
  onShowUsers,
  onShowConfig,
  onShowExport,
  onShowDelphi,
  onShowSnapshots,
  onShowJourney,
  onChangePassword,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleMenuItemClick = (callback: () => void) => {
    callback();
    setIsOpen(false);
  };

  const roleBadgeColor =
    user?.role === 'Admin' ? '#D4A847' : user?.role === 'Analyst' ? '#3B82F6' : '#94A3B8';

  return (
    <div
      ref={menuRef}
      style={{
        position: 'relative',
        display: 'inline-block',
      }}
    >
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          border: '1px solid rgba(71, 85, 105, 0.5)',
          backgroundColor: 'transparent',
          color: '#94A3B8',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s ease-in-out',
        } as React.CSSProperties}
        onMouseEnter={(e) => {
          (e.target as HTMLButtonElement).style.backgroundColor = '#334155';
          (e.target as HTMLButtonElement).style.color = '#F8FAFC';
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLButtonElement).style.backgroundColor = 'transparent';
          (e.target as HTMLButtonElement).style.color = '#94A3B8';
        }}
        aria-label="Menu"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: '44px',
            width: '240px',
            backgroundColor: '#1E293B',
            border: '1px solid rgba(71, 85, 105, 0.5)',
            borderRadius: '10px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.4)',
            zIndex: 9999,
            overflow: 'hidden',
          }}
        >
          {/* User Info Section */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(71, 85, 105, 0.3)' }}>
            <div style={{ fontSize: '13px', color: '#F8FAFC', fontWeight: 500, marginBottom: '4px' }}>
              {user?.name || 'User'}
            </div>
            <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '8px' }}>
              {user?.email || 'user@example.com'}
            </div>
            {user?.role && (
              <div
                style={{
                  display: 'inline-block',
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '4px 8px',
                  backgroundColor: `${roleBadgeColor}20`,
                  color: roleBadgeColor,
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {user.role === 'Admin' && <Shield size={12} style={{ display: 'inline-block', marginRight: '4px' }} />}
                {user.role}
              </div>
            )}
          </div>

          {/* Menu Items */}
          <div style={{ padding: '4px 0' }}>
            {/* Admin Section */}
            {isAdmin && (
              <>
                <MenuItem
                  icon={Users}
                  label="User Management"
                  onClick={() => handleMenuItemClick(onShowUsers)}
                />
                <MenuItem
                  icon={Settings}
                  label="Model Configuration"
                  onClick={() => handleMenuItemClick(onShowConfig)}
                />
                <Divider />
              </>
            )}

            {/* General Items */}
            <MenuItem
              icon={Download}
              label="Export Center"
              onClick={() => handleMenuItemClick(onShowExport)}
            />
            <MenuItem
              icon={Users}
              label="Expert Elicitation (Delphi)"
              onClick={() => handleMenuItemClick(onShowDelphi)}
            />
            <MenuItem
              icon={Clock}
              label="Session History"
              onClick={() => handleMenuItemClick(onShowSnapshots)}
            />

            <Divider />

            {/* Strategic Views */}
            <MenuItem
              icon={Map}
              label="Consumer Journey"
              onClick={() => handleMenuItemClick(onShowJourney)}
            />

            {/* Divider */}
            <Divider />

            {/* Security Items */}
            <MenuItem
              icon={Lock}
              label="Change Password"
              onClick={() => handleMenuItemClick(onChangePassword)}
            />
            <MenuItem
              icon={LogOut}
              label="Sign Out"
              onClick={() => handleMenuItemClick(onLogout)}
              isDestructive
            />
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Reusable menu item component
 */
interface MenuItemProps {
  icon: React.ComponentType<{ size: number }>;
  label: string;
  onClick: () => void;
  isDestructive?: boolean;
}

const MenuItem: React.FC<MenuItemProps> = ({ icon: Icon, label, onClick, isDestructive = false }) => {
  const [isHovered, setIsHovered] = React.useState(false);

  const itemColor = isDestructive ? '#EF4444' : '#F8FAFC';
  const hoverBg = isDestructive ? 'rgba(239, 68, 68, 0.1)' : '#334155';

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: '100%',
        padding: '10px 16px',
        backgroundColor: isHovered ? hoverBg : 'transparent',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '13px',
        color: itemColor,
        transition: 'background-color 0.15s ease-in-out',
      }}
    >
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        <Icon size={16} />
      </div>
      <span>{label}</span>
    </button>
  );
};

/**
 * Divider between menu sections
 */
const Divider: React.FC = () => (
  <div
    style={{
      height: '1px',
      backgroundColor: 'rgba(71, 85, 105, 0.3)',
      margin: '4px 0',
    }}
  />
);

export default BurgerMenu;
