/**
 * ageEngine.js
 * -----------------------------------------------------------------------
 * Single source of truth for ages and the classifications that depend on
 * them (Senior Citizen, current teenage mother, teenage pregnancy case,
 * sensitive child pregnancy case).
 *
 * WHY THIS EXISTS
 * ---------------
 * An annual household roll-over re-uses a prior data year's roster. The
 * birth date never changes, so every age - and every age-derived flag -
 * has to be re-derived against the Data Year being encoded. Before this
 * module each page re-implemented that arithmetic with slightly different
 * rules (AddResident used the Data Year, BarangayList used "today",
 * UploadData trusted the spreadsheet), which meant a roll-over could carry
 * a stale `is_senior` or `current_teenage_mother` forward.
 *
 * POLICY (confirmed)
 * ------------------
 *   - Age reference date: "today" while encoding the current year, and
 *     December 31 of the target year for every other year (past *or*
 *     future). Encoding 2027 ahead of time therefore increments ages
 *     correctly instead of freezing them at today's date.
 *   - Age is derived from the birth date whenever one exists. The Age
 *     field is only editable when the birth date is missing, and that
 *     estimate is anchored to the year it was entered so it still rolls
 *     forward on the next Data Year.
 *   - Senior Citizen is fully automatic: age >= 60. No manual override.
 *   - "Current teenage mother" needs evidence (a child), so it is kept as
 *     a reported baseline and only *applied* while the person is female
 *     and aged 10-19. The baseline survives a year change, so a person who
 *     ages out at 20 can still be re-derived correctly if the encoder goes
 *     back to an earlier year.
 *   - "Teenage pregnancy case" is historical: it follows the age at first
 *     birth (<= 19) and is retained after age 20.
 *   - "Child pregnancy case" is a sensitive, historical fact. A pregnancy
 *     reported for a female aged <= 9 is classified as a child case, never
 *     as a teenage case. The flag is retained if the person later turns 10
 *     so the sensitive case does not disappear from the restricted module.
 *
 * Every function here is pure (no database, no React) so the same rules
 * can be reused by the registration form, the resident list editor and the
 * spreadsheet importer.
 */

export const SENIOR_MIN_AGE = 60;
export const ADOLESCENT_MIN_AGE = 10;
export const ADOLESCENT_MAX_AGE = 19;
export const CHILD_MAX_AGE = 9;

/** Earliest year offered by the Data Year selectors. */
export const DATA_YEAR_FLOOR = 2020;
/** How many years back from the current year the selectors offer. */
export const DATA_YEAR_LOOKBACK = 10;

/* ── Small numeric normalizers ──────────────────────────────────────── */

/** Calendar year, or null when the value is not a usable year. */
export function toYearInt(value) {
  const year = parseInt(value, 10);
  return Number.isFinite(year) ? year : null;
}

/**
 * Whole years of age, or null when the value is not a usable age.
 * Age 0 (an infant) is a real age and is intentionally preserved - the old
 * `x ? parseInt(x) : null` idiom silently turned newborns into nulls.
 */
export function toAgeInt(value) {
  if (value === null || value === undefined || value === "") return null;
  const age = parseInt(value, 10);
  if (!Number.isFinite(age) || age < 0) return null;
  return age;
}

/* ── Date handling ──────────────────────────────────────────────────── */

/**
 * Parses a date-only value into a LOCAL Date with no time component.
 *
 * `new Date("1990-01-01")` is parsed as UTC midnight, which is the day
 * BEFORE in negative time zones and can shift an age by one. Reading the
 * parts ourselves keeps the calendar date exactly as the encoder typed it.
 */
export function parseDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const str = String(value).trim();
  const iso = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  let year;
  let month;
  let day;

  if (iso) {
    year = parseInt(iso[1], 10);
    month = parseInt(iso[2], 10);
    day = parseInt(iso[3], 10);
  } else {
    const parsed = new Date(str);
    if (Number.isNaN(parsed.getTime())) return null;
    year = parsed.getFullYear();
    month = parsed.getMonth() + 1;
    day = parsed.getDate();
  }

  // Reject impossible dates such as 1990-02-31 (JS would silently roll it
  // over to March, quietly changing the age).
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

/** Today's calendar year. */
export function currentYear(now = new Date()) {
  return now.getFullYear();
}

/**
 * Reference date an age is measured against:
 *   - current Data Year  -> today
 *   - any other year     -> December 31 of that year
 *
 * The second rule is what makes an ahead-of-time roll-over work: selecting
 * 2027 while still in 2026 gives everyone their end-of-2027 age rather than
 * today's age, so birthdays later in the target year are counted.
 */
