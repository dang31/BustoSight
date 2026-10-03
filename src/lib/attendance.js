import { supabase } from "./supabase";

export const PROGRAM = "program";
export const SEMINAR = "seminar";

/** Option value for a program/seminar checkbox, e.g. "program:<uuid>". */
export const attendanceOptionValue = (kind, id) => `${kind}:${id}`;

/**
 * Groups the resident-attendance options by their parent program so a
 * <select multiple> can render one <optgroup> per program.
 */
export function buildGroups(programs, seminars) {
  const seminarsByProgram = new Map();

  for (const seminar of seminars) {
    if (!seminar?.program_id) continue;
    const list = seminarsByProgram.get(seminar.program_id) || [];
    list.push(seminar);
    seminarsByProgram.set(seminar.program_id, list);
  }

  return programs.map((program) => ({
    program,
    seminars: seminarsByProgram.get(program.id) || [],
  }));
}

/**
 * Loads non-archived programs and seminars for the attendance dropdown.
 * Never throws - callers get { programs, seminars, error }.
 */
export async function fetchAttendanceCatalog() {
  try {
    const [programsResult, seminarsResult] = await Promise.all([
      supabase
        .from("programs")
        .select("id, name")
        .eq("is_archived", false)
        .order("name", { ascending: true }),
      supabase
        .from("seminars")
        .select("id, program_id, title")
        .eq("is_archived", false)
        .order("title", { ascending: true }),
    ]);

    if (programsResult.error) throw programsResult.error;
    if (seminarsResult.error) throw seminarsResult.error;

    return {
      programs: programsResult.data || [],
      seminars: seminarsResult.data || [],
      error: null,
    };
  } catch (error) {
    console.error("Error fetching attendance catalog:", error);
    return {
      programs: [],
      seminars: [],
      error: error.message || "Failed to load programs and seminars.",
    };
  }
}

/**
 * Turns the selected option values into the residents.attended_items
 * JSONB array. Names are denormalized from the catalog so reports stay
 * readable after a program is renamed or archived.
 */
export function serializeAttendance(selectedValues, groups) {
  if (!Array.isArray(selectedValues) || selectedValues.length === 0) return [];

  const items = [];
  const seen = new Set();

  for (const { program, seminars } of groups) {
    const programValue = attendanceOptionValue(PROGRAM, program.id);
    if (selectedValues.includes(programValue) && !seen.has(programValue)) {
      seen.add(programValue);
      items.push({
        kind: PROGRAM,
        id: program.id,
        name: program.name,
      });
    }

    for (const seminar of seminars) {
      const seminarValue = attendanceOptionValue(SEMINAR, seminar.id);
      if (selectedValues.includes(seminarValue) && !seen.has(seminarValue)) {
        seen.add(seminarValue);
        items.push({
          kind: SEMINAR,
          id: seminar.id,
          program_id: program.id,
          name: seminar.title,
        });
      }
    }
  }

  return items;
}

/**
 * Like serializeAttendance, but also carries forward stored entries whose
 * program or seminar is no longer in the catalog (archived or renamed away).
 *
 * serializeAttendance can only emit items it can find in `groups`, so saving an
 * unrelated field such as a corrected surname would otherwise silently erase a
 * resident's attendance history. Callers pass the orphans returned by
 * deserializeAttendance; the encoder can drop them explicitly instead.
 */
export function mergeAttendance(selectedValues, groups, orphans = []) {
  const items = serializeAttendance(selectedValues, groups);
  const kept = new Set(items.map((item) => attendanceOptionValue(item.kind, item.id)));

  for (const orphan of toItemArray(orphans)) {
    const key = attendanceOptionValue(orphan.kind, orphan.id);
    if (kept.has(key)) continue;
    kept.add(key);
    items.push(orphan);
  }

  return items;
}

