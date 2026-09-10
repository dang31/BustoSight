import { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import PasswordInput from "../components/Common/PasswordInput";
import { logTransaction } from "../utils/logger";
import "../css/LoginPage.css";

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const location = useLocation();
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (location.state?.message) {
      const isTimeoutMsg = location.state.message.toLowerCase().includes('inactivity');
      setToast({
        message: location.state.message,
        type: isTimeoutMsg ? "warning" : "error",
      });
      setTimeout(() => setToast(null), 5000);

      // Clear state so it doesn't reappear on refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg("");

    try {
      // Supabase Auth requires an email. If the user enters a username,
      // we first look up their actual email from the profiles table.
      let loginEmail = username;

      if (!username.includes("@")) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("email")
          .eq("username", username)
          .single();

        if (profileData && profileData.email) {
          loginEmail = profileData.email;
        } else {
          // Fallback if no email is set in the profile but they try to log in
          loginEmail = `${username}@bustos.gov.ph`;
        }
      }

      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: loginEmail,
          password: password,
        });

      if (authError || !authData.user) {
        // Check local storage accounts fallback for testing
        const localUsers =
          JSON.parse(localStorage.getItem("popdevUsers")) || [];
        const localMatch = localUsers.find(
          (u) =>
            (u.username || "").toLowerCase() === username.toLowerCase() ||
            (u.email || "").toLowerCase() === username.toLowerCase(),
        );

        if (
          localMatch &&
          (localMatch.archived || localMatch.status !== "Active")
        ) {
          setErrorMsg(
            "Your account is deactivated. Contact the admin to activate it.",
          );
          return;
        }

        setErrorMsg(authError?.message || "Invalid username or password.");
        return;
      }

      // Fetch the user's profile to check their status and archiving
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authData.user.id)
        .single();

      if (
        profileError ||
        !profile ||
        profile.archived ||
        profile.status !== "Active"
      ) {
        // If account is archived, inactive, or missing, log them out immediately
        await supabase.auth.signOut();
        setErrorMsg(
          "Your account is deactivated. Contact the admin to activate it.",
        );
        return;
      }

      // Store user session info for the frontend
      const userPayload = { ...profile, password: password };
      sessionStorage.setItem("popdev_user", JSON.stringify(userPayload));
      localStorage.setItem("popdev_user", JSON.stringify(userPayload));

      // Log successful login transaction
      logTransaction({
        action: "User Login",
        category: "Authentication",
        details: `User @${profile.username || username} logged in successfully as ${profile.role || 'Staff'}.`,
        user: userPayload,
      });

      navigate("/dashboard");
    } catch (err) {
      console.error("Login error:", err);
      setErrorMsg("An error occurred during login.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Shared background layers */}
      <div className="bg-image" />
      <div className="overlay" />

      {/* Toast Notification */}
      {toast && (
        <div
          className={`login-toast login-toast-${toast.type} animate-fade-up`}
        >
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)}>×</button>
        </div>
      )}

      {/* Back button */}
      <Link to="/" className="back-btn">
        ← Back to Home
      </Link>

      <div className="login-container">
        {/* Logos */}
        <header className="login-logos">
          <img
            src="/bustos-logo.png"
            alt="Bustos Logo"
            className="login-logo"
          />
          <img
            src="/bp-logo.png"
            alt="Bagong Pilipinas"
            className="login-logo"
          />
          <img
            src="/popdev-logo.png"
            alt="Commission on Population"
            className="login-logo"
          />
        </header>

        {/* Login Card */}
        <div className="login-card">
          {/* Left (blue) panel */}
          <div className="card-left">
            <h1>Authorized Access</h1>
            <p>
              Please sign in using your authorized account to access the Bustos
              Population Development System.
            </p>
          </div>

          {/* Right (form) panel */}
          <div className="card-right">
            <h2>Login</h2>
            <p className="login-instruction">
              Please log in with your official credentials.
            </p>

            {errorMsg && (
              <div
                className="login-error-msg"
                style={{
                  color: "#ff4d4d",
                  marginBottom: "15px",
                  fontSize: "14px",
                  fontWeight: "bold",
                }}
              >
                {errorMsg}
              </div>
            )}

            <form id="loginForm" onSubmit={handleLogin}>
              <div className="login-input-group">
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                />
              </div>

              <div className="login-input-group">
                <label htmlFor="password">Password</label>
                <PasswordInput
                  id="password"
                  name="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                className={`btn-login-submit ${isLoading ? "loading" : ""}`}
                id="loginSubmitBtn"
                disabled={isLoading}
              >
                {isLoading ? "Authenticating..." : "Login"}
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <footer className="login-footer">
          <p>© 2026 Bustos Population Development System</p>
          <p>
            Developed by BS Information Technology Students – Bulacan State
            University
          </p>
        </footer>
      </div>
    </div>
  );
}
