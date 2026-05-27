"use client";

export function Footer() {
  return (
    <footer className="footer-v3">
      <div className="footer-inner">
        <div className="footer-brand">
          <span className="footer-logo">CoconutLabs</span>
          <span className="footer-tagline">Tiny tokens. Big ships.</span>
        </div>
        <div className="footer-links">
          <div className="footer-col">
            <span className="footer-col-head">Product</span>
            <a href="#burn" className="footer-link">Burn Index</a>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <span className="footer-copy">© 2026 CoconutLabs. All rights reserved.</span>
        <span className="footer-verif">
          Evidence levels: API-verified · CLI-verified · Token-only estimate · Manual entry
        </span>
      </div>
    </footer>
  );
}
