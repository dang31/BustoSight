import { createClient } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

/**
 * Verify an admin password without disturbing the current session.
 *
 * Uses an isolated client (persistSession: false) so re-authenticating does not
 * mutate or refresh the signed-in user's own session. Previously this logic was
 * copy-pasted across BarangayList (x3), ArchiveResidents, Programs,
 * TransactionLogs and ManageAccounts.
 *
 * @param {string} password
 * @returns {Promise<boolean>} true when the password belongs to an admin account
 */
export async function verifyAdminPassword(password) {
  const pwd = (password ?? "").trim();
  if (!pwd) return false;

  const tempAuthClient = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );

  let emailsToTry = [];
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.email) emailsToTry.push(user.email);
  } catch (e) {
    /* fall through to the stored profile / defaults below */
  }

  const storedUserStr =
    sessionStorage.getItem("popdev_user") || localStorage.getItem("popdev_user");
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

  for (const email of uniqueEmails) {
    try {
      const { error: authError } = await tempAuthClient.auth.signInWithPassword({
        email,
        password: pwd,
      });
      if (!authError) return true;
    } catch (e) {
      /* try the next candidate */
    }
  }

  return false;
}
