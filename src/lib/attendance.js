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
      parsed = [trimmed];
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