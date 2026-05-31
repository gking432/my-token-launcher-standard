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
        .ps-page {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
        }
        .ps-shell {
          display: flex;
          align-items: stretch;
          flex: 1;
        }
        .ps-main {
          flex: 1;
          min-width: 0;
        }
      `}</style>
      <div className="ps-page">
        <AppHeader wide />
        <div className="ps-shell">
          <LeftSidebar />
          <main className="ps-main">{children}</main>
        </div>
        <SiteFooter />
      </div>
    </>
  );
};

export default PageShell;
