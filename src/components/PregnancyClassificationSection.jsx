import {
  isAdolescentAge,
  isAdultAge,
  isChildAge,
  isFemaleSex,
  toAgeInt,
} from "../lib/ageEngine";

/**
 * Age-aware pregnancy classification block used by the registration form.
 *
 * A pregnancy reported for a female aged <= 9 is a sensitive child-pregnancy
 * case and must never be encoded as a teenage pregnancy. The block therefore
 * changes shape with age instead of showing teenage fields for every female.
 */
export default function PregnancyClassificationSection({
  person,
  title = "Household Member",
  onAgeFirstBirthChange,
  onTeenagePregnancyChange,
  onTeenMotherChange,
  onChildPregnancyChange,
  style,
}) {
  const p = person || {};
  const female = isFemaleSex(p.sex);
  const age = toAgeInt(p.age);
  const child = isChildAge(p.age);
  const adolescent = isAdolescentAge(p.age);
  const adult = isAdultAge(p.age);
  const teenMotherEligible = female && adolescent;

  // Non-female residents have no pregnancy classification to record.
  if (!female) return null;

  if (age === null) {
    return (
      <div className="pregnancy-na-notice animate-fade-in" style={style}>
        <i className="fa-solid fa-circle-info"></i>
        <span>
          Enter a birth date or an age to determine the pregnancy
          classification.
        </span>
      </div>
    );
  }

  if (child) {
    return (
      <div
        className="teenage-pregnancy-box child-pregnancy-box animate-fade-in"
        style={style}
      >
        <p className="teenage-pregnancy-title child-pregnancy-title">
          Child Pregnancy Classification (Age ≤ 9)
        </p>

        <div className="child-pregnancy-alert">
          <i className="fa-solid fa-shield-halved"></i>
          <div>
            <strong>Confidential — restricted access</strong>
            <span>
              This classification is excluded from Teenage Pregnancy reports.
              Only authorized administrators may open the complete case
              details in the Sensitive Cases module.
            </span>
          </div>
        </div>

        <div className="check-item-fancy child-pregnancy-check">
          <div className="check-item-text">
            <label>Reported Child Pregnancy Case</label>
            <span className="sub-desc">
              Tick only when a pregnancy has been reported or confirmed. The
              system records this as a child case, never as a teenage case.
            </span>
          </div>
          <input
            type="checkbox"
            checked={Boolean(p.child_pregnancy_case)}
            onChange={(e) => onChildPregnancyChange(e.target.checked)}
          />
        </div>
      </div>
    );
  }

  const sectionTitle = adolescent
    ? `Teenage Pregnancy (Female ${title}, Age 10–19)`
    : adult
      ? `Historical Teenage Pregnancy (Female ${title}, Age 20+)`
      : `Teenage Pregnancy (Female ${title})`;

  return (
    <div className="teenage-pregnancy-box animate-fade-in" style={style}>
      <p className="teenage-pregnancy-title">{sectionTitle}</p>
      <div className="grid-3-cols">
        <div className="field-group">
          <label>Age at First Birth</label>
          <input
            type="number"
            placeholder="e.g. 18"
            value={p.age_first_birth || ""}
            onChange={(e) => onAgeFirstBirthChange(e.target.value)}
          />
        </div>
        <div className="check-item-fancy">
          <div className="check-item-text">
            <label>Teenage Pregnancy Case</label>
            <span className="sub-desc">
              (Historical — auto-checked when age at first birth is 19 or
              below; kept after age 20)
            </span>
          </div>
          <input
            type="checkbox"
            checked={Boolean(p.teenage_pregnancy)}
            onChange={(e) => onTeenagePregnancyChange(e.target.checked)}
          />
        </div>
        <div className="check-item-fancy">
          <div className="check-item-text">
            <label>Current Teenage Mother</label>
            <span className="sub-desc">
              {teenMotherEligible
                ? "(Currently age 10-19 and has a child)"
                : `Only applies while age 10-19${
                    age !== null ? ` — currently ${age}` : ""
                  }.`}
            </span>
          </div>
          <input
            type="checkbox"
            checked={Boolean(p.teenage_mother)}
            disabled={!teenMotherEligible}
            onChange={(e) => onTeenMotherChange(e.target.checked)}
          />
        </div>
      </div>
    </div>
  );
}
