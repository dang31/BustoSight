/**
 * householdContinuity.js
 * -----------------------------------------------------------------------
 * Prior-household lookup, auto-fill and member-retention helpers for the
 * Resident Registration portal (AddResident).
 *
 * The registration flow can match an established household from an earlier
 * data year, copy its census baseline into the current encoding form and let
 * the encoder decide which of those people are still part of the household:
 *
 *   - "retained"  -> carried forward into the new data year (saved)
 *   - "deceased"  -> not carried forward (recorded in the transaction log)
 *   - "migrated"  -> not carried forward (recorded in the transaction log)
 *
 * Prior-year rows are NEVER modified. Nothing in this module writes to the
 * database - it only reads and shapes data for the form.
 *
 * NOTE ON HOUSEHOLD NUMBERS: h_no is stable *within* a data year but is NOT
 * guaranteed to be unique across data years (BM156 was Flores in 2024 and
 * Mercado in 2025), so every search always includes the barangay and returns
 * household-year candidates for the encoder to confirm.
 */

import { supabase } from "./supabase";
import {
  applyPersonYear,
  calculateAgeForYear,
  calculateAgeFromPrior,
} from "./ageEngine";

// The age arithmetic used to live here. It now belongs to ageEngine.js so the
// registration form, the resident list editor and the spreadsheet importer
// all apply exactly the same rules; the names stay re-exported so existing
// imports keep working.
export {
  ageReferenceDate,
  calculateAgeForYear,
  calculateAgeFromPrior,
} from "./ageEngine";

/* ── Retention statuses ─────────────────────────────────────────────── */

export const RETAINED = "retained";
export const DECEASED = "deceased";
export const MIGRATED = "migrated";

export const RETENTION_LABELS = {
  [RETAINED]: "Retained",
  [DECEASED]: "Deceased",
  [MIGRATED]: "Migrated",
};

/** Columns needed to rebuild the full registration form from a prior row. */
export const PRIOR_RESIDENT_FIELDS = [
  "id",
  "h_no",
  "house_no",
  "street",
  "purok",
  "barangay",
  "data_year",
  "residence_type",
  "is_archived",
  "first_name",
  "middle_name",
  "last_name",
  "qualifier",
  "birth_place",
  "birth_date",
  "age",
  "sex",
  "civil_status",
  "religion",
  "citizenship",
  "educational_attainment",
  "occupation",
  "is_voter",
  "is_4ps",
  "is_pwd",
  "has_pwd_id",
  "disability_details",
  "is_senior",
  "has_senior_id",
  "is_solo_parent",
  "has_solo_parent_id",
  "age_at_first_birth",
  "teenage_pregnancy_case",
  "current_teenage_mother",
  "child_pregnancy_case",
  "dswd_referral_status",
  "dswd_referred_at",
  "dswd_referral_notes",
  "is_household_head",
  "relation_to_head",
  "attended_items",
].join(",");

/* ── Small normalizers ──────────────────────────────────────────────── */

const pick = (row, ...keys) => {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  const value = row?.[keys[0]];
  return value === undefined ? null : value;
};

const toBool = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (["yes", "y", "true", "1"].includes(v)) return true;
    if (["no", "n", "false", "0", ""].includes(v)) return false;
  }
  return Boolean(value);
};

const toYear = (value) => {
  const year = parseInt(value, 10);
  return Number.isFinite(year) ? year : null;
};

const clean = (value) => (value === null || value === undefined ? "" : String(value).trim());

const softEq = (a, b) => clean(a).toLowerCase() === clean(b).toLowerCase();

/** Escapes LIKE wildcards so user input cannot turn into a pattern. */
const escapeLike = (value) => clean(value).replace(/([\\%_])/g, "\\$1");

/* ── Legacy value normalization ─────────────────────────────────────── */

