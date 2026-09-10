import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { logTransaction } from '../utils/logger';

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Barangay List', path: '/barangay' },
  { label: 'Reports', path: '/reports' },
  { label: 'Add Residents', path: '/add-resident' },
  { label: 'Upload Files', path: '/upload' },
  { label: 'Manage Account', path: '/manage-accounts' },
  { label: 'Transaction Logs', path: '/transaction-logs' },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const [isOpen, setIsOpen] = useState(false);

  const [userProfile, setUserProfile] = useState(() => {
    const storedUser = sessionStorage.getItem('popdev_user') || localStorage.getItem('popdev_user');
    return storedUser ? JSON.parse(storedUser) : null;
  });

  useEffect(() => {
    async function fetchUser() {
      if (!userProfile) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', user.id)
              .single();
            if (profile) {
              setUserProfile(profile);
              sessionStorage.setItem('popdev_user', JSON.stringify(profile));
              localStorage.setItem('popdev_user', JSON.stringify(profile));
            }
          }
        } catch (err) {
          console.error('Error fetching user profile:', err);
        }
      }
    }
    fetchUser();
  }, [userProfile]);

  const userRole = userProfile?.role || 'Staff';

  const filteredNavItems = NAV_ITEMS.filter((item) => {
    if (item.path === '/transaction-logs') {
      return userRole === 'Admin' || userRole === 'Administrator';
    }
    if (userRole === 'Staff') {
      if (item.path === '/manage-accounts') {
        return false;
      }
    } else if (userRole !== 'Admin' && userRole !== 'Administrator') {
      if (item.path === '/upload' || item.path === '/manage-accounts' || item.path === '/add-resident') {
        return false;
      }
    }
    return true;
  });

  const getInitials = (user) => {
    if (!user) return 'U';
    const first = (user.first_name || '').trim();
    const last = (user.last_name || '').trim();
    if (first && last) {
      return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
    }
    if (first) {
      return first.substring(0, 2).toUpperCase();
    }
    if (user.username) {
      return user.username.substring(0, 2).toUpperCase();
    }
    if (user.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  const getFullName = (user) => {
    if (!user) return 'Logged User';
    const first = (user.first_name || '').trim();
    const last = (user.last_name || '').trim();
    if (first || last) {
      return `${first} ${last}`.trim();
    }
    return user.username || user.email || 'Logged User';
  };

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      await logTransaction({
        action: 'User Logout',
        category: 'Authentication',
        details: `${userProfile?.username || userProfile?.email || 'User'} logged out of the system.`,
        user: userProfile
      });
      await supabase.auth.signOut();
      localStorage.removeItem('popdev_user');
      sessionStorage.removeItem('popdev_user');
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
            {filteredNavItems.map((item) => {
              const isBarangaySection = item.path === '/barangay';
              const isBarangayActive = ['/barangay', '/household', '/resident'].includes(location.pathname);

              return (
                <div key={item.path}>
                  <li
                    className={(item.path === location.pathname || (isBarangaySection && isBarangayActive)) ? 'active' : ''}
                    onClick={() => {
                      if (isBarangaySection) {
                        navigate('/household');
                      } else {
                        navigate(item.path);
                      }
                      closeSidebar();
                    }}
                  >
                    {item.label}
                  </li>
                  {isBarangaySection && (
                    <ul className="sub-menu">
                      <li
                        className={`sub-item ${(location.pathname === '/household' || location.pathname === '/barangay') ? 'active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/household');
                          closeSidebar();
                        }}
                      >
                        Household
                      </li>
                      <li
                        className={`sub-item ${location.pathname === '/resident' ? 'active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/resident');
                          closeSidebar();
                        }}
                      >
                        Resident
                      </li>
                    </ul>
                  )}
                </div>
              );
            })}
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