export function ageReferenceDate(targetYear, now = new Date()) {
  const year = toYearInt(targetYear);
  if (year === null) return now;
  if (year === now.getFullYear()) return now;
  return new Date(year, 11, 31);
}

/** "as of today" / "as of December 31, 2027" - for the form's helper text. */
export function describeAgeReference(targetYear, now = new Date()) {
  const year = toYearInt(targetYear) ?? now.getFullYear();
  if (year === now.getFullYear()) return "as of today";
  const ref = ageReferenceDate(year, now);
  return `as of ${ref.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })}`;
}

/* ── Age arithmetic ─────────────────────────────────────────────────── */

/** Recalculates age from a birth date against the Data Year being encoded. */
export function calculateAgeForYear(dob, targetYear, now = new Date()) {
  const birth = parseDateOnly(dob);
  if (!birth) return "";

  const ref = ageReferenceDate(targetYear, now);
  let age = ref.getFullYear() - birth.getFullYear();
  const monthDiff = ref.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : "";
}

/**
 * Fallback when a record has no birth date: roll the stored age forward (or
 * backward) by the years between its baseline year and the target year.
 *
 * The old version clamped at `Math.max(0, to - from)`, which meant picking
 * an EARLIER Data Year never made anyone younger. Ages now move both ways
 * and are only clamped at 0.
 */
export function calculateAgeFromPrior(priorAge, priorYear, targetYear) {
  const age = toAgeInt(priorAge);
  if (age === null) return "";
  const from = toYearInt(priorYear);
  const to = toYearInt(targetYear);
  if (from === null || to === null) return age;
  return Math.max(0, age + (to - from));
}

/**
 * The age a form record should show for `targetYear`.
 *
 * Birth date wins whenever one exists. Otherwise the age is rolled from its
 * baseline (ageBaselineYear/ageBaselineValue, falling back to the prior
 * record's year/age). With neither a birth date nor a year anchor the
 * entered age is returned unchanged.
 */
export function resolvePersonAge(person, targetYear, now = new Date()) {
  const dob = person?.dob ?? person?.birth_date ?? "";
  if (dob) return calculateAgeForYear(dob, targetYear, now);

  const baselineYear = person?.ageBaselineYear ?? person?.priorDataYear ?? null;
  const baselineAge = person?.ageBaselineValue ?? person?.priorAge ?? "";
  if (
    baselineYear === null ||
    baselineYear === undefined ||
    toAgeInt(baselineAge) === null
  ) {
    return person?.age ?? "";
  }
  return calculateAgeFromPrior(baselineAge, baselineYear, targetYear);
}

/* ── Sex / age-band predicates ──────────────────────────────────────── */

/**
 * True for a female record. The database holds both spellings ("F" from the
 * spreadsheet importer and BarangayList, "Female" from the registration
 * form), plus legacy "Woman"/"Girl" values. Accepting the same set as the
 * database trigger keeps the UI and the database classification in sync.
 */
export function isFemaleSex(sex) {
  const value = String(sex ?? "").trim().toLowerCase();
  return ["f", "female", "woman", "girl"].includes(value);
}

export function isSeniorAge(age) {
  const value = toAgeInt(age);
  return value !== null && value >= SENIOR_MIN_AGE;
}

export function isAdolescentAge(age) {
  const value = toAgeInt(age);
  return (
    value !== null && value >= ADOLESCENT_MIN_AGE && value <= ADOLESCENT_MAX_AGE
  );
}

export function isChildAge(age) {
  const value = toAgeInt(age);
  return value !== null && value <= CHILD_MAX_AGE;
}

export function isAdultAge(age) {
  const value = toAgeInt(age);
  return value !== null && value >= ADOLESCENT_MAX_AGE + 1;
}

/* ── Pregnancy classification ───────────────────────────────────────── */

/**
 * Classifies a reported pregnancy by the person's age.
 *
 * POLICY
 * ------
 *   - Only a female record can carry a pregnancy classification.
 *   - Any pregnancy evidence on a female aged <= 9 (an explicit child case,
 *     a teenage flag, a current teenage-mother flag, or an age at first
 *     birth) is automatically promoted to a child-pregnancy case. An age at
 *     first birth of 9 or below is also a historical child case even when the
 *     person is now older.
 *   - A child case and every teenage classification are mutually exclusive.
 *     The sensitive child case is never counted as an official
 *     teenage-pregnancy case or as a current teenage mother.
 *   - `child_pregnancy_case` is historical: an explicitly recorded child case
 *     stays on file after the person turns 10, so the victim does not vanish
 *     from the restricted module.
 */
