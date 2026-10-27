/**
 * residentName.js
 * -----------------------------------------------------------------------
 * Shared display formatting for resident names.
 *
 * The system stores the surname separately from the given name, but Philippine
 * census and government forms present names as:
 *
 *     First  Middle  Surname  Suffix
 *
 * e.g. "Rosario Reyes DEL ROSARIO JR."
 *
 * The middle name is printed in full, exactly as stored in the database, so
 * what a printed report shows always matches the resident record. Several
 * screens previously built this string by hand - two of them reduced the middle
 * name to an initial - so the order and the full name now come from one place.
 */

/**
 * Formats a resident for display as: First  Middle  Surname  Suffix
 *
 * Missing parts are dropped rather than leaving gaps, so a resident with no
 * middle name renders "Rosario DEL ROSARIO" with no double space.
 *
 * @param {object}  resident          row using either raw DB or mapped keys
 * @param {string}  [resident.first_name]  or `first`
 * @param {string}  [resident.middle_name] or `mid`
 * @param {string}  [resident.last_name]   or `last`
 * @param {string}  [resident.qualifier]   or `q`
 * @returns {string}
 */
export function formatResidentName(resident = {}) {
  const first = resident.first_name ?? resident.first ?? "";
  const middle = resident.middle_name ?? resident.mid ?? "";
  const last = resident.last_name ?? resident.last ?? "";
  const qualifier = resident.qualifier ?? resident.q ?? "";

  const name = [
    String(first).trim(),
    String(middle).trim(),
    String(last).trim(),
    String(qualifier).trim(),
  ]
    .filter(Boolean)
    .join(" ");

  return name || "Unnamed Resident";
}

export default formatResidentName;