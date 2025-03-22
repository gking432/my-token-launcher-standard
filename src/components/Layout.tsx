import React from 'react';
import Header from './Header';
import Footer from './Footer';
import '../styles/header.css';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="app-container">
      <Header />
      <div className="viewport">
        {children}
      </div>
      <Footer />
    </div>
  );
};

export default Layout;