export function classifyPregnancyAtAge(person, ageValue) {
  const source = person || {};
  const female = isFemaleSex(source.sex ?? source.s ?? "");
  const age = toAgeInt(ageValue);
  const firstBirth = toAgeInt(
    source.age_first_birth ?? source.age_at_first_birth ?? "",
  );
  const hasFirstBirth = firstBirth !== null && firstBirth > 0;
  const reportedChild = Boolean(
    source.child_pregnancy_case ?? source.childPregnancy ?? false,
  );
  const reportedTeen = Boolean(
    source.teenage_pregnancy ?? source.teenage_pregnancy_case ?? false,
  );
  const reportedCurrentMother = Boolean(
    source.teen_mother_reported ??
      source.current_teenage_mother ??
      source.teenage_mother ??
      false,
  );
  const isChildAgeBand = age !== null && age <= CHILD_MAX_AGE;
  const firstBirthWasChildAge =
    hasFirstBirth && firstBirth <= CHILD_MAX_AGE;

  const childPregnancyCase =
    female &&
    (reportedChild ||
      firstBirthWasChildAge ||
      (isChildAgeBand &&
        (reportedTeen || reportedCurrentMother || hasFirstBirth)));

  const teenagePregnancyCase =
    female && !childPregnancyCase
      ? hasFirstBirth
        ? firstBirth <= ADOLESCENT_MAX_AGE
        : reportedTeen
      : false;

  return { childPregnancyCase, teenagePregnancyCase, isChildAgeBand };
}

/** Age-resolving wrapper around classifyPregnancyAtAge. */
export function derivePregnancyFlags(person, targetYear, now = new Date()) {
  const age = resolvePersonAge(person, targetYear, now);
  return classifyPregnancyAtAge(person, age);
}

/* ── Derivation ─────────────────────────────────────────────────────── */

/**
 * Re-derives every age-dependent field for a person in `targetYear`.
 *
 * `person` may use either the registration-form keys (`dob`, `sex`,
 * `teen_mother_reported`) or the database/report keys (`birth_date`, `s`,
 * `current_teenage_mother`) - the resolver accepts both so the same rules
 * apply everywhere.
 */
export function derivePersonYear(person, targetYear, now = new Date()) {
  const source = person || {};
  const dob = source.dob ?? source.birth_date ?? "";
  const sex = source.sex ?? source.s ?? "";
  const teenReported = Boolean(
    source.teen_mother_reported ??
      source.teenage_mother ??
      source.current_teenage_mother ??
      false,
  );
  // Evidence behind a senior ID is kept separately so a roll that puts the
  // person back under 60 can still restore it if the encoder returns to the
  // year where they qualified.
  const seniorIdEvidence = Boolean(
    source.senior_id_reported ?? source.has_senior_id ?? false,
  );

  const age = resolvePersonAge(source, targetYear, now);
  const isSenior = isSeniorAge(age);
  const pregnancy = classifyPregnancyAtAge(source, age);

  return {
    age,
    ageEstimated: !dob && age !== "",
    is_senior: isSenior,
    // A senior ID only exists while the person is actually a senior.
    has_senior_id: isSenior ? seniorIdEvidence : false,
    // "Current teenage mother" only applies to females aged 10-19. The
    // reported baseline is kept on the record, not overwritten, so the flag
    // can be re-derived if the encoder switches back to an earlier year.
    teenage_mother:
      isFemaleSex(sex) &&
      isAdolescentAge(age) &&
      teenReported &&
      !pregnancy.childPregnancyCase,
    // Classifications are mutually exclusive; a child case always wins.
    teenage_pregnancy_case: pregnancy.teenagePregnancyCase,
    // Applied child-pregnancy flag. This is what lets a form reclassify a
    // reported teenage flag on a <=9 record as soon as its age is known.
    child_pregnancy_case: pregnancy.childPregnancyCase,
  };
}

/** Same as derivePersonYear, but merged back onto the original object. */
export function applyPersonYear(person, targetYear, now = new Date()) {
  return { ...(person || {}), ...derivePersonYear(person, targetYear, now) };
}

/**
 * Final normalization immediately before a save/import. Returns only the
 * age-derived columns so the caller can spread them into a row, guaranteeing
 * no stale `is_senior` or `current_teenage_mother` can ever reach the
 * database.
 */
