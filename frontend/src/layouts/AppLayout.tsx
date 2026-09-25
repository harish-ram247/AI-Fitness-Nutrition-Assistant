import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { ChangePasswordModal } from '../features/auth/components/ChangePasswordModal';

/**
 * AppLayout: Production application shell for authenticated routes.
 *
 * Structure:
 * - Top Header: Application name, user profile info, mobile menu trigger, actions.
 * - Body: Desktop Sidebar (persistent on desktop, hidden on tablet/mobile) + Main content.
 * - MobileNav: Drawer navigation for small screens.
 * - ChangePasswordModal: Accessible password management dialog.
 */
export const AppLayout: React.FC = () => {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      {/* Top Header */}
      <Header
        onToggleMobileNav={() => setIsMobileNavOpen((prev) => !prev)}
        isMobileNavOpen={isMobileNavOpen}
        onOpenChangePassword={() => setIsPasswordModalOpen(true)}
      />

      {/* Main Layout Area: Sidebar + Content */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Desktop Sidebar (hidden on tablet/mobile via CSS) */}
        <div className="desktop-sidebar-container">
          <Sidebar />
        </div>

        {/* Mobile Navigation Drawer */}
        <MobileNav isOpen={isMobileNavOpen} onClose={() => setIsMobileNavOpen(false)} />

        {/* Page Content */}
        <main
          role="main"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 'var(--spacing-6)',
            minWidth: 0,
          }}
        >
          <div className="container">
            <React.Suspense
              fallback={
                <div
                  role="status"
                  aria-label="Loading page content"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '200px',
                    padding: '2rem',
                  }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      border: '3px solid rgba(255, 255, 255, 0.2)',
                      borderTopColor: 'var(--color-primary, #6366f1)',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                    }}
                  />
                  <span className="sr-only" style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', border: 0 }}>
                    Loading page content...
                  </span>
                </div>
              }
            >
              <Outlet />
            </React.Suspense>
          </div>
        </main>
      </div>

      {/* Password Change Dialog */}
      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />

      {/* Accessible Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--border-subtle)',
          padding: 'var(--spacing-3) var(--spacing-4)',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: 'var(--font-size-xs)',
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        AI Fitness &amp; Nutrition Assistant &mdash; Phase 8C
      </footer>
    </div>
  );
};