const EDUCATION_ALIASES = {
  none: "No Education",
  "no education": "No Education",
  "elementary": "Elementary Level",
  "elementary level": "Elementary Level",
  "elementary graduate": "Elementary Graduate",
  "grade school": "Elementary Level",
  "primary": "Elementary Level",
  "high school": "High School Level",
  "high school level": "High School Level",
  "high school graduate": "High School Graduate",
  "secondary": "High School Level",
  "vocational": "Vocational",
  "college": "College Level",
  "college level": "College Level",
  "college graduate": "College Graduate",
  "post graduate": "Post Graduate",
  "graduate": "Post Graduate",
};

export const EDUCATION_OPTIONS = [
  "No Education",
  "Elementary Level",
  "Elementary Graduate",
  "High School Level",
  "High School Graduate",
  "Vocational",
  "College Level",
  "College Graduate",
  "Post Graduate",
];

export const VOTER_OPTIONS = ["Registered Voter", "Not Registered Voter"];

export const CIVIL_STATUS_OPTIONS = [
  "Single",
  "Married",
  "Widowed",
  "Separated",
];

export const RESIDENCE_OPTIONS = [
  "Owner",
  "Renter",
  "Boarder",
  "Living with relatives",
  "Apartment",
  "Other",
];

/** Maps a stored education value onto the form's option list (or keeps it raw). */
export function normalizeEducation(value) {
  const raw = clean(value);
  if (!raw) return "";
  return EDUCATION_ALIASES[raw.toLowerCase()] || raw;
}

/** Maps "Registered" / "YES" style legacy values onto the voter options. */
export function normalizeVoter(value) {
  const raw = clean(value);
  if (!raw) return "Registered Voter";
  const v = raw.toLowerCase();
  if (["registered", "registered voter", "yes", "y", "true", "1"].includes(v)) {
    return "Registered Voter";
  }
  if (
    ["not registered", "not registered voter", "no", "n", "false", "0"].includes(v)
  ) {
    return "Not Registered Voter";
  }
  return raw;
}

/**
 * Maps a stored residence type onto the form options. Anything that is not a
 * canonical option is preserved through "Other" + the detail field so no
 * historical value is silently dropped.
 */
export function mapResidenceType(value) {
  const raw = clean(value);
  if (!raw) return { value: "Owner", other: "" };
  const v = raw.toLowerCase();
  if (v === "owner" || v === "owned") return { value: "Owner", other: "" };
  if (v === "renter" || v === "rented") return { value: "Renter", other: "" };
  if (v === "boarder") return { value: "Boarder", other: "" };
  if (v === "apartment") return { value: "Apartment", other: "" };
  if (v === "living with relatives") {
    return { value: "Living with relatives", other: "" };
  }
  if (RESIDENCE_OPTIONS.includes(raw)) return { value: raw, other: "" };
  return { value: "Other", other: raw };
}

/* ── Household numbering ────────────────────────────────────────────── */

/**
 * Household identifier prefix per barangay. The old code used the first three
 * letters of the barangay name (Bonga Mayor -> BON) which does not match the
 * established identifiers (BM101, BM156 ...).
 */
export const BRGY_HH_PREFIX = {
  "Bonga Mayor": "BM",
  "Bonga Menor": "BON",
  Buisan: "BUI",
  Camachilihan: "CAM",
  Cambaog: "CAM",
  Catacte: "CAT",
  Liciada: "LIC",
  Malamig: "MAL",
  Malawak: "MAL",
  Poblacion: "POB",
  "San Pedro": "SP",
  Talampas: "TAL",
  Tanawan: "TAN",
  Tibagan: "TIB",
};

export function householdPrefix(brgyName) {
  const name = clean(brgyName);
  if (BRGY_HH_PREFIX[name]) return BRGY_HH_PREFIX[name];
  return name.substring(0, 3).toUpperCase();
}

