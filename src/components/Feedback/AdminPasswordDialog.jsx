import { useState, useRef, useEffect } from "react";
import PasswordInput from "../Common/PasswordInput";
import { ShieldIcon } from "./icons";
import { verifyAdminPassword } from "../../utils/adminPassword";

/**
 * AdminPasswordDialog — replacement for prompt("Security Check: ...").
 *
 * Verifies the password server-side and only resolves once it is correct, so
 * callers receive a password they know is valid. Resolves null when cancelled.
 */
export default function AdminPasswordDialog({ options, onCancel, onResolved }) {
  const {
    actionTitle = "Admin Password Required",
    actionDescription = "Please enter your administrator password to authorize this action.",
    confirmLabel = "Verify",
  } = options;

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!password.trim()) {
      setError("Admin password is required.");
      return;
    }

    setLoading(true);
    const ok = await verifyAdminPassword(password);

    // The dialog may have unmounted while the check was in flight.
    if (!aliveRef.current) return;

    if (!ok) {
      setError("Incorrect admin password. Please try again.");
      setPassword("");
      setLoading(false);
      return;
    }

    onResolved(password);
  };

  return (
    <div
      className="fb-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fb-admin-title"
      onClick={loading ? undefined : onCancel}
    >
      <div className="fb-box" onClick={(e) => e.stopPropagation()}>
        <div className="fb-box-header">
          <span className="fb-box-icon warning">
            <ShieldIcon />
          </span>
          <div className="fb-box-titles">
            <h3 className="fb-box-title" id="fb-admin-title">
              {actionTitle}
            </h3>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="fb-box-body">
            <p className="fb-box-text">{actionDescription}</p>

            <div className="fb-field">
              <label className="fb-field-label" htmlFor="fb-admin-password">
                Admin Password <span className="req">*</span>
              </label>
              <PasswordInput
                id="fb-admin-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                placeholder="Enter your current password"
                autoFocus
                disabled={loading}
              />
              {error && <p className="fb-error-text">{error}</p>}
            </div>
          </div>

          <div className="fb-box-footer">
            <button
              type="button"
              className="fb-btn fb-btn-cancel"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="fb-btn fb-btn-primary"
              disabled={loading}
            >
              {loading ? "Verifying…" : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
