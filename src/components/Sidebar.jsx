import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Barangay List', path: '/barangay' },
  { label: 'Reports', path: '/reports' },
  { label: 'Add Residents', path: '/add-resident' },
  { label: 'Upload Files', path: '/upload' },
  { label: 'Manage Account', path: '/manage-accounts' },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const storedUser = localStorage.getItem('popdev_user');
  const userProfile = storedUser ? JSON.parse(storedUser) : null;
  const userRole = userProfile?.role || 'Staff';

  const filteredNavItems = NAV_ITEMS.filter((item) => {
    if (userRole !== 'Admin' && userRole !== 'Administrator') {
      if (item.path === '/upload' || item.path === '/manage-accounts' || item.path === '/add-resident') {
        return false;
      }
    }
    return true;
  });

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      await supabase.auth.signOut();
      localStorage.removeItem('popdev_user');
      navigate('/login');
    }
  };

  const closeSidebar = () => setIsOpen(false);

  return (
    <>
      <button className="mobile-nav-toggle" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? '✕' : '☰'}
      </button>

      {isOpen && <div className="sidebar-overlay show" onClick={closeSidebar} />}

      <aside className={`sidebar ${isOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-logo">
          <img src="/popdev-logo.png" alt="PopDev Logo" />
        </div>

        <nav className="nav-menu">
          <p className="label">Population Development</p>
          <ul>
            {filteredNavItems.map((item) => (
              <li
                key={item.path}
                className={pathname === item.path ? 'active' : ''}
                onClick={() => {
                  navigate(item.path);
                  closeSidebar();
                }}
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
    </>
  );
}