/** Highest numeric suffix already used for a barangay, across all data years. */
export async function generateHouseholdNumber(brgyName) {
  const prefix = householdPrefix(brgyName);
  if (!prefix) return "";

  let maxNum = 0;
  const scan = (hNo) => {
    const match = clean(hNo).match(new RegExp(`^${prefix}(\\d+)$`, "i"));
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  };

  try {
    const { data, error } = await supabase
      .from("residents")
      .select("h_no")
      .ilike("h_no", `${escapeLike(prefix)}%`)
      .ilike("barangay", escapeLike(brgyName))
      .limit(5000);
    if (error) throw error;
    (data || []).forEach((row) => scan(row.h_no));
  } catch (err) {
    console.warn("Household number lookup failed:", err);
  }

  try {
    const local = JSON.parse(localStorage.getItem("tanawanData")) || [];
    local.forEach((rec) => {
      if (softEq(rec.brgy, brgyName)) scan(rec.h_no);
    });
  } catch {
    // localStorage unavailable - the Supabase maximum is enough.
  }

  return `${prefix}${maxNum + 1}`;
}

/* ── Record normalization (Supabase row OR localStorage record) ─────── */

/**
 * Reads a resident row regardless of whether it came from Supabase
 * (`last_name`) or the legacy localStorage shape (`last`).
 */
export function normalizeResidentRecord(row) {
  if (!row) return null;

  const attended = pick(row, "attended_items", "attendedItems");
  const rawAge = pick(row, "age", "age");

  return {
    id: pick(row, "id", "id"),
    h_no: clean(pick(row, "h_no", "h_no")),
    house_no: clean(pick(row, "house_no", "no")),
    street: clean(pick(row, "street", "st")),
    purok: clean(pick(row, "purok", "p")),
    barangay: clean(pick(row, "barangay", "brgy")),
    data_year: toYear(pick(row, "data_year", "dataYear")),
    residence_type: clean(pick(row, "residence_type", "residenceType")),
    is_archived: toBool(pick(row, "is_archived", "isArchived")),

    first_name: clean(pick(row, "first_name", "first")),
    middle_name: clean(pick(row, "middle_name", "mid")),
    last_name: clean(pick(row, "last_name", "last")),
    qualifier: clean(pick(row, "qualifier", "q")),
    birth_place: clean(pick(row, "birth_place", "bp")),
    birth_date: clean(pick(row, "birth_date", "bd")),
    age: rawAge === null || rawAge === "" ? "" : rawAge,
    sex: clean(pick(row, "sex", "s")) || "Male",
    civil_status: clean(pick(row, "civil_status", "cs")) || "Single",
    religion: clean(pick(row, "religion", "religion")),
    citizenship: clean(pick(row, "citizenship", "cz")) || "FILIPINO",
    educational_attainment: clean(
      pick(row, "educational_attainment", "edu"),
    ),
    occupation: clean(pick(row, "occupation", "oc")),
    is_voter: clean(pick(row, "is_voter", "isVoter")),

    is_4ps: toBool(pick(row, "is_4ps", "is4ps")),
    is_pwd: toBool(pick(row, "is_pwd", "isPwd")),
    has_pwd_id: toBool(pick(row, "has_pwd_id", "hasPwdId")),
    disability_details: clean(pick(row, "disability_details", "disabilityDetails")),
    is_senior: toBool(pick(row, "is_senior", "isSenior")),
    has_senior_id: toBool(pick(row, "has_senior_id", "hasSeniorId")),
    is_solo_parent: toBool(pick(row, "is_solo_parent", "isSoloParent")),
    has_solo_parent_id: toBool(
      pick(row, "has_solo_parent_id", "hasSoloParentId"),
    ),
    age_at_first_birth:
      pick(row, "age_at_first_birth", "ageFirstBirth") ?? "",
    teenage_pregnancy: toBool(
      pick(row, "teenage_pregnancy_case", "teenagePregnancy"),
    ),
    current_teenage_mother: toBool(
      pick(row, "current_teenage_mother", "teenageMother"),
    ),
    child_pregnancy_case: toBool(
      pick(row, "child_pregnancy_case", "childPregnancy"),
    ),
    dswd_referral_status:
      clean(pick(row, "dswd_referral_status", "dswdReferralStatus")) ||
      "Pending",
    dswd_referred_at:
      pick(row, "dswd_referred_at", "dswdReferredAt") ?? "",
    dswd_referral_notes:
      pick(row, "dswd_referral_notes", "dswdReferralNotes") ?? "",

    is_household_head: toBool(pick(row, "is_household_head", "isHead")),
    relation_to_head: clean(pick(row, "relation_to_head", "rel")),
    attended_items: Array.isArray(attended) ? attended : [],

    isPriorFormRecord: false,
  };
}

