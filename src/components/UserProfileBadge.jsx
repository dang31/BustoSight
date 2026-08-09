import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function UserProfileBadge() {
  const [userProfile, setUserProfile] = useState(() => {
    const storedUser = localStorage.getItem('popdev_user');
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

  return (
    <div className="header-user-profile no-print">
      <div className="user-avatar-initials">
        {getInitials(userProfile)}
      </div>
      <div className="user-details">
        <span className="user-name" title={getFullName(userProfile)}>
          {getFullName(userProfile)}
        </span>
        <span className="user-role-badge">
          {userRole}
        </span>
      </div>
    </div>
  );
}
