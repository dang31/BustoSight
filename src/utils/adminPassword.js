import { supabase } from "../lib/supabase";

/**
 * Verify an admin password without disturbing the current session.
 *
 * Calls GoTrue's password-grant endpoint directly instead of going through
 * `supabase.auth.signInWithPassword`. That matters for two reasons:
 *
 *  1. Creating a second Supabase client registers a second GoTrueClient under
 *     the same storage key, which logs "Multiple GoTrueClient instances
 *     detected in the same browser context" and can behave unpredictably when
 *     both touch storage concurrently. Only lib/supabase.js should own a client.
 *
 *  2. Reusing the app's own client would replace the signed-in user's session
 *     with the admin's. A raw fetch has no session handling at all, so the
 *     current session cannot be mutated, refreshed, or overwritten, and the
 *     returned tokens are discarded rather than persisted.
 *
 * Previously this logic was copy-pasted across BarangayList (x3),
 * ArchiveResidents, Programs, TransactionLogs and ManageAccounts.
 *
 * @param {string} password
 * @returns {Promise<boolean>} true when the password belongs to an admin account
 */
export async function verifyAdminPassword(password) {
  const pwd = (password ?? "").trim();
  if (!pwd) return false;

  const emailsToTry = [];

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.email) emailsToTry.push(user.email);
  } catch (e) {
    /* fall through to the stored profile / defaults below */
  }

  const storedUserStr =
    sessionStorage.getItem("popdev_user") ||
    localStorage.getItem("popdev_user");
  if (storedUserStr) {
    try {
      const storedUser = JSON.parse(storedUserStr);
      if (storedUser?.email) emailsToTry.push(storedUser.email);
      if (storedUser?.username) {
        emailsToTry.push(`${storedUser.username}@bustos.gov.ph`);
      }
    } catch (e) {
      /* ignore malformed storage */
    }
  }

  emailsToTry.push("admin@bustos.gov.ph");

  const uniqueEmails = [...new Set(emailsToTry.filter(Boolean))];
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.error("verifyAdminPassword: Supabase env vars are not set.");
    return false;
  }

  for (const email of uniqueEmails) {
    try {
      const response = await fetch(
        `${url}/auth/v1/token?grant_type=password`,
        {
          method: "POST",
          headers: {
            apikey: anonKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password: pwd }),
        },
      );

      // 200 means GoTrue accepted the credentials. The tokens in the body are
      // intentionally discarded - we only needed proof the password is valid.
      if (response.ok) return true;

      // 429 = rate limited. Trying more accounts cannot help and would make the
      // lockout worse, so stop here and report failure.
      if (response.status === 429) {
        console.error("verifyAdminPassword: rate limited by Supabase Auth.");
        return false;
      }
    } catch (e) {
      /* network problem - try the next candidate */
    }
  }

  return false;
}