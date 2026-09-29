import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import Toast from "./Toast";
import ConfirmDialog from "./ConfirmDialog";
import AdminPasswordDialog from "./AdminPasswordDialog";
import { verifyAdminPassword } from "../../utils/adminPassword";
import "./Feedback.css";

const FeedbackContext = createContext(null);

/**
 * FeedbackProvider
 *
 * Owns the single toast host and the two dialogs, so they can be triggered
 * imperatively from anywhere via:
 *
 *   const toast = useToast();
 *   toast.success("Saved.");
 *
 *   const confirm = useConfirm();
 *   if (!await confirm({ title, message, danger })) return;
 *
 *   const requestAdminPassword = useAdminPassword();
 *   const pwd = await requestAdminPassword({ actionTitle });
 *   if (pwd === null) return;   // cancelled
 *
 * The host is mounted once at the app root so toasts survive navigation.
 */
export default function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const [adminState, setAdminState] = useState(null);

  const nextId = useRef(0);
  const timers = useRef(new Map());

  // Track per-toast dismissal timers so unmount or dismiss can't leave one
  // firing against a stale id.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((t) => clearTimeout(t));
      pending.clear();
    };
  }, []);

  const dismissToast = useCallback((id) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (message, type = "info", duration) => {
      if (!message) return null;
      const id = ++nextId.current;
      const ms = duration ?? (type === "error" ? 6000 : 4000);

      setToasts((prev) => [...prev, { id, message: String(message), type }]);

      timers.current.set(
        id,
        setTimeout(() => {
          timers.current.delete(id);
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, ms),
      );

      return id;
    },
    [],
  );

  const toast = useRef({
    success: (m, d) => pushToast(m, "success", d),
    error: (m, d) => pushToast(m, "error", d),
    info: (m, d) => pushToast(m, "info", d),
    warning: (m, d) => pushToast(m, "warning", d),
  }).current;

  // ── confirm() ──────────────────────────────────────────────────────────────
  // Resolves true when confirmed, false when cancelled. Never rejects.
  const confirm = useCallback(
    (options = {}) =>
      new Promise((resolve) => {
        setConfirmState({ ...options, resolve });
      }),
    [],
  );

  const settleConfirm = useCallback(
    (result) => {
      setConfirmState((prev) => {
        if (prev) prev.resolve(result);
        return null;
      });
    },
    [],
  );

  // ── requestAdminPassword() ────────────────────────────────────────────────
  // Resolves the entered password, or null when cancelled.
  const requestAdminPassword = useCallback(
    (options = {}) =>
      new Promise((resolve) => {
        setAdminState({ ...options, resolve });
      }),
    [],
  );

  const settleAdmin = useCallback((result) => {
    setAdminState((prev) => {
      if (prev) prev.resolve(result);
      return null;
    });
  }, []);

  // Escape closes the topmost dialog.
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== "Escape") return;
      if (confirmState) settleConfirm(false);
      else if (adminState) settleAdmin(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmState, adminState, settleConfirm, settleAdmin]);

  return (
    <FeedbackContext.Provider
      value={{ toast, confirm, requestAdminPassword, verifyAdminPassword }}
    >
      {children}

      <Toast toasts={toasts} onDismiss={dismissToast} />

      {confirmState && (
        <ConfirmDialog
          options={confirmState}
          onCancel={() => settleConfirm(false)}
          onConfirm={() => settleConfirm(true)}
        />
      )}

      {adminState && (
        <AdminPasswordDialog
          options={adminState}
          onCancel={() => settleAdmin(null)}
          onResolved={(value) => settleAdmin(value)}
        />
      )}
    </FeedbackContext.Provider>
  );
}

function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) {
    throw new Error("Feedback hooks must be used inside <FeedbackProvider>.");
  }
  return ctx;
}

export function useToast() {
  return useFeedback().toast;
}

export function useConfirm() {
  return useFeedback().confirm;
}

export function useAdminPassword() {
  return useFeedback().requestAdminPassword;
}

export { verifyAdminPassword };
