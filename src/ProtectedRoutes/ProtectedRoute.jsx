import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function ProtectedRoute({ children, allowedRoles }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [hasAccess, setHasAccess] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  useEffect(() => {
    async function checkUser() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setSession(session);

      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('must_change_password, role')
          .eq('id', session.user.id)
          .single();

        if (profile?.must_change_password) {
          setMustChangePassword(true);
        }

        if (allowedRoles) {
          const storedUser = sessionStorage.getItem('popdev_user') || localStorage.getItem('popdev_user');
          if (profile && !allowedRoles.includes(profile.role)) {
            setHasAccess(false);
          } else if (storedUser) {
            try {
              const userProfile = JSON.parse(storedUser);
              if (!allowedRoles.includes(userProfile.role)) {
                setHasAccess(false);
              }
            } catch (e) {
              setHasAccess(false);
            }
          } else {
            setHasAccess(false);
          }
        }
      }
      setLoading(false);
    }

    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [allowedRoles]);

  if (loading) return <h2>Loading...</h2>;

  if (!session) {
    return <Navigate to="/login" state={{ message: 'Please log in first to access this page.' }} replace />;
  }

  if (mustChangePassword) {
    return <Navigate to="/force-password-change" replace />;
  }

  if (!hasAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}