import { useEffect, useRef } from "react";
import { WarningTriangleIcon, AlertCircleIcon, InfoIcon } from "./icons";

const VARIANTS = {
  danger: { Icon: WarningTriangleIcon, tone: "danger", confirmClass: "fb-btn-danger" },
  warning: { Icon: WarningTriangleIcon, tone: "warning", confirmClass: "fb-btn-danger" },
  default: { Icon: InfoIcon, tone: "neutral", confirmClass: "fb-btn-primary" },
};

/**
 * ConfirmDialog — replacement for window.confirm().
 * Driven by useConfirm(); always resolves, never rejects.
 */
export default function ConfirmDialog({ options, onCancel, onConfirm }) {
  const {
    title = "Are you sure?",
    message = "",
    details = [],
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    variant = "default",
  } = options;

  const { Icon, tone, confirmClass } = VARIANTS[variant] || VARIANTS.default;
  const isDestructive = tone !== "neutral";
  const initialFocusRef = useRef(null);

  useEffect(() => {
    // For destructive actions, focus the CANCEL button so a stray Enter (or a
    // muscle-memory Space on a focused button) cannot delete anything.
    initialFocusRef.current?.focus();
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div
      className="fb-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fb-confirm-title"
      onClick={onCancel}
    >
      <div className="fb-box" onClick={(e) => e.stopPropagation()}>
        <div className="fb-box-header">
          <span className={`fb-box-icon ${tone}`}>
            <Icon />
          </span>
          <div className="fb-box-titles">
            <h3 className="fb-box-title" id="fb-confirm-title">
              {title}
            </h3>
          </div>
        </div>

        <div className="fb-box-body">
          {message && <p className="fb-box-text">{message}</p>}
          {details.length > 0 && (
            <ul className="fb-box-list">
              {details.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="fb-box-footer">
          <button
            type="button"
            ref={isDestructive ? initialFocusRef : undefined}
            className="fb-btn fb-btn-cancel"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            ref={isDestructive ? undefined : initialFocusRef}
            className={`fb-btn ${confirmClass}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
