import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function ProtectedRoute({ children, allowedRoles }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [hasAccess, setHasAccess] = useState(true);

  useEffect(() => {
    async function checkUser() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setSession(session);

      if (session && allowedRoles) {
        const storedUser = localStorage.getItem('popdev_user');
        if (storedUser) {
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

  if (!hasAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}