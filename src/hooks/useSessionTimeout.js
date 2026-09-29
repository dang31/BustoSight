import { useEffect, useRef, useCallback } from "react";
import { TIMEOUT_MS, WARNING_MS, WARNING_SECONDS, INACTIVITY_MINUTES } from "../config/session";

const TICK_MS = 1000;
/** mousemove fires very often; only treat it as activity once per second. */
const ACTIVITY_THROTTLE_MS = 1000;

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
 * Tracks a wall-clock deadline rather than a bare setTimeout: browsers throttle
 * and freeze timers in background tabs, so a setTimeout can fire long after it
 * was due. Comparing Date.now() against the deadline on every tick means an
 * already-expired session logs out immediately, the moment the tab is usable.
 *
 * @param {Function} onTimeout   – called when the inactivity deadline is reached
 * @param {Function} onWarning   – called once when the warning window opens (optional)
 * @param {Function} onDismiss   – called when the warning is dismissed / session extended (optional)
 * @param {boolean}  active      – only run while true (pass false on public/login pages)
 *
 * @returns {{ extendSession: Function, warningSeconds: number, inactivityMinutes: number }}
 */
export default function useSessionTimeout({
  onTimeout,
  onWarning,
  onDismiss,
  active = true,
}) {
  // Callbacks live in a ref so re-rendering the consumer cannot re-arm the
  // deadline. This was the previous bug: inline callbacks made the timers
  // restart on every render, so the timeout never actually elapsed.
  const callbacksRef = useRef({ onTimeout, onWarning, onDismiss });
  useEffect(() => {
    callbacksRef.current = { onTimeout, onWarning, onDismiss };
  });

  const deadlineRef = useRef(0);
  const warnedRef = useRef(false);
  const warningOpenRef = useRef(false);
  const lastActivityRef = useRef(0);

  /** Push the deadline out a full window and close the warning if it is up. */
  const extendSession = useCallback(() => {
    deadlineRef.current = Date.now() + TIMEOUT_MS;
    warnedRef.current = false;
    if (warningOpenRef.current) {
      warningOpenRef.current = false;
      callbacksRef.current.onDismiss?.();
    }
  }, []);

  useEffect(() => {
    if (!active) return;

    deadlineRef.current = Date.now() + TIMEOUT_MS;
    warnedRef.current = false;
    warningOpenRef.current = false;

    const handleActivity = () => {
      // While the warning is on screen the user must choose explicitly —
      // a stray mouse bump should not silently keep the session alive.
      if (warningOpenRef.current) return;

      const now = Date.now();
      if (now - lastActivityRef.current < ACTIVITY_THROTTLE_MS) return;

      lastActivityRef.current = now;
      deadlineRef.current = now + TIMEOUT_MS;
      warnedRef.current = false;
    };

    const interval = setInterval(() => {
      const remaining = deadlineRef.current - Date.now();

      if (remaining <= 0) {
        clearInterval(interval);
        callbacksRef.current.onTimeout?.();
        return;
      }

      
      if (remaining <= WARNING_MS && !warnedRef.current) {
        warnedRef.current = true;
        warningOpenRef.current = true;
        callbacksRef.current.onWarning?.(Math.ceil(remaining / 1000));
      }
    }, TICK_MS);

    ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, handleActivity, { passive: true })
    );

    return () => {
      clearInterval(interval);
      ACTIVITY_EVENTS.forEach((evt) =>
        window.removeEventListener(evt, handleActivity)
      );
    };
  }, [active, extendSession]);

  return {
    extendSession,
    warningSeconds: WARNING_SECONDS,
    inactivityMinutes: INACTIVITY_MINUTES,
  };
}
