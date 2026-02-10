import React from 'react';
import './CoverPage.css';

interface CoverPageProps {
  onEnter: () => void;
}

function CoverPage({ onEnter }: CoverPageProps) {
  return (
    <div className="tectide-page">
      {/* Top Navigation */}
      <nav className="tectide-nav">
        <div className="nav-left">
          <div className="logo-circle">
            <div className="logo-icon">●</div>
          </div>
          <div className="nav-brand">
            <div className="brand-name">Tectide Stratum</div>
            <div className="status">
              <span className="status-dot"></span>
              Network Online
            </div>
          </div>
        </div>
        <div className="nav-right">
          <a href="#" className="nav-link">Documentation</a>
          <a href="#" className="nav-link">Status</a>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="tectide-container">
        <div className="hero-section">
          <div className="badge">
            <span className="badge-icon">🛡️</span>
            SECURE P2P PROTOCOL v2.4
          </div>

          <h1 className="hero-title">
            Welcome to <span className="gradient-text">Tectide Stratum</span>
          </h1>

          <p className="hero-subtitle">
            Secure, distributed, and resilient communication for the modern web.<br />
            Connect with peers directly in a decentralized network where you<br />
            own your data.
          </p>

          <button className="cta-button" onClick={onEnter}>
            Click here to join a server →
          </button>
        </div>

        {/* Features Section */}
        <div className="features-section">
          <div className="feature-card">
            <div className="feature-icon blue">📶</div>
            <h3>Distributed</h3>
            <p>No central authority. The network is powered by its participants.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon green">🛡️</div>
            <h3>End-to-End Encrypted</h3>
            <p>Your messages are encrypted on your device and only decrypted by the recipient.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon purple">{'<>'}</div>
            <h3>Open Protocol</h3>
            <p>Built on open standards. Auditable code for maximum community trust.</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="tectide-footer">
        <div className="footer-left">
          <span>© 2023 Tectide Stratum Project</span>
          <span className="version-badge">v1.0.4 stable</span>
        </div>
        <div className="footer-right">
          <div className="footer-icons">
            <span className="icon">↗</span>
            <span className="icon">⎋</span>
          </div>
          <a href="#" className="footer-link">Privacy Policy</a>
          <a href="#" className="footer-link">Terms</a>
        </div>
      </footer>
    </div>
  );
}

export default CoverPage;
