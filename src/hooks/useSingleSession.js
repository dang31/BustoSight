import { useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { getDeviceId } from "../lib/device";

/** How often to check whether we still own the session. */
const CHECK_MS = 15000;

/**
 * useSingleSession
 *
 * Enforces one active session per account across devices. On sign-in the
 * enforce-single-session edge function records this browser's device_id as the
 * owner; this hook checks that the row still belongs to us and, if not, reports
 * that the account was opened somewhere else.
 *
 * Every tab of one browser shares a device_id (localStorage), so a second tab
 * does not trip this. A different browser or machine has a different device_id
 * and does trip it.
 *
 * Checks on a timer while the tab is visible, plus immediately when the tab
 * regains focus or becomes visible again — so a user who switches back to the
 * kicked tab is signed out at once rather than waiting for the next tick.
 *
 * @param {Function} onSuperseded – called once when another device has taken over
 * @param {boolean}  active      – only run while true
 */
export default function useSingleSession({ onSuperseded, active = true }) {
  const supersededRef = useRef(false);
  const onSupersededRef = useRef(onSuperseded);

  useEffect(() => {
    onSupersededRef.current = onSuperseded;
  });

  useEffect(() => {
    if (!active) return undefined;

    let cancelled = false;

    const check = async () => {
      // Don't burn requests, and don't act on a tab the user isn't looking at.
      if (cancelled || supersededRef.current) return;
      if (document.visibilityState !== "visible") return;

      try {
        const { data, error } = await supabase.auth.getSession();
        const session = data?.session;
        if (!session) return;

        const { data: owner, error: ownerError } = await supabase
          .from("user_sessions")
          .select("device_id")
          .eq("user_id", session.user.id)
          .maybeSingle();

        // Ignore transient failures — a missing table or a network blip must
        // not sign anyone out. Only an explicit mismatch is acted on.
        if (error || ownerError || !owner?.device_id) return;
        if (cancelled || supersededRef.current) return;

        if (owner.device_id !== getDeviceId()) {
          supersededRef.current = true;
          onSupersededRef.current?.();
        }
      } catch (_) {
        /* never let a poll failure escalate into a logout */
      }
    };

    const interval = setInterval(check, CHECK_MS);

    // A returning tab should be checked immediately, not on the next tick.
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
    };
  }, [active]);

  // A fresh sign-in should be able to trip the watchdog again.
  useEffect(() => {
    if (active) supersededRef.current = false;
  }, [active]);
}