import { supabase } from "../lib/supabase";

const LOCAL_STORAGE_KEY = "bustosight_transaction_logs";

/**
 * Seed initial sample logs if no logs exist in localStorage
 */
function getInitialLogs() {
  const now = new Date();
  return [
    {
      id: "log-seed-1",
      timestamp: new Date(now.getTime() - 1000 * 60 * 15).toISOString(),
      user_name: "Admin User",
      user_role: "Administrator",
      action: "Admin Login",
      category: "Authentication",
      details: "Admin successfully logged into the BustoSight System.",
    },
    {
      id: "log-seed-2",
      timestamp: new Date(now.getTime() - 1000 * 60 * 45).toISOString(),
      user_name: "Admin User",
      user_role: "Administrator",
      action: "System Initialization",
      category: "System",
      details: "Transaction logging module initialized successfully.",
    },
  ];
}

/**
 * Log a new transaction/event
 */
export async function logTransaction({
  action,
  category = "General",
  details = "",
  user = null,
}) {
  try {
    // 1. Get current logged in user details if not provided
    let loggedUserName = "System Admin";
    let loggedUserRole = "Administrator";

    if (user) {
      loggedUserName =
        `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
        user.username ||
        user.email ||
        "System Admin";
      loggedUserRole = user.role || "Administrator";
    } else {
      const storedUser = sessionStorage.getItem("popdev_user") || localStorage.getItem("popdev_user");
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          loggedUserName =
            `${parsed.first_name || ""} ${parsed.last_name || ""}`.trim() ||
            parsed.username ||
            parsed.email ||
            "System Admin";
          loggedUserRole = parsed.role || "Administrator";
        } catch (e) {
          // fallback
        }
      }
    }

    const logEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      user_name: loggedUserName,
      user_role: loggedUserRole,
      action,
      category,
      details: typeof details === "object" ? JSON.stringify(details) : String(details),
    };

    // Save to LocalStorage fallback first
    let localLogs = [];
    try {
      const existing = localStorage.getItem(LOCAL_STORAGE_KEY);
      localLogs = existing ? JSON.parse(existing) : getInitialLogs();
    } catch (e) {
      localLogs = [];
    }
    localLogs.unshift(logEntry);
    // Keep max 500 logs locally
    if (localLogs.length > 500) {
      localLogs = localLogs.slice(0, 500);
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localLogs));

    // Try saving to Supabase transaction_logs table
    try {
      await supabase.from("transaction_logs").insert([
        {
          timestamp: logEntry.timestamp,
          user_name: logEntry.user_name,
          user_role: logEntry.user_role,
          action: logEntry.action,
          category: logEntry.category,
          details: logEntry.details,
        },
      ]);
    } catch (err) {
      // Supabase insert error ignored gracefully as localStorage already backed it up
    }

    return logEntry;
  } catch (err) {
    console.warn("Logger error:", err);
  }
}

/**
 * Fetch all transaction logs (combines Supabase + LocalStorage)
 */
export async function getTransactionLogs() {
  let localLogs = [];
  try {
    const existing = localStorage.getItem(LOCAL_STORAGE_KEY);
    localLogs = existing ? JSON.parse(existing) : getInitialLogs();
    if (!existing) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localLogs));
    }
  } catch (e) {
    localLogs = [];
  }

  try {
    const { data, error } = await supabase
      .from("transaction_logs")
      .select("*")
      .order("timestamp", { ascending: false });

    if (!error && data && data.length > 0) {
      // Merge unique by timestamp or id
      const combined = [...data, ...localLogs];
      const uniqueLogs = Array.from(
        new Map(combined.map((item) => [item.timestamp + item.action, item])).values()
      );
      uniqueLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      return uniqueLogs;
    }
  } catch (e) {
    // Return local logs if table query fails
  }

  return localLogs;
}

/**
 * Clear local logs
 */
export function clearLocalTransactionLogs() {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([]));
}
