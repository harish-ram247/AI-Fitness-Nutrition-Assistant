import React from 'react';
import { NavLink } from 'react-router-dom';

export interface NavItem {
  name: string;
  path: string;
  iconText: string;
}

export const NAV_ITEMS: NavItem[] = [
  { name: 'Dashboard', path: '/dashboard', iconText: '📊' },
  { name: 'Profile', path: '/profile', iconText: '👤' },
  { name: 'Nutrition', path: '/nutrition', iconText: '🥗' },
  { name: 'Workouts', path: '/workouts', iconText: '🏋️' },
  { name: 'Recommendations', path: '/recommendations', iconText: '💡' },
  { name: 'AI Assistant', path: '/ai', iconText: '🤖' },
];

export interface SidebarProps {
  onNavClick?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onNavClick }) => {
  return (
    <aside
      aria-label="Desktop Sidebar"
      style={{
        width: '240px',
        backgroundColor: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          padding: 'var(--spacing-4) var(--spacing-6)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <span
          style={{
            fontSize: 'var(--font-size-lg)',
            fontWeight: 700,
            color: 'var(--color-primary)',
            letterSpacing: '-0.02em',
          }}
        >
          AI Fitness
        </span>
      </div>

      <nav aria-label="Sidebar Navigation" style={{ padding: 'var(--spacing-3) var(--spacing-2)', flex: 1 }}>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {NAV_ITEMS.map((item) => (
            <li key={item.path} style={{ marginBottom: 'var(--spacing-1)' }}>
              <NavLink
                to={item.path}
                onClick={onNavClick}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-3)',
                  padding: 'var(--spacing-2) var(--spacing-4)',
                  borderRadius: 'var(--radius-md)',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  backgroundColor: isActive ? 'var(--bg-surface-hover)' : 'transparent',
                  fontWeight: isActive ? 600 : 400,
                  textDecoration: 'none',
                  borderLeft: isActive ? '3px solid var(--color-primary)' : '3px solid transparent',
                  transition: 'background-color var(--transition-fast)',
                })}
              >
                <span aria-hidden="true" style={{ fontSize: '1.1rem' }}>
                  {item.iconText}
                </span>
                <span>{item.name}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
};