/** True when the row represents the household head of its household-year. */
export function isHeadRecord(record) {
  if (!record) return false;
  if (record.is_household_head) return true;
  return clean(record.relation_to_head).toUpperCase() === "HEAD";
}

/* ── Candidate grouping ─────────────────────────────────────────────── */

const personNameIncludes = (record, lastName, firstName) => {
  const last = clean(lastName).toLowerCase();
  const first = clean(firstName).toLowerCase();
  if (last && !clean(record.last_name).toLowerCase().includes(last)) return false;
  if (first && !clean(record.first_name).toLowerCase().includes(first)) {
    return false;
  }
  return true;
};

/** Removes rows already present in both Supabase and localStorage. */
function dedupeRecords(rows) {
  const seen = new Set();
  const out = [];
  rows.forEach((row) => {
    const record = row.__norm ? row : normalizeResidentRecord(row);
    if (!record) return;
    const key =
      record.id ||
      [
        record.data_year,
        record.h_no,
        record.last_name.toLowerCase(),
        record.first_name.toLowerCase(),
        record.middle_name.toLowerCase(),
        record.birth_date,
      ].join("|");
    if (seen.has(key)) return;
    seen.add(key);
    out.push(record);
  });
  return out;
}

/**
 * Groups normalized rows into household-year candidates, newest first.
 * Each candidate has the head first, then the remaining members.
 */