/**
 * Reads a stored attended_items array back into option values so an edit
 * form can preselect them. Entries no longer in the catalog are kept in
 * `orphans` so they can still be displayed rather than silently dropped.
 */
export function deserializeAttendance(attendedItems, groups) {
  const available = new Set();

  for (const { program, seminars } of groups) {
    available.add(attendanceOptionValue(PROGRAM, program.id));
    for (const seminar of seminars) {
      available.add(attendanceOptionValue(SEMINAR, seminar.id));
    }
  }

  const values = [];
  const orphans = [];

  for (const item of toItemArray(attendedItems)) {
    const kind = item.kind === SEMINAR ? SEMINAR : PROGRAM;
    const value = attendanceOptionValue(kind, item.id);
    if (available.has(value)) values.push(value);
    else orphans.push(item);
  }

  return { values, orphans };
}

/**
 * Normalizes whatever is in the column into an array of items, tolerating
 * null, a legacy JSON string, or a bare uuid string.
 */
export function toItemArray(attendedItems) {
  if (!attendedItems) return [];

  let parsed = attendedItems;
  if (typeof parsed === "string") {
    const trimmed = parsed.trim();
    if (!trimmed) return [];
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      // Not JSON. Keep the raw value visible instead of dropping it, so a
      // malformed row surfaces as an orphan rather than being silently erased
      // the next time the resident is saved.
      parsed = [{ kind: PROGRAM, id: trimmed, name: trimmed }];
    }
  }

  if (Array.isArray(parsed)) {
    return parsed
      .filter((item) => item && typeof item === "object" && item.id)
      .map((item) => ({
        kind: item.kind === SEMINAR ? SEMINAR : PROGRAM,
        id: item.id,
        name: item.name || "",
        ...(item.program_id ? { program_id: item.program_id } : {}),
      }));
  }

  if (typeof parsed === "object" && parsed.id) {
    return [
      {
        kind: parsed.kind === SEMINAR ? SEMINAR : PROGRAM,
        id: parsed.id,
        name: parsed.name || "",
        ...(parsed.program_id ? { program_id: parsed.program_id } : {}),
      },
    ];
  }

  return [];
}

/**
 * Turns selected option values into printable report targets.
 *
 * A program target carries the ids of its seminars, because a resident counts
 * toward a program when they ticked the program itself OR joined any of its
 * seminars.
 *
 * @param {string[]} values   "program:<uuid>" / "seminar:<uuid>" strings
 * @param {Array}  groups     output of buildGroups
 */
export function resolveAttendanceTargets(values, groups) {
  const targets = [];
  const seen = new Set();

  for (const { program, seminars } of groups) {
    const programValue = attendanceOptionValue(PROGRAM, program.id);
    if (values.includes(programValue) && !seen.has(programValue)) {
      seen.add(programValue);
      targets.push({
        kind: PROGRAM,
        id: program.id,
        name: program.name,
        seminarIds: seminars.map((seminar) => seminar.id),
      });
    }

    for (const seminar of seminars) {
      const seminarValue = attendanceOptionValue(SEMINAR, seminar.id);
      if (values.includes(seminarValue) && !seen.has(seminarValue)) {
        seen.add(seminarValue);
        targets.push({
          kind: SEMINAR,
          id: seminar.id,
          name: seminar.title,
          programId: program.id,
          programName: program.name,
          seminarIds: [],
        });
      }
    }
  }

  return targets;
}

/**
 * How one resident's stored attendance relates to one report target.
 *
 * Seminar targets match only that seminar. Program targets match the program
 * itself, any of its seminars, or both - returned as the label the report
 * prints in its "Attended Via" column.
 *
 * @returns {'program'|'seminar'|'both'|null} null when the resident did not attend
 */
