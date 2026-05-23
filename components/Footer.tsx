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
            <a href="#challenge" className="footer-link">Challenges</a>
            <a href="#drops" className="footer-link">Workflow Drops</a>
          </div>
          <div className="footer-col">
            <span className="footer-col-head">Trust</span>
            <a href="#" className="footer-link">Collection Spec</a>
            <a href="#" className="footer-link">Privacy</a>
          </div>
          <div className="footer-col">
            <span className="footer-col-head">Company</span>
            <a href="#" className="footer-link">About</a>
            <a href="#" className="footer-link">Blog</a>
            <a href="#" className="footer-link">Contact</a>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <span className="footer-copy">© 2026 CoconutLabs. All rights reserved.</span>
        <span className="footer-verif">
          Verification levels: Provider-synced · Device-synced · Estimated · Self-reported
        </span>
      </div>
    </footer>
  );
}
