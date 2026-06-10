import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import '../css/LoginPage.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .eq('status', 'Active')
        .single();

      if (error || !data) {
        setErrorMsg('Invalid username or password, or account is inactive.');
        return;
      }

      // Store user session info if needed
      localStorage.setItem('popdev_user', JSON.stringify(data));
      navigate('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      setErrorMsg('An error occurred during login.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Shared background layers */}
      <div className="bg-image" />
      <div className="overlay" />

      {/* Back button */}
      <Link to="/" className="back-btn">← Back to Home</Link>

      <div className="login-container">
        {/* Logos */}
        <header className="login-logos">
          <img src="/bustos-logo.png" alt="Bustos Logo" className="login-logo" />
          <img src="/bp-logo.png" alt="Bagong Pilipinas" className="login-logo" />
          <img src="/popdev-logo.png" alt="Commission on Population" className="login-logo" />
        </header>

        {/* Login Card */}
        <div className="login-card">
          {/* Left (blue) panel */}
          <div className="card-left">
            <h1>Authorized Access</h1>
            <p>
              Please sign in using your authorized account to access the
              Bustos Population Development System.
            </p>
          </div>

          {/* Right (form) panel */}
          <div className="card-right">
            <h2>Login</h2>
            <p className="login-instruction">Please log in with your official credentials.</p>

            {errorMsg && <div className="login-error-msg" style={{ color: '#ff4d4d', marginBottom: '15px', fontSize: '14px', fontWeight: 'bold' }}>{errorMsg}</div>}

            <form id="loginForm" onSubmit={handleLogin}>
              <div className="login-input-group">
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                />
              </div>

              <div className="login-input-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>

              <button type="submit" className={`btn-login-submit ${isLoading ? 'loading' : ''}`} id="loginSubmitBtn" disabled={isLoading}>
                {isLoading ? 'Authenticating...' : 'Login'}
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <footer className="login-footer">
          <p>© 2026 Bustos Population Development System</p>
          <p>Developed by BS Information Technology Students – Bulacan State University</p>
        </footer>
      </div>
    </div>
  );
}
