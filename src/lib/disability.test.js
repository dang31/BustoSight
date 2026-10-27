import assert from "node:assert/strict";
import test from "node:test";
import { disabilityDetailsForSave, getDisabilityError } from "./disability.js";

test("PWD requires a disability description, including for legacy records", () => {
  for (const disability_details of [undefined, null, "", "   ", "\n\t"]) {
    const person = { is_pwd: true, disability_details };
    assert.equal(
      getDisabilityError(person, "Member 2"),
      "Member 2: please specify the disability when PWD is selected.",
    );
    assert.equal(disabilityDetailsForSave(person), null);
  }
});

test("valid PWD descriptions are accepted and trimmed when saved", () => {
  const person = { is_pwd: true, disability_details: "  Visual impairment  " };
  assert.equal(getDisabilityError(person), "");
  assert.equal(disabilityDetailsForSave(person), "Visual impairment");
  assert.equal(person.disability_details, "  Visual impairment  ");
});

test("non-PWD residents do not require or save disability details", () => {
  for (const disability_details of [undefined, "", "Visual impairment"]) {
    const person = { is_pwd: false, disability_details };
    assert.equal(getDisabilityError(person), "");
    assert.equal(disabilityDetailsForSave(person), null);
  }
});