export function matchAttendanceTarget(attendedItems, target) {
  const items = toItemArray(attendedItems);

  if (target.kind === SEMINAR) {
    return items.some((item) => item.kind === SEMINAR && item.id === target.id)
      ? SEMINAR
      : null;
  }

  const direct = items.some(
    (item) => item.kind === PROGRAM && item.id === target.id,
  );
  const viaSeminar = target.seminarIds.some((seminarId) =>
    items.some((item) => item.kind === SEMINAR && item.id === seminarId),
  );

  if (direct && viaSeminar) return "both";
  if (direct) return "program";
  if (viaSeminar) return "seminar";
  return null;
}

/**
 * Read-model for the resident detail card.
 *
 * Groups a stored attended_items array by parent program so the UI can show
 * the program -> seminar hierarchy instead of one flattened string. A program
 * whose seminars were ticked but which was never ticked itself is still listed,
 * flagged as reached via its seminars, because that is the real relationship.
 *
 * Entries whose program or seminar is no longer in the catalog are kept and
 * marked `archived` rather than dropped - seminars whose parent program is
 * still known stay nested under it so the relationship survives.
 *
 * @returns {{programs: Array, orphans: Array, programCount: number, seminarCount: number}}
 */
export function summarizeAttendance(attendedItems, groups = []) {
  const items = toItemArray(attendedItems);

  const programById = new Map(
    groups.map(({ program }) => [program.id, program]),
  );

  const seminarById = new Map();
  for (const { program, seminars } of groups) {
    for (const seminar of seminars) {
      seminarById.set(seminar.id, { seminar, program });
    }
  }

  const entries = new Map();
  const orphans = [];

  const entryFor = (programId, programName) => {
    let entry = entries.get(programId);
    if (!entry) {
      entry = {
        id: programId,
        name: programName || "Unknown Program",
        programAttended: false,
        seminars: [],
      };
      entries.set(programId, entry);
    }
    return entry;
  };

  for (const item of items) {
    if (item.kind === PROGRAM) {
      const program = programById.get(item.id);
      if (program) {
        entryFor(program.id, program.name).programAttended = true;
      } else {
        orphans.push({ ...item, archived: true });
      }
      continue;
    }

    const match = seminarById.get(item.id);
    if (match) {
      const entry = entryFor(match.program.id, match.program.name);
      if (!entry.seminars.some((s) => s.id === item.id)) {
        entry.seminars.push({
          id: item.id,
          name: match.seminar.title,
          archived: false,
        });
      }
      continue;
    }

    const parent = item.program_id ? programById.get(item.program_id) : null;
    if (parent) {
      const entry = entryFor(parent.id, parent.name);
      entry.seminars.push({
        id: item.id,
        name: item.name || item.id,
        archived: true,
      });
    } else {
      orphans.push({ ...item, archived: true });
    }
  }

  const list = [...entries.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return {
    programs: list,
    orphans,
    programCount: list.filter((entry) => entry.programAttended).length,
    seminarCount: list.reduce(
      (total, entry) => total + entry.seminars.length,
      0,
    ),
  };
}

/** Human-readable list for the review summary and reports. */
export function formatAttendance(attendedItems, groups = []) {
  const items = toItemArray(attendedItems);
  const parts = [];
  const matched = new Set();

  for (const { program, seminars } of groups) {
    const programValue = attendanceOptionValue(PROGRAM, program.id);
    if (items.some((item) => item.kind === PROGRAM && item.id === program.id)) {
      parts.push(program.name);
      matched.add(programValue);
    }

    for (const seminar of seminars) {
      const seminarValue = attendanceOptionValue(SEMINAR, seminar.id);
      if (
        items.some((item) => item.kind === SEMINAR && item.id === seminar.id)
      ) {
        parts.push(seminar.title);
        matched.add(seminarValue);
      }
    }
  }

  // Anything archived or renamed away still gets shown, so a stored
  // attendance record never silently disappears from the summary.
  for (const item of items) {
    if (!matched.has(attendanceOptionValue(item.kind, item.id))) {
      parts.push(item.name || item.id);
    }
  }

  return parts.join(", ");
}