/**
 * nameValidation.js
 * -----------------------------------------------------------------------
 * Reusable client-side name validation for the Barangay Information
 * System. Allows random/shuffled letter combinations while strictly
 * disallowing numbers and non-name special characters.
 * -----------------------------------------------------------------------
 */

// Only letters, spaces, hyphens, and apostrophes are allowed.
// This blocks digits and non-name symbols while allowing names like "Anne-Marie" or "O'Connor".
const ALLOWED_CHARACTERS_REGEX = /^[A-Za-z\s'-]+$/;

// Checks for any digits 0-9
const NUMBER_REGEX = /\d/;

// Two or more consecutive whitespace characters
const MULTIPLE_SPACES_REGEX = /\s{2,}/;

/**
 * RULES is an ordered list of [ruleName, testFn] pairs.
 */
const RULES = [
  [
    'notAString',
    (name) => (typeof name !== 'string' ? 'Name must be text.' : null),
  ],
  [
    'minLength',
    (name) => (name.length < 2 ? 'Name must be at least 2 characters long.' : null),
  ],
  [
    'noNumbers',
    (name) => (NUMBER_REGEX.test(name) ? 'Name cannot contain numbers.' : null),
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
];

/**
 * getNameError(name)
 * Runs every rule in order and returns the FIRST error message found,
 * or `null` if the name passes every rule.
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
 * Pure boolean wrapper around getNameError.
 */
export function isValidName(name) {
  return getNameError(name) === null;
}

export default isValidName;