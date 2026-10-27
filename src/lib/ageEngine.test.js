import assert from "node:assert/strict";
import test from "node:test";
import { applyPersonYear, normalizePersonForSave } from "./ageEngine.js";

const now = new Date(2026, 9, 27);
const person = {
  sex: "Female",
  age: 17,
  age_first_birth: "",
  teen_mother_reported: false,
};
const derive = (changes = {}) =>
  applyPersonYear({ ...person, ...changes }, 2026, now);

test("valid first-birth evidence selects motherhood without changing the manual baseline", () => {
  for (const age of [10, 17, 19]) {
    const result = derive({ age, age_first_birth: String(age) });
    assert.equal(result.teenage_mother, true);
    assert.equal(result.teen_mother_reported, false);
    assert.equal(normalizePersonForSave(result, 2026, now).current_teenage_mother, true);
  }
});

test("motherhood can be manually selected and cleared when first-birth age is unknown", () => {
  const checked = derive({ teen_mother_reported: true });
  assert.equal(checked.teenage_mother, true);
  const unchecked = applyPersonYear(
    { ...checked, teen_mother_reported: false }, 2026, now,
  );
  assert.equal(unchecked.teenage_mother, false);
  assert.equal(normalizePersonForSave(unchecked, 2026, now).current_teenage_mother, false);
});

test("correcting or clearing automatic evidence does not leave motherhood selected", () => {
  const automatic = derive({ age_first_birth: "16" });
  for (const age_first_birth of ["", "18", "0", "invalid"]) {
    const corrected = applyPersonYear({ ...automatic, age_first_birth }, 2026, now);
    assert.equal(corrected.teenage_mother, false, age_first_birth);
  }
  // A manual report is independent evidence and survives clearing first birth.
  assert.equal(derive({ teen_mother_reported: true }).teenage_mother, true);
});

test("motherhood stays selected while valid first-birth evidence is present", () => {
  assert.equal(derive({ age_first_birth: "16", teen_mother_reported: false }).teenage_mother, true);
});

test("age, sex, and sensitive child cases retain their restrictions", () => {
  for (const changes of [
    { age: 20, age_first_birth: "16" },
    { age: "", age_first_birth: "16" },
    { sex: "Male", age_first_birth: "16", teen_mother_reported: true },
    { child_pregnancy_case: true, age_first_birth: "16", teen_mother_reported: true },
    { age_first_birth: "9" },
    { age: 9, age_first_birth: "8", teen_mother_reported: true },
  ]) {
    const result = derive(changes);
    assert.equal(result.teenage_mother, false, JSON.stringify(changes));
    assert.equal(normalizePersonForSave(result, 2026, now).current_teenage_mother, false);
  }
  assert.equal(derive({ child_pregnancy_case: true }).child_pregnancy_case, true);
  assert.equal(derive({ age_first_birth: "9" }).child_pregnancy_case, true);
});

test("birth date and data year changes recalculate automatic motherhood", () => {
  const source = { ...person, dob: "2007-01-01", age_first_birth: "16" };
  const teen = applyPersonYear(source, 2026, now);
  assert.equal(teen.age, 19);
  assert.equal(teen.teenage_mother, true);
  const adult = applyPersonYear(teen, 2027, now);
  assert.equal(adult.age, 20);
  assert.equal(adult.teenage_mother, false);
  assert.equal(adult.teenage_pregnancy_case, true);
  assert.equal(applyPersonYear(adult, 2026, now).teenage_mother, true);
  assert.equal(applyPersonYear({ ...teen, dob: "2006-01-01" }, 2026, now).teenage_mother, false);
  assert.equal(applyPersonYear({ ...teen, sex: "Male" }, 2026, now).teenage_mother, false);
});

test("database field names derive the same displayed and saved classification", () => {
  const record = { sex: "F", birth_date: "2009-01-01", age_at_first_birth: 16, current_teenage_mother: false };
  assert.equal(applyPersonYear(record, 2026, now).teenage_mother, true);
  assert.equal(normalizePersonForSave(record, 2026, now).current_teenage_mother, true);
});
