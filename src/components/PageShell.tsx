import React from 'react';
import AppHeader from './AppHeader';
import LeftSidebar from './LeftSidebar';
import SiteFooter from './SiteFooter';

interface PageShellProps {
  children: React.ReactNode;
}

const PageShell: React.FC<PageShellProps> = ({ children }) => {
  return (
    <>
      <style>{`
        .ps-shell {
          display: flex;
          align-items: flex-start;
          min-height: calc(100vh - var(--mm-header-offset, 60px));
        }
        .ps-main {
          flex: 1;
          min-width: 0;
        }
      `}</style>
      <AppHeader hideNav />
      <div className="ps-shell">
        <LeftSidebar />
        <main className="ps-main">
          {children}
          <SiteFooter />
        </main>
      </div>
    </>
  );
};

export default PageShell;
