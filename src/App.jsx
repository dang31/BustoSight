import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabase';
import { logTransaction } from './utils/logger';
import useSessionTimeout from './hooks/useSessionTimeout';
import SessionTimeoutModal from './components/Common/SessionTimeoutModal';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import BarangayList from './pages/BarangayList';
import AddResident from './pages/AddResident';
import Reports from './pages/Reports';
import ManageAccounts from './pages/ManageAccounts';
import ArchiveResidents from './pages/ArchiveResidents';
import UploadData from './pages/UploadData';
import TransactionLogs from './pages/TransactionLogs';
import ForcePasswordChange from './pages/ForcePasswordChange';
import ProtectedRoute from './ProtectedRoutes/ProtectedRoute';
import './css/global.css';

// Public routes that should NOT trigger session timeout
const PUBLIC_PATHS = ['/', '/login', '/force-password-change'];
const WARNING_SECONDS = 2 * 60; // 2-minute countdown shown in modal

function AppInner() {
  const navigate = useNavigate();
  const location = useLocation();

  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown]     = useState(WARNING_SECONDS);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Only activate timeout on protected (non-public) pages
  const isPublicPage = PUBLIC_PATHS.includes(location.pathname);

  // Check auth state so we don't run the timeout on guests
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
      if (!session) {
        localStorage.removeItem('popdev_user');
        sessionStorage.removeItem('popdev_user');
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsAuthenticated(!!session);
      if (!session) {
        localStorage.removeItem('popdev_user');
        sessionStorage.removeItem('popdev_user');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Logout handler ────────────────────────────────────────────────────────
  const performLogout = useCallback(async (reason = 'timeout') => {
    setShowWarning(false);
    try {
      const storedUser = sessionStorage.getItem('popdev_user') || localStorage.getItem('popdev_user');
      const userProfile = storedUser ? JSON.parse(storedUser) : null;
      await logTransaction({
        action: reason === 'timeout' ? 'Auto Logout – Session Timeout' : 'Manual Logout (Timeout Warning)',
        category: 'Authentication',
        details: reason === 'timeout'
          ? `${userProfile?.username || userProfile?.email || 'User'} was automatically logged out after 10 minutes of inactivity.`
          : `${userProfile?.username || userProfile?.email || 'User'} chose to logout from the session expiry warning.`,
        user: userProfile,
      });
    } catch (_) { /* non-critical */ }
    await supabase.auth.signOut();
    localStorage.removeItem('popdev_user');
    sessionStorage.removeItem('popdev_user');
    navigate('/login', { state: { message: reason === 'timeout'
      ? 'You were logged out due to 10 minutes of inactivity.'
      : 'You have been logged out.' }, replace: true });
  }, [navigate]);

  // ── Session timeout hook ──────────────────────────────────────────────────
  const { extendSession } = useSessionTimeout({
    active: isAuthenticated && !isPublicPage,
    onWarning: () => {
      setCountdown(WARNING_SECONDS);
      setShowWarning(true);
    },
    onDismiss: () => {
      setShowWarning(false);
    },
    onTimeout: () => {
      performLogout('timeout');
    },
  });

  // ── Live countdown inside the modal ──────────────────────────────────────
  useEffect(() => {
    if (!showWarning) return;
    setCountdown(WARNING_SECONDS);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showWarning]);

  // ── Extend handler ────────────────────────────────────────────────────────
  const handleExtend = () => {
    extendSession();
    setShowWarning(false);
  };

  return (
    <>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/force-password-change" element={<ForcePasswordChange />} />

        {/* Protected routes */}
        <Route path="/dashboard" element={
          <ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/barangay" element={<ProtectedRoute><BarangayList defaultMode="household" /></ProtectedRoute>} />
        <Route path="/household" element={<ProtectedRoute><BarangayList defaultMode="household" /></ProtectedRoute>} />
        <Route path="/resident" element={<ProtectedRoute><BarangayList defaultMode="resident" /></ProtectedRoute>} />
        <Route path="/add-resident" element={<ProtectedRoute><AddResident /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
        <Route path="/manage-accounts" element={
          <ProtectedRoute allowedRoles={['Admin', 'Administrator']}>
            <ManageAccounts />
          </ProtectedRoute>} />
        <Route path="/transaction-logs" element={
          <ProtectedRoute allowedRoles={['Admin', 'Administrator']}>
            <TransactionLogs />
          </ProtectedRoute>} />
        <Route path="/archive" element={<ProtectedRoute><ArchiveResidents /></ProtectedRoute>} />
        <Route path="/upload" element={
          <ProtectedRoute allowedRoles={['Admin', 'Administrator', 'Staff']}>
            <UploadData />
          </ProtectedRoute>} />
      </Routes>

      {/* Global session timeout warning modal */}
      <SessionTimeoutModal
        show={showWarning}
        countdown={countdown}
        onExtend={handleExtend}
        onLogout={() => performLogout('manual')}
      />
    </>
  );
}

function App() {
  return (
    <Router>
      <AppInner />
    </Router>
  );
}

export default App;
