/**
 * Single source of truth for inactivity-timeout settings.
 * Imported by the session timeout hook and the shared logout helper so the
 * displayed "5 minutes" copy can never drift from the real timer.
 */

/** Log the user out after this much inactivity. */
export const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/** Warn the user this long before the deadline. */
export const WARNING_MS = 60 * 1000; // 60 seconds

export const WARNING_SECONDS = Math.round(WARNING_MS / 1000);

export const INACTIVITY_MINUTES = Math.round(TIMEOUT_MS / 60000);