export function buildCandidates(rows) {
  const groups = new Map();

  rows.forEach((row) => {
    const record = row.__norm ? row : normalizeResidentRecord(row);
    if (!record || record.data_year === null) return;
    if (record.is_archived) return;
    const key = `${record.h_no || "(no-id)"}|${record.data_year}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  });

  const candidates = [];

  groups.forEach((members, key) => {
    let headIndex = members.findIndex(isHeadRecord);
    if (headIndex < 0) headIndex = 0;
    const head = members[headIndex];
    const ordered = [head, ...members.filter((_, i) => i !== headIndex)];

    candidates.push({
      key,
      hNo: head.h_no,
      dataYear: head.data_year,
      barangay: head.barangay,
      headName:
        `${head.last_name}, ${head.first_name}`.trim().replace(/,\s*$/, "") ||
        "—",
      headRecord: head,
      houseNo: head.house_no,
      street: head.street,
      purok: head.purok,
      residenceType: head.residence_type,
      memberCount: ordered.length,
      hasHead: headIndex >= 0 && isHeadRecord(head),
      members: ordered,
    });
  });

  candidates.sort((a, b) => {
    if (b.dataYear !== a.dataYear) return b.dataYear - a.dataYear;
    return String(a.hNo).localeCompare(String(b.hNo));
  });

  return candidates;
}

/* ── Search ─────────────────────────────────────────────────────────── */

function readLocalRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem("tanawanData"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function findLocalPriorRows({ hNo, lastName, firstName, barangay, targetYear }) {
  const hasHh = clean(hNo) !== "";
  const hasName = clean(lastName) !== "" || clean(firstName) !== "";

  return readLocalRecords()
    .map((rec) => normalizeResidentRecord(rec))
    .filter((record) => {
      if (!record || record.data_year === null) return false;
      if (record.data_year >= targetYear) return false;
      if (record.is_archived) return false;
      if (barangay && !softEq(record.barangay, barangay)) return false;

      const matchesHh = hasHh && softEq(record.h_no, hNo);
      const matchesName =
        hasName && isHeadRecord(record) && personNameIncludes(record, lastName, firstName);

      return matchesHh || matchesName;
    })
    .map((record) => ({ ...record, __norm: true }));
}

/**
 * Searches every data year before `targetYear` for the household.
 *
 * Search criteria:
 *   - exact household number + barangay, and/or
 *   - prior head name + barangay (head rows only)
 *
 * Returns `{ candidates, errors, note }`. `candidates` are household-year
 * groups sorted newest first; the caller auto-loads a single candidate and
 * shows a picker when there is more than one.
 */
export async function findPriorHouseholdCandidates({
  hNo = "",
  lastName = "",
  firstName = "",
  barangay = "",
  targetYear,
}) {
  const errors = [];
  const rows = [];

  const year = toYear(targetYear) ?? new Date().getFullYear();
  const hasHh = clean(hNo) !== "";
  const hasName = clean(lastName) !== "" || clean(firstName) !== "";

  if (hasHh) {
    const { data, error } = await supabase
      .from("residents")
      .select(PRIOR_RESIDENT_FIELDS)
      .ilike("h_no", escapeLike(hNo))
      .ilike("barangay", escapeLike(barangay))
      .lt("data_year", year)
      .eq("is_archived", false)
      .order("data_year", { ascending: false })
      .limit(500);
    if (error) errors.push(error.message);
    else rows.push(...(data || []));
  }

  if (hasName) {
    let query = supabase
      .from("residents")
      .select("id, h_no, data_year, barangay, last_name, first_name")
      .eq("is_household_head", true)
      .ilike("barangay", escapeLike(barangay))
      .lt("data_year", year)
      .eq("is_archived", false)
      .order("data_year", { ascending: false })
      .limit(40);
    if (clean(lastName)) query = query.ilike("last_name", escapeLike(lastName));
    if (clean(firstName)) query = query.ilike("first_name", escapeLike(firstName));

    const { data: heads, error: headErr } = await query;
    if (headErr) errors.push(headErr.message);
    else if (heads && heads.length > 0) {
      const hhNos = [...new Set(heads.map((h) => h.h_no).filter(Boolean))];
      const { data: rosterRows, error: rosterErr } = await supabase
        .from("residents")
        .select(PRIOR_RESIDENT_FIELDS)
        .in("h_no", hhNos)
        .ilike("barangay", escapeLike(barangay))
        .lt("data_year", year)
        .eq("is_archived", false)
        .limit(1000);
      if (rosterErr) errors.push(rosterErr.message);
      else rows.push(...(rosterRows || []));
    }
  }

  rows.push(
    ...findLocalPriorRows({
      hNo,
      lastName,
      firstName,
      barangay,
      targetYear: year,
    }),
  );

  let candidates = buildCandidates(dedupeRecords(rows));
  let note = "";

  // The household-number query and the head-name query can surface different
  // households (h_no is reused across years and a head's h_no picks up every
  // household that ever used it), so the two identifiers are applied as
  // independent filters rather than a union.
  if (hasHh) {
    // Anchor on the identifier first: only this household's records remain.
    candidates = candidates.filter((c) => softEq(c.hNo, hNo));
  }

  if (hasName) {
    // Then prefer the households actually headed by the named person - this is
    // what keeps BM156/Flores distinct from BM156/Mercado.
    const matched = candidates.filter((c) =>
      personNameIncludes(c.headRecord, lastName, firstName),
    );
    if (matched.length > 0) {
      candidates = matched;
    } else if (hasHh) {
      // Fall back to the household-number hits with a note so a reused
      // identifier still surfaces something useful.
      note = `No ${hNo.trim()} record with that head name was found before ${year}; showing every ${hNo.trim()} record instead.`;
    } else {
      note = `No household headed by ${[lastName, firstName].filter(Boolean).join(", ")} was found before ${year}.`;
      candidates = [];
    }
  }

  return { candidates, errors, note };
}

/**
 * Returns the rows that already exist for this household in the data year
 * being encoded, so the encoder is warned about duplicates up front.
 */
export async function fetchHouseholdForYear({ hNo, barangay, targetYear }) {
  if (!clean(hNo)) return { rows: [], error: null };
  try {
    const { data, error } = await supabase
      .from("residents")
      .select("id, last_name, first_name, relation_to_head, is_household_head")
      .ilike("h_no", escapeLike(hNo))
      .ilike("barangay", escapeLike(barangay))
      .eq("data_year", targetYear)
      .limit(300);
    if (error) return { rows: [], error };
    return { rows: data || [], error: null };
  } catch (err) {
    return { rows: [], error: err };
  }
}

/* ── Form mapping ───────────────────────────────────────────────────── */

/**
 * Builds the registration-form shape for one prior record and re-derives
 * every age-dependent field against `targetYear`.
 *
 * The birth date is the master baseline: when one exists it drives the age,
 * and the age field is not editable. When it is missing the prior year's age
 * is carried forward through the engine, anchored to that record's data year
 * (`ageBaselineYear` / `ageBaselineValue`) so it still rolls forward (or
 * backward) if the encoder switches Data Year.
 *
 * Classifications are NEVER copied verbatim - `is_senior`, `has_senior_id`
 * and `teenage_mother` are re-derived from the recalculated age. What IS
 * carried over is the evidence behind them:
 *   - `has_senior_id`   -> kept, then re-applied only if still >= 60
 *   - `teen_mother_reported` -> the reported baseline, applied only while
 *     female and 10-19 so it can be re-derived if the year changes
 *   - `teenage_pregnancy` / `child_pregnancy_case` -> historical facts
 */
function mapPriorRecordToForm(record, targetYear) {
  const hasDob = Boolean(record.birth_date);
  const rawAge = record.age === "" || record.age === null ? null : record.age;

  const form = {
    lname: record.last_name,
    fname: record.first_name,
    mname: record.middle_name,
    q: record.qualifier,
    pob: record.birth_place,
    dob: record.birth_date,
    sex: record.sex || "Male",
    civil: record.civil_status || "Single",
    religion: record.religion,
    citizenship: record.citizenship || "FILIPINO",
    edu: normalizeEducation(record.educational_attainment),
    occupation: record.occupation,
    is_voter: normalizeVoter(record.is_voter),
    is_4ps: Boolean(record.is_4ps),
    is_pwd: Boolean(record.is_pwd),
    has_pwd_id: Boolean(record.has_pwd_id),
    disability_details: record.is_pwd ? record.disability_details || "" : "",
    // Reported baseline re-applied only while the person is still a senior.
    senior_id_reported: Boolean(record.has_senior_id),
    has_senior_id: Boolean(record.has_senior_id),
    is_solo_parent: Boolean(record.is_solo_parent),
    has_solo_parent_id: Boolean(record.has_solo_parent_id),
    age_first_birth: record.age_at_first_birth ?? "",
    teenage_pregnancy: Boolean(
      record.teenage_pregnancy ?? record.teenage_pregnancy_case,
    ),
    child_pregnancy_case: Boolean(record.child_pregnancy_case),
    // DSWD referral is case-level, not year-level. Carry it through a
    // roll-over so the new record does not appear as a fresh Pending case.
    dswd_referral_status: record.dswd_referral_status || "Pending",
    dswd_referred_at: record.dswd_referred_at || "",
    dswd_referral_notes: record.dswd_referral_notes || "",
    // Reported baseline that survives a year change; the applied
    // `teenage_mother` flag below is derived from it.
    teen_mother_reported: Boolean(record.current_teenage_mother),
    // Age anchor used only when the birth date is missing.
    ageBaselineYear: hasDob ? null : record.data_year,
    ageBaselineValue: hasDob ? null : rawAge,
    // Programs/seminars are time-bound and are intentionally NOT carried
    // forward into the new data year.
    attended_items: [],

    // Continuity metadata (never written to the database)
    source: "prior",
    priorId: record.id,
    priorDataYear: record.data_year,
    priorAge: rawAge,
    retentionStatus: RETAINED,
  };

  // Re-derives age, ageEstimated, is_senior, has_senior_id and
  // teenage_mother for the data year being encoded.
  const derived = applyPersonYear(form, targetYear);
  return {
    ...derived,
    // Keep the reported teenage field in sync with the derived, mutually
    // exclusive classification (a historical child case is never a teenage
    // case).
    teenage_pregnancy: derived.teenage_pregnancy_case,
  };
}

/** Maps a prior household-head record onto the head form shape. */
export function mapPriorToHeadForm(record, targetYear) {
  return {
    ...mapPriorRecordToForm(record, targetYear),
    source: "prior",
    isSuccessor: false,
  };
}

/** Maps a prior member record onto the member card shape. */
export function mapPriorToMemberForm(record, targetYear) {
  return {
    ...mapPriorRecordToForm(record, targetYear),
    rel:
      record.relation_to_head && !isHeadRecord(record)
        ? record.relation_to_head
        : "",
    promotedToHead: false,
  };
}

/* ── Retention helpers ──────────────────────────────────────────────── */

/** A member is carried forward unless a prior member was marked otherwise. */
export function isMemberRetained(member) {
  if (!member) return false;
  if (member.source !== "prior") return true;
  return member.retentionStatus === RETAINED;
}

/** Members that are written to the new data year (excludes promoted heads). */
export function activeMembersOf(members = []) {
  return members.filter((m) => isMemberRetained(m) && !m.promotedToHead);
}

/** Counts used by the retention toolbar and the Step 4 tracker. */
export function summarizeRetention(members = []) {
  const prior = members.filter((m) => m.source === "prior");
  const promoted = members.filter((m) => m.promotedToHead);
  const retained = prior.filter(
    (m) => m.retentionStatus === RETAINED && !m.promotedToHead,
  ).length;
  const deceased = prior.filter((m) => m.retentionStatus === DECEASED).length;
  const migrated = prior.filter((m) => m.retentionStatus === MIGRATED).length;
  const added = members.filter(
    (m) => m.source !== "prior" && !m.promotedToHead,
  ).length;

  return {
    priorTotal: prior.length,
    promoted: promoted.length,
    retained,
    deceased,
    migrated,
    added,
    excluded: deceased + migrated,
    active: retained + added,
  };
}

/** Duplicate detection key: name + birth date (mirrors the DB trigger). */
export function identityKey(person = {}) {
  const last = person.last_name ?? person.lname ?? person.last ?? "";
  const first = person.first_name ?? person.fname ?? person.first ?? "";
  const middle = person.middle_name ?? person.mname ?? person.mid ?? "";
  const dob = person.birth_date ?? person.dob ?? person.bd ?? "";
  const norm = (v) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return [norm(last), norm(first), norm(middle), norm(dob)].join("|");
}

export default {
  RETAINED,
  DECEASED,
  MIGRATED,
  RETENTION_LABELS,
  calculateAgeForYear,
  calculateAgeFromPrior,
  buildCandidates,
  findPriorHouseholdCandidates,
  fetchHouseholdForYear,
  generateHouseholdNumber,
  mapPriorToHeadForm,
  mapPriorToMemberForm,
  isMemberRetained,
  activeMembersOf,
  summarizeRetention,
  identityKey,
};
