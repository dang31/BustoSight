import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './lib/supabase';
import useSessionTimeout from './hooks/useSessionTimeout';
import useSingleSession from './hooks/useSingleSession';
import { logout } from './utils/logout';
import SessionTimeoutModal from './components/Common/SessionTimeoutModal';
import FeedbackProvider from './components/Feedback/FeedbackProvider';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import BarangayList from './pages/BarangayList';
import AddResident from './pages/AddResident';
import Reports from './pages/Reports';
import ManageAccounts from './pages/ManageAccounts';
import Programs from './pages/Programs';
import ArchiveResidents from './pages/ArchiveResidents';
import UploadData from './pages/UploadData';
import TransactionLogs from './pages/TransactionLogs';
import ForcePasswordChange from './pages/ForcePasswordChange';
import ProtectedRoute from './ProtectedRoutes/ProtectedRoute';
import './css/global.css';

// Public routes that should NOT trigger session timeout
const PUBLIC_PATHS = ['/', '/login', '/force-password-change'];

function AppInner() {
  const navigate = useNavigate();
  const location = useLocation();

  const [showWarning, setShowWarning] = useState(false);
  // null means "no warning window open" — distinct from 0, so an expired
  // countdown can be told apart from "never started counting".
  const [countdown, setCountdown]     = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // The hook's tick and the countdown reaching zero can both fire; the ref
  // makes performLogout idempotent so we sign out and audit-log exactly once.
  const loggingOutRef = useRef(false);

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

  // Re-arm the logout guard whenever a new session starts, so a second timeout
  // in the same page visit still logs out.
  useEffect(() => {
    if (isAuthenticated) loggingOutRef.current = false;
  }, [isAuthenticated]);

  // ── Logout handler ────────────────────────────────────────────────────────
  const performLogout = useCallback(async (reason = 'timeout') => {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    setShowWarning(false);
    setCountdown(null);
    const { message, tone } = await logout(reason);
    navigate('/login', { state: { message, tone }, replace: true });
  }, [navigate]);

  // ── Single-session watchdog ───────────────────────────────────────────────
  // Signs this device out when the account is opened elsewhere. Shares the
  // logout guard above so a takeover racing the idle timeout logs out once.
  const handleSuperseded = useCallback(() => {
    performLogout('superseded');
  }, [performLogout]);

  useSingleSession({
    active: isAuthenticated && !isPublicPage,
    onSuperseded: handleSuperseded,
  });

  // ── Session timeout hook ──────────────────────────────────────────────────
  const { extendSession, warningSeconds, inactivityMinutes } = useSessionTimeout({
    active: isAuthenticated && !isPublicPage,
    onWarning: (remaining) => {
      setCountdown(remaining);
      setShowWarning(true);
    },
    onDismiss: () => {
      setShowWarning(false);
      setCountdown(null);
    },
    onTimeout: () => {
      performLogout('timeout');
    },
  });

  // ── Live countdown inside the modal ──────────────────────────────────────
  useEffect(() => {
    if (countdown === null) return;
    const interval = setInterval(() => {
      setCountdown((prev) => (prev === null ? null : Math.max(prev - 1, 0)));
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown === null]);

  // Guarantee the logout happens even if the tick interval is throttled.
  useEffect(() => {
    if (countdown === null || countdown > 0) return;
    performLogout('timeout');
  }, [countdown, performLogout]);

  // ── Extend handler ────────────────────────────────────────────────────────
  const handleExtend = () => {
    extendSession();
    setShowWarning(false);
    setCountdown(null);
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
        <Route path="/programs" element={
          <ProtectedRoute allowedRoles={['Admin', 'Administrator']}>
            <Programs />
          </ProtectedRoute>} />
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
        countdown={countdown ?? 0}
        warningSeconds={warningSeconds}
        inactivityMinutes={inactivityMinutes}
        onExtend={handleExtend}
        onLogout={() => performLogout('warning')}
      />
    </>
  );
}

function App() {
  return (
    <Router>
      <FeedbackProvider>
        <AppInner />
      </FeedbackProvider>
    </Router>
  );
}

export default App;
