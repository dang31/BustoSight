/**
 * nameValidation.js
 * -----------------------------------------------------------------------
 * Reusable client-side name validation for the Barangay Information
 * System. Import `isValidName` (and optionally `getNameError` for a
 * human-readable reason) into any form: AddResident, edit-resident,
 * household-head forms, etc.
 *
 * Design notes:
 * - Each rule is its own small function that returns an error message
 *   (string) when it FAILS, or `null` when it passes. This makes the
 *   list of rules easy to read, easy to unit-test individually, and
 *   easy to extend later (just push another rule into RULES).
 * - `isValidName` stays a pure boolean function so it can be dropped
 *   straight into a ternary, an `if`, or a `disabled={!isValidName(x)}`
 *   prop without extra plumbing.
 * - `getNameError` is provided separately so UI code can show *why*
 *   a name was rejected, without duplicating the rule logic.
 * -----------------------------------------------------------------------
 */

// Common keyboard-smashing substrings. These are checked as substrings
// (not whole-string matches) so "asdfgh" is caught by "asdf" alone, but
// we still list the longer ones explicitly for clarity/readability and
// to catch cases like "asdasd" that aren't covered by the short list.
const KEYBOARD_SMASH_PATTERNS = [
  'asdf', 'qwer', 'zxcv', 'poi', 'lkj', 'mnb', // adjacent-key runs
  'qwerty', 'asdfgh', 'xcvbnm', 'asdasd',       // common full smashes
];

// A name has to contain at least one vowel to plausibly be a real word
// in most naming conventions used locally (Filipino, English, Spanish-
// derived surnames, etc.). This is a cheap, effective filter against
// consonant-only gibberish like "xzfhbn".
const VOWEL_REGEX = /[aeiouAEIOU]/;

// Only letters, spaces, hyphens, and apostrophes are allowed. This
// blocks digits and symbols (which don't belong in a person's name)
// while still allowing legitimate constructs like "Anne-Marie" or
// "O'Connor".
const ALLOWED_CHARACTERS_REGEX = /^[A-Za-z\s'-]+$/;

// Four or more of the SAME character in a row ("aaaa", "zzzz", "----")
// almost never occurs in a real name but is a classic symptom of
// someone mashing a single key or copy-pasting junk data.
const REPEATED_CHARACTER_REGEX = /(.)\1{3,}/i;

// Two or more consecutive whitespace characters (e.g. "John  Paul")
// usually indicates a typo or pasted formatting artifact, not an
// intentional part of someone's name.
const MULTIPLE_SPACES_REGEX = /\s{2,}/;

/**
 * RULES is an ordered list of [ruleName, testFn] pairs. Each testFn
 * receives the raw name string and returns an error message if the
 * rule is violated, or `null` if the name satisfies that rule.
 *
 * To add a new rule later (e.g. "no more than 50 characters"), just
 * append another entry here — no other code needs to change.
 */
const RULES = [
  [
    'notAString',
    (name) => (typeof name !== 'string' ? 'Name must be text.' : null),
  ],
  [
    'minLength',
    // Guards against single-character "names" like "J" that are too
    // short to be meaningful and are often accidental input.
    (name) => (name.length < 2 ? 'Name must be at least 2 characters long.' : null),
  ],
  [
    'allowedCharacters',
    (name) =>
      !ALLOWED_CHARACTERS_REGEX.test(name)
        ? 'Name can only contain letters, spaces, hyphens (-), and apostrophes (\').'
        : null,
  ],
  [
    'noLeadingOrTrailingSpace',
    // A leading/trailing space is almost always accidental (extra
    // keystroke) and would otherwise silently corrupt stored/ sorted
    // data (e.g. " Juan" sorting differently from "Juan").
    (name) =>
      name.startsWith(' ') || name.endsWith(' ')
        ? 'Name cannot start or end with a space.'
        : null,
  ],
  [
    'noMultipleConsecutiveSpaces',
    (name) =>
      MULTIPLE_SPACES_REGEX.test(name)
        ? 'Name cannot contain multiple consecutive spaces.'
        : null,
  ],
  [
    'containsVowel',
    (name) =>
      !VOWEL_REGEX.test(name)
        ? 'Name must contain at least one vowel.'
        : null,
  ],
  [
    'noRepeatedCharacters',
    (name) =>
      REPEATED_CHARACTER_REGEX.test(name)
        ? 'Name cannot contain four or more repeated characters in a row.'
        : null,
  ],
  [
    'noKeyboardSmashPatterns',
    (name) => {
      const lower = name.toLowerCase();
      const matched = KEYBOARD_SMASH_PATTERNS.find((pattern) => lower.includes(pattern));
      return matched ? 'Name looks like random keyboard input and was rejected.' : null;
    },
  ],
];

/**
 * getNameError(name)
 * Runs every rule in order and returns the FIRST error message found,
 * or `null` if the name passes every rule. Useful for showing a
 * specific, actionable message in the UI.
 */
export function getNameError(name) {
  for (const [, test] of RULES) {
    const error = test(name);
    if (error) return error;
  }
  return null;
}

/**
 * isValidName(name)
 * Pure boolean wrapper around getNameError, for use in conditionals,
 * disabled props, form-submit guards, etc.
 *
 * @param {string} name
 * @returns {boolean} true if the name passes all validation rules.
 */
export function isValidName(name) {
  return getNameError(name) === null;
}

export default isValidName;