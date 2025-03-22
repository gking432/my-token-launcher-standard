import React from "react";
import "../styles/footer.css";

const Footer: React.FC = () => {
  return (
    <footer className="footer">
      <a href="/" className="footerlogo">
        <span className="logo-move">Move</span>
        <span className="logo-mint">Mint</span>
        <span className="logo-dot">.</span>
        <span className="logo-fun">fun</span>
      </a>
      <p>© 2025 MoveMint. All Rights Reserved.</p>
    </footer>
  );
};

export default Footer;
