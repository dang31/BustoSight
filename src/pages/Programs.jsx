import React, { useState, useEffect, useMemo, useCallback } from "react";
import Sidebar from "../components/Sidebar";
import UserProfileBadge from "../components/UserProfileBadge";
import PasswordInput from "../components/Common/PasswordInput";
import { supabase } from "../lib/supabase";
import { logTransaction } from "../utils/logger";
import "../css/Programs.css";

// ── SVG Icons ─────────────────────────────────────────────────────────────
const IconPrograms = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    <line x1="9" y1="7" x2="15" y2="7" />
    <line x1="9" y1="11" x2="13" y2="11" />
  </svg>
);

const IconSeminar = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const IconCheckCircle = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const IconPauseCircle = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="10" y1="15" x2="10" y2="9" />
    <line x1="14" y1="15" x2="14" y2="9" />
  </svg>
);

const IconArchiveBox = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="21 8 21 21 3 21 3 8" />
    <rect x="1" y="3" width="22" height="5" />
    <line x1="10" y1="12" x2="14" y2="12" />
  </svg>
);

const IconRestore = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
  </svg>
);

const IconSearch = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const IconPlus = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const IconRefresh = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

const IconEdit = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const IconArrowRight = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const IconArrowLeft = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const IconShield = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const IconUser = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const IconLock = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

