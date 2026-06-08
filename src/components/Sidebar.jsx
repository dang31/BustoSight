import { useNavigate, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Barangay List', path: '/barangay' },
  { label: 'Reports', path: '/reports' },
  { label: 'Add Residents', path: '/add-resident' },
  { label: 'Manage Account', path: '/manage-accounts' },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      sessionStorage.clear();
      navigate('/login');
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <img src="/popdev-logo.png" alt="PopDev Logo" />
      </div>

      <nav className="nav-menu">
        <p className="label">Population Development</p>
        <ul>
          {NAV_ITEMS.map((item) => (
            <li
              key={item.path}
              className={pathname === item.path ? 'active' : ''}
              onClick={() => navigate(item.path)}
            >
              {item.label}
            </li>
          ))}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <button className="logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </aside>
  );
}
