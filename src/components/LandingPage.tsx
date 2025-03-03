import React from 'react';
import '../MoveMint.css';
import Header from './Header';
import Footer from './Footer';

const LandingPage: React.FC = () => {
  return (
    <div className="container">
    
      <section className="launch-section">
        <a href="/launch" className="launch-link">
          <button className="launch-btn">
            <img src="/assets/coinicon.svg" alt="Launch Icon" className="launch-icon" />
            Launch
          </button>
        </a>
      </section>
      <Footer />
    </div>
  );
};

export default LandingPage;