// ── Admin Password Verification Modal ─────────────────────────────────────
function AdminPasswordAuthModal({ actionTitle, actionDescription, onConfirm, onClose }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!password.trim()) {
      setError("Admin password is required.");
      return;
    }

    setLoading(true);
    try {
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user || !user.email) {
        throw new Error("Unable to identify active admin session. Please log in again.");
      }

      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: password,
      });

      if (signInErr) {
        setError("Incorrect admin password. Please try again.");
        setLoading(false);
        return;
      }

      await onConfirm();
    } catch (err) {
      setError(err.message || "Authentication verification failed.");
      setLoading(false);
    }
  };

  return (
    <div className="prog-modal-overlay" onClick={onClose}>
      <div className="prog-modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "440px" }}>
        <div className="prog-modal-header">
          <h3>
            <IconShield /> Admin Authentication
          </h3>
          <button className="prog-modal-close-btn" onClick={onClose} disabled={loading}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="prog-modal-body" style={{ textAlign: "center" }}>
            <div className="prog-auth-lock-icon">
              <IconLock />
            </div>

            <h4 style={{ fontSize: "16px", fontWeight: "700", color: "var(--gray-800)", margin: "0 0 6px" }}>
              {actionTitle || "Admin Password Required"}
            </h4>
            <p style={{ fontSize: "13px", color: "var(--gray-600)", margin: "0 0 18px", lineHeight: "1.4" }}>
              {actionDescription || "Please enter your administrator password to authorize this action."}
            </p>

            <div style={{ textAlign: "left", marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--gray-700)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
                Admin Password <span style={{ color: "#e53e3e" }}>*</span>
              </label>
              <PasswordInput
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                placeholder="Enter your current password"
                autoFocus
                disabled={loading}
              />
              {error && (
                <div style={{ color: "#e53e3e", fontSize: "12px", marginTop: "6px", fontWeight: "500" }}>
                  {error}
                </div>
              )}
            </div>
          </div>

          <div className="prog-modal-footer">
            <button type="button" className="btn-modal-cancel" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-modal-submit" disabled={loading}>
              {loading ? "Authenticating..." : "Authorize & Proceed"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page Component ───────────────────────────────────────────────────
export default function Programs() {
  const [programs, setPrograms] = useState([]);
  const [seminars, setSeminars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(null);

  // Authenticated Admin Profile State
  const [adminUser, setAdminUser] = useState(null);

  // Active view: null for Programs list, or program object for selected program's seminars
  const [selectedProgramId, setSelectedProgramId] = useState(null);

  // Archive View Tab: "active" or "archived"
  const [viewTab, setViewTab] = useState("active");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  // Modals state
  const [programModal, setProgramModal] = useState({ isOpen: false, mode: "add", data: null });
  const [seminarModal, setSeminarModal] = useState({ isOpen: false, mode: "add", data: null });
  const [archiveModal, setArchiveModal] = useState({ isOpen: false, type: null, data: null });

  // Admin Auth Password Verification Modal State
  const [authModal, setAuthModal] = useState({
    isOpen: false,
    actionTitle: "",
    actionDescription: "",
    pendingHandler: null,
  });

  // Toast notifications
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Load Authenticated Admin Profile ─────────────────────────────────────
  useEffect(() => {
    async function loadAdminProfile() {
      try {
        const storedUser = sessionStorage.getItem("popdev_user") || localStorage.getItem("popdev_user");
        if (storedUser) {
          try {
            setAdminUser(JSON.parse(storedUser));
          } catch (_) {}
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();

          if (profile) {
            setAdminUser(profile);
            sessionStorage.setItem("popdev_user", JSON.stringify(profile));
            localStorage.setItem("popdev_user", JSON.stringify(profile));
          }
        }
      } catch (err) {
        console.warn("Could not load current admin user:", err);
      }
    }
    loadAdminProfile();
  }, []);

  const getAdminFullName = useCallback(() => {
    if (!adminUser) return "System Admin";
    const first = (adminUser.first_name || "").trim();
    const last = (adminUser.last_name || "").trim();
    if (first || last) return `${first} ${last}`.trim();
    return adminUser.username || adminUser.email || "System Admin";
  }, [adminUser]);

  // ── Fetch Programs and Seminars from Supabase ────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setDbError(null);
    try {
      const { data: progData, error: progErr } = await supabase
        .from("programs")
        .select("*")
        .order("created_at", { ascending: false });

      if (progErr) throw progErr;

      const { data: semData, error: semErr } = await supabase
        .from("seminars")
        .select("*")
        .order("created_at", { ascending: false });

      if (semErr) throw semErr;

      setPrograms(progData || []);
      setSeminars(semData || []);
    } catch (err) {
      console.error("Error fetching programs/seminars:", err);
      setDbError(err.message || "Failed to load programs from database.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Selected Program object
  const selectedProgram = useMemo(() => {
    if (!selectedProgramId) return null;
    return programs.find((p) => p.id === selectedProgramId) || null;
  }, [programs, selectedProgramId]);

  // Map seminar count by program_id (active only)
  const seminarCountByProgram = useMemo(() => {
    const map = {};
    seminars.forEach((s) => {
      if (!s.is_archived) {
        map[s.program_id] = (map[s.program_id] || 0) + 1;
      }
    });
    return map;
  }, [seminars]);

  // Summary statistics
  const stats = useMemo(() => {
    const activeProgramsList = programs.filter((p) => !p.is_archived);
    const archivedProgramsCount = programs.filter((p) => p.is_archived).length;
    const totalPrograms = activeProgramsList.length;
    const activePrograms = activeProgramsList.filter((p) => p.status === "Active").length;
    const inactivePrograms = activeProgramsList.filter((p) => p.status === "Inactive").length;
    const totalSeminars = seminars.filter((s) => !s.is_archived).length;
    const archivedSeminarsCount = seminars.filter((s) => s.is_archived).length;
    return {
      totalPrograms,
      activePrograms,
      inactivePrograms,
      totalSeminars,
      archivedProgramsCount,
      archivedSeminarsCount,
    };
  }, [programs, seminars]);

  // Filtered Programs list according to viewTab ("active" or "archived")
  const filteredPrograms = useMemo(() => {
    const isArchivedView = viewTab === "archived";
    return programs.filter((prog) => {
      const isProgArchived = !!prog.is_archived;
      if (isArchivedView !== isProgArchived) return false;

      if (!isArchivedView && statusFilter !== "All" && prog.status !== statusFilter) return false;

      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const matchesName = (prog.name || "").toLowerCase().includes(q);
        const matchesDesc = (prog.description || "").toLowerCase().includes(q);
        const matchesAuthor = (prog.created_by_name || "").toLowerCase().includes(q);

        const childSeminars = seminars.filter((s) => s.program_id === prog.id);
        const matchesSeminar = childSeminars.some((s) => (s.title || "").toLowerCase().includes(q));

        if (!matchesName && !matchesDesc && !matchesAuthor && !matchesSeminar) return false;
      }
      return true;
    });
  }, [programs, seminars, viewTab, statusFilter, searchQuery]);

  // Filtered Seminars under selected program
  const filteredSeminars = useMemo(() => {
    if (!selectedProgramId) return [];
    const isArchivedView = viewTab === "archived";
    return seminars.filter((sem) => {
      if (sem.program_id !== selectedProgramId) return false;
      const isSemArchived = !!sem.is_archived;
      if (isArchivedView !== isSemArchived) return false;

      if (!isArchivedView && statusFilter !== "All" && sem.status !== statusFilter) return false;

      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const matchesTitle = (sem.title || "").toLowerCase().includes(q);
        const matchesDesc = (sem.description || "").toLowerCase().includes(q);
        const matchesAuthor = (sem.created_by_name || "").toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesAuthor) return false;
      }
      return true;
    });
  }, [seminars, selectedProgramId, viewTab, statusFilter, searchQuery]);

  // ── Handlers: Program Save ───────────────────────────────────────────────
  const triggerSaveProgram = (formData) => {
    const { name, id } = formData;
    const trimmedName = name.trim();

    const isDuplicate = programs.some(
      (p) => !p.is_archived && p.name.trim().toLowerCase() === trimmedName.toLowerCase() && p.id !== id
    );
    if (isDuplicate) {
      showToast(`A program named "${trimmedName}" already exists.`, "error");
      throw new Error(`A program named "${trimmedName}" already exists.`);
    }

    const isAdd = programModal.mode === "add";
    setAuthModal({
      isOpen: true,
      actionTitle: isAdd ? "Authorize Program Creation" : "Authorize Program Update",
      actionDescription: `Enter your password to ${isAdd ? "create" : "update"} the program "${trimmedName}".`,
      pendingHandler: () => executeSaveProgram(formData),
    });
  };

  const executeSaveProgram = async (formData) => {
    const { name, description, status, id } = formData;
    const trimmedName = name.trim();

    const { data: { user } } = await supabase.auth.getUser();
    const adminName = getAdminFullName();
    const adminId = user?.id || adminUser?.id || null;

    if (programModal.mode === "add") {
      let insertPayload = {
        name: trimmedName,
        description: description.trim() || null,
        status,
        is_archived: false,
        created_by: adminId,
        created_by_name: adminName,
        updated_by: adminId,
        updated_by_name: adminName,
      };

      let { error } = await supabase.from("programs").insert([insertPayload]);

      if (error && (error.message || "").includes("created_by")) {
        const fallbackPayload = {
          name: trimmedName,
          description: description.trim() || null,
          status,
        };
        const res = await supabase.from("programs").insert([fallbackPayload]);
        error = res.error;
      }

      if (error) throw error;

      await logTransaction({
        action: "Created Program",
        category: "Program Management",
        details: `Admin "${adminName}" created program: "${trimmedName}" (Status: ${status}).`,
        user: adminUser,
      });

      showToast(`Program "${trimmedName}" created successfully!`, "success");
    } else {
      let updatePayload = {
        name: trimmedName,
        description: description.trim() || null,
        status,
        updated_by: adminId,
        updated_by_name: adminName,
        updated_at: new Date().toISOString(),
      };

      let { error } = await supabase.from("programs").update(updatePayload).eq("id", id);

      if (error && (error.message || "").includes("updated_by")) {
        const fallbackPayload = {
          name: trimmedName,
          description: description.trim() || null,
          status,
          updated_at: new Date().toISOString(),
        };
        const res = await supabase.from("programs").update(fallbackPayload).eq("id", id);
        error = res.error;
      }

      if (error) throw error;

      await logTransaction({
        action: "Updated Program",
        category: "Program Management",
        details: `Admin "${adminName}" updated program: "${trimmedName}" (Status: ${status}).`,
        user: adminUser,
      });

      showToast(`Program "${trimmedName}" updated successfully!`, "success");
    }

    setAuthModal({ isOpen: false, actionTitle: "", actionDescription: "", pendingHandler: null });
    setProgramModal({ isOpen: false, mode: "add", data: null });
    await fetchData();
  };

  // ── Handlers: Seminar Save ───────────────────────────────────────────────
  const triggerSaveSeminar = (formData) => {
    const { title, id, program_id } = formData;
    const trimmedTitle = title.trim();

    const isDuplicate = seminars.some(
      (s) =>
        !s.is_archived &&
        s.program_id === program_id &&
        s.title.trim().toLowerCase() === trimmedTitle.toLowerCase() &&
        s.id !== id
    );
    if (isDuplicate) {
      showToast(`A seminar titled "${trimmedTitle}" already exists under this program.`, "error");
      throw new Error(`A seminar titled "${trimmedTitle}" already exists under this program.`);
    }

    const isAdd = seminarModal.mode === "add";
    setAuthModal({
      isOpen: true,
      actionTitle: isAdd ? "Authorize Seminar Creation" : "Authorize Seminar Update",
      actionDescription: `Enter your password to ${isAdd ? "add" : "update"} the seminar "${trimmedTitle}".`,
      pendingHandler: () => executeSaveSeminar(formData),
    });
  };

  const executeSaveSeminar = async (formData) => {
    const { title, description, status, id, program_id } = formData;
    const trimmedTitle = title.trim();

    const { data: { user } } = await supabase.auth.getUser();
    const adminName = getAdminFullName();
    const adminId = user?.id || adminUser?.id || null;

    if (seminarModal.mode === "add") {
      // Try inserting with full payload; progressively strip unknown columns on error
      const fullInsertPayload = {
        program_id,
        title: trimmedTitle,
        description: description.trim() || null,
        status,
        is_archived: false,
        created_by: adminId,
        created_by_name: adminName,
        updated_by: adminId,
        updated_by_name: adminName,
      };

      let { error } = await supabase.from("seminars").insert([fullInsertPayload]);

      // If is_archived column doesn't exist, retry without audit + is_archived columns
      if (error && (error.message || "").toLowerCase().includes("is_archived")) {
        const noArchivedPayload = {
          program_id,
          title: trimmedTitle,
          description: description.trim() || null,
          status,
          created_by: adminId,
          created_by_name: adminName,
          updated_by: adminId,
          updated_by_name: adminName,
        };
        const res = await supabase.from("seminars").insert([noArchivedPayload]);
        error = res.error;
      }

      // If audit columns don't exist, fall back to minimal payload
      if (error && (error.message || "").toLowerCase().includes("created_by")) {
        const minimalPayload = {
          program_id,
          title: trimmedTitle,
          description: description.trim() || null,
          status,
        };
        const res = await supabase.from("seminars").insert([minimalPayload]);
        error = res.error;
      }

      if (error) throw error;

      await logTransaction({
        action: "Created Seminar",
        category: "Program Management",
        details: `Admin "${adminName}" added seminar "${trimmedTitle}" under Program "${selectedProgram?.name}".`,
        user: adminUser,
      });

      showToast(`Seminar "${trimmedTitle}" added successfully!`, "success");
    } else {
      let updatePayload = {
        title: trimmedTitle,
        description: description.trim() || null,
        status,
        updated_by: adminId,
        updated_by_name: adminName,
        updated_at: new Date().toISOString(),
      };

      let { error } = await supabase.from("seminars").update(updatePayload).eq("id", id);

      if (error && (error.message || "").includes("updated_by")) {
        const fallbackPayload = {
          title: trimmedTitle,
          description: description.trim() || null,
          status,
          updated_at: new Date().toISOString(),
        };
        const res = await supabase.from("seminars").update(fallbackPayload).eq("id", id);
        error = res.error;
      }

      if (error) throw error;

      await logTransaction({
        action: "Updated Seminar",
        category: "Program Management",
        details: `Admin "${adminName}" updated seminar "${trimmedTitle}" under Program "${selectedProgram?.name}".`,
        user: adminUser,
      });

      showToast(`Seminar "${trimmedTitle}" updated successfully!`, "success");
    }

    setAuthModal({ isOpen: false, actionTitle: "", actionDescription: "", pendingHandler: null });
    setSeminarModal({ isOpen: false, mode: "add", data: null });
    await fetchData();
  };

  // ── Handlers: Archive Record ─────────────────────────────────────────────
  const triggerArchive = (type, data) => {
    const isProgram = type === "program";
    const name = isProgram ? data?.name : data?.title;

    setArchiveModal({ isOpen: false, type: null, data: null });
    setAuthModal({
      isOpen: true,
      actionTitle: `Authorize Archiving of ${isProgram ? "Program" : "Seminar"}`,
      actionDescription: `Enter your password to archive "${name}". It will be moved to the Archived tab.`,
      pendingHandler: () => executeArchive(type, data),
    });
  };

  const executeArchive = async (type, data) => {
    const adminName = getAdminFullName();
    const { data: { user } } = await supabase.auth.getUser();
    const adminId = user?.id || adminUser?.id || null;

    // Helper: try update with full audit columns; if schema error, fallback to minimal fields
    const archiveUpdate = async (table, matchField, matchValue) => {
      const fullPayload = {
        status: "Inactive",
        is_archived: true,
        archived_at: new Date().toISOString(),
        archived_by: adminId,
        archived_by_name: adminName,
      };
      let { error } = await supabase.from(table).update(fullPayload).eq(matchField, matchValue);

      if (error && (error.message || "").toLowerCase().includes("archived")) {
        // Fallback: only set status + is_archived
        const fallback = { status: "Inactive", is_archived: true };
        const res = await supabase.from(table).update(fallback).eq(matchField, matchValue);
        error = res.error;
      }
      return error;
    };

    try {
      if (type === "program") {
        const childCount = seminarCountByProgram[data.id] || 0;

        // 1. Archive the program AND automatically set status to Inactive
        const progErr = await archiveUpdate("programs", "id", data.id);
        if (progErr) throw progErr;

        // 2. Also archive associated child seminars AND set to Inactive
        await archiveUpdate("seminars", "program_id", data.id);

        await logTransaction({
          action: "Archived Program",
          category: "Program Management",
          details: `Admin "${adminName}" archived program "${data.name}" (Status changed to Inactive) and its ${childCount} associated seminars.`,
          user: adminUser,
        });

        showToast(`Program "${data.name}" was archived and marked Inactive.`, "info");
        if (selectedProgramId === data.id) {
          setSelectedProgramId(null);
        }
      } else if (type === "seminar") {
        const semErr = await archiveUpdate("seminars", "id", data.id);
        if (semErr) throw semErr;

        await logTransaction({
          action: "Archived Seminar",
          category: "Program Management",
          details: `Admin "${adminName}" archived seminar "${data.title}" (Status changed to Inactive) under Program "${selectedProgram?.name}".`,
          user: adminUser,
        });

        showToast(`Seminar "${data.title}" was archived and marked Inactive.`, "info");
      }

      setAuthModal({ isOpen: false, actionTitle: "", actionDescription: "", pendingHandler: null });
      await fetchData();
    } catch (err) {
      console.error("Archive error:", err);
      showToast(err.message || "Failed to archive record.", "error");
    }
  };

  // ── Handlers: Restore Record from Archive ─────────────────────────────────
  const triggerRestore = (type, data) => {
    const isProgram = type === "program";
    const name = isProgram ? data?.name : data?.title;

    setAuthModal({
      isOpen: true,
      actionTitle: `Authorize Restoration of ${isProgram ? "Program" : "Seminar"}`,
      actionDescription: `Enter your password to restore "${name}" back to the active list.`,
      pendingHandler: () => executeRestore(type, data),
    });
  };

  const executeRestore = async (type, data) => {
    const adminName = getAdminFullName();
    const { data: { user } } = await supabase.auth.getUser();
    const adminId = user?.id || adminUser?.id || null;

    // Helper: try restore with full audit columns; fallback to minimal
    const restoreUpdate = async (table, matchField, matchValue) => {
      const fullPayload = {
        is_archived: false,
        archived_at: null,
        updated_by: adminId,
        updated_by_name: adminName,
      };
      let { error } = await supabase.from(table).update(fullPayload).eq(matchField, matchValue);

      if (error && (error.message || "").toLowerCase().includes("archived")) {
        const fallback = { is_archived: false };
        const res = await supabase.from(table).update(fallback).eq(matchField, matchValue);
        error = res.error;
      }
      if (error && (error.message || "").toLowerCase().includes("updated_by")) {
        const fallback = { is_archived: false };
        const res = await supabase.from(table).update(fallback).eq(matchField, matchValue);
        error = res.error;
      }
      return error;
    };

    try {
      if (type === "program") {
        const progErr = await restoreUpdate("programs", "id", data.id);
        if (progErr) throw progErr;

        // Also restore seminars under this program
        await restoreUpdate("seminars", "program_id", data.id);

        await logTransaction({
          action: "Restored Program",
          category: "Program Management",
          details: `Admin "${adminName}" restored program "${data.name}" from archive back to active list.`,
          user: adminUser,
        });

        showToast(`Program "${data.name}" restored successfully!`, "success");
      } else if (type === "seminar") {
        const semErr = await restoreUpdate("seminars", "id", data.id);
        if (semErr) throw semErr;

        await logTransaction({
          action: "Restored Seminar",
          category: "Program Management",
          details: `Admin "${adminName}" restored seminar "${data.title}" from archive back to active list.`,
          user: adminUser,
        });

        showToast(`Seminar "${data.title}" restored successfully!`, "success");
      }

      setAuthModal({ isOpen: false, actionTitle: "", actionDescription: "", pendingHandler: null });
      await fetchData();
    } catch (err) {
      console.error("Restore error:", err);
      showToast(err.message || "Failed to restore record.", "error");
    }
  };


  return (
    <div className="dashboard-wrapper">
      <div className="bg-image" />
      <div className="overlay" />
      <Sidebar />

      <main className="prog-content">
        {/* Toast Notification */}
        {toast && (
          <div className={`prog-toast prog-toast-${toast.type}`}>
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)}>✕</button>
          </div>
        )}

        {/* ── Fixed Top Section (non-scrolling) ── */}
        <div className="prog-fixed-top">

        {/* Page Header */}
        <header className="prog-page-header">
          <div className="prog-title-section">
            <h1>
              Programs &amp; Seminars
              <span className="admin-badge-tag">Admin Management</span>
            </h1>
            <p>
              Manage community development programs and their associated child seminars with secure Admin archiving.
            </p>
          </div>
          <div className="prog-header-actions">
            <button
              className={`prog-header-archive-btn ${viewTab === "archived" ? "archived-active" : ""}`}
              onClick={() => { setViewTab(viewTab === "archived" ? "active" : "archived"); setSearchQuery(""); }}
              title={viewTab === "archived" ? "Switch to Active view" : "View Archived records"}
            >
              <IconArchiveBox />
              {viewTab === "archived" ? "Archived" : "Archived"}
              <span className="prog-header-archive-count">
                {selectedProgram
                  ? seminars.filter(s => s.program_id === selectedProgram?.id && s.is_archived).length
                  : stats.archivedProgramsCount}
              </span>
            </button>
            <UserProfileBadge />
          </div>
        </header>

        {/* Database Notice if table doesn't exist */}
        {dbError && (
          <div style={{
            background: "#fff5f5",
            border: "1.5px solid #feb2b2",
            borderRadius: "var(--radius-md)",
            padding: "16px 20px",
            marginBottom: "20px",
            color: "#c53030",
            boxShadow: "var(--shadow-sm)"
          }}>
            <h4 style={{ margin: "0 0 6px", fontSize: "14.5px", fontWeight: "700" }}>
              Database Setup Required
            </h4>
            <p style={{ margin: 0, fontSize: "13px", lineHeight: "1.5" }}>
              Could not query the programs table (<code>{dbError}</code>). Please ensure the SQL migration in <code>supabase/programs_and_seminars.sql</code> has been executed in your Supabase SQL Editor.
            </p>
          </div>
        )}

        {/* Summary Stat Cards */}
        <div className="prog-stats-grid">
          <div className="prog-stat-card">
            <div className="prog-stat-info">
              <h3>Active Programs</h3>
              <div className="stat-value">{stats.activePrograms}</div>
            </div>
            <div className="prog-stat-icon green">
              <IconCheckCircle />
            </div>
          </div>

          <div className="prog-stat-card">
            <div className="prog-stat-info">
              <h3>Inactive Programs</h3>
              <div className="stat-value">{stats.inactivePrograms}</div>
            </div>
            <div className="prog-stat-icon orange">
              <IconPauseCircle />
            </div>
          </div>

          <div className="prog-stat-card">
            <div className="prog-stat-info">
              <h3>Active Seminars</h3>
              <div className="stat-value">{stats.totalSeminars}</div>
            </div>
            <div className="prog-stat-icon purple">
              <IconSeminar />
            </div>
          </div>

          <div className="prog-stat-card">
            <div className="prog-stat-info">
              <h3>Archived Records</h3>
              <div className="stat-value">{stats.archivedProgramsCount + stats.archivedSeminarsCount}</div>
            </div>
            <div className="prog-stat-icon blue">
              <IconArchiveBox />
            </div>
          </div>
        </div>

        {/* ── Drill-down Breadcrumbs Bar if Program Selected ── */}
        {selectedProgram && (
          <div className="prog-breadcrumb-bar">
            <div className="prog-breadcrumbs">
              <span
                className="prog-breadcrumb-link"
                onClick={() => {
                  setSelectedProgramId(null);
                  setSearchQuery("");
                  setStatusFilter("All");
                }}
              >
                <IconPrograms /> Programs
              </span>
              <span className="prog-breadcrumb-sep">/</span>
              <span className="prog-breadcrumb-current">{selectedProgram.name}</span>
            </div>

            <button
              className="btn-back-programs"
              onClick={() => {
                setSelectedProgramId(null);
                setSearchQuery("");
                setStatusFilter("All");
              }}
            >
              <IconArrowLeft /> Back to All Programs
            </button>
          </div>
        )}

        {/* ── Program Banner if Program Selected ── */}
        {selectedProgram && (
          <div className="prog-detail-banner">
            <div className="prog-detail-banner-info">
              <h2>
                {selectedProgram.name}
                <span className={`prog-status-pill ${selectedProgram.is_archived ? "inactive" : selectedProgram.status.toLowerCase()}`}>
                  {selectedProgram.is_archived ? "Archived" : selectedProgram.status}
                </span>
              </h2>
              <p>{selectedProgram.description || "No description provided for this program."}</p>
              {selectedProgram.created_by_name && (
                <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--gray-500)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <IconUser /> Created by: <strong style={{ color: "var(--primary)" }}>{selectedProgram.created_by_name}</strong>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              {!selectedProgram.is_archived ? (
                <>
                  <button
                    className="btn-action-edit"
                    onClick={() => setProgramModal({ isOpen: true, mode: "edit", data: selectedProgram })}
                    title="Edit Program Details"
                  >
                    <IconEdit />
                  </button>
                  <button
                    className="btn-action-archive"
                    onClick={() => setArchiveModal({ isOpen: true, type: "program", data: selectedProgram })}
                    title="Archive Program"
                  >
                    <IconArchiveBox />
                  </button>
                </>
              ) : (
                <button
                  className="btn-action-restore"
                  onClick={() => triggerRestore("program", selectedProgram)}
                  title="Restore Program"
                >
                  <IconRestore /> Restore Program
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Toolbar: Search, Active/Archived Tabs, Filter, and Action Buttons ── */}
        <div className="prog-toolbar">
          {/* 1. Search Box */}
          <div className="prog-search-box">
            <span className="prog-search-icon">
              <IconSearch />
            </span>
            <input
              type="text"
              placeholder={
                selectedProgram
                  ? `Search ${viewTab} seminars by title or author...`
                  : `Search ${viewTab} programs by name, author, or seminar...`
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* 2. Status Filters & Actions */}
          <div className="prog-toolbar-actions">
            {viewTab === "active" && (
              <select
                className="prog-status-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active Only</option>
                <option value="Inactive">Inactive Only</option>
              </select>
            )}

            <button className="btn-refresh-prog" onClick={fetchData} title="Refresh Data">
              <IconRefresh /> Refresh
            </button>

            {viewTab === "active" && (
              selectedProgram ? (
                <button
                  className="btn-primary-add"
                  onClick={() =>
                    setSeminarModal({
                      isOpen: true,
                      mode: "add",
                      data: { program_id: selectedProgram.id, status: "Active" },
                    })
                  }
                >
                  <IconPlus /> Add Seminar
                </button>
              ) : (
                <button
                  className="btn-primary-add"
                  onClick={() =>
                    setProgramModal({
                      isOpen: true,
                      mode: "add",
                      data: { status: "Active" },
                    })
                  }
                >
                  <IconPlus /> Add Program
                </button>
              )
            )}
          </div>
        </div>

        </div>{/* end prog-fixed-top */}

        {/* ── Scrollable Data View ── */}
        <div className="prog-scroll-body">
        <div className="prog-card-wrapper">
          {/* VIEW A: SEMINARS TABLE (when a program is selected) */}
          {selectedProgram ? (
            <div className="prog-table-container">
              <table className="prog-custom-table">
                <thead>
                  <tr>
                    <th style={{ width: "26%" }}>Seminar Title</th>
                    <th style={{ width: "30%" }}>Description</th>
                    <th style={{ width: "13%" }}>Status</th>
                    <th style={{ width: "17%" }}>{viewTab === "archived" ? "Archived By & Date" : "Created By & Date"}</th>
                    <th style={{ width: "14%", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: "center", padding: "40px" }}>
                        Loading seminars...
                      </td>
                    </tr>
                  ) : filteredSeminars.length === 0 ? (
                    <tr>
                      <td colSpan="5">
                        <div className="prog-empty-box">
                          {viewTab === "archived" ? <IconArchiveBox /> : <IconSeminar />}
                          <h4>No {viewTab} seminars found</h4>
                          <p>
                            {viewTab === "archived"
                              ? "There are no archived seminars for this program."
                              : "No active seminars have been added to this program yet. Click '+ Add Seminar' above to create one."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredSeminars.map((sem) => (
                      <tr key={sem.id}>
                        <td>
                          <div className="prog-name-cell">
                            <span className="prog-title-main">{sem.title}</span>
                          </div>
                        </td>
                        <td>
                          <span className="prog-desc-sub">
                            {sem.description || <em style={{ color: "var(--gray-400)" }}>No description</em>}
                          </span>
                        </td>
                        <td>
                          <span className={`prog-status-pill ${sem.is_archived ? "inactive" : sem.status.toLowerCase()}`}>
                            {sem.is_archived ? "Archived" : sem.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <span style={{ fontSize: "12.5px", fontWeight: "600", color: "var(--gray-800)", display: "flex", alignItems: "center", gap: "4px" }}>
                              <IconUser /> {sem.is_archived ? (sem.archived_by_name || "Admin") : (sem.created_by_name || "Admin")}
                            </span>
                            <span style={{ color: "var(--gray-500)", fontSize: "11.5px" }}>
                              {new Date(sem.is_archived && sem.archived_at ? sem.archived_at : sem.created_at).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="prog-actions-cell" style={{ justifyContent: "flex-end" }}>
                            {!sem.is_archived ? (
                              <>
                                <button
                                  className="btn-action-edit"
                                  onClick={() =>
                                    setSeminarModal({
                                      isOpen: true,
                                      mode: "edit",
                                      data: sem,
                                    })
                                  }
                                  title="Edit Seminar"
                                >
                                  <IconEdit />
                                </button>
                                <button
                                  className="btn-action-archive"
                                  onClick={() => setArchiveModal({ isOpen: true, type: "seminar", data: sem })}
                                  title="Archive Seminar"
                                >
                                  <IconArchiveBox />
                                </button>
                              </>
                            ) : (
                              <button
                                className="btn-action-restore"
                                onClick={() => triggerRestore("seminar", sem)}
                                title="Restore Seminar"
                              >
                                <IconRestore /> Restore
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* VIEW B: ALL PROGRAMS TABLE (Overview) */
            <div className="prog-table-container">
              <table className="prog-custom-table">
                <thead>
                  <tr>
                    <th style={{ width: "20%" }}>Program Name</th>
                    <th style={{ width: "24%" }}>Description</th>
                    <th style={{ width: "13%" }}>Seminars</th>
                    <th style={{ width: "12%" }}>Status</th>
                    <th style={{ width: "16%" }}>{viewTab === "archived" ? "Archived By & Date" : "Created By & Date"}</th>
                    <th style={{ width: "15%", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: "center", padding: "40px" }}>
                        Loading programs...
                      </td>
                    </tr>
                  ) : filteredPrograms.length === 0 ? (
                    <tr>
                      <td colSpan="6">
                        <div className="prog-empty-box">
                          {viewTab === "archived" ? <IconArchiveBox /> : <IconPrograms />}
                          <h4>No {viewTab} programs found</h4>
                          <p>
                            {viewTab === "archived"
                              ? "There are currently no archived programs in the system."
                              : "No active programs have been registered yet. Click '+ Add Program' to create the first one."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredPrograms.map((prog) => {
                      const count = seminarCountByProgram[prog.id] || 0;
                      return (
                        <tr key={prog.id}>
                          <td>
                            <div className="prog-name-cell">
                              <span className="prog-title-main">{prog.name}</span>
                            </div>
                          </td>
                          <td>
                            <span className="prog-desc-sub">
                              {prog.description || <em style={{ color: "var(--gray-400)" }}>No description</em>}
                            </span>
                          </td>
                          <td>
                            <span className="prog-seminar-count-badge">
                              <IconSeminar /> {count} {count === 1 ? "Seminar" : "Seminars"}
                            </span>
                          </td>
                          <td>
                            <span className={`prog-status-pill ${prog.is_archived ? "inactive" : prog.status.toLowerCase()}`}>
                              {prog.is_archived ? "Archived" : prog.status}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                              <span style={{ fontSize: "12.5px", fontWeight: "600", color: "var(--gray-800)", display: "flex", alignItems: "center", gap: "4px" }}>
                                <IconUser /> {prog.is_archived ? (prog.archived_by_name || "Admin") : (prog.created_by_name || "Admin")}
                              </span>
                              <span style={{ color: "var(--gray-500)", fontSize: "11.5px" }}>
                                {new Date(prog.is_archived && prog.archived_at ? prog.archived_at : prog.created_at).toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                            </div>
                          </td>
                          <td>
                            <div className="prog-actions-cell" style={{ justifyContent: "flex-end" }}>
                              <button
                                className="btn-action-view"
                                onClick={() => {
                                  setSelectedProgramId(prog.id);
                                  setSearchQuery("");
                                  setStatusFilter("All");
                                }}
                                title="View / Manage Seminars"
                              >
                                View Seminars <IconArrowRight />
                              </button>

                              {!prog.is_archived ? (
                                <>
                                  <button
                                    className="btn-action-edit"
                                    onClick={() =>
                                      setProgramModal({
                                        isOpen: true,
                                        mode: "edit",
                                        data: prog,
                                      })
                                    }
                                    title="Edit Program"
                                  >
                                    <IconEdit />
                                  </button>
                                  <button
                                    className="btn-action-archive"
                                    onClick={() =>
                                      setArchiveModal({
                                        isOpen: true,
                                        type: "program",
                                        data: prog,
                                      })
                                    }
                                    title="Archive Program"
                                  >
                                    <IconArchiveBox />
                                  </button>
                                </>
                              ) : (
                                <button
                                  className="btn-action-restore"
                                  onClick={() => triggerRestore("program", prog)}
                                  title="Restore Program"
                                >
                                  <IconRestore /> Restore
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </div>{/* end prog-scroll-body */}
      </main>

      {/* ── MODAL 1: ADD / EDIT PROGRAM ── */}
      {programModal.isOpen && (
        <ProgramFormModal
          mode={programModal.mode}
          adminName={getAdminFullName()}
          initialData={programModal.data}
          onSave={triggerSaveProgram}
          onClose={() => setProgramModal({ isOpen: false, mode: "add", data: null })}
        />
      )}

      {/* ── MODAL 2: ADD / EDIT SEMINAR ── */}
      {seminarModal.isOpen && (
        <SeminarFormModal
          mode={seminarModal.mode}
          adminName={getAdminFullName()}
          programName={selectedProgram?.name || "Program"}
          initialData={seminarModal.data}
          onSave={triggerSaveSeminar}
          onClose={() => setSeminarModal({ isOpen: false, mode: "add", data: null })}
        />
      )}

      {/* ── MODAL 3: ARCHIVE CONFIRMATION ── */}
      {archiveModal.isOpen && (
        <ArchiveConfirmModal
          type={archiveModal.type}
          data={archiveModal.data}
          childSeminarCount={
            archiveModal.type === "program" && archiveModal.data
              ? seminarCountByProgram[archiveModal.data.id] || 0
              : 0
          }
          onConfirm={() => triggerArchive(archiveModal.type, archiveModal.data)}
          onClose={() => setArchiveModal({ isOpen: false, type: null, data: null })}
        />
      )}

      {/* ── MODAL 4: ADMIN PASSWORD AUTHENTICATION MODAL ── */}
      {authModal.isOpen && (
        <AdminPasswordAuthModal
          actionTitle={authModal.actionTitle}
          actionDescription={authModal.actionDescription}
          onConfirm={authModal.pendingHandler}
          onClose={() => setAuthModal({ isOpen: false, actionTitle: "", actionDescription: "", pendingHandler: null })}
        />
      )}
    </div>
  );
}

// ── Program Form Modal ────────────────────────────────────────────────────
function ProgramFormModal({ mode, adminName, initialData, onSave, onClose }) {
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [status, setStatus] = useState(initialData?.status || "Active");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Program Name is required.");
      return;
    }

    try {
      onSave({
        id: initialData?.id,
        name,
        description,
        status,
      });
    } catch (err) {
      setError(err.message || "Validation failed.");
    }
  };

  return (
    <div className="prog-modal-overlay" onClick={onClose}>
      <div className="prog-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="prog-modal-header">
          <h3>
            <IconPrograms /> {mode === "add" ? "Add New Program" : "Edit Program"}
          </h3>
          <button className="prog-modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="prog-modal-body">
            {/* Authenticated Admin Badge */}
            <div className="prog-admin-auth-badge">
              <IconShield />
              <span>
                Authenticated Admin: <strong>{adminName}</strong>
              </span>
            </div>

            {error && (
              <div style={{
                background: "#fff5f5",
                border: "1px solid #feb2b2",
                color: "#e53e3e",
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                fontSize: "12.5px",
                marginBottom: "14px"
              }}>
                {error}
              </div>
            )}

            <div className="prog-form-group">
              <label>
                Program Name <span className="required-star">*</span>
              </label>
              <input
                type="text"
                className={`prog-form-input ${!name.trim() && error ? "has-error" : ""}`}
                placeholder="e.g., Awareness Program, Health & Wellness"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(""); }}
                autoFocus
              />
            </div>

            <div className="prog-form-group">
              <label>Program Description (Optional)</label>
              <textarea
                className="prog-form-textarea"
                placeholder="Brief description of the program goals, audience, and scope..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="prog-form-group">
              <label>Status</label>
              <select
                className="prog-form-select"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="prog-modal-footer">
            <button type="button" className="btn-modal-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-modal-submit">
              {mode === "add" ? "Create Program (Verify Password)" : "Save Changes (Verify Password)"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Seminar Form Modal ────────────────────────────────────────────────────
function SeminarFormModal({ mode, adminName, programName, initialData, onSave, onClose }) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [status, setStatus] = useState(initialData?.status || "Active");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Seminar Title is required.");
      return;
    }

    try {
      onSave({
        id: initialData?.id,
        program_id: initialData?.program_id,
        title,
        description,
        status,
      });
    } catch (err) {
      setError(err.message || "Validation failed.");
    }
  };

  return (
    <div className="prog-modal-overlay" onClick={onClose}>
      <div className="prog-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="prog-modal-header">
          <h3>
            <IconSeminar /> {mode === "add" ? "Add Seminar" : "Edit Seminar"}
          </h3>
          <button className="prog-modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="prog-modal-body">
            {/* Authenticated Admin Badge */}
            <div className="prog-admin-auth-badge">
              <IconShield />
              <span>
                Authenticated Admin: <strong>{adminName}</strong>
              </span>
            </div>

            {error && (
              <div style={{
                background: "#fff5f5",
                border: "1px solid #feb2b2",
                color: "#e53e3e",
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                fontSize: "12.5px",
                marginBottom: "14px"
              }}>
                {error}
              </div>
            )}

            <div className="prog-form-group">
              <label>Parent Program</label>
              <div className="prog-parent-program-tag">
                <IconPrograms /> {programName}
              </div>
            </div>

            <div className="prog-form-group">
              <label>
                Seminar Title <span className="required-star">*</span>
              </label>
              <input
                type="text"
                className={`prog-form-input ${!title.trim() && error ? "has-error" : ""}`}
                placeholder="e.g., Community Safety Orientation, Disaster Preparedness"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setError(""); }}
                autoFocus
              />
            </div>

            <div className="prog-form-group">
              <label>Seminar Description (Optional)</label>
              <textarea
                className="prog-form-textarea"
                placeholder="Brief description of the seminar topic, agenda, or prerequisites..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="prog-form-group">
              <label>Status</label>
              <select
                className="prog-form-select"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="prog-modal-footer">
            <button type="button" className="btn-modal-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-modal-submit">
              {mode === "add" ? "Add Seminar (Verify Password)" : "Save Changes (Verify Password)"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Archive Confirmation Modal ────────────────────────────────────────────
function ArchiveConfirmModal({ type, data, childSeminarCount, onConfirm, onClose }) {
  const isProgram = type === "program";
  const name = isProgram ? data?.name : data?.title;

  return (
    <div className="prog-modal-overlay" onClick={onClose}>
      <div className="prog-modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "460px" }}>
        <div className="prog-delete-modal-body">
          <div className="prog-archive-icon-wrap">
            <IconArchiveBox />
          </div>

          <h3>Archive {isProgram ? "Program" : "Seminar"}?</h3>
          <p>
            Are you sure you want to archive <strong>"{name}"</strong>? It will be safely moved to the Archived tab.
          </p>

          {isProgram && childSeminarCount > 0 && (
            <div className="prog-archive-notice-box">
              📦 <strong>Note:</strong> Archiving this program will also move its{" "}
              <strong>{childSeminarCount} {childSeminarCount === 1 ? "seminar" : "seminars"}</strong> to the archive records. You can restore them anytime.
            </div>
          )}
        </div>

        <div className="prog-modal-footer" style={{ justifyContent: "center" }}>
          <button type="button" className="btn-modal-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-modal-archive"
            onClick={onConfirm}
          >
            Continue to Password Verification
          </button>
        </div>
      </div>
    </div>
  );
}
