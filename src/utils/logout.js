import { supabase } from "../lib/supabase";
import { logTransaction } from "./logger";
import { INACTIVITY_MINUTES } from "../config/session";

/**
 * Single logout implementation shared by the session-timeout hook, the
 * sidebar's manual logout button and the single-session watchdog, so all three
 * revoke the Supabase session, clear local state and write the same audit
 * entry. Navigation is left to the caller.
 *
 * @param {"timeout" | "manual" | "warning" | "superseded"} reason
 * @returns {Promise<{ user: object|null, message: string, tone: string }>}
 */
export async function logout(reason = "manual") {
  let userProfile = null;

  try {
    const storedUser =
      sessionStorage.getItem("popdev_user") ||
      localStorage.getItem("popdev_user");
    userProfile = storedUser ? JSON.parse(storedUser) : null;
  } catch (_) {
    userProfile = null;
  }

  const who = userProfile?.username || userProfile?.email || "User";

  let message = "You have been logged out.";
  let tone = "info";
  let action = "User Logout";
  let details = `${who} logged out of the system.`;

  if (reason === "timeout") {
    action = "Auto Logout – Session Timeout";
    details = `${who} was automatically logged out after ${INACTIVITY_MINUTES} minutes of inactivity.`;
    message = `You were logged out due to ${INACTIVITY_MINUTES} minutes of inactivity.`;
    tone = "warning";
  } else if (reason === "superseded") {
    action = "Session Revoked – Signed In Elsewhere";
    details = `${who} was signed out because this account was opened on another device.`;
    message = "You were signed out because this account was opened on another device.";
    tone = "info";
  } else if (reason === "warning") {
    action = "Manual Logout (Timeout Warning)";
    details = `${who} chose to logout from the session expiry warning.`;
  }

  try {
    await logTransaction({ action, category: "Authentication", details, user: userProfile });
  } catch (_) {
    /* auditing is non-critical to logging out */
  }

  await supabase.auth.signOut();
  localStorage.removeItem("popdev_user");
  sessionStorage.removeItem("popdev_user");

  return { user: userProfile, message, tone };
}
