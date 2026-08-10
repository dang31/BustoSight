import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import BarangayList from './pages/BarangayList';
import AddResident from './pages/AddResident';
import Reports from './pages/Reports';
import ManageAccounts from './pages/ManageAccounts';
import ArchiveResidents from './pages/ArchiveResidents';
import UploadData from './pages/UploadData';
import ForcePasswordChange from './pages/ForcePasswordChange';
import ProtectedRoute from './ProtectedRoutes/ProtectedRoute';
import './css/global.css';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/force-password-change" element={<ForcePasswordChange />} />

        {/* Protected routes */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>} />
        <Route path="/barangay" element={<ProtectedRoute><BarangayList /></ProtectedRoute>} />
        <Route path="/add-resident" element={<ProtectedRoute><AddResident /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
        <Route path="/manage-accounts" element={<ProtectedRoute allowedRoles={['Admin', 'Administrator']}><ManageAccounts /></ProtectedRoute>} />
        <Route path="/archive" element={<ProtectedRoute><ArchiveResidents /></ProtectedRoute>} />
        <Route path="/upload" element={<ProtectedRoute allowedRoles={['Admin', 'Administrator', 'Staff']}><UploadData /></ProtectedRoute>} />
      </Routes>
    </Router>
  ); 
}

export default App;
