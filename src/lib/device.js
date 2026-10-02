const STORAGE_KEY = "bustosight_device_id";

/**
 * Stable per-browser identifier used by single-session enforcement.
 *
 * Deliberately stored in localStorage (not sessionStorage): localStorage is
 * shared by every tab of one browser profile, so all tabs of the same browser
 * report the same device, while a different browser or machine can never share
 * it. sessionStorage would be per-tab and would make a second tab look like a
 * second device.
 *
 * Never clear this on logout — it must survive so that signing back in on the
 * same device is still recognised as the same device.
 */
export function getDeviceId() {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;

    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

    localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch (_) {
    // Private mode / storage disabled — fall back to a per-tab value so the app
    // still works, it just won't be recognised as the same device later.
    return `dev-session-${Date.now().toString(36)}`;
  }
}