import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../css/LandingPage.css';

export default function LandingPage() {
  const navigate = useNavigate();
  const [showLearnMore, setShowLearnMore] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const handleCloseModal = () => {
    setIsClosing(true);
    setTimeout(() => {
      setShowLearnMore(false);
      setIsClosing(false);
    }, 280);
  };

  return (
    <div className="landing-hero">
      {/* Background video (YouTube embed) */}
      <div className="landing-video-container">
        <iframe
          className="landing-video-iframe"
          src="https://www.youtube-nocookie.com/embed/b0NFMOHMt4Y?autoplay=1&mute=1&loop=1&playlist=b0NFMOHMt4Y&controls=0&showinfo=0&rel=0&iv_load_policy=3&enablejsapi=1&disablekb=1&modestbranding=1"
          title="Bustos Background Video"
          allow="autoplay; encrypted-media"
          allowFullScreen
          aria-hidden="true"
        />
      </div>

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
          <button
            type="button"
            className="landing-learn-more-btn"
            onClick={() => setShowLearnMore(true)}
          >
            Learn More
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="landing-footer">
        <p className="warning">⚠️ Access to the system is limited to authorized personnel only.</p>
        <p className="copyright">© 2026 Bustos Population Development System</p>
        <p className="devs">Developed by BS Information Technology Students – Bulacan State University</p>
      </footer>

      {/* Learn More Modal Overlay Container */}
      {showLearnMore && (
        <div 
          className={`learn-more-modal-overlay ${isClosing ? 'modal-closing' : ''}`} 
          onClick={handleCloseModal}
        >
          <div 
            className={`landing-about-container ${isClosing ? 'modal-container-closing' : ''}`} 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Back Button */}
            <button 
              className="btn-back" 
              onClick={handleCloseModal}
            >
              ← Back
            </button>

            {/* Header Logos inside Container: Pop Dev, Bustos, Bagong Pilipinas */}
            <div className="container-logos">
              <img src="/popdev-logo.png" alt="Pop Dev Logo" className="container-logo" />
              <img src="/bustos-logo.png" alt="Bustos Logo" className="container-logo" />
              <img src="/bp-logo.png" alt="Bagong Pilipinas Logo" className="container-logo" />
            </div>

            <h1 className="about-main-title">Learn More About BustoSight</h1>
            <div className="about-divider" />

            {/* Video Showcase Card */}
            <div className="about-card video-card">
              <h2>Bustos Video Showcase</h2>
              <div className="video-responsive">
                <iframe
                  src="https://www.youtube-nocookie.com/embed/b0NFMOHMt4Y"
                  title="Bustos Showcase Video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>

            {/* What is BustoSight */}
            <div className="about-card">
              <h2>What is BustoSight?</h2>
              <p>
                <strong>BustoSight</strong> is a web-based Population Records and Predictive Decision Support System developed to support the <strong>Municipality of Bustos Population Development Office (MPDO)</strong> in managing, organizing, and analyzing population-related records.
              </p>
              <p>
                The system transforms traditional and manual record-keeping processes into a more organized and accessible digital platform. It provides tools for managing population records, generating reports, monitoring data, and analyzing population trends to support informed decision-making.
              </p>
            </div>

            {/* Our Purpose */}
            <div className="about-card">
              <h2>Our Purpose</h2>
              <p>
                BustoSight aims to improve the efficiency, accuracy, and accessibility of population data management in the Municipality of Bustos. By reducing reliance on manual processes and spreadsheets, the system helps authorized personnel manage records more systematically while minimizing data duplication and errors.
              </p>
            </div>

            {/* Key Features */}
            <div className="about-card">
              <h2>Key Features</h2>
              <div className="features-grid">
                <div className="feature-item">
                  <h3>Population Records Management</h3>
                  <p>Allows authorized users to add, view, update, and manage population records through a centralized digital system.</p>
                </div>

                <div className="feature-item">
                  <h3>Data Validation</h3>
                  <p>Helps ensure that submitted records follow the required format and contain valid information, reducing errors and inconsistencies.</p>
                </div>

                <div className="feature-item">
                  <h3>File Upload and Data Import</h3>
                  <p>Provides a convenient way to upload population datasets and integrate records into the system for processing and analysis.</p>
                </div>

                <div className="feature-item">
                  <h3>Reporting and Data Analysis</h3>
                  <p>Generates organized reports and presents population information in a more understandable format to assist users in reviewing and interpreting data.</p>
                </div>

                <div className="feature-item">
                  <h3>Predictive Analytics</h3>
                  <p>Uses historical population data to identify trends and generate population projections. These insights can help support planning and decision-making for future population-related programs and services.</p>
                </div>

                <div className="feature-item">
                  <h3>Secure User Management</h3>
                  <p>Provides role-based access and account management to ensure that system functions and population records are accessible only to authorized users.</p>
                </div>
              </div>
            </div>

            {/* Why BustoSight Matters */}
            <div className="about-card">
              <h2>Why BustoSight Matters</h2>
              <p>
                Population data plays an important role in community planning and development. Accurate and well-organized population records can help local offices better understand the needs of the community and support the development of appropriate programs, services, and policies.
              </p>
              <p>
                BustoSight provides a centralized platform where population information can be managed and analyzed more efficiently. Through digital record management and predictive analytics, the system aims to provide useful information that can support evidence-based decision-making for the Municipality of Bustos.
              </p>
            </div>

            {/* Our Goal */}
            <div className="about-card goal-card">
              <h2>Our Goal</h2>
              <p>
                The goal of BustoSight is to provide a <strong>user-friendly, reliable, and efficient population management system</strong> that supports the digital transformation of population records and helps authorized personnel make better use of available data.
              </p>

              <div className="motto-box">
                <p><strong>BustoSight — Turning Population Data into Meaningful Insights for Better Decision-Making.</strong></p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


