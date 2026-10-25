import { supabase } from "../lib/supabase";

/**
 * Re-authenticates the signed-in administrator without touching the active
 * session.
 *
 * Unlike verifyAdminPassword(), this deliberately does NOT fall back to a
 * shared admin account: sensitive case details must be unlocked by the
 * administrator who is already signed in, using their own password. The
 * authoritative profile role is checked first, so a tampered localStorage
 * role cannot unlock the field.
 *
 * The returned tokens are discarded. We only need proof that the credential
 * is valid.
 */
export async function verifyCurrentUserPassword(password) {
  const pwd = (password ?? "").trim();
  if (!pwd) return false;

  let user = null;

  try {
    const response = await supabase.auth.getUser();
    user = response?.data?.user || null;
  } catch (err) {
    /* An unverifiable session must never unlock sensitive data. */
    return false;
  }

  if (!user?.email) return false;

  // Sensitive access is limited to Admin / Administrator accounts. The role
  // comes from the database, not from mutable localStorage/sessionStorage.
  try {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (error || !profile) return false;
    if (profile.role !== "Admin" && profile.role !== "Administrator") {
      return false;
    }
  } catch (err) {
    return false;
  }

  const email = user.email;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.error(
      "verifyCurrentUserPassword: Supabase env vars are not set.",
    );
    return false;
  }

  try {
    const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password: pwd }),
    });

    if (response.ok) return true;

    if (response.status === 429) {
      console.error("verifyCurrentUserPassword: rate limited by Supabase Auth.");
    }
  } catch (err) {
    /* Network problem: fail closed. */
  }

  return false;
}

/** How long an unlocked Sensitive Cases view stays open. */
export const SENSITIVE_UNLOCK_MINUTES = 10;

/** Milliseconds for one unlock window. */
export const SENSITIVE_UNLOCK_MS = SENSITIVE_UNLOCK_MINUTES * 60 * 1000;
