import { useEffect, useRef, useCallback } from "react";

const TIMEOUT_MS  = 10 * 60 * 1000; // 10 minutes
const WARNING_MS  =  2 * 60 * 1000; //  2 minutes before expiry (i.e. at 8 mins)

// Events that count as "activity"
const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "click",
  "wheel",
];

/**
 * useSessionTimeout
 *
 * @param {Function} onTimeout   – called when the 10-min deadline is reached
 * @param {Function} onWarning   – called when 2 mins remain (optional)
 * @param {Function} onDismiss   – called when the warning is dismissed / session extended (optional)
 * @param {boolean}  active      – only run while true (pass false on public/login pages)
 */
export default function useSessionTimeout({
  onTimeout,
  onWarning,
  onDismiss,
  active = true,
}) {
  const timeoutRef = useRef(null);
  const warningRef = useRef(null);
  const warningShownRef = useRef(false);

  const clearTimers = useCallback(() => {
    clearTimeout(timeoutRef.current);
    clearTimeout(warningRef.current);
  }, []);

  const resetTimers = useCallback(() => {
    clearTimers();

    // Hide warning if it was showing
    if (warningShownRef.current) {
      warningShownRef.current = false;
      onDismiss?.();
    }

    // Warning fires at TIMEOUT_MS - WARNING_MS (i.e. 8 min mark)
    warningRef.current = setTimeout(() => {
      warningShownRef.current = true;
      onWarning?.();
    }, TIMEOUT_MS - WARNING_MS);

    // Hard logout at TIMEOUT_MS (10 min mark)
    timeoutRef.current = setTimeout(() => {
      onTimeout();
    }, TIMEOUT_MS);
  }, [clearTimers, onTimeout, onWarning, onDismiss]);

  useEffect(() => {
    if (!active) return;

    // Start timers on mount
    resetTimers();

    // Reset on every activity event
    const handleActivity = () => resetTimers();
    ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, handleActivity, { passive: true })
    );

    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach((evt) =>
        window.removeEventListener(evt, handleActivity)
      );
    };
  }, [active, resetTimers, clearTimers]);

  /** Call this when the user clicks "Stay Logged In" in the warning modal */
  const extendSession = useCallback(() => {
    resetTimers();
  }, [resetTimers]);

  return { extendSession };
}
