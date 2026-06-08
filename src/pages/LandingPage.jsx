import { useNavigate } from 'react-router-dom';
import '../css/LandingPage.css';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing-hero">
      {/* Background video */}
      <video
        className="landing-video"
        autoPlay
        muted
        loop
        playsInline
        aria-hidden="true"
      >
        <source src="/landing-video.mp4" type="video/mp4" />
      </video>

      {/* Dark overlay */}
      <div className="landing-overlay" />

      {/* Logos row */}
      <header className="landing-logos">
        <img src="/bustos-logo.png" alt="Bustos Logo" className="landing-logo" />
        <img src="/bp-logo.png" alt="Bagong Pilipinas" className="landing-logo" />
        <img src="/popdev-logo.png" alt="Commission on Population" className="landing-logo" />
      </header>

      {/* Hero content */}
      <main className="landing-content">
        <h1>Bustos Development System</h1>
        <h2>Bustos, Bulacan</h2>
        <p className="landing-description">
          A centralized system for managing and monitoring population data of Bustos, Bulacan.
        </p>

        <div className="landing-actions">
          <button
            className="btn-landing-login"
            onClick={() => navigate('/login')}
            id="landingLoginBtn"
          >
            LOGIN
          </button>
          <a href="#about" className="landing-learn-more">Learn More</a>
        </div>
      </main>

      {/* Footer */}
      <footer className="landing-footer">
        <p className="warning">⚠️ Access to the system is limited to authorized personnel only.</p>
        <p className="copyright">© 2026 Bustos Population Development System</p>
        <p className="devs">Developed by BS Information Technology Students – Bulacan State University</p>
      </footer>
    </div>
  );
}
