import { useId } from "react";

export default function DisabilityDetailsField({ person, onChange, className = "field-group" }) {
  const id = useId();
  if (!person.is_pwd) return null;

  return (
    <div className={className}>
      <label htmlFor={id}>Disability <span aria-hidden="true">*</span></label>
      <input
        id={id}
        type="text"
        required
        placeholder="Specify the person's disability"
        value={person.disability_details || ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
