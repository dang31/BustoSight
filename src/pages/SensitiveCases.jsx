import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "../components/Sidebar";
import UserProfileBadge from "../components/UserProfileBadge";
import PasswordInput from "../components/Common/PasswordInput";
import { useToast } from "../components/Feedback/FeedbackProvider";
import { supabase } from "../lib/supabase";
import { logTransaction } from "../utils/logger";
import { formatResidentName } from "../lib/residentName";
import {
  getDataYearOptions,
  isFemaleSex,
  toAgeInt,
} from "../lib/ageEngine";
import {
  SENSITIVE_UNLOCK_MINUTES,
  SENSITIVE_UNLOCK_MS,
  verifyCurrentUserPassword,
} from "../utils/sensitiveAccess";
import "../css/SensitiveCases.css";

const STATUS_LABELS = {
  Pending: "Pending DSWD referral",
  Referred: "Referred to DSWD",
  Closed: "Closed",
};

function normalizeStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  if (status === "referred") return "Referred";
  if (status === "closed") return "Closed";
  return "Pending";
}

function statusClass(status) {
  return `sensitive-status sensitive-status-${status.toLowerCase()}`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatAddress(record) {
  if (!record) return "—";
  return (
    [
      record.house_no ? `House ${record.house_no}` : "",
      record.street,
      record.purok,
      record.barangay,
    ]
      .filter(Boolean)
      .join(", ") || "—"
  );
}

function remainingLabel(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function sensitiveLoadError(message) {
  const text = String(message || "Could not load the sensitive cases.");
  const hint =
    text.includes("dswd_") || text.includes("child_pregnancy_case")
      ? " Run supabase/sensitive_child_pregnancy.sql in the Supabase SQL editor first."
      : "";
  return `${text}${hint}`;
}

export default function SensitiveCases() {
  const toast = useToast();

  const [locked, setLocked] = useState(true);
  const [password, setPassword] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [deadline, setDeadline] = useState(null);
  const [remaining, setRemaining] = useState(0);
  // Guards against a manual lock racing the auto-lock timer and writing two
  // audit entries for the same lock event.
  const lockedRef = useRef(true);

  const [cases, setCases] = useState([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  const [yearFilter, setYearFilter] = useState("all");
  const [brgyFilter, setBrgyFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [selectedCase, setSelectedCase] = useState(null);
  const [referralStatus, setReferralStatus] = useState("Pending");
  const [referralNotes, setReferralNotes] = useState("");
  const [savingReferral, setSavingReferral] = useState(false);

  const handleLock = useCallback(
    (reason = "manual") => {
      if (lockedRef.current) return;
      lockedRef.current = true;

      setLocked(true);
      setCases([]);
      setSelectedCase(null);
      setDeadline(null);
      setRemaining(0);
      setPassword("");
      setUnlockError("");
      setLoadingCases(false);
      setLoadError("");

      logTransaction({
        action:
          reason === "auto"
            ? "Sensitive Cases Auto-Locked"
            : "Sensitive Cases Locked",
        category: "Data Privacy",
        details:
          reason === "auto"
            ? "The confidential child-pregnancy summary auto-locked after the unlock window expired."
            : "An administrator locked the confidential child-pregnancy summary.",
      });
    },
    [],
  );

  // Auto-lock when the unlock window runs out.
  useEffect(() => {
    if (!deadline) return undefined;

    const tick = () => {
      const left = Math.max(0, deadline - Date.now());
      setRemaining(left);
      if (left <= 0) handleLock("auto");
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [deadline, handleLock]);

  // Sensitive rows are fetched only while the page is unlocked.
  useEffect(() => {
    if (locked) return undefined;

    let alive = true;

    async function loadCases() {
      setLoadingCases(true);
      setLoadError("");

      try {
        let query = supabase
          .from("residents")
          .select(
            "id, first_name, middle_name, last_name, qualifier, age, birth_date, sex, barangay, h_no, house_no, street, purok, data_year, child_pregnancy_case, dswd_referral_status, dswd_referred_at, dswd_referral_notes, created_at, is_archived",
          )
          .eq("child_pregnancy_case", true);

        if (yearFilter !== "all") {
          query = query.eq("data_year", Number(yearFilter));
        }

        const { data, error } = await query;

        if (!alive) return;

        if (error) {
          console.error("Sensitive cases fetch error:", error);
          setLoadError(sensitiveLoadError(error.message));
          setCases([]);
        } else {
          const rows = (data || [])
            .filter((row) => isFemaleSex(row.sex))
            .sort(
              (a, b) =>
                (toAgeInt(a.age) ?? Number.MAX_SAFE_INTEGER) -
                (toAgeInt(b.age) ?? Number.MAX_SAFE_INTEGER),
            );
          setCases(rows);
        }
      } catch (error) {
        if (!alive) return;
        console.error("Sensitive cases fetch error:", error);
        setLoadError(sensitiveLoadError(error?.message));
        setCases([]);
      } finally {
        if (alive) setLoadingCases(false);
      }
    }

    loadCases();
    return () => {
      alive = false;
    };
  }, [locked, yearFilter, reloadToken]);

  const yearOptions = useMemo(
    () => getDataYearOptions().map(String),
    [],
  );

  const brgyOptions = useMemo(
    () =>
      Array.from(
        new Set(cases.map((row) => row.barangay).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b)),
    [cases],
  );

  useEffect(() => {
    if (brgyFilter !== "all" && !brgyOptions.includes(brgyFilter)) {
      setBrgyFilter("all");
    }
  }, [brgyFilter, brgyOptions]);

  const visibleCases = useMemo(() => {
    const term = search.trim().toLowerCase();

    return cases.filter((row) => {
      if (brgyFilter !== "all" && row.barangay !== brgyFilter) return false;
      if (!term) return true;

      return [
        formatResidentName(row),
        row.h_no,
        row.house_no,
        row.street,
        row.purok,
        row.barangay,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [cases, brgyFilter, search]);

  const summary = useMemo(() => {
    const ages = cases
      .map((row) => toAgeInt(row.age))
      .filter((age) => age !== null);
    const barangays = new Set(
      cases.map((row) => row.barangay).filter(Boolean),
    );
    const pending = cases.filter(
      (row) => normalizeStatus(row.dswd_referral_status) === "Pending",
    ).length;

    return {
      total: cases.length,
      barangays: barangays.size,
      youngest: ages.length ? Math.min(...ages) : null,
      pending,
    };
  }, [cases]);

  const handleUnlock = async (event) => {
    event.preventDefault();
    setUnlockError("");

    if (!password.trim()) {
      setUnlockError("Enter your administrator password.");
      return;
    }

    setUnlocking(true);
    let ok = false;
    try {
      ok = await verifyCurrentUserPassword(password);
    } catch (err) {
      console.error("Sensitive Cases verification error:", err);
      ok = false;
    }

    if (!ok) {
      setUnlockError(
        "Incorrect password. The confidential data was not loaded.",
      );
      setUnlocking(false);
      logTransaction({
        action: "Sensitive Cases Unlock Failed",
        category: "Data Privacy",
        details:
          "A failed attempt was made to unlock the confidential child-pregnancy summary.",
      });
      return;
    }

    setPassword("");
    setUnlockError("");
    setUnlocking(false);
    setLocked(false);
    lockedRef.current = false;
    setDeadline(Date.now() + SENSITIVE_UNLOCK_MS);
    setRemaining(SENSITIVE_UNLOCK_MS);

    logTransaction({
      action: "Sensitive Cases Unlocked",
      category: "Data Privacy",
      details:
        "An administrator unlocked the confidential child-pregnancy summary.",
    });
    toast.success(
      `Sensitive cases unlocked for ${SENSITIVE_UNLOCK_MINUTES} minutes.`,
    );
  };

  const openCase = (row) => {
    setSelectedCase(row);
    setReferralStatus(normalizeStatus(row.dswd_referral_status));
    setReferralNotes(row.dswd_referral_notes || "");
    logTransaction({
      action: "Sensitive Case Viewed",
      category: "Data Privacy",
      details: `Opened the confidential child-pregnancy case for HH# ${row.h_no || "N/A"} (Data Year ${row.data_year || "N/A"}).`,
    });
  };

  const handleSaveReferral = async () => {
    if (!selectedCase) return;

    setSavingReferral(true);
    try {
      const existingReferredAt = selectedCase.dswd_referred_at || null;
      const nextReferredAt =
        referralStatus === "Referred"
          ? existingReferredAt || new Date().toISOString()
          : referralStatus === "Closed"
            ? existingReferredAt
            : null;

      const payload = {
        dswd_referral_status: referralStatus,
        dswd_referred_at: nextReferredAt,
        dswd_referral_notes: referralNotes.trim() || null,
      };

      // A resident has one row per data year. Keep the DSWD state consistent
      // across all of that resident's annual rows instead of leaving an older
      // year showing a different referral status.
      let updateQuery = supabase.from("residents").update(payload);

      if (selectedCase.birth_date) {
        updateQuery = updateQuery
          .eq("child_pregnancy_case", true)
          .eq("first_name", selectedCase.first_name)
          .eq("last_name", selectedCase.last_name)
          .eq("birth_date", selectedCase.birth_date)
          .eq("barangay", selectedCase.barangay);

        updateQuery =
          selectedCase.middle_name === null ||
          selectedCase.middle_name === undefined
            ? updateQuery.is("middle_name", null)
            : updateQuery.eq("middle_name", selectedCase.middle_name);
        updateQuery =
          selectedCase.qualifier === null ||
          selectedCase.qualifier === undefined
            ? updateQuery.is("qualifier", null)
            : updateQuery.eq("qualifier", selectedCase.qualifier);
      } else {
        // Without a birth date there is no safe cross-year identity. Update
        // only the record the administrator opened.
        updateQuery = updateQuery.eq("id", selectedCase.id);
      }

      const { error } = await updateQuery;
      if (error) throw error;

      const sameCasePerson = (row) =>
        row.id === selectedCase.id ||
        (Boolean(selectedCase.birth_date) &&
          row.birth_date === selectedCase.birth_date &&
          row.first_name === selectedCase.first_name &&
          row.last_name === selectedCase.last_name &&
          (row.middle_name || null) === (selectedCase.middle_name || null) &&
          (row.qualifier || null) === (selectedCase.qualifier || null) &&
          row.barangay === selectedCase.barangay);

      setCases((prev) =>
        prev.map((row) =>
          sameCasePerson(row) ? { ...row, ...payload } : row,
        ),
      );
      setSelectedCase(null);

      logTransaction({
        action: "DSWD Referral Updated",
        category: "Data Privacy",
        details: `Child-pregnancy case for HH# ${selectedCase.h_no || "N/A"} (Data Year ${selectedCase.data_year || "N/A"}) marked ${referralStatus}; matching annual records synchronized.`,
      });
      toast.success("DSWD referral status updated.");
    } catch (error) {
      console.error("DSWD referral update error:", error);
      toast.error(
        `Could not update the referral status: ${error.message || "unknown error"}`,
      );
    } finally {
      setSavingReferral(false);
    }
  };

  return (
    <div className="dashboard-wrapper">
      <div className="bg-image" />
      <div className="overlay" />
      <Sidebar />

      <main className="content sensitive-content">
        <header className="main-header sensitive-header">
          <div>
            <p className="sensitive-eyebrow">Restricted · Data Privacy Act</p>
            <h1>Confidential Sensitive Cases</h1>
          </div>

          <div className="sensitive-header-actions">
            {!locked && (
              <span className="sensitive-session-chip">
                <i className="fa-solid fa-lock-open"></i>
                Auto-locks in {remainingLabel(remaining)}
              </span>
            )}
            {!locked && (
              <button
                type="button"
                className="sensitive-lock-now"
                onClick={() => handleLock("manual")}
              >
                <i className="fa-solid fa-lock"></i> Lock now
              </button>
            )}
            <UserProfileBadge />
          </div>
        </header>

        {locked ? (
          <div className="sensitive-lock-shell">
            <div className="sensitive-lock-card">
              <div className="sensitive-lock-icon">
                <i className="fa-solid fa-shield-halved"></i>
              </div>
              <p className="sensitive-eyebrow">Access Restricted</p>
              <h2>Confidential Case Summary</h2>
              <p className="sensitive-lock-copy">
                This module contains child-pregnancy cases for LGU and DSWD
                referral. It is excluded from public reports and is available
                only to authorized administrators.
              </p>

              <div className="sensitive-dpa-note">
                <i className="fa-solid fa-scale-balanced"></i>
                <span>
                  <b>Data Privacy Act of 2012 (RA 10173).</b> Unauthorized
                  viewing, copying, or disclosure of these records may be
                  punished by law. Every unlock attempt is recorded.
                </span>
              </div>

              <form className="sensitive-unlock-form" onSubmit={handleUnlock}>
                <label htmlFor="sensitive-password">
                  Administrator password
                </label>
                <PasswordInput
                  id="sensitive-password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setUnlockError("");
                  }}
                  placeholder="Re-enter your password"
                  autoComplete="current-password"
                  autoFocus
                  disabled={unlocking}
                />
                {unlockError && (
                  <p className="sensitive-error">
                    <i className="fa-solid fa-circle-exclamation"></i>{" "}
                    {unlockError}
                  </p>
                )}
                <button
                  type="submit"
                  className="sensitive-unlock-btn"
                  disabled={unlocking}
                >
                  {unlocking ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i>{" "}
                      Verifying…
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-unlock-keyhole"></i> Unlock
                      confidential summary
                    </>
                  )}
                </button>
              </form>

              <p className="sensitive-footnote">
                Child cases are automatically classified from the resident
                record when a female aged 9 or below has a reported pregnancy.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="sensitive-banner">
              <i className="fa-solid fa-triangle-exclamation"></i>
              <div>
                <b>Confidential — for authorized LGU / DSWD referral only.</b>
                <span>
                  Do not screenshot, print, or share this summary. Child
                  pregnancy cases are kept separate from official Teenage
                  Pregnancy reports.
                </span>
              </div>
            </div>

            <div className="sensitive-stats">
              <div className="sensitive-stat-card">
                <span className="sensitive-stat-icon total">
                  <i className="fa-solid fa-folder-open"></i>
                </span>
                <div>
                  <p>Case records</p>
                  <h2>{summary.total}</h2>
                </div>
              </div>
              <div className="sensitive-stat-card">
                <span className="sensitive-stat-icon barangay">
                  <i className="fa-solid fa-map-location-dot"></i>
                </span>
                <div>
                  <p>Barangays affected</p>
                  <h2>{summary.barangays}</h2>
                </div>
              </div>
              <div className="sensitive-stat-card">
                <span className="sensitive-stat-icon age">
                  <i className="fa-solid fa-child-reaching"></i>
                </span>
                <div>
                  <p>Youngest recorded age</p>
                  <h2>{summary.youngest ?? "—"}</h2>
                </div>
              </div>
              <div className="sensitive-stat-card">
                <span className="sensitive-stat-icon pending">
                  <i className="fa-solid fa-clock"></i>
                </span>
                <div>
                  <p>Pending DSWD referral</p>
                  <h2>{summary.pending}</h2>
                </div>
              </div>
            </div>

            <div className="sensitive-toolbar">
              <div className="sensitive-search">
                <i className="fa-solid fa-magnifying-glass"></i>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search case, household, or address…"
                />
              </div>

              <select
                value={yearFilter}
                onChange={(event) => setYearFilter(event.target.value)}
              >
                <option value="all">All data years</option>
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>

              <select
                value={brgyFilter}
                onChange={(event) => setBrgyFilter(event.target.value)}
              >
                <option value="all">All barangays</option>
                {brgyOptions.map((brgy) => (
                  <option key={brgy} value={brgy}>
                    {brgy}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="sensitive-refresh"
                onClick={() => setReloadToken((value) => value + 1)}
                disabled={loadingCases}
                title="Refresh cases"
              >
                <i
                  className={`fa-solid fa-rotate ${loadingCases ? "fa-spin" : ""}`}
                ></i>
              </button>
            </div>

            {loadError && (
              <div className="sensitive-load-error">
                <i className="fa-solid fa-circle-exclamation"></i>
                <span>{loadError}</span>
              </div>
            )}

            {loadingCases ? (
              <div className="sensitive-loading">
                <i className="fa-solid fa-spinner fa-spin"></i>
                <span>Loading confidential cases…</span>
              </div>
            ) : visibleCases.length === 0 ? (
              <div className="sensitive-empty">
                <i className="fa-solid fa-folder-open"></i>
                <h3>No matching child-pregnancy cases</h3>
                <p>
                  No sensitive cases match the selected data year, barangay, or
                  search term.
                </p>
              </div>
            ) : (
              <div className="sensitive-grid">
                {visibleCases.map((row) => {
                  const status = normalizeStatus(row.dswd_referral_status);
                  const age = toAgeInt(row.age);

                  return (
                    <button
                      type="button"
                      className="sensitive-case-card"
                      key={row.id}
                      onClick={() => openCase(row)}
                    >
                      <div className="sensitive-case-top">
                        <span className="sensitive-case-tag">
                          <i className="fa-solid fa-shield-heart"></i>
                          {age !== null && age <= 9
                            ? "Child pregnancy · Age ≤ 9"
                            : "Historical child-pregnancy case"}
                        </span>
                        <span className="sensitive-case-tags">
                          {row.is_archived && (
                            <span className="sensitive-case-tag archived">
                              <i className="fa-solid fa-box-archive"></i>
                              Archived
                            </span>
                          )}
                          <span className={statusClass(status)}>
                            {STATUS_LABELS[status]}
                          </span>
                        </span>
                      </div>

                      <h3>{formatResidentName(row)}</h3>

                      <div className="sensitive-case-meta">
                        <span>
                          <i className="fa-solid fa-cake-candles"></i> Age{" "}
                          {row.age ?? "—"}
                        </span>
                        <span>
                          <i className="fa-solid fa-calendar"></i> Data Year{" "}
                          {row.data_year || "—"}
                        </span>
                        <span>
                          <i className="fa-solid fa-location-dot"></i>{" "}
                          {row.barangay || "—"}
                        </span>
                        <span>
                          <i className="fa-solid fa-house"></i> HH#{" "}
                          {row.h_no || "—"}
                        </span>
                      </div>

                      <p className="sensitive-case-address">
                        {formatAddress(row)}
                      </p>

                      <div className="sensitive-case-footer">
                        <span>
                          {status === "Referred"
                            ? row.dswd_referred_at
                              ? `Referred ${formatDate(row.dswd_referred_at)}`
                              : "Referred · date not recorded"
                            : status === "Closed"
                              ? "Case closed"
                              : "Awaiting DSWD referral"}
                        </span>
                        <span className="sensitive-open-link">
                          View case{" "}
                          <i className="fa-solid fa-arrow-right"></i>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {selectedCase && !locked && (
          <div
            className="modal-overlay"
            onClick={() => setSelectedCase(null)}
          >
            <div
              className="sensitive-modal-content"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="sensitive-modal-header">
                <div>
                  <p className="sensitive-eyebrow">Confidential case</p>
                  <h2>{formatResidentName(selectedCase)}</h2>
                </div>
                <button
                  type="button"
                  className="sensitive-modal-close"
                  onClick={() => setSelectedCase(null)}
                  aria-label="Close sensitive case"
                >
                  &times;
                </button>
              </div>

              <div className="sensitive-modal-body">
                <div className="sensitive-modal-warning">
                  <i className="fa-solid fa-triangle-exclamation"></i>
                  <span>
                    Full sensitive details. Handle under the Data Privacy Act
                    and refer to DSWD through the authorized LGU process.
                  </span>
                </div>

                <div className="sensitive-detail-grid">
                  <div>
                    <span>Age at record</span>
                    <b>{selectedCase.age ?? "—"}</b>
                  </div>
                  <div>
                    <span>Data Year</span>
                    <b>{selectedCase.data_year || "—"}</b>
                  </div>
                  <div>
                    <span>Barangay</span>
                    <b>{selectedCase.barangay || "—"}</b>
                  </div>
                  <div>
                    <span>Household No.</span>
                    <b>{selectedCase.h_no || "—"}</b>
                  </div>
                  <div className="wide">
                    <span>Address</span>
                    <b>{formatAddress(selectedCase)}</b>
                  </div>
                  <div>
                    <span>Recorded</span>
                    <b>{formatDate(selectedCase.created_at)}</b>
                  </div>
                  <div>
                    <span>Current status</span>
                    <b>
                      {
                        STATUS_LABELS[
                          normalizeStatus(selectedCase.dswd_referral_status)
                        ]
                      }
                    </b>
                  </div>
                  <div>
                    <span>Record state</span>
                    <b>{selectedCase.is_archived ? "Archived" : "Active"}</b>
                  </div>
                </div>

                <div className="sensitive-referral-box">
                  <h3>
                    <i className="fa-solid fa-hand-holding-heart"></i> DSWD
                    Referral Tracking
                  </h3>
                  <p className="sensitive-referral-hint">
                    The referral state is shared across matching annual records
                    for this resident.
                  </p>

                  <div className="sensitive-referral-grid">
                    <div className="sensitive-referral-field">
                      <label htmlFor="referral-status">Referral status</label>
                      <select
                        id="referral-status"
                        value={referralStatus}
                        onChange={(event) =>
                          setReferralStatus(event.target.value)
                        }
                      >
                        <option value="Pending">Pending</option>
                        <option value="Referred">Referred</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </div>

                    <div className="sensitive-referral-field">
                      <label>Referred on</label>
                      <div className="sensitive-readonly">
                        {referralStatus === "Pending"
                          ? "—"
                          : referralStatus === "Referred" &&
                              !selectedCase.dswd_referred_at
                            ? "Will be set when saved"
                            : formatDate(selectedCase.dswd_referred_at)}
                      </div>
                    </div>
                  </div>

                  <div className="sensitive-referral-field">
                    <label htmlFor="referral-notes">
                      Referral notes (optional)
                    </label>
                    <textarea
                      id="referral-notes"
                      rows={3}
                      value={referralNotes}
                      onChange={(event) => setReferralNotes(event.target.value)}
                      placeholder="Record the DSWD coordination, date endorsed, or follow-up notes…"
                    />
                  </div>
                </div>
              </div>

              <div className="sensitive-modal-footer">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setSelectedCase(null)}
                  disabled={savingReferral}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="sensitive-save-btn"
                  onClick={handleSaveReferral}
                  disabled={savingReferral}
                >
                  {savingReferral ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i>{" "}
                      Saving…
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-floppy-disk"></i> Save referral
                      status
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
