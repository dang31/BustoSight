export function disabilityDetailsForSave(person) {
  return person.is_pwd ? String(person.disability_details || "").trim() || null : null;
}

export function getDisabilityError(person, label = "Resident") {
  return person.is_pwd && !disabilityDetailsForSave(person)
    ? `${label}: please specify the disability when PWD is selected.`
    : "";
}
