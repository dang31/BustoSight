import {
  CheckCircleIcon,
  AlertCircleIcon,
  InfoIcon,
  WarningTriangleIcon,
} from "./icons";

const ICONS = {
  success: CheckCircleIcon,
  error: AlertCircleIcon,
  info: InfoIcon,
  warning: WarningTriangleIcon,
};

/**
 * Toast — the single stacked toast host for the whole app.
 * Mounted once by FeedbackProvider so toasts survive route changes.
 */
export default function Toast({ toasts, onDismiss }) {
  if (!toasts.length) return null;

  return (
    <div className="fb-toast-host" role="region" aria-live="polite" aria-label="Notifications">
      {toasts.map((t) => {
        const Icon = ICONS[t.type] || InfoIcon;
        return (
          <div key={t.id} className={`fb-toast fb-toast-${t.type}`} role="status">
            <span className="fb-toast-icon">
              <Icon />
            </span>
            <span className="fb-toast-message">{t.message}</span>
            <button
              type="button"
              className="fb-toast-close"
              onClick={() => onDismiss(t.id)}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
