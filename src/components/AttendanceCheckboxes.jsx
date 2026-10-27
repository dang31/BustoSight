import { useState } from "react";
import {
  PROGRAM,
  SEMINAR,
  attendanceOptionValue,
} from "../lib/attendance";

/**
 * Collapsible "Programs & Seminars Attended" picker.
 *
 * One accordion row per Program, with its Seminars nested underneath, so the
 * parent-child relationship is visible rather than implied. Programs start
 * collapsed to keep the registration form short.
 *
 * Selection rules:
 *  - Selecting a Seminar also selects its parent Program.
 *  - Selecting a Program does NOT select its Seminars.
 *  - Deselecting a Program also deselects its Seminars, since a Seminar with
 *    no selected Program would break the rule above.
 *
 * `selected` is an array of "program:<uuid>" / "seminar:<uuid>" strings, which
 * src/lib/attendance.js turns into the residents.attended_items JSONB array.
 */
export default function AttendanceCheckboxes({
  groups,
  selected = [],
  onChange,
  disabled = false,
  loading = false,
  error = "",
  onRetry,
}) {
  const [expandedIds, setExpandedIds] = useState([]);

  const selectedSet = new Set(selected);
  const expandedSet = new Set(expandedIds);

  const isSelected = (value) => selectedSet.has(value);
  const isExpanded = (programId) => expandedSet.has(programId);

  const toggleExpanded = (programId) => {
    setExpandedIds((prev) =>
      prev.includes(programId)
        ? prev.filter((id) => id !== programId)
        : [...prev, programId],
    );
  };

  const toggleProgram = ({ program, seminars }) => {
    const programValue = attendanceOptionValue(PROGRAM, program.id);

    if (isSelected(programValue)) {
      const seminarValues = seminars.map((seminar) =>
        attendanceOptionValue(SEMINAR, seminar.id),
      );
      onChange(
        selected.filter(
          (value) => value !== programValue && !seminarValues.includes(value),
        ),
      );
      return;
    }

    onChange([...selected, programValue]);
  };

  const toggleSeminar = (program, seminar) => {
    const programValue = attendanceOptionValue(PROGRAM, program.id);
    const seminarValue = attendanceOptionValue(SEMINAR, seminar.id);

    if (isSelected(seminarValue)) {
      onChange(selected.filter((value) => value !== seminarValue));
      return;
    }

    // Selecting a seminar implies selecting its parent program.
    onChange(
      selectedSet.has(programValue)
        ? [...selected, seminarValue]
        : [...selected, programValue, seminarValue],
    );
  };

  if (loading) {
    return <p className="attendance-note">Loading programs and seminars...</p>;
  }

  if (error) {
    return (
      <div className="attendance-note attendance-note-error">
        <span>Could not load programs and seminars: {error}</span>
        {onRetry && (
          <button type="button" className="attendance-retry" onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <p className="attendance-note">
        No programs available yet. Add them on the <b>Programs</b> page first.
      </p>
    );
  }

  const totalSelectedPrograms = groups.filter(({ program }) =>
    isSelected(attendanceOptionValue(PROGRAM, program.id)),
  ).length;

  const totalSelectedSeminars = groups
    .flatMap(({ seminars }) => seminars)
    .filter((seminar) =>
      isSelected(attendanceOptionValue(SEMINAR, seminar.id)),
    ).length;

  return (
    <div className={`attendance-picker${disabled ? " is-disabled" : ""}`}>
      <div className="attendance-header">
        <span className="attendance-header-title">
          Programs &amp; Seminars Attended
        </span>
        <span className="attendance-header-count">
          {totalSelectedPrograms} program
          {totalSelectedPrograms === 1 ? "" : "s"} &middot;{" "}
          {totalSelectedSeminars} seminar
          {totalSelectedSeminars === 1 ? "" : "s"} selected
        </span>
      </div>

      <div className="attendance-accordion">
        {groups.map(({ program, seminars }) => {
          const programValue = attendanceOptionValue(PROGRAM, program.id);
          const programChecked = isSelected(programValue);
          const expanded = isExpanded(program.id);
          const selectedSeminars = seminars.filter((seminar) =>
            isSelected(attendanceOptionValue(SEMINAR, seminar.id)),
          ).length;

          return (
            <div
              key={program.id}
              className={`attendance-row${expanded ? " expanded" : ""}${
                programChecked ? " checked" : ""
              }`}
            >
              <div className="attendance-row-head">
                <label className="attendance-row-program">
                  <input
                    type="checkbox"
                    checked={programChecked}
                    disabled={disabled}
                    onChange={() => toggleProgram({ program, seminars })}
                  />
                  <span className="attendance-row-name">{program.name}</span>
                </label>

                <span
                  className={`attendance-row-count${
                    selectedSeminars > 0 ? " has-selection" : ""
                  }`}
                  title={`${selectedSeminars} of ${seminars.length} seminars selected`}
                >
                  {selectedSeminars} selected
                </span>

                <button
                  type="button"
                  className="attendance-row-toggle"
                  onClick={() => toggleExpanded(program.id)}
                  disabled={disabled}
                  aria-expanded={expanded}
                  aria-label={`${expanded ? "Collapse" : "Expand"} ${program.name}`}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="9 6 15 12 9 18" />
                  </svg>
                </button>
              </div>

              {expanded && (
                <div className="attendance-row-body">
                  {seminars.length === 0 ? (
                    <p className="attendance-note attendance-note-inline">
                      No seminars available
                    </p>
                  ) : (
                    <>
                      <p className="attendance-row-subhead">Seminars</p>
                      <div className="attendance-row-seminars">
                        {seminars.map((seminar) => {
                          const seminarValue = attendanceOptionValue(
                            SEMINAR,
                            seminar.id,
                          );
                          return (
                            <label
                              key={seminar.id}
                              className={`attendance-seminar${
                                isSelected(seminarValue) ? " checked" : ""
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected(seminarValue)}
                                disabled={disabled}
                                onChange={() => toggleSeminar(program, seminar)}
                              />
                              <span>{seminar.title}</span>
                            </label>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}