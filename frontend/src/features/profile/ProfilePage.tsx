import React, { useState } from 'react';
import { AccountInfoCard } from './components/AccountInfoCard';
import { ProfileForm } from './components/ProfileForm';
import { PreferencesForm } from './components/PreferencesForm';
import { GoalsSection } from './components/GoalsSection';

type ActiveTab = 'profile' | 'preferences' | 'goals' | 'all';

export const ProfilePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('all');

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--spacing-6)' }}>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 var(--spacing-2) 0' }}>
          Profile &amp; Preferences
        </h1>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', margin: 0 }}>
          Manage your personal information, nutritional targets, and fitness goals.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div
        role="tablist"
        aria-label="Profile Sections"
        style={{
          display: 'flex',
          gap: 'var(--spacing-2)',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: 'var(--spacing-6)',
          overflowX: 'auto',
        }}
      >
        {[
          { id: 'all', label: 'All Overview' },
          { id: 'profile', label: 'Personal Information' },
          { id: 'preferences', label: 'Preferences & Targets' },
          { id: 'goals', label: 'Fitness Goals' },
        ].map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            id={`tab-${tab.id}`}
            type="button"
            onClick={() => setActiveTab(tab.id as ActiveTab)}
            style={{
              padding: 'var(--spacing-2) var(--spacing-4)',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === tab.id ? 600 : 400,
              fontSize: 'var(--font-size-sm)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all var(--transition-fast)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Panels with Independent Fault Isolation */}
      <div id={`panel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
        {/* Account Info Card (visible on 'all' or 'profile') */}
        {(activeTab === 'all' || activeTab === 'profile') && <AccountInfoCard />}

        {/* Profile Information Form */}
        {(activeTab === 'all' || activeTab === 'profile') && <ProfileForm />}

        {/* Nutritional & Coaching Preferences Form */}
        {(activeTab === 'all' || activeTab === 'preferences') && <PreferencesForm />}

        {/* Fitness Goals Section */}
        {(activeTab === 'all' || activeTab === 'goals') && <GoalsSection />}
      </div>
    </div>
  );
};