export function normalizePersonForSave(person, targetYear, now = new Date()) {
  const source = person || {};
  const derived = derivePersonYear(source, targetYear, now);

  const firstBirth = toAgeInt(
    source.age_first_birth ?? source.age_at_first_birth ?? "",
  );
  const hasFirstBirth = firstBirth !== null && firstBirth > 0;
  const pregnancy = classifyPregnancyAtAge(source, derived.age);

  return {
    age: derived.age === "" ? null : derived.age,
    is_senior: derived.is_senior,
    has_senior_id: derived.has_senior_id,
    current_teenage_mother: derived.teenage_mother,
    teenage_pregnancy_case: pregnancy.teenagePregnancyCase,
    child_pregnancy_case: pregnancy.childPregnancyCase,
    age_at_first_birth: hasFirstBirth ? firstBirth : null,
  };
}

/* ── Change reporting ───────────────────────────────────────────────── */

/** Lightweight before/after record used to explain a recalculation. */
export function snapshotPerson(person) {
  const source = person || {};
  return {
    age: source.age ?? "",
    is_senior: Boolean(source.is_senior),
    teenage_mother: Boolean(source.teenage_mother),
  };
}

/** Counts what changed between two equally-ordered lists of people. */
export function summarizeYearChanges(beforeList = [], afterList = []) {
  const counts = {
    aged: 0,
    newSeniors: 0,
    noLongerSenior: 0,
    teenMotherCleared: 0,
    teenMotherSet: 0,
  };
  const length = Math.min(beforeList.length, afterList.length);
  for (let i = 0; i < length; i += 1) {
    const before = beforeList[i];
    const after = afterList[i];
    const beforeAge = toAgeInt(before.age);
    const afterAge = toAgeInt(after.age);
    if (beforeAge !== null && afterAge !== null && beforeAge !== afterAge) {
      counts.aged += 1;
    }
    if (!before.is_senior && after.is_senior) counts.newSeniors += 1;
    if (before.is_senior && !after.is_senior) counts.noLongerSenior += 1;
    if (before.teenage_mother && !after.teenage_mother) {
      counts.teenMotherCleared += 1;
    }
    if (!before.teenage_mother && after.teenage_mother) {
      counts.teenMotherSet += 1;
    }
  }
  return counts;
}

/** Human-readable version of summarizeYearChanges ("" when nothing moved). */
export function formatYearChangeSummary(counts) {
  if (!counts) return "";
  const bits = [];
  if (counts.aged) bits.push(`${counts.aged} age${counts.aged === 1 ? "" : "s"} recalculated`);
  if (counts.newSeniors) {
    bits.push(
      `${counts.newSeniors} new Senior Citizen${counts.newSeniors === 1 ? "" : "s"}`,
    );
  }
  if (counts.noLongerSenior) {
    bits.push(
      `${counts.noLongerSenior} no longer Senior${counts.noLongerSenior === 1 ? "" : "s"}`,
    );
  }
  if (counts.teenMotherCleared) {
    bits.push(
      `${counts.teenMotherCleared} teenage-mother flag${counts.teenMotherCleared === 1 ? "" : "s"} cleared`,
    );
  }
  if (counts.teenMotherSet) {
    bits.push(
      `${counts.teenMotherSet} teenage-mother flag${counts.teenMotherSet === 1 ? "" : "s"} set`,
    );
  }
  return bits.join(", ");
}

/* ── Data Year options ──────────────────────────────────────────────── */

/**
 * Years offered by the Data Year selectors: the upcoming year (so an annual
 * roll-over can be prepared early) down through a ten-year look-back,
 * floored at DATA_YEAR_FLOOR.
 *
 * For 2026 this yields 2027 ... 2016, which is a superset of every selector
 * the app used to offer - the only visible change is that 2027 is now
 * selectable.
 */
export function getDataYearOptions(now = new Date()) {
  const current = currentYear(now);
  const last = current + 1;
  const first = Math.min(current - DATA_YEAR_LOOKBACK, DATA_YEAR_FLOOR);
  const years = [];
  for (let year = last; year >= first; year -= 1) years.push(year);
  return years;
}

export default {
  SENIOR_MIN_AGE,
  ADOLESCENT_MIN_AGE,
  ADOLESCENT_MAX_AGE,
  toAgeInt,
  toYearInt,
  parseDateOnly,
  currentYear,
  ageReferenceDate,
  describeAgeReference,
  calculateAgeForYear,
  calculateAgeFromPrior,
  resolvePersonAge,
  isFemaleSex,
  isSeniorAge,
  isAdolescentAge,
  isChildAge,
  isAdultAge,
  classifyPregnancyAtAge,
  derivePregnancyFlags,
  derivePersonYear,
  applyPersonYear,
  normalizePersonForSave,
  snapshotPerson,
  summarizeYearChanges,
  formatYearChangeSummary,
  getDataYearOptions,
};
