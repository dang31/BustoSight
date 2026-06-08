import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import BarangayList from './pages/BarangayList';
import AddResident from './pages/AddResident';
import Reports from './pages/Reports';
import ManageAccounts from './pages/ManageAccounts';
import ArchiveResidents from './pages/ArchiveResidents';
import './css/global.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/barangay" element={<BarangayList />} />
        <Route path="/add-resident" element={<AddResident />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/manage-accounts" element={<ManageAccounts />} />
        <Route path="/archive" element={<ArchiveResidents />} />
      </Routes>
    </Router>
  );
}

export default App;
