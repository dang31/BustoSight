import React, { useState, useEffect, useMemo } from "react";
import Sidebar from "../components/Sidebar";
import UserProfileBadge from "../components/UserProfileBadge";
import { getTransactionLogs, clearLocalTransactionLogs, logTransaction } from "../utils/logger";
import { supabase } from "../lib/supabase";
import PasswordInput from "../components/Common/PasswordInput";
import * as XLSX from "xlsx";
import "../css/TransactionLogs.css";

// ── Admin Password Confirm Modal ─────────────────────────────────────────────
function AdminPasswordModal({ actionLabel, onConfirm, onClose }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!password.trim()) {
      setError("Password is required.");
      return;
    }

    setLoading(true);
    try {
      // Get current signed-in user's email
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) throw new Error("Unable to retrieve current session.");

      // Re-authenticate with their email + entered password
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });

      if (signInErr) {
        setError("Incorrect password. Please try again.");
        setLoading(false);
        return;
      }

      onConfirm();
    } catch (err) {
      setError(err.message || "Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="logs-modal-overlay" onClick={onClose}>
      <div className="logs-modal-box" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="logs-modal-header">
          <div className="logs-modal-icon-wrap">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div>
            <h2 className="logs-modal-title">Admin Verification Required</h2>
            <p className="logs-modal-subtitle">
              Enter your password to <strong>{actionLabel}</strong>.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="logs-modal-form">
          <div className="logs-modal-field">
            <label htmlFor="admin-verify-password">Your Current Password</label>
            <PasswordInput
              id="admin-verify-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              placeholder="Enter your password"
              autoFocus
              disabled={loading}
              style={{
                padding: "10px 40px 10px 14px",
                border: error ? "1.5px solid #e53e3e" : "1.5px solid var(--gray-200)",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.9rem",
                fontFamily: "inherit",
                color: "var(--gray-700)",
                outline: "none",
                transition: "var(--transition)",
              }}
            />
            {error && <p className="logs-modal-error">{error}</p>}
          </div>

          <div className="logs-modal-actions">
            <button type="button" className="logs-modal-btn-cancel" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="logs-modal-btn-confirm" disabled={loading}>
              {loading ? "Verifying..." : "Confirm"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function TransactionLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [dateFilter, setDateFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Password modal state: null | "export" | "clear"
  const [pendingAction, setPendingAction] = useState(null);

  const fetchLogs = async () => {
    setLoading(true);
    const data = await getTransactionLogs();
    setLogs(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Filter logs by search, category, and date
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (selectedCategory !== "All" && log.category !== selectedCategory) return false;

      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        const matchesAction = (log.action || "").toLowerCase().includes(query);
        const matchesUser = (log.user_name || "").toLowerCase().includes(query);
        const matchesDetails = (log.details || "").toLowerCase().includes(query);
        if (!matchesAction && !matchesUser && !matchesDetails) return false;
      }

      if (dateFilter !== "All") {
        const logDate = new Date(log.timestamp);
        const now = new Date();
        if (dateFilter === "Today") {
          const isToday =
            logDate.getDate() === now.getDate() &&
            logDate.getMonth() === now.getMonth() &&
            logDate.getFullYear() === now.getFullYear();
          if (!isToday) return false;
        } else if (dateFilter === "7Days") {
          if (logDate < new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)) return false;
        } else if (dateFilter === "30Days") {
          if (logDate < new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)) return false;
        }
      }

      return true;
    });
  }, [logs, selectedCategory, searchQuery, dateFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(start, start + itemsPerPage);
  }, [filteredLogs, currentPage, itemsPerPage]);

  // Statistics
  const stats = useMemo(() => {
    const total = logs.length;
    const authCount = logs.filter((l) => l.category === "Authentication").length;
    const accountCount = logs.filter((l) => l.category === "Account Management").length;
    const residentCount = logs.filter(
      (l) => l.category === "Resident Records" || l.category === "Data Upload"
    ).length;
    return { total, authCount, accountCount, residentCount };
  }, [logs]);

  // Category badge class
  const getCategoryClass = (category) => {
    switch (category) {
      case "Authentication":     return "auth";
      case "Account Management": return "account";
      case "Resident Records":   return "resident";
      case "Data Upload":        return "upload";
      case "Reports":            return "reports";
      default:                   return "system";
    }
  };

  // ── Export (after password verified) ─────────────────────────────────────
  const doExport = () => {
    setPendingAction(null);
    const exportData = filteredLogs.map((log) => ({
      "Timestamp": new Date(log.timestamp).toLocaleString(),
      "User":      log.user_name || "N/A",
      "Role":      log.user_role || "N/A",
      "Category":  log.category  || "General",
      "Action":    log.action    || "N/A",
      "Details":   log.details   || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook  = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Transaction Logs");
    XLSX.writeFile(
      workbook,
      `BustoSight_Transaction_Logs_${new Date().toISOString().slice(0, 10)}.xlsx`
    );

    logTransaction({
      action:   "Exported Logs",
      category: "System",
      details:  `Exported ${filteredLogs.length} transaction log records to Excel.`,
    });
  };

  // ── Clear (after password verified) ──────────────────────────────────────
  const doClearLogs = () => {
    setPendingAction(null);
    clearLocalTransactionLogs();
    setLogs([]);
    logTransaction({
      action:   "Cleared Local Logs",
      category: "System",
      details:  "Admin cleared local transaction log history.",
    });
  };

  // Determine what to run after password is confirmed
  const handlePasswordConfirmed = () => {
    if (pendingAction === "export") doExport();
    else if (pendingAction === "clear") doClearLogs();
  };

  const actionLabel =
    pendingAction === "export"
      ? "export transaction logs"
      : "clear local transaction logs";

  // ── SVG Icons ─────────────────────────────────────────────────────────────
  const IconExport = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );

  const IconTrash = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );

  const IconRefresh = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );

  const IconSearch = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );

  // ── Icon sets for stat cards ──────────────────────────────────────────────
  const IconTotal = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );

  const IconKey = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  );

  const IconUser = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );

  const IconFolder = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="dashboard-wrapper">
      <div className="bg-image" />
      <div className="overlay" />
      <Sidebar />

      <main className="logs-content">
        {/* Page Header */}
        <header className="logs-page-header">
          <div className="logs-title-section">
            <h1>
              Transaction Logs
              <span className="admin-only-tag">Admin Only</span>
            </h1>
            <p>Track all user activities, security events, and system transactions across BustoSight.</p>
          </div>
          <div className="logs-action-btns">
            <button
              className="btn-export-logs"
              onClick={() => setPendingAction("export")}
              title="Export to Excel"
            >
              <IconExport /> Export Logs
            </button>
            <button
              className="btn-clear-logs"
              onClick={() => setPendingAction("clear")}
              title="Clear Local History"
            >
              <IconTrash /> Clear Local History
            </button>
            <UserProfileBadge />
          </div>
        </header>

        {/* Summary Metric Cards */}
        <div className="logs-summary-grid">
          <div className="logs-summary-card">
            <div className="logs-summary-info">
              <h3>Total Events Logged</h3>
              <div className="value">{stats.total}</div>
            </div>
            <div className="logs-summary-icon blue"><IconTotal /></div>
          </div>
          <div className="logs-summary-card">
            <div className="logs-summary-info">
              <h3>Auth &amp; Logins</h3>
              <div className="value">{stats.authCount}</div>
            </div>
            <div className="logs-summary-icon green"><IconKey /></div>
          </div>
          <div className="logs-summary-card">
            <div className="logs-summary-info">
              <h3>Account Changes</h3>
              <div className="value">{stats.accountCount}</div>
            </div>
            <div className="logs-summary-icon purple"><IconUser /></div>
          </div>
          <div className="logs-summary-card">
            <div className="logs-summary-info">
              <h3>Records &amp; Uploads</h3>
              <div className="value">{stats.residentCount}</div>
            </div>
            <div className="logs-summary-icon orange"><IconFolder /></div>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="logs-filters-bar">
          <div className="logs-search-wrapper">
            <span className="logs-search-icon"><IconSearch /></span>
            <input
              type="text"
              placeholder="Search logs by action, user, or details..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            />
          </div>

          <div className="logs-select-group">
            <select
              className="logs-select"
              value={selectedCategory}
              onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1); }}
            >
              <option value="All">All Categories</option>
              <option value="Authentication">Authentication</option>
              <option value="Account Management">Account Management</option>
              <option value="Resident Records">Resident Records</option>
              <option value="Data Upload">Data Upload</option>
              <option value="Reports">Reports</option>
              <option value="System">System</option>
            </select>

            <select
              className="logs-select"
              value={dateFilter}
              onChange={(e) => { setDateFilter(e.target.value); setCurrentPage(1); }}
            >
              <option value="All">All Time</option>
              <option value="Today">Today</option>
              <option value="7Days">Last 7 Days</option>
              <option value="30Days">Last 30 Days</option>
            </select>

            <button className="logs-refresh-btn" onClick={fetchLogs}>
              <IconRefresh /> Refresh
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="logs-table-card">
          <div className="logs-table-wrapper">
            <table className="logs-table">
              <thead>
                <tr>
                  <th>Date &amp; Time</th>
                  <th>User</th>
                  <th>Category</th>
                  <th>Action</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr className="logs-loading-row">
                    <td colSpan="5">Loading logs…</td>
                  </tr>
                ) : paginatedLogs.length === 0 ? (
                  <tr>
                    <td colSpan="5">
                      <div className="logs-empty-state">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M12 8v4M12 16h.01" />
                        </svg>
                        <p style={{ fontWeight: "600" }}>No transaction logs found.</p>
                        <p style={{ fontSize: "0.85rem", marginTop: "4px" }}>
                          Try adjusting your search query or filters.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="logs-timestamp">
                        {new Date(log.timestamp).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      <td>
                        <div className="logs-user-cell">
                          <span className="logs-user-name">{log.user_name || "System"}</span>
                          <span className="logs-user-role">{log.user_role || "User"}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`category-badge ${getCategoryClass(log.category)}`}>
                          {log.category || "General"}
                        </span>
                      </td>
                      <td className="log-action-text">{log.action}</td>
                      <td className="log-details-text">{log.details || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {filteredLogs.length > 0 && (
            <div className="logs-pagination">
              <div className="pagination-info">
                Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredLogs.length)} to{" "}
                {Math.min(currentPage * itemsPerPage, filteredLogs.length)} of {filteredLogs.length} entries
              </div>
              <div className="pagination-btns">
                <button
                  className="pagination-btn"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                >
                  Previous
                </button>
                <span className="pagination-page-label">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  className="pagination-btn"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Admin Password Confirmation Modal */}
      {pendingAction && (
        <AdminPasswordModal
          actionLabel={actionLabel}
          onConfirm={handlePasswordConfirmed}
          onClose={() => setPendingAction(null)}
        />
      )}
    </div>
  );
}
