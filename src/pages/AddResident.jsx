import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import UserProfileBadge from "../components/UserProfileBadge";
import AttendanceCheckboxes from "../components/AttendanceCheckboxes";
import PregnancyClassificationSection from "../components/PregnancyClassificationSection";
import { brgyStats } from "../data/brgyData";
import { supabase } from "../lib/supabase";
import "../css/AddResident.css";
import { isValidName, getNameError } from "../lib/nameValidation";
import {
  buildGroups,
  fetchAttendanceCatalog,
  formatAttendance,
  serializeAttendance,
} from "../lib/attendance";
import { logTransaction } from "../utils/logger";
import { formatResidentName } from "../lib/residentName";
import { useToast, useConfirm } from "../components/Feedback/FeedbackProvider";
import {
  RETAINED,
  DECEASED,
  MIGRATED,
  RETENTION_LABELS,
  EDUCATION_OPTIONS,
  VOTER_OPTIONS,
  CIVIL_STATUS_OPTIONS,
  RESIDENCE_OPTIONS,
  findPriorHouseholdCandidates,
  fetchHouseholdForYear,
  generateHouseholdNumber,
  mapResidenceType,
  mapPriorToHeadForm,
  mapPriorToMemberForm,
  isMemberRetained,
  activeMembersOf,
  summarizeRetention,
  identityKey,
} from "../lib/householdContinuity";
import {
  getDataYearOptions,
  describeAgeReference,
  calculateAgeForYear,
  currentYear,
  isSeniorAge,
  isFemaleSex,
  toAgeInt,
  applyPersonYear,
  normalizePersonForSave,
  snapshotPerson,
  summarizeYearChanges,
  formatYearChangeSummary,
} from "../lib/ageEngine";

export default function AddResident() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  // const [household, setHousehold] = useState({
  //   hh_num: "",
  //   house_no: "",
  //   street: "",
  //   purok: "",
  //   brgy: "",
  //   mun: "Bustos",
  //   residence_type: "Owner",
  //   residence_type_other: "",
  // });
  // const [head, setHead] = useState({
  //   lname: "",
  //   fname: "",
  //   mname: "",
  //   q: "",
  //   pob: "",
  //   dob: "",
  //   age: "",
  //   sex: "Male",
  //   civil: "Single",
  //   religion: "",
  //   citizenship: "FILIPINO",
  //   edu: "",
  //   occupation: "",
  //   is_voter: "Registered Voter",
  //   is_4ps: false,
  //   is_pwd: false,
  //   has_pwd_id: false,
  //   is_senior: false,
  //   has_senior_id: false,
  //   is_solo_parent: false,
  //   has_solo_parent_id: false,
  //   age_first_birth: "",
  //   teenage_pregnancy: false,
  //   teenage_mother: false,
  // });
  const [members, setMembers] = useState([]);
  const [expandedMemberIndex, setExpandedMemberIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [formWarning, setFormWarning] = useState("");
  const [attendanceCatalog, setAttendanceCatalog] = useState({
    programs: [],
    seminars: [],
  });
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [attendanceError, setAttendanceError] = useState("");
  const toast = useToast();
  const confirm = useConfirm();

  const loadAttendanceCatalog = useCallback(async () => {
    setAttendanceLoading(true);
    setAttendanceError("");
    const result = await fetchAttendanceCatalog();
    setAttendanceCatalog({
      programs: result.programs,
      seminars: result.seminars,
    });
    setAttendanceError(result.error || "");
    setAttendanceLoading(false);
  }, []);

  useEffect(() => {
    loadAttendanceCatalog();
  }, [loadAttendanceCatalog]);

  const attendanceGroups = useMemo(
    () => buildGroups(attendanceCatalog.programs, attendanceCatalog.seminars),
    [attendanceCatalog],
  );

  const attendanceText = useCallback(
    (items) =>
      formatAttendance(
        serializeAttendance(items, attendanceGroups),
        attendanceGroups,
      ),
    [attendanceGroups],
  );

  // Reusable default states so we can both initialize and reset the form
  const initialHousehold = {
    data_year: new Date().getFullYear().toString(),
    hh_num: "",
    house_no: "",
    street: "",
    purok: "",
    brgy: "",
    mun: "Bustos",
    residence_type: "Owner",
    residence_type_other: "",
  };

  const initialHead = {
    lname: "",
    fname: "",
    mname: "",
    q: "",
    pob: "",
    dob: "",
    age: "",
    sex: "Male",
    civil: "Single",
    religion: "",
    citizenship: "FILIPINO",
    edu: "",
    occupation: "",
    is_voter: "Registered Voter",
    is_4ps: false,
    is_pwd: false,
    has_pwd_id: false,
    is_senior: false,
    senior_id_reported: false,
    has_senior_id: false,
    is_solo_parent: false,
    has_solo_parent_id: false,
    age_first_birth: "",
    teenage_pregnancy: false,
    // Reported baseline (evidence of a child). The applied
    // `teenage_mother` flag is derived from it by the age engine and only
    // holds while the person is female and aged 10-19.
    teen_mother_reported: false,
    teenage_mother: false,
    child_pregnancy_case: false,
    // Age anchor used when the birth date is missing, so an estimated age
    // still rolls forward on the next data year.
    ageBaselineYear: null,
    ageBaselineValue: null,
    ageEstimated: false,
    attended_items: [],
  };
  const [household, setHousehold] = useState(initialHousehold);
  const [head, setHead] = useState(initialHead);

  /* ── Prior Household Lookup & Member Retention ──
   * verificationStatus: 'idle' | 'searching' | 'candidates' | 'matched'
   *                     | 'new_household'
   * matchedHousehold holds the confirmed prior household-year; priorHeadForm
   * keeps the original prior head so a successor can be reverted. */
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState("idle");
  const [matchedHousehold, setMatchedHousehold] = useState(null);
  const [priorCandidates, setPriorCandidates] = useState([]);
  const [lookupNote, setLookupNote] = useState("");
  const [currentYearMatch, setCurrentYearMatch] = useState(null);
  const [lookupHhNo, setLookupHhNo] = useState("");
  const [lookupLastName, setLookupLastName] = useState("");
  const [lookupFirstName, setLookupFirstName] = useState("");
  const [retentionReviewed, setRetentionReviewed] = useState(false);
  // Household-head retention: 'retained' | 'deceased' | 'migrated'
  const [headRetention, setHeadRetention] = useState(RETAINED);
  const [priorHeadForm, setPriorHeadForm] = useState(null);
  const [headIsSuccessor, setHeadIsSuccessor] = useState(false);
  const [successorChoice, setSuccessorChoice] = useState("");

  /**
   * Age is always derived from the birth date against the Data Year being
   * encoded, so a prior-year roster recalculates to the year the encoder is
   * working on. For the current year the reference is today; for every other
   * year (past *or* future) it is December 31 of that year, which is what
   * makes preparing next year's roll-over work.
   */
  const selectedDataYear = () => {
    const year = parseInt(household.data_year, 10);
    return Number.isFinite(year) ? year : new Date().getFullYear();
  };

  /** True when an age is known (0 counts - infants are a real age). */
  const hasKnownAge = (person) => toAgeInt(person.age) !== null;

  /**
   * Birth date is the master baseline. Entering one recalculates the age and
   * every age-derived flag; the Age field becomes read-only. Clearing it
   * falls back to the last known age, anchored to the current data year so it
   * still rolls forward next year.
   */
  const handleHeadDobChange = (dobValue) => {
    setHead((prev) => {
      const next = { ...prev, dob: dobValue };
      if (dobValue) {
        next.age = calculateAgeForYear(dobValue, selectedDataYear());
        next.ageBaselineYear = null;
        next.ageBaselineValue = null;
        next.ageEstimated = false;
      } else {
        next.ageBaselineYear = selectedDataYear();
        next.ageBaselineValue = toAgeInt(prev.age);
      }
      return applyPersonYear(next, selectedDataYear());
    });
  };

  const handleMemberDobChange = (index, dobValue) => {
    setMembers((prev) => {
      const next = [...prev];
      const person = { ...next[index], dob: dobValue };
      if (dobValue) {
        person.age = calculateAgeForYear(dobValue, selectedDataYear());
        person.ageBaselineYear = null;
        person.ageBaselineValue = null;
        person.ageEstimated = false;
      } else {
        person.ageBaselineYear = selectedDataYear();
        person.ageBaselineValue = toAgeInt(person.age);
      }
      next[index] = applyPersonYear(person, selectedDataYear());
      return next;
    });
  };

  /**
   * The Age field is only editable while the birth date is missing (an
   * estimate the encoder supplies). The value is anchored to the data year it
   * was typed in, so switching Data Year still rolls it forward.
   */
  const handleHeadAgeChange = (value) => {
    setHead((prev) => {
      if (prev.dob) return prev; // derived - not editable
      const raw = value === "" ? "" : value;
      return applyPersonYear(
        {
          ...prev,
          age: raw,
          ageBaselineYear: value === "" ? null : selectedDataYear(),
          ageBaselineValue: toAgeInt(value),
        },
        selectedDataYear(),
      );
    });
  };

  const handleMemberAgeChange = (index, value) => {
    setMembers((prev) => {
      if (prev[index]?.dob) return prev; // derived - not editable
      const next = [...prev];
      next[index] = applyPersonYear(
        {
          ...next[index],
          age: value === "" ? "" : value,
          ageBaselineYear: value === "" ? null : selectedDataYear(),
          ageBaselineValue: toAgeInt(value),
        },
        selectedDataYear(),
      );
      return next;
    });
  };

  /** Sex drives the female-adolescent rules, so re-derive on change. */
  const handleHeadSexChange = (value) => {
    setHead((prev) =>
      applyPersonYear({ ...prev, sex: value }, selectedDataYear()),
    );
  };

  const handleMemberSexChange = (index, value) => {
    setMembers((prev) => {
      const next = [...prev];
      next[index] = applyPersonYear(
        { ...next[index], sex: value },
        selectedDataYear(),
      );
      return next;
    });
  };

  /**
   * "Current teenage mother" is reported (it needs evidence of a child), so
   * the encoder ticks it. The flag is then only *applied* while the person is
   * female and 10-19 - the baseline is kept so it can be re-derived if the
   * data year changes.
   */
  const handleHeadTeenMotherChange = (checked) => {
    setHead((prev) =>
      applyPersonYear(
        { ...prev, teen_mother_reported: checked },
        selectedDataYear(),
      ),
    );
  };

  const handleMemberTeenMotherChange = (index, checked) => {
    setMembers((prev) => {
      const next = [...prev];
      next[index] = applyPersonYear(
        { ...next[index], teen_mother_reported: checked },
        selectedDataYear(),
      );
      return next;
    });
  };

  /**
   * A reported pregnancy on a female child is a sensitive child-pregnancy
   * case. Toggling it clears the teenage baselines so checking creates a clean
   * child case and unchecking cannot be silently re-derived from a stale teen
   * flag. A first-birth age of 9 or below is separate evidence and still
   * preserves the case until that value is corrected.
   */
  const handleHeadChildPregnancyChange = (checked) => {
    setHead((prev) =>
      applyPersonYear(
        {
          ...prev,
          child_pregnancy_case: checked,
          teenage_pregnancy: false,
          teen_mother_reported: false,
        },
        selectedDataYear(),
      ),
    );
  };

  const handleMemberChildPregnancyChange = (index, checked) => {
    setMembers((prev) => {
      const next = [...prev];
      next[index] = applyPersonYear(
        {
          ...next[index],
          child_pregnancy_case: checked,
          teenage_pregnancy: false,
          teen_mother_reported: false,
        },
        selectedDataYear(),
      );
      return next;
    });
  };

  const handleHeadAgeFirstBirthChange = (val) => {
    const ageNum = parseInt(val, 10);
    const isTeenPreg = !isNaN(ageNum) && ageNum > 0 && ageNum <= 19;
    setHead((prev) =>
      applyPersonYear(
        {
          ...prev,
          age_first_birth: val,
          teenage_pregnancy: isTeenPreg,
        },
        selectedDataYear(),
      ),
    );
  };

  const handleMemberAgeFirstBirthChange = (index, val) => {
    const ageNum = parseInt(val, 10);
    const isTeenPreg = !isNaN(ageNum) && ageNum > 0 && ageNum <= 19;
    setMembers((prev) => {
      const next = [...prev];
      next[index] = applyPersonYear(
        {
          ...next[index],
          age_first_birth: val,
          teenage_pregnancy: isTeenPreg,
        },
        selectedDataYear(),
      );
      return next;
    });
  };

  // Senior Citizen is fully automatic (age >= 60), so these handlers no longer
  // carry a senior branch - the checkbox is derived and disabled in the UI.
  const handleHeadClassification = (field, checked) => {
    setHead((prev) => {
      const next = { ...prev, [field]: checked };
      if (field === "is_pwd" && !checked) next.has_pwd_id = false;
      if (field === "is_solo_parent" && !checked)
        next.has_solo_parent_id = false;
      return next;
    });
  };

  const updateMemberClassification = (index, field, checked) => {
    const newMembers = [...members];
    newMembers[index][field] = checked;
    if (field === "is_pwd" && !checked) newMembers[index].has_pwd_id = false;
    if (field === "is_solo_parent" && !checked)
      newMembers[index].has_solo_parent_id = false;
    setMembers(newMembers);
  };

  const validateStep = (step = currentStep) => {
    if (step === 1) {
      if (!household.hh_num) {
        if (verificationStatus === "idle") {
          return 'Search for a prior household first, or click "Register as New Household" to generate a Household Number.';
        }
        if (verificationStatus === "new_household") {
          return 'Enter a Household Number, or click "Register as New Household" to generate one.';
        }
        return "Household Number is required.";
      }
      if (!household.house_no) return "House Number is required.";
      if (!household.street) return "Street name is required.";
      if (!household.purok) return "Purok / Sitio is required.";
      if (!household.brgy) return "Please select a Barangay.";
      if (
        household.residence_type === "Other" &&
        !household.residence_type_other
      ) {
        return "Please specify the residence type.";
      }
      if (
        currentYearMatch &&
        verificationStatus === "matched" &&
        currentYearMatch > 0
      ) {
        return `Household ${household.hh_num} already has ${currentYearMatch} record(s) for Data Year ${household.data_year}. Edit or add members from the Household list to avoid duplicates.`;
      }
    }

    // Step 2: Household Head Validation
    if (step === 2) {
      // A prior household head that will not be carried forward must have a
      // successor before the household can be encoded.
      if (
        verificationStatus === "matched" &&
        priorHeadForm &&
        headRetention !== RETAINED &&
        !headIsSuccessor
      ) {
        return `The prior household head is marked ${RETENTION_LABELS[headRetention]}. Select a successor (promote a retained member or enter a new head) before continuing.`;
      }

      if (!head.lname) return "Last Name is required for the Household Head.";
      const lnameErr = getNameError(head.lname);
      if (lnameErr) return `Household Head last name: ${lnameErr}`;

      if (!head.fname) return "First Name is required for the Household Head.";
      const fnameErr = getNameError(head.fname);
      if (fnameErr) return `Household Head first name: ${fnameErr}`;

      if (head.mname) {
        const mnameErr = getNameError(head.mname);
        if (mnameErr) return `Household Head middle name: ${mnameErr}`;
      }

      if (!head.pob)
        return "Place of Birth is required for the Household Head.";
      if (!head.dob) return "Date of Birth is required for the Household Head.";
      if (calculateAgeForYear(head.dob, selectedDataYear()) === "")
        return "Date of Birth must be a valid date that is not in the future.";
      if (head.age !== "" && head.age <= 18)
        return "Household head must be over 18 years old.";
    }

    if (step === 3) {
      // Every prior member must have been reviewed (Retained / Deceased /
      // Migrated) before the encoder can move on.
      if (verificationStatus === "matched" && !retentionReviewed) {
        return "Review the prior-year roster and confirm retention (Retained, Deceased or Migrated) before continuing.";
      }

      for (let i = 0; i < members.length; i += 1) {
        const member = members[i];
        if (member.promotedToHead) continue; // saved as the head instead
        if (!isMemberRetained(member)) continue; // not carried forward

        const hasAnyMemberValue =
          member.lname ||
          member.fname ||
          member.rel ||
          member.dob ||
          member.pob ||
          member.religion ||
          member.edu ||
          member.occupation;
        if (hasAnyMemberValue) {
          if (!member.lname) return `Member ${i + 1} is missing a Last Name.`;
          const lnameErr = getNameError(member.lname);
          if (lnameErr) return `Member ${i + 1} last name: ${lnameErr}`;

          if (!member.fname) return `Member ${i + 1} is missing a First Name.`;
          const fnameErr = getNameError(member.fname);
          if (fnameErr) return `Member ${i + 1} first name: ${fnameErr}`;

          if (member.mname) {
            const mnameErr = getNameError(member.mname);
            if (mnameErr) return `Member ${i + 1} middle name: ${mnameErr}`;
          }

          if (!member.rel)
            return `Member ${i + 1} is missing a Relationship to Head.`;

          // An age (or a birth date to derive it from) is required so the
          // Senior Citizen and teenage-mother classifications can be derived
          // automatically on save rather than left blank.
          if (!member.dob && toAgeInt(member.age) === null) {
            return `Member ${i + 1} needs a Date of Birth — or, if it is unknown, an estimated Age.`;
          }
        }
      }

      // Duplicate person check across the head + the members being saved.
      const seen = new Map();
      const roster = [head, ...activeMembersOf(members)];
      for (const person of roster) {
        const last = String(person.lname || "").trim();
        const first = String(person.fname || "").trim();
        if (!last && !first) continue;
        const key = identityKey(person);
        const label = formatResidentName({
          first_name: person.fname,
          middle_name: person.mname,
          last_name: person.lname,
          qualifier: person.q,
        });
        if (seen.has(key)) {
          return `Duplicate: ${label} appears twice in this household roster. Mark one record as Deceased or Migrated, or correct the birth date.`;
        }
        seen.set(key, label);
      }
    }

    return "";
  };

  const validateAll = () => {
    const householdWarning = validateStep(1);
    if (householdWarning) return householdWarning;

    const headWarning = validateStep(2);
    if (headWarning) return headWarning;

    return validateStep(3);
  };

  const addMember = () => {
    setMembers([
      ...members,
      {
        lname: "",
        fname: "",
        mname: "",
        q: "",
        rel: "",
        pob: "",
        dob: "",
        age: "",
        sex: "Male",
        civil: "Single",
        religion: "",
        citizenship: "FILIPINO",
        edu: "",
        occupation: "",
        is_voter: "Registered Voter",
        is_4ps: false,
        is_pwd: false,
        has_pwd_id: false,
        is_senior: false,
        senior_id_reported: false,
        has_senior_id: false,
        is_solo_parent: false,
        has_solo_parent_id: false,
        age_first_birth: "",
        teenage_pregnancy: false,
        teen_mother_reported: false,
        teenage_mother: false,
        child_pregnancy_case: false,
        ageBaselineYear: null,
        ageBaselineValue: null,
        ageEstimated: false,
        attended_items: [],
        source: "new",
        promotedToHead: false,
      },
    ]);
    setExpandedMemberIndex(members.length);
    setFormWarning("");
  };

  /**
   * Sets the retention status of a prior member. Members marked Deceased or
   * Migrated stay visible for reference but are excluded from the new data
   * year. Confirming again after any change re-arms the roster confirmation.
   */
  const updateMemberStatus = (index, status) => {
    setMembers((prev) =>
      prev.map((member, i) =>
        i === index ? { ...member, retentionStatus: status } : member,
      ),
    );
    setRetentionReviewed(false);
    if (status !== RETAINED && expandedMemberIndex === index) {
      setExpandedMemberIndex(-1);
    }
    setFormWarning("");
  };

  /** Shortcut: keep every prior member in the household. */
  const retainAllMembers = () => {
    setMembers((prev) =>
      prev.map((member) =>
        member.source === "prior" && !member.promotedToHead
          ? { ...member, retentionStatus: RETAINED }
          : member,
      ),
    );
    setFormWarning("");
  };

  const confirmRosterReviewed = () => {
    setRetentionReviewed(true);
    setFormWarning("");
  };

  const removeMember = (index) => {
    setMembers(members.filter((_, i) => i !== index));
    if (expandedMemberIndex === index) {
      setExpandedMemberIndex(-1);
    } else if (expandedMemberIndex > index) {
      setExpandedMemberIndex(expandedMemberIndex - 1);
    }
  };

  /** Updates one field, or a patch object, of a single member card. */
  const updateMember = (index, fieldOrPatch, value) => {
    setMembers((prev) =>
      prev.map((m, i) => {
        if (i !== index) return m;
        return typeof fieldOrPatch === "object"
          ? { ...m, ...fieldOrPatch }
          : { ...m, [fieldOrPatch]: value };
      }),
    );
  };

  const handleStep = (dir) => {
    if (dir === 1) {
      const warning = validateStep();
      if (warning) {
        setFormWarning(warning);
        return;
      }
    }

    if (currentStep === 4 && dir === 1) {
      saveData();
      return;
    }

    setFormWarning("");
    setCurrentStep(currentStep + dir);
  };

  const saveData = async () => {
    const warning = validateAll();
    if (warning) {
      setFormWarning(warning);
      return;
    }

    setFormWarning("");
    setIsLoading(true);
    try {
      const currentYear = new Date().getFullYear();
      const common = {
        data_year: household.data_year ? parseInt(household.data_year, 10) : currentYear,
        h_no: household.hh_num,
        house_no: household.house_no,
        street: household.street,
        purok: household.purok,
        barangay: household.brgy,
        residence_type:
          household.residence_type === "Other"
            ? household.residence_type_other
            : household.residence_type,
      };

      const dataYear = common.data_year;

      // Final safety net: re-derive every age and age-dependent flag from the
      // birth date (or the estimated-age anchor) for the data year being
      // saved, so no stale `is_senior` / `current_teenage_mother` can ever
      // reach the database.
      const headNorm = normalizePersonForSave(head, dataYear);

      const residentsToSave = [
        {
          ...common,
          last_name: head.lname,
          first_name: head.fname,
          middle_name: head.mname || null,
          qualifier: head.q || null,
          birth_place: head.pob,
          birth_date: head.dob || null,
          sex: head.sex,
          civil_status: head.civil,
          relation_to_head: "HEAD",
          is_household_head: true,
          age: headNorm.age,
          religion: head.religion || null,
          educational_attainment: head.edu || null,
          citizenship: head.citizenship || "FILIPINO",
          occupation: head.occupation || null,
          is_voter: head.is_voter,
          is_4ps: head.is_4ps,
          is_pwd: head.is_pwd,
          has_pwd_id: head.is_pwd ? head.has_pwd_id : false,
          is_senior: headNorm.is_senior,
          has_senior_id: headNorm.has_senior_id,
          is_solo_parent: head.is_solo_parent,
          has_solo_parent_id: head.is_solo_parent
            ? head.has_solo_parent_id
            : false,
          age_at_first_birth: headNorm.age_at_first_birth,
          teenage_pregnancy_case: headNorm.teenage_pregnancy_case,
          current_teenage_mother: headNorm.current_teenage_mother,
          child_pregnancy_case: headNorm.child_pregnancy_case,
          dswd_referral_status: head.dswd_referral_status || "Pending",
          dswd_referred_at: head.dswd_referred_at || null,
          dswd_referral_notes: head.dswd_referral_notes || null,
          attended_items: serializeAttendance(
            head.attended_items,
            attendanceGroups,
          ),
          is_archived: false,
        },
        // Only members carried forward are written to the new data year.
        // Deceased / migrated prior members and the promoted successor are
        // recorded in the transaction log instead.
        ...activeMembersOf(members).map((m) => {
          const memberNorm = normalizePersonForSave(m, dataYear);
          return {
            ...common,
            last_name: m.lname,
            first_name: m.fname,
            middle_name: m.mname || null,
            qualifier: m.q || null,
            birth_place: m.pob,
            birth_date: m.dob || null,
            sex: m.sex,
            civil_status: m.civil,
            relation_to_head: m.rel || "MEMBER",
            is_household_head: false,
            age: memberNorm.age,
            religion: m.religion || null,
            educational_attainment: m.edu || null,
            citizenship: m.citizenship || "FILIPINO",
            occupation: m.occupation || null,
            is_voter: m.is_voter,
            is_4ps: m.is_4ps,
            is_pwd: m.is_pwd,
            has_pwd_id: m.is_pwd ? m.has_pwd_id : false,
            is_senior: memberNorm.is_senior,
            has_senior_id: memberNorm.has_senior_id,
            is_solo_parent: m.is_solo_parent,
            has_solo_parent_id: m.is_solo_parent
              ? m.has_solo_parent_id
              : false,
            age_at_first_birth: memberNorm.age_at_first_birth,
            teenage_pregnancy_case: memberNorm.teenage_pregnancy_case,
            current_teenage_mother: memberNorm.current_teenage_mother,
            child_pregnancy_case: memberNorm.child_pregnancy_case,
            dswd_referral_status: m.dswd_referral_status || "Pending",
            dswd_referred_at: m.dswd_referred_at || null,
            dswd_referral_notes: m.dswd_referral_notes || null,
            attended_items: serializeAttendance(
              m.attended_items,
              attendanceGroups,
            ),
            is_archived: false,
          };
        }),
      ];

      // Check for duplicate residents in Supabase & Local Storage before saving
      const allLocalRecords = JSON.parse(localStorage.getItem("tanawanData")) || [];

      for (const r of residentsToSave) {
        // 1. Check Supabase database
        let query = supabase
          .from("residents")
          .select("id, last_name, first_name, is_archived, data_year")
          .ilike("last_name", r.last_name.trim())
          .ilike("first_name", r.first_name.trim())
          .eq("barangay", r.barangay)
          .eq("data_year", r.data_year);

        const { data: existing, error: checkErr } = await query;

        if (!checkErr && existing && existing.length > 0) {
          const isArchived = existing.some((ex) => ex.is_archived);
          const fullName = formatResidentName(r);
          const msg = isArchived
            ? `Cannot save: Resident ${fullName} already exists in ${r.barangay} as an archived record for year ${r.data_year}.`
            : `Cannot save: Resident ${fullName} already exists in ${r.barangay} for year ${r.data_year}.`;

          setFormWarning(msg);
          setIsLoading(false);
          return;
        }

        // 2. Check Local Storage
        const localDup = allLocalRecords.find((rec) => {
          const sameFirst = (rec.first || "").toLowerCase().trim() === r.first_name.toLowerCase().trim();
          const sameLast = (rec.last || "").toLowerCase().trim() === r.last_name.toLowerCase().trim();
          const sameBrgy = (rec.brgy || "").toLowerCase().trim() === r.barangay.toLowerCase().trim();
          const sameYear = rec.dataYear ? parseInt(rec.dataYear, 10) === r.data_year : true;
          return sameFirst && sameLast && sameBrgy && sameYear;
        });

        if (localDup) {
          const fullName = formatResidentName(r);
          const msg = `Cannot save: Resident ${fullName} already exists in local storage for year ${r.data_year}.`;
          setFormWarning(msg);
          setIsLoading(false);
          return;
        }
      }

      const { error } = await supabase
        .from("residents")
        .insert(residentsToSave);

      if (error) {
        if (error.message && error.message.includes("already exists in the system")) {
          setFormWarning(error.message);
          return;
        }
        throw error;
      }

      // Sync to localStorage
      const allRecords = JSON.parse(localStorage.getItem("tanawanData")) || [];
      const newRecordsLocal = residentsToSave.map((r) => ({
        id: r.id || "local_" + Math.random().toString(36).substr(2, 9),
        h_no: r.h_no,
        brgy: r.barangay,
        no: r.house_no,
        st: r.street,
        p: r.purok,
        last: r.last_name,
        first: r.first_name,
        mid: r.middle_name,
        q: r.qualifier,
        bd: r.birth_date,
        bp: r.birth_place,
        s: r.sex,
        cs: r.civil_status,
        cz: r.citizenship,
        oc: r.occupation,
        rel: r.relation_to_head,
        isVoter: r.is_voter,
        age: r.age,
        residenceType: r.residence_type,
        isHead: r.is_household_head,
        religion: r.religion,
        edu: r.educational_attainment,
        isPwd: r.is_pwd,
        hasPwdId: r.has_pwd_id,
        isSenior: r.is_senior,
        hasSeniorId: r.has_senior_id,
        isSoloParent: r.is_solo_parent,
        hasSoloParentId: r.has_solo_parent_id,
        ageFirstBirth: r.age_at_first_birth,
        teenagePregnancy: r.teenage_pregnancy_case,
        teenageMother: r.current_teenage_mother,
        childPregnancy: r.child_pregnancy_case,
        dswdReferralStatus: r.dswd_referral_status,
        dswdReferredAt: r.dswd_referred_at,
        dswdReferralNotes: r.dswd_referral_notes,
        is4ps: r.is_4ps,
        attendedItems: r.attended_items,
        dataYear: r.data_year,
      }));

      localStorage.setItem(
        "tanawanData",
        JSON.stringify([...allRecords, ...newRecordsLocal]),
      );

      const summary = summarizeRetention(members);
      const retentionBits = [];
      if (verificationStatus === "matched" && matchedHousehold) {
        retentionBits.push(
          `prior household ${matchedHousehold.hNo} from ${matchedHousehold.dataYear} (head: ${matchedHousehold.headName})`,
        );
        retentionBits.push(`${summary.retained} retained`);
        if (summary.promoted) retentionBits.push(`${summary.promoted} promoted to head`);
        if (summary.deceased) retentionBits.push(`${summary.deceased} deceased (not carried forward)`);
        if (summary.migrated) retentionBits.push(`${summary.migrated} migrated (not carried forward)`);
        if (summary.added) retentionBits.push(`${summary.added} newly added`);
        const net = residentsToSave.length - (matchedHousehold.memberCount || 0);
        retentionBits.push(`net increment ${net >= 0 ? "+" : ""}${net}`);
      } else if (verificationStatus === "new_household") {
        retentionBits.push(
          `new household (no prior-year record), ${residentsToSave.length} member(s)`,
        );
      }
      if (headRetention !== RETAINED && priorHeadForm) {
        retentionBits.push(
          `prior head ${formatResidentName({
            first_name: priorHeadForm.fname,
            middle_name: priorHeadForm.mname,
            last_name: priorHeadForm.lname,
            qualifier: priorHeadForm.q,
          })} marked ${RETENTION_LABELS[headRetention]}`,
        );
      }

      logTransaction({
        action: "Add Resident",
        category: "Resident Management",
        details:
          `Registered household ${residentsToSave[0]?.h_no || ""} in ${residentsToSave[0]?.barangay || ""} with ${residentsToSave.length} member(s) for year ${residentsToSave[0]?.data_year || ""}.` +
          (retentionBits.length ? ` | ${retentionBits.join(", ")}.` : ""),
      });

      toast.success(
        `Resident saved successfully to Supabase${residentsToSave.length > 1 ? ` (${residentsToSave.length} members)` : ""}!`,
      );
      navigate("/barangay");
    } catch (err) {
      console.error("Error saving to Supabase:", err);
      const message = String(err?.message || "Unknown error");
      if (message.includes("already exists")) {
        setFormWarning(message);
      }
      const migrationHint =
        message.includes("child_pregnancy_case") || message.includes("dswd_")
          ? " Database migration required: run supabase/sensitive_child_pregnancy.sql in the Supabase SQL editor."
          : "";
      toast.error(`Failed to save to Supabase: ${message}${migrationHint}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Prior Household Lookup & Member Retention ──

  /**
   * Looks up the household in every data year before the one being encoded.
   * A single hit is auto-loaded; multiple hits are shown as candidates
   * because h_no is reused across data years (BM156 = Flores in 2024,
   * Mercado in 2025).
   */
  const handleSearchPriorHousehold = async () => {
    const hasHh = lookupHhNo.trim() !== "";
    const hasName = lookupLastName.trim() !== "" || lookupFirstName.trim() !== "";

    if (!hasHh && !hasName) {
      toast.warning("Enter a Household No. and/or the prior head's name to search.");
      return;
    }
    if (!household.brgy) {
      toast.warning("Select a Barangay first — prior records are matched within a barangay.");
      return;
    }

    setIsVerifying(true);
    setVerificationStatus("searching");
    setMatchedHousehold(null);
    setPriorCandidates([]);
    setLookupNote("");
    setCurrentYearMatch(null);

    try {
      const { candidates, errors, note } = await findPriorHouseholdCandidates({
        hNo: lookupHhNo,
        lastName: lookupLastName,
        firstName: lookupFirstName,
        barangay: household.brgy,
        targetYear: selectedDataYear(),
      });

      if (errors.length) toast.warning(`Lookup finished with warnings: ${errors[0]}`);
      if (note) setLookupNote(note);

      if (candidates.length === 0) {
        if (errors.length > 0) {
          // The lookup did not complete — do not mint a number from partial data.
          setVerificationStatus("idle");
          toast.error(
            "Lookup could not confirm prior-year records. Check the connection and search again.",
          );
          return;
        }
        setVerificationStatus("new_household");
        // No prior-year record → this is a new household, so mint its number.
        const generated = await generateHouseholdNumber(household.brgy);
        if (generated) {
          setHousehold((prev) => ({ ...prev, hh_num: generated }));
          toast.info(
            `No prior-year record found — new household with Household No. ${generated}.`,
          );
        } else {
          toast.info(
            "No prior-year record found. Enter or generate a Household No. to continue.",
          );
        }
        return;
      }

      if (candidates.length === 1) {
        await applyPriorCandidate(candidates[0]);
        return;
      }

      setPriorCandidates(candidates);
      setVerificationStatus("candidates");
    } catch (err) {
      console.error("Prior household lookup error:", err);
      setVerificationStatus("idle");
      toast.error("Prior household lookup failed: " + err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  /** Loads a chosen prior household-year into the registration form. */
  const applyPriorCandidate = async (candidate) => {
    if (!candidate) return;
    setIsVerifying(true);
    try {
      const year = candidate.dataYear;

      // Household & location details come from the prior record.
      const residence = mapResidenceType(candidate.residenceType);
      setHousehold((prev) => ({
        ...prev,
        hh_num: candidate.hNo || prev.hh_num,
        house_no: candidate.houseNo || prev.house_no,
        street: candidate.street || prev.street,
        purok: candidate.purok || prev.purok,
        brgy: candidate.barangay || prev.brgy,
        residence_type: residence.value,
        residence_type_other: residence.other,
        data_year: String(selectedDataYear()),
      }));

      // Head of household.
      const headForm = mapPriorToHeadForm(candidate.headRecord, selectedDataYear());
      setHead(headForm);
      setPriorHeadForm(headForm);
      setHeadRetention(RETAINED);
      setHeadIsSuccessor(false);
      setSuccessorChoice("");

      // Members: everyone except the head, carried over with a retention
      // status the encoder can adjust.
      const roster = candidate.members
        .filter((m) => m !== candidate.headRecord)
        .map((m) => mapPriorToMemberForm(m, selectedDataYear()));
      setMembers(roster);
      setExpandedMemberIndex(-1);
      setRetentionReviewed(false);
      setFormWarning("");

      // Warn when this household already has records in the target year.
      const { rows, error } = await fetchHouseholdForYear({
        hNo: candidate.hNo,
        barangay: candidate.barangay,
        targetYear: selectedDataYear(),
      });
      if (error) console.warn("Current-year check failed:", error);
      setCurrentYearMatch(rows.length || 0);

      setMatchedHousehold({
        hNo: candidate.hNo,
        dataYear: year,
        headName: candidate.headName,
        memberCount: candidate.memberCount,
        houseNo: candidate.houseNo,
        street: candidate.street,
        purok: candidate.purok,
        barangay: candidate.barangay,
      });
      setPriorCandidates([]);
      setLookupNote("");
      setVerificationStatus("matched");
      toast.success(
        `Loaded household ${candidate.hNo} (${year}) — ${candidate.memberCount} record(s), ages recalculated for ${selectedDataYear()}.`,
      );
    } catch (err) {
      console.error("Failed to load prior household:", err);
      toast.error("Could not load that household: " + err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  /** Starts a brand-new household and generates its Household No. */
  const startNewHousehold = async () => {
    if (!household.brgy) {
      toast.warning("Select a Barangay before generating a Household No.");
      return;
    }
    setIsVerifying(true);
    try {
      const generated = await generateHouseholdNumber(household.brgy);
      setHousehold((prev) => ({ ...prev, hh_num: generated || prev.hh_num }));
      clearMatchedRoster();
      setVerificationStatus("new_household");
      toast.info(
        generated
          ? `New household — Household No. ${generated} generated for ${household.brgy}.`
          : "New household — could not generate a number, please enter the Household No. manually.",
      );
    } catch (err) {
      console.error("Household number generation failed:", err);
      toast.error("Could not generate a Household No.: " + err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  /** Drops the prior match and returns the form to the lookup state. */
  const clearMatchedRoster = () => {
    setMatchedHousehold(null);
    setPriorCandidates([]);
    setMembers([]);
    setExpandedMemberIndex(-1);
    setRetentionReviewed(false);
    setHead(initialHead);
    setPriorHeadForm(null);
    setHeadRetention(RETAINED);
    setHeadIsSuccessor(false);
    setSuccessorChoice("");
    setCurrentYearMatch(null);
    setFormWarning("");
  };

  const clearPriorMatch = () => {
    clearMatchedRoster();
    setVerificationStatus("idle");
    setLookupNote("");
  };

  /**
   * Records what happens to the prior household head. Marking the head
   * Deceased or Migrated requires a successor before Step 3 can be left.
   */
  const handleHeadRetentionChange = (status) => {
    if (status === headRetention) return;

    if (status === RETAINED) {
      // Revert to the original prior head.
      if (priorHeadForm) setHead(priorHeadForm);
      setMembers((prev) => prev.map((m) => ({ ...m, promotedToHead: false })));
      setHeadIsSuccessor(false);
      setSuccessorChoice("");
    } else if (priorHeadForm) {
      // Keep the prior head visible for reference until a successor is chosen.
      setHead(priorHeadForm);
      setHeadIsSuccessor(false);
      setSuccessorChoice("");
      setMembers((prev) => prev.map((m) => ({ ...m, promotedToHead: false })));
      toast.info(
        `Prior head marked ${RETENTION_LABELS[status]}. Choose a successor or enter a new head.`,
      );
    }

    setHeadRetention(status);
    setFormWarning("");
  };

  /** Applies the chosen successor: a retained member promoted to head, or a freshly entered head. */
  const handleSuccessorChoice = (choice) => {
    setSuccessorChoice(choice);
    setFormWarning("");

    if (!choice) {
      setHeadIsSuccessor(false);
      if (priorHeadForm) setHead(priorHeadForm);
      setMembers((prev) => prev.map((m) => ({ ...m, promotedToHead: false })));
      return;
    }

    if (choice === "manual") {
      setHead({
        ...initialHead,
        source: "new",
        isSuccessor: true,
        rel: "HEAD",
      });
      setMembers((prev) => prev.map((m) => ({ ...m, promotedToHead: false })));
      setHeadIsSuccessor(true);
      return;
    }

    const index = parseInt(choice.replace("member:", ""), 10);
    const member = members[index];
    if (!member || !isMemberRetained(member)) return;

    setHead({
      ...member,
      rel: "HEAD",
      source: member.source,
      isSuccessor: true,
      priorId: member.priorId,
      priorDataYear: member.priorDataYear,
      priorAge: member.priorAge,
      ageEstimated: member.ageEstimated,
      retentionStatus: RETAINED,
      attended_items: [],
    });
    setMembers((prev) =>
      prev.map((m, i) => (i === index ? { ...m, promotedToHead: true } : m)),
    );
    setHeadIsSuccessor(true);
  };

  const handleBrgyChange = (e) => {
    const selectedBrgy = e.target.value;
    if (verificationStatus === "matched" || verificationStatus === "candidates") {
      // A prior match is barangay-specific — changing barangay drops it.
      clearPriorMatch();
    }
    setHousehold((prev) => ({ ...prev, brgy: selectedBrgy }));
    setLookupNote("");
    setCurrentYearMatch(null);
  };

  /**
   * Data Year drives every age on the form, so switching it re-derives each
   * person's age and every age-derived classification (Senior Citizen, current
   * teenage mother). The revert-to-head copy is re-derived too, so restoring a
   * retired head never restores a stale age.
   */
  const handleDataYearChange = (e) => {
    const value = e.target.value;
    const year = parseInt(value, 10);
    if (!Number.isFinite(year)) return;

    // A loaded prior household can only be carried into a LATER data year.
    // Rolling back onto (or into) its own year would re-create the source
    // rows, so the change is rejected and the previous value kept.
    if (
      verificationStatus === "matched" &&
      matchedHousehold &&
      Number.isFinite(matchedHousehold.dataYear) &&
      year <= matchedHousehold.dataYear
    ) {
      toast.error(
        `Data Year must be later than the loaded prior household (${matchedHousehold.dataYear}). Use "Change Prior Household" to encode an earlier year.`,
      );
      return;
    }

    if (currentStep === 2 && headRetention === DECEASED) {
      setFormWarning(
        "Changing Data Year while the prior head is marked Deceased will reset the head's retention. Please review the successor selection after switching.",
      );
    }

    // Snapshot everyone before and after so the encoder is told exactly what
    // the year change did, rather than silently moving ages around.
    const before = [
      snapshotPerson(head),
      ...members.map((m) => snapshotPerson(m)),
    ];
    const after = [
      snapshotPerson(applyPersonYear(head, year)),
      ...members.map((m) => snapshotPerson(applyPersonYear(m, year))),
    ];

    setHousehold((prev) => ({ ...prev, data_year: value }));
    setHead((prev) => applyPersonYear(prev, year));
    setMembers((prev) => prev.map((m) => applyPersonYear(m, year)));
    if (priorHeadForm) {
      setPriorHeadForm((prev) => (prev ? applyPersonYear(prev, year) : prev));
    }

    const summary = formatYearChangeSummary(
      summarizeYearChanges(before, after),
    );
    if (summary) toast.info(`Data Year ${year}: ${summary}.`);

    // Re-check whether the matched household already exists in the new year.
    if (verificationStatus === "matched" && matchedHousehold) {
      fetchHouseholdForYear({
        hNo: matchedHousehold.hNo,
        barangay: matchedHousehold.barangay,
        targetYear: year,
      })
        .then(({ rows }) => setCurrentYearMatch(rows.length || 0))
        .catch(() => setCurrentYearMatch(null));
    }
  };

  const resetForm = async () => {
    const confirmed = await confirm({
      title: "Clear all fields?",
      message:
        "Every household, head and member detail you have entered will be discarded. This cannot be undone.",
      details: ["Household number and barangay", "Head of household details", "All household members"],
      confirmLabel: "Clear all fields",
      cancelLabel: "Keep my entries",
      variant: "warning",
    });
    if (!confirmed) return;

    setHousehold(initialHousehold);
    setHead(initialHead);
    setMembers([]);
    setExpandedMemberIndex(-1);
    setFormWarning("");
    setVerificationStatus("idle");
    setMatchedHousehold(null);
    setPriorCandidates([]);
    setLookupNote("");
    setCurrentYearMatch(null);
    setLookupHhNo("");
    setLookupLastName("");
    setLookupFirstName("");
    setRetentionReviewed(false);
    setHeadRetention(RETAINED);
    setPriorHeadForm(null);
    setHeadIsSuccessor(false);
    setSuccessorChoice("");
    setIsVerifying(false);
    setCurrentStep(1);
  };

  // Derived values used by the Step 3 retention toolbar and Step 4 tracker.
  const retentionSummary = summarizeRetention(members);
  const activeMemberList = activeMembersOf(members);

  /**
   * Keeps a stored legacy value visible in a <select> even when it is not one
   * of the canonical options (e.g. a prior record holding "Owned").
   */
  const withLegacyValue = (options, value) =>
    value && !options.includes(value) ? [value, ...options] : options;

  return (
    <div className="dashboard-wrapper">
      <div className="bg-image" />
      <div className="overlay" />
      <Sidebar />

      <main className="content add-resident-content">
        <header className="main-header">
          <h1>Resident Registration Portal</h1>
          <UserProfileBadge />
        </header>

        <div className="step-wrapper">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} style={{ display: "contents" }}>
              <div
                className={`step ${currentStep === s ? "active" : ""} ${currentStep > s ? "done" : ""}`}
              >
                {currentStep > s ? "✓" : s}
              </div>
              {s < 4 && <div className="step-divider" />}
            </div>
          ))}
        </div>

        <div className="form-card-container">
          <div
            className="form-blue-header"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              textAlign: "center",
            }}
          >
            <h1 style={{ margin: 0, fontSize: "18px", textTransform: "none", letterSpacing: "0.4px", textAlign: "center" }}>
              {currentStep === 1
                ? "Step 1: Household & Location Details"
                : currentStep === 2
                  ? "Step 2: Household Head Profile"
                  : currentStep === 3
                    ? "Step 3: Family Members & Dependents"
                    : "Step 4: Summary & Verification Review"}
            </h1>

            <button
              type="button"
              className="btn-clear-fields"
              onClick={resetForm}
              disabled={isLoading}
              style={{
                position: "absolute",
                right: "24px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "1px solid rgba(255, 255, 255, 0.4)",
                color: "#ffffff",
                fontSize: "13px",
                fontWeight: "600",
                padding: "8px 16px",
                borderRadius: "8px",
                cursor: "pointer",
                textShadow: "0 1px 2px rgba(0,0,0,0.2)",
                transition: "background 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "none";
              }}
            >
              Clear Fields
            </button>
          </div>

          <div
            className={`form-white-body ${currentStep === 4 ? "step-4-static" : ""}`}
          >
            <form onSubmit={(e) => e.preventDefault()}>
              {formWarning && (
                <div className="form-warning">⚠ {formWarning}</div>
              )}

              {currentStep === 1 && (
                <div className="form-step animate-fade-up">
                  <h2 className="form-section-title">Data Year & Barangay</h2>
                  <div className="grid-4-cols">
                    <div className="field-group">
                      <label>Data Year</label>
                      <select
                        className="modern-select"
                        value={household.data_year}
                        onChange={handleDataYearChange}
                      >
                        {getDataYearOptions().map((y) => (
                          <option key={y} value={y}>
                            {y}
                            {y > currentYear() ? " (Upcoming)" : ""}
                          </option>
                        ))}
                      </select>
                      <span className="age-reference-note">
                        Ages and Senior / teenage-mother status are calculated{" "}
                        {describeAgeReference(selectedDataYear())}.
                      </span>
                    </div>
                    <div className="field-group">
                      <label>Barangay</label>
                      <select
                        className="modern-select"
                        value={household.brgy}
                        onChange={handleBrgyChange}
                      >
                        <option value="" disabled>
                          Select Barangay
                        </option>
                        {brgyStats.map((b) => (
                          <option key={b.name} value={b.name}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field-group">
                      <label>Municipality</label>
                      <input type="text" value="Bustos" readOnly />
                    </div>
                    <div className="field-group">
                      <label>Province</label>
                      <input type="text" value="Bulacan" readOnly />
                    </div>
                  </div>

                  {/* ── Prior Household Lookup & Member Retention ── */}
                  <div className="verification-box">
                    <div className="verification-header">
                      <i className="fa-solid fa-magnifying-glass" style={{ color: "#2563eb", fontSize: "15px" }}></i>
                      <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#1e293b" }}>
                        Prior Household Lookup
                      </h3>
                      <span style={{ fontSize: "11px", color: "#64748b", fontStyle: "italic" }}>
                        Carry an established household forward
                      </span>
                    </div>
                    <p style={{ fontSize: "12.5px", color: "#475569", margin: "8px 0 14px", lineHeight: 1.5 }}>
                      Search every Data Year <b>before {selectedDataYear()}</b> by{" "}
                      <b>Household No.</b> and/or the <b>prior head's name</b> (within the selected
                      barangay). Household numbers can be reused across years, so a match is always
                      confirmed before it is loaded.
                    </p>

                    {verificationStatus !== "matched" && verificationStatus !== "candidates" && (
                      <div className="lookup-fields">
                        <div className="field-group">
                          <label>Household No.</label>
                          <input
                            type="text"
                            placeholder="e.g. BM156"
                            value={lookupHhNo}
                            disabled={isVerifying}
                            onChange={(e) => setLookupHhNo(e.target.value)}
                          />
                        </div>
                        <div className="field-group">
                          <label>Prior Head — Last Name</label>
                          <input
                            type="text"
                            placeholder="e.g. Flores"
                            value={lookupLastName}
                            disabled={isVerifying}
                            onChange={(e) => setLookupLastName(e.target.value)}
                          />
                        </div>
                        <div className="field-group">
                          <label>First Name</label>
                          <input
                            type="text"
                            placeholder="e.g. Arthur"
                            value={lookupFirstName}
                            disabled={isVerifying}
                            onChange={(e) => setLookupFirstName(e.target.value)}
                          />
                        </div>
                        <div className="lookup-actions">
                          <button
                            type="button"
                            className="btn-verify-household"
                            onClick={handleSearchPriorHousehold}
                            disabled={isVerifying || !household.brgy}
                          >
                            {isVerifying ? (
                              <><i className="fa-solid fa-spinner fa-spin"></i> Searching...</>
                            ) : (
                              <><i className="fa-solid fa-magnifying-glass"></i> Search Prior Household</>
                            )}
                          </button>
                          <button
                            type="button"
                            className="btn-new-household"
                            onClick={startNewHousehold}
                            disabled={isVerifying || !household.brgy}
                          >
                            <i className="fa-solid fa-house-chimney-medical"></i> Register as New Household
                          </button>
                        </div>
                        {!household.brgy && (
                          <p style={{ fontSize: "11.5px", color: "#b45309", margin: "6px 0 0" }}>
                            Select a Barangay first — prior records are matched within a barangay.
                          </p>
                        )}
                      </div>
                    )}

                    {lookupNote && (
                      <p className="lookup-note">
                        <i className="fa-solid fa-circle-info"></i> {lookupNote}
                      </p>
                    )}

                    {verificationStatus === "candidates" && (
                      <div className="candidate-list">
                        <p className="candidate-list-title">
                          {priorCandidates.length} household-year record(s) match — household
                          numbers are reused, so pick the right one:
                        </p>
                        {priorCandidates.map((c) => (
                          <div className="candidate-card" key={c.key}>
                            <div className="candidate-info">
                              <strong className="candidate-hh">{c.hNo || "(no identifier)"}</strong>
                              <span className="candidate-head">{c.headName}</span>
                              <span className="candidate-meta">
                                Data Year {c.dataYear} · {c.memberCount} member(s)
                                {c.houseNo ? ` · ${c.houseNo}` : ""}
                                {c.street ? ` ${c.street}` : ""}
                                {c.purok ? ` · ${c.purok}` : ""}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="btn-use-candidate"
                              onClick={() => applyPriorCandidate(c)}
                              disabled={isVerifying}
                            >
                              Use this household
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="btn-text-link"
                          onClick={() => {
                            setPriorCandidates([]);
                            setVerificationStatus("idle");
                          }}
                        >
                          ← Back to search
                        </button>
                      </div>
                    )}

                    {verificationStatus === "matched" && matchedHousehold && (
                      <div className="verification-matched-card">
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                          <i className="fa-solid fa-circle-check" style={{ color: "#16a34a", fontSize: "18px" }}></i>
                          <div>
                            <strong style={{ color: "#166534" }}>Household Match Found!</strong>{" "}
                            <span className="badge-continuity">Identifier Retained</span>
                          </div>
                        </div>
                        <div className="matched-details-grid">
                          <div className="matched-detail-item">
                            <small>Household #</small>
                            <strong>{matchedHousehold.hNo}</strong>
                          </div>
                          <div className="matched-detail-item">
                            <small>Prior Head</small>
                            <strong>{matchedHousehold.headName}</strong>
                          </div>
                          <div className="matched-detail-item">
                            <small>Prior Data Year</small>
                            <strong>{matchedHousehold.dataYear}</strong>
                          </div>
                          <div className="matched-detail-item">
                            <small>Prior Records</small>
                            <strong>{matchedHousehold.memberCount}</strong>
                          </div>
                        </div>
                        {currentYearMatch > 0 && (
                          <div className="lookup-warning">
                            <i className="fa-solid fa-triangle-exclamation"></i>{" "}
                            {currentYearMatch} record(s) already exist for household{" "}
                            {matchedHousehold.hNo} in Data Year {household.data_year}. Edit those
                            records from the Household list instead of re-encoding them.
                          </div>
                        )}
                        <div className="matched-card-footer">
                          <span style={{ fontSize: "11.5px", color: "#166534", fontStyle: "italic" }}>
                            Head and {matchedHousehold.memberCount - 1} prior member record(s) were
                            loaded with ages recalculated for {household.data_year}.
                          </span>
                          <button type="button" className="btn-text-link" onClick={clearPriorMatch}>
                            Start over
                          </button>
                        </div>
                      </div>
                    )}

                    {verificationStatus === "new_household" && (
                      <div className="verification-new-card">
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <i className="fa-solid fa-house-chimney-medical" style={{ color: "#d97706", fontSize: "18px" }}></i>
                          <div>
                            <strong style={{ color: "#92400e" }}>No Prior-Year Record Found</strong>
                            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#78716c" }}>
                              This will be registered as a new household for Data Year {household.data_year}
                              {household.hh_num ? ` with Household No. ${household.hh_num}` : ""}.
                            </p>
                          </div>
                        </div>
                        <button type="button" className="btn-text-link" onClick={clearPriorMatch}>
                          ← Look up a prior household instead
                        </button>
                      </div>
                    )}
                  </div>

                  <h2 className="form-section-title">Household Information</h2>
                  <div className="grid-4-cols">
                    <div className="field-group">
                      <label>Household Number</label>
                      <input
                        type="text"
                        placeholder="e.g. BM156"
                        value={household.hh_num}
                        readOnly={verificationStatus === "matched"}
                        onChange={(e) =>
                          setHousehold({ ...household, hh_num: e.target.value })
                        }
                        style={verificationStatus === "matched" ? { backgroundColor: "#f0fdf4", border: "1px solid #86efac", cursor: "not-allowed" } : {}}
                      />
                      {verificationStatus === "matched" && (
                        <span style={{ fontSize: "10.5px", color: "#16a34a", fontWeight: 600 }}>
                          <i className="fa-solid fa-lock"></i> Locked — Continuity ID
                        </span>
                      )}
                    </div>
                    <div className="field-group">
                      <label>House Number</label>
                      <input
                        type="text"
                        placeholder="No."
                        value={household.house_no}
                        onChange={(e) =>
                          setHousehold({
                            ...household,
                            house_no: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="field-group">
                      <label>Street</label>
                      <input
                        type="text"
                        placeholder="Street Name"
                        value={household.street}
                        onChange={(e) =>
                          setHousehold({ ...household, street: e.target.value })
                        }
                      />
                    </div>
                    <div className="field-group">
                      <label>Purok / Sitio</label>
                      <input
                        type="text"
                        placeholder="Purok"
                        value={household.purok}
                        onChange={(e) =>
                          setHousehold({ ...household, purok: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <h2
                    className="form-section-title"
                    style={{ marginTop: "30px" }}
                  >
                    Resident Information
                  </h2>
                  <div className="grid-2-cols">
                    <div className="field-group">
                      <label>Type of Residence</label>
                      <select
                        className="modern-select"
                        value={household.residence_type}
                        onChange={(e) =>
                          setHousehold({
                            ...household,
                            residence_type: e.target.value,
                          })
                        }
                      >
                        {RESIDENCE_OPTIONS.map((option) => (
                          <option key={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                    {household.residence_type === "Other" && (
                      <div className="field-group animate-fade-in">
                        <label>Specify Residence Type</label>
                        <input
                          type="text"
                          placeholder="Specify..."
                          value={household.residence_type_other}
                          onChange={(e) =>
                            setHousehold({
                              ...household,
                              residence_type_other: e.target.value,
                            })
                          }
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="form-step animate-fade-up">
                  {verificationStatus === "matched" && matchedHousehold && (
                    <div className="matched-head-banner">
                      <i className="fa-solid fa-house" style={{ color: "#2563eb", fontSize: "15px" }}></i>
                      <span>
                        Encoding for established household <strong>{matchedHousehold.hNo}</strong> —
                        Prior head: <strong>{matchedHousehold.headName}</strong> ({matchedHousehold.dataYear})
                      </span>
                    </div>
                  )}

                  {/* ── Prior head retention & successor ── */}
                  {verificationStatus === "matched" && priorHeadForm && (
                    <div className="head-retention-box">
                      <div className="retention-box-title">
                        <i className="fa-solid fa-user-shield"></i>
                        Household Head for Data Year {household.data_year}
                        <span className="retention-from">
                          carried from {matchedHousehold?.dataYear}:{" "}
                          {formatResidentName({
                            first_name: priorHeadForm.fname,
                            middle_name: priorHeadForm.mname,
                            last_name: priorHeadForm.lname,
                            qualifier: priorHeadForm.q,
                          })}
                        </span>
                      </div>

                      <div className="retention-options">
                        {[RETAINED, DECEASED, MIGRATED].map((status) => (
                          <label
                            key={status}
                            className={`retention-chip ${status} ${headRetention === status ? "active" : ""}`}
                          >
                            <input
                              type="radio"
                              name="head_retention"
                              checked={headRetention === status}
                              onChange={() => handleHeadRetentionChange(status)}
                            />
                            {RETENTION_LABELS[status]}
                          </label>
                        ))}
                      </div>

                      {headRetention !== RETAINED && (
                        <div className="successor-box animate-fade-in">
                          <p className="successor-lead">
                            <i className="fa-solid fa-triangle-exclamation"></i>{" "}
                            The prior head will <b>not</b> be encoded as head for{" "}
                            {household.data_year} (status recorded in the transaction log). Choose a
                            successor:
                          </p>

                          <label
                            className={`successor-option ${successorChoice === "manual" ? "active" : ""}`}
                          >
                            <input
                              type="radio"
                              name="successor_choice"
                              checked={successorChoice === "manual"}
                              onChange={() => handleSuccessorChoice("manual")}
                            />
                            <span>
                              <strong>Enter a new household head manually</strong>
                              <small>Fill in the head profile below from scratch.</small>
                            </span>
                          </label>

                          {members.map((m, i) =>
                            m.source === "prior" && isMemberRetained(m) ? (
                              <label
                                key={`succ-${i}`}
                                className={`successor-option ${successorChoice === `member:${i}` ? "active" : ""}`}
                              >
                                <input
                                  type="radio"
                                  name="successor_choice"
                                  checked={successorChoice === `member:${i}`}
                                  onChange={() => handleSuccessorChoice(`member:${i}`)}
                                />
                                <span>
                                  <strong>
                                    {formatResidentName({
                                      first_name: m.fname,
                                      middle_name: m.mname,
                                      last_name: m.lname,
                                      qualifier: m.q,
                                    })}
                                  </strong>
                                  <small>
                                    Promote a retained member — currently {m.rel || "Member"}, age{" "}
                                    {m.age || "—"}.
                                  </small>
                                </span>
                              </label>
                            ) : null,
                          )}

                          {!headIsSuccessor && (
                            <p className="successor-required">
                              A successor is required before you can leave this step.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  <h2 className="form-section-title">
                    Household Head Information
                  </h2>

                  <div className="grid-4-cols">
                    <div className="field-group">
                      <label>Last Name</label>
                      <input
                        type="text"
                        value={head.lname}
                        onChange={(e) =>
                          setHead({ ...head, lname: e.target.value })
                        }
                      />
                      {head.lname && getNameError(head.lname) && (
                        <span style={{ color: "#ef4444", fontSize: "12px" }}>
                          ⚠ {getNameError(head.lname)}
                        </span>
                      )}
                    </div>
                    <div className="field-group">
                      <label>First Name</label>
                      <input
                        type="text"
                        value={head.fname}
                        onChange={(e) =>
                          setHead({ ...head, fname: e.target.value })
                        }
                      />
                      {head.fname && getNameError(head.fname) && (
                        <span style={{ color: "#ef4444", fontSize: "12px" }}>
                          ⚠ {getNameError(head.fname)}
                        </span>
                      )}
                    </div>
                    <div className="field-group">
                      <label>Middle Name</label>
                      <input
                        type="text"
                        value={head.mname}
                        onChange={(e) =>
                          setHead({ ...head, mname: e.target.value })
                        }
                      />
                      {head.mname && getNameError(head.mname) && (
                        <span style={{ color: "#ef4444", fontSize: "12px" }}>
                          ⚠ {getNameError(head.mname)}
                        </span>
                      )}
                    </div>
                    <div className="field-group">
                      <label>Name Extension</label>
                      <select
                        className="modern-select"
                        value={head.q}
                        onChange={(e) =>
                          setHead({ ...head, q: e.target.value })
                        }
                      >
                        <option value="">None</option>
                        <option>JR.</option>
                        <option>SR.</option>
                        <option>III</option>
                        <option>IV</option>
                        <option>V</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid-4-cols" style={{ marginTop: "15px" }}>
                    <div className="field-group">
                      <label>Place of Birth</label>
                      <input
                        type="text"
                        value={head.pob}
                        onChange={(e) =>
                          setHead({ ...head, pob: e.target.value })
                        }
                      />
                    </div>
                    <div className="field-group">
                      <label>Date of Birth</label>
                      <input
                        type="date"
                        value={head.dob}
                        onChange={(e) => handleHeadDobChange(e.target.value)}
                      />
                    </div>
                    <div className="field-group">
                      <label>Age</label>
                      <input
                        type="number"
                        placeholder={head.dob ? "Calculated" : "Enter estimated age"}
                        value={head.age}
                        readOnly={Boolean(head.dob)}
                        className={head.dob ? "age-auto-input" : ""}
                        onChange={(e) => handleHeadAgeChange(e.target.value)}
                      />
                      {head.dob ? (
                        <span className="auto-classified-badge">
                          <i className="fa-solid fa-lock"></i> Derived from birth
                          date · {describeAgeReference(selectedDataYear())}
                        </span>
                      ) : (
                        <span className="age-reference-note estimated">
                          Estimated — no birth date on file. Anchored to Data Year{" "}
                          {selectedDataYear()}.
                        </span>
                      )}
                    </div>
                    <div className="field-group">
                      <label>Gender</label>
                      <select
                        className="modern-select"
                        value={head.sex}
                        onChange={(e) => handleHeadSexChange(e.target.value)}
                      >
                        <option>Male</option>
                        <option>Female</option>
                        <option>LGBTQ+</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid-4-cols" style={{ marginTop: "15px" }}>
                    <div className="field-group">
                      <label>Civil Status</label>
                      <select
                        className="modern-select"
                        value={head.civil}
                        onChange={(e) =>
                          setHead({ ...head, civil: e.target.value })
                        }
                      >
                        {withLegacyValue(CIVIL_STATUS_OPTIONS, head.civil).map(
                          (option) => (
                            <option key={option}>{option}</option>
                          ),
                        )}
                      </select>
                    </div>
                    <div className="field-group">
                      <label>Religion</label>
                      <input
                        type="text"
                        placeholder="e.g. Roman Catholic"
                        value={head.religion}
                        onChange={(e) =>
                          setHead({ ...head, religion: e.target.value })
                        }
                      />
                    </div>
                    <div className="field-group">
                      <label>Citizenship</label>
                      <input
                        type="text"
                        value={head.citizenship}
                        onChange={(e) =>
                          setHead({ ...head, citizenship: e.target.value })
                        }
                      />
                    </div>
                    <div className="field-group">
                      <label>Educational Attainment</label>
                      <select
                        className="modern-select"
                        value={head.edu}
                        onChange={(e) =>
                          setHead({ ...head, edu: e.target.value })
                        }
                      >
                        <option value="" disabled>
                          Select Education
                        </option>
                        {withLegacyValue(EDUCATION_OPTIONS, head.edu).map(
                          (option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ),
                        )}
                      </select>
                    </div>
                  </div>

                  <div className="grid-3-cols" style={{ marginTop: "15px" }}>
                    <div className="field-group">
                      <label>Occupation</label>
                      <input
                        type="text"
                        placeholder="e.g. Teacher"
                        value={head.occupation}
                        onChange={(e) =>
                          setHead({ ...head, occupation: e.target.value })
                        }
                      />
                    </div>
                    <div className="field-group">
                      <label>Voter Information</label>
                      <select
                        className="modern-select"
                        value={head.is_voter}
                        onChange={(e) =>
                          setHead({ ...head, is_voter: e.target.value })
                        }
                      >
                        {withLegacyValue(VOTER_OPTIONS, head.is_voter).map(
                          (option) => (
                            <option key={option}>{option}</option>
                          ),
                        )}
                      </select>
                    </div>
                    <div className="field-group">
                      <label>4Ps Beneficiary</label>
                      <select
                        className="modern-select"
                        value={head.is_4ps ? "Yes" : "No"}
                        onChange={(e) =>
                          setHead({ ...head, is_4ps: e.target.value === "Yes" })
                        }
                      >
                        <option value="No">No</option>
                        <option value="Yes">Yes</option>
                      </select>
                    </div>
                  </div>

                  {/* Special Classification Grid */}
                  <div className="classification-box">
                    <p className="classification-title">
                      Special Classification & ID Status
                    </p>
                    <div className="classification-grid">
                      {/* PWD Card */}
                      <div
                        className={`classification-card ${head.is_pwd ? "active" : ""}`}
                      >
                        <div className="class-header">
                          <label className="checkbox-container">
                            <input
                              type="checkbox"
                              checked={head.is_pwd}
                              onChange={(e) =>
                                handleHeadClassification(
                                  "is_pwd",
                                  e.target.checked,
                                )
                              }
                            />
                            <span className="class-label">
                              Person with Disability (PWD)
                            </span>
                          </label>
                        </div>
                        {head.is_pwd && (
                          <div className="id-options animate-fade-in">
                            <label className="radio-container">
                              <input
                                type="radio"
                                name="head_pwd_id"
                                checked={head.has_pwd_id === true}
                                onChange={() =>
                                  setHead({ ...head, has_pwd_id: true })
                                }
                              />
                              <span>Has PWD ID</span>
                            </label>
                            <label className="radio-container">
                              <input
                                type="radio"
                                name="head_pwd_id"
                                checked={head.has_pwd_id === false}
                                onChange={() =>
                                  setHead({ ...head, has_pwd_id: false })
                                }
                              />
                              <span>No ID</span>
                            </label>
                          </div>
                        )}
                      </div>

                      {/* Senior Citizen Card — derived automatically from the
                          calculated age (60 and above); no manual override. */}
                      <div
                        className={`classification-card ${head.is_senior ? "active" : ""} ${!hasKnownAge(head) ? "disabled" : ""}`}
                      >
                        <div className="class-header">
                          <label className="checkbox-container">
                            <input
                              type="checkbox"
                              checked={head.is_senior}
                              disabled
                            />
                            <span className="class-label">Senior Citizen</span>
                          </label>
                          <span
                            className="auto-classified-tag"
                            title="Set automatically from the calculated age."
                          >
                            <i className="fa-solid fa-wand-magic-sparkles"></i> Auto
                          </span>
                        </div>
                        {hasKnownAge(head) ? (
                          <span className="auto-classified-note">
                            Age {head.age} {describeAgeReference(selectedDataYear())} —
                            classified automatically at 60 and above.
                          </span>
                        ) : (
                          <span className="auto-classified-note muted">
                            Enter a birth date or an age to classify.
                          </span>
                        )}
                        {head.is_senior && (
                          <div className="id-options animate-fade-in">
                            <label className="radio-container">
                              <input
                                type="radio"
                                name="head_senior_id"
                                checked={head.has_senior_id === true}
                                onChange={() =>
                                  setHead({
                                    ...head,
                                    senior_id_reported: true,
                                    has_senior_id: true,
                                  })
                                }
                              />
                              <span>Has Senior Citizen ID</span>
                            </label>
                            <label className="radio-container">
                              <input
                                type="radio"
                                name="head_senior_id"
                                checked={head.has_senior_id === false}
                                onChange={() =>
                                  setHead({
                                    ...head,
                                    senior_id_reported: false,
                                    has_senior_id: false,
                                  })
                                }
                              />
                              <span>No ID</span>
                            </label>
                          </div>
                        )}
                      </div>

                      {/* Solo Parent Card */}
                      <div
                        className={`classification-card ${head.is_solo_parent ? "active" : ""}`}
                      >
                        <div className="class-header">
                          <label className="checkbox-container">
                            <input
                              type="checkbox"
                              checked={head.is_solo_parent}
                              onChange={(e) =>
                                handleHeadClassification(
                                  "is_solo_parent",
                                  e.target.checked,
                                )
                              }
                            />
                            <span className="class-label">Solo Parent</span>
                          </label>
                        </div>
                        {head.is_solo_parent && (
                          <div className="id-options animate-fade-in">
                            <label className="radio-container">
                              <input
                                type="radio"
                                name="head_solo_id"
                                checked={head.has_solo_parent_id === true}
                                onChange={() =>
                                  setHead({ ...head, has_solo_parent_id: true })
                                }
                              />
                              <span>Has Solo Parent ID</span>
                            </label>
                            <label className="radio-container">
                              <input
                                type="radio"
                                name="head_solo_id"
                                checked={head.has_solo_parent_id === false}
                                onChange={() =>
                                  setHead({
                                    ...head,
                                    has_solo_parent_id: false,
                                  })
                                }
                              />
                              <span>No ID</span>
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Age-aware pregnancy classification */}
                  <PregnancyClassificationSection
                    person={head}
                    title="Household Head"
                    onAgeFirstBirthChange={handleHeadAgeFirstBirthChange}
                    onTeenagePregnancyChange={(checked) =>
                      setHead((prev) => ({
                        ...prev,
                        teenage_pregnancy: checked,
                      }))
                    }
                    onTeenMotherChange={handleHeadTeenMotherChange}
                    onChildPregnancyChange={handleHeadChildPregnancyChange}
                  />

                  <div className="field-group" style={{ marginTop: "18px" }}>
                    <label>Services/Program Attended:</label>
                    <AttendanceCheckboxes
                      groups={attendanceGroups}
                      selected={head.attended_items}
                      onChange={(attended_items) =>
                        setHead({ ...head, attended_items })
                      }
                      loading={attendanceLoading}
                      error={attendanceError}
                      onRetry={loadAttendanceCatalog}
                    />
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="form-step animate-fade-up">
                  <h2 className="form-section-title">Household Members</h2>

                  {/* ── Retention toolbar (prior household matched) ── */}
                  {verificationStatus === "matched" && (
                    <div className={`retention-toolbar ${retentionReviewed ? "confirmed" : ""}`}>
                      <div className="retention-summary">
                        <span className="retention-pill retained">
                          <b>{retentionSummary.retained}</b> retained
                        </span>
                        {retentionSummary.deceased > 0 && (
                          <span className="retention-pill deceased">
                            <b>{retentionSummary.deceased}</b> deceased
                          </span>
                        )}
                        {retentionSummary.migrated > 0 && (
                          <span className="retention-pill migrated">
                            <b>{retentionSummary.migrated}</b> migrated
                          </span>
                        )}
                        {retentionSummary.promoted > 0 && (
                          <span className="retention-pill promoted">
                            <b>{retentionSummary.promoted}</b> promoted to head
                          </span>
                        )}
                        {retentionSummary.added > 0 && (
                          <span className="retention-pill added">
                            <b>{retentionSummary.added}</b> newly added
                          </span>
                        )}
                      </div>
                      <div className="retention-actions">
                        <button type="button" className="btn-retain-all" onClick={retainAllMembers}>
                          <i className="fa-solid fa-people-roof"></i> Keep all prior members
                        </button>
                        <button
                          type="button"
                          className={`btn-confirm-roster ${retentionReviewed ? "done" : ""}`}
                          onClick={confirmRosterReviewed}
                        >
                          {retentionReviewed ? (
                            <><i className="fa-solid fa-circle-check"></i> Roster confirmed</>
                          ) : (
                            "Confirm roster"
                          )}
                        </button>
                      </div>
                      <p className="retention-hint">
                        Prior members from {matchedHousehold?.dataYear} carry a status —{" "}
                        <b>Retained</b> members are saved for {household.data_year};{" "}
                        <b>Deceased</b> and <b>Migrated</b> members are excluded and only recorded
                        in the transaction log. Programs/seminars attended are not carried forward.
                      </p>
                    </div>
                  )}

                  {members.length === 0 ? (
                    <div
                      className="empty-members-state"
                      style={{
                        textAlign: "center",
                        padding: "40px 20px",
                        background: "#f8fafc",
                        borderRadius: "8px",
                        border: "2px dashed #cbd5e1",
                        marginBottom: "20px",
                      }}
                    >
                      <p
                        style={{
                          color: "#64748b",
                          fontSize: "14px",
                          fontWeight: "500",
                        }}
                      >
                        No household members added yet. Click the button below
                        to add family members.
                      </p>
                    </div>
                  ) : (
                    <div
                      className="members-cards-container"
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "20px",
                        marginBottom: "20px",
                      }}
                    >
                      {members.map((m, i) => {
                        const isExpanded = expandedMemberIndex === i;
                        const fullName =
                          formatResidentName({
                            first_name: m.fname,
                            middle_name: m.mname,
                            last_name: m.lname,
                            qualifier: m.q,
                          }) || `Member ${i + 1}`;

                        return (
                          <div
                            key={i}
                            className={`member-card ${isExpanded ? "expanded" : ""} ${
                              m.source === "prior"
                                ? `prior-member ${m.promotedToHead ? "promoted" : m.retentionStatus}`
                                : "new-member"
                            }`}
                            style={{
                              border: "1px solid #e2e8f0",
                              borderRadius: "12px",
                              background: "white",
                              overflow: "hidden",
                              boxShadow: "0 2px 5px rgba(0,0,0,0.02)",
                            }}
                          >
                            <div
                              className="member-card-header"
                              onClick={() =>
                                setExpandedMemberIndex(isExpanded ? -1 : i)
                              }
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "16px 20px",
                                background: isExpanded ? "#f1f5f9" : "#f8fafc",
                                borderBottom: isExpanded
                                  ? "1px solid #e2e8f0"
                                  : "none",
                                cursor: "pointer",
                                transition: "background-color 0.2s",
                              }}
                            >
                              <div
                                className="member-card-title"
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "10px",
                                }}
                              >
                                <span
                                  className="member-number"
                                  style={{
                                    background: "#3b82f6",
                                    color: "white",
                                    fontWeight: "bold",
                                    fontSize: "11px",
                                    width: "22px",
                                    height: "22px",
                                    borderRadius: "50%",
                                    display: "flex",
                                    alignItems: "center",
                                    justifySelf: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  {i + 1}
                                </span>
                                <span
                                  className="member-name"
                                  style={{
                                    fontWeight: "700",
                                    fontSize: "14px",
                                    color: "#1e293b",
                                  }}
                                >
                                  {fullName} {m.rel ? `(${m.rel})` : ""}
                                </span>
                                {m.source === "prior" && (
                                  <span className={`member-source-badge ${m.promotedToHead ? "promoted" : m.retentionStatus}`}>
                                    {m.promotedToHead
                                      ? "Successor head"
                                      : `Prior ${m.priorDataYear}`}
                                  </span>
                                )}
                                {m.source === "new" && verificationStatus === "matched" && (
                                  <span className="member-source-badge added">New</span>
                                )}
                                {m.ageEstimated && (
                                  <span
                                    className="member-source-badge estimated"
                                    title="Age estimated from the prior record — no birth date on file"
                                  >
                                    Age est.
                                  </span>
                                )}
                              </div>
                              <div
                                className="member-card-actions"
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  display: "flex",
                                  gap: "10px",
                                  alignItems: "center",
                                  flexWrap: "wrap",
                                  justifyContent: "flex-end",
                                }}
                              >
                                {m.source === "prior" && !m.promotedToHead && (
                                  <div className="member-retention-group">
                                    {[RETAINED, DECEASED, MIGRATED].map((status) => (
                                      <button
                                        key={status}
                                        type="button"
                                        className={`member-retention-btn ${status} ${
                                          m.retentionStatus === status ? "active" : ""
                                        }`}
                                        title={`Mark this prior member as ${RETENTION_LABELS[status]}`}
                                        onClick={() => updateMemberStatus(i, status)}
                                      >
                                        {RETENTION_LABELS[status]}
                                      </button>
                                    ))}
                                  </div>
                                )}
                                <button
                                  type="button"
                                  className="btn-toggle-expand"
                                  onClick={() =>
                                    setExpandedMemberIndex(isExpanded ? -1 : i)
                                  }
                                  style={{
                                    background: "none",
                                    border: "none",
                                    color: "#3b82f6",
                                    fontSize: "12px",
                                    fontWeight: "600",
                                    cursor: "pointer",
                                    padding: "5px",
                                  }}
                                >
                                  {isExpanded
                                    ? "Collapse ▲"
                                    : "Expand / Edit ▼"}
                                </button>
                                {m.source !== "prior" && (
                                  <button
                                    type="button"
                                    className="btn-remove-member"
                                    onClick={() => removeMember(i)}
                                    style={{
                                      color: "#ef4444",
                                      background: "none",
                                      border: "none",
                                      fontSize: "12px",
                                      fontWeight: "600",
                                      textDecoration: "underline",
                                      cursor: "pointer",
                                      padding: "5px",
                                    }}
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            </div>

                            {isExpanded && (
                              <div
                                className="member-card-body animate-slide-down"
                                style={{
                                  padding: "24px 20px",
                                  background: "white",
                                }}
                              >
                                {m.source === "prior" &&
                                  !m.promotedToHead &&
                                  m.retentionStatus !== RETAINED && (
                                    <div className="member-excluded-note">
                                      <i className="fa-solid fa-ban"></i>{" "}
                                      Marked <b>{RETENTION_LABELS[m.retentionStatus]}</b> — this
                                      record is kept for reference and will{" "}
                                      <b>not</b> be saved for Data Year {household.data_year}. It is
                                      only recorded in the transaction log.
                                    </div>
                                  )}
                                <div className="grid-4-cols">
                                  <div className="field-group">
                                    <label>Last Name</label>
                                    <input
                                      type="text"
                                      value={m.lname}
                                      onChange={(e) =>
                                        updateMember(i, "lname", e.target.value)
                                      }
                                    />
                                    {m.lname && getNameError(m.lname) && (
                                      <span
                                        style={{
                                          color: "#ef4444",
                                          fontSize: "12px",
                                        }}
                                      >
                                        ⚠ {getNameError(m.lname)}
                                      </span>
                                    )}
                                  </div>
                                  <div className="field-group">
                                    <label>First Name</label>
                                    <input
                                      type="text"
                                      value={m.fname}
                                      onChange={(e) =>
                                        updateMember(i, "fname", e.target.value)
                                      }
                                    />
                                    {m.fname && getNameError(m.fname) && (
                                      <span
                                        style={{
                                          color: "#ef4444",
                                          fontSize: "12px",
                                        }}
                                      >
                                        ⚠ {getNameError(m.fname)}
                                      </span>
                                    )}
                                  </div>
                                  <div className="field-group">
                                    <label>Middle Name</label>
                                    <input
                                      type="text"
                                      value={m.mname}
                                      onChange={(e) =>
                                        updateMember(i, "mname", e.target.value)
                                      }
                                    />
                                    {m.mname && getNameError(m.mname) && (
                                      <span
                                        style={{
                                          color: "#ef4444",
                                          fontSize: "12px",
                                        }}
                                      >
                                        ⚠ {getNameError(m.mname)}
                                      </span>
                                    )}
                                  </div>
                                  <div className="field-group">
                                    <label>Name Extension</label>
                                    <select
                                      className="modern-select"
                                      value={m.q}
                                      onChange={(e) =>
                                        updateMember(i, "q", e.target.value)
                                      }
                                    >
                                      <option value="">None</option>
                                      <option>JR.</option>
                                      <option>SR.</option>
                                      <option>III</option>
                                      <option>IV</option>
                                      <option>V</option>
                                    </select>
                                  </div>
                                </div>

                                <div
                                  className="grid-4-cols"
                                  style={{ marginTop: "15px" }}
                                >
                                  <div className="field-group">
                                    <label>Relationship to Head</label>
                                    <input
                                      type="text"
                                      placeholder="e.g. Spouse / Son / Daughter"
                                      value={m.rel}
                                      onChange={(e) =>
                                        updateMember(i, "rel", e.target.value)
                                      }
                                    />
                                  </div>
                                  <div className="field-group">
                                    <label>Place of Birth</label>
                                    <input
                                      type="text"
                                      value={m.pob}
                                      onChange={(e) =>
                                        updateMember(i, "pob", e.target.value)
                                      }
                                    />
                                  </div>
                                  <div className="field-group">
                                    <label>Date of Birth</label>
                                    <input
                                      type="date"
                                      value={m.dob}
                                      onChange={(e) =>
                                        handleMemberDobChange(i, e.target.value)
                                      }
                                    />
                                  </div>
                                  <div className="field-group">
                                    <label>Age</label>
                                    <input
                                      type="number"
                                      placeholder={
                                        m.dob
                                          ? "Calculated"
                                          : "Enter estimated age"
                                      }
                                      value={m.age}
                                      readOnly={Boolean(m.dob)}
                                      className={m.dob ? "age-auto-input" : ""}
                                      onChange={(e) =>
                                        handleMemberAgeChange(i, e.target.value)
                                      }
                                    />
                                    {m.dob ? (
                                      <span className="auto-classified-badge">
                                        <i className="fa-solid fa-lock"></i>{" "}
                                        Derived from birth date ·{" "}
                                        {describeAgeReference(
                                          selectedDataYear(),
                                        )}
                                      </span>
                                    ) : (
                                      <span className="age-reference-note estimated">
                                        Estimated — no birth date on file.
                                        Anchored to Data Year{" "}
                                        {selectedDataYear()}.
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div
                                  className="grid-4-cols"
                                  style={{ marginTop: "15px" }}
                                >
                                  <div className="field-group">
                                    <label>Gender</label>
                                    <select
                                      className="modern-select"
                                      value={m.sex}
                                      onChange={(e) =>
                                        handleMemberSexChange(i, e.target.value)
                                      }
                                    >
                                      <option>Male</option>
                                      <option>Female</option>
                                      <option>LGBTQ+</option>
                                    </select>
                                  </div>
                                  <div className="field-group">
                                    <label>Civil Status</label>
                                    <select
                                      className="modern-select"
                                      value={m.civil}
                                      onChange={(e) =>
                                        updateMember(i, "civil", e.target.value)
                                      }
                                    >
                                      {withLegacyValue(
                                        CIVIL_STATUS_OPTIONS,
                                        m.civil,
                                      ).map((option) => (
                                        <option key={option}>{option}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="field-group">
                                    <label>Religion</label>
                                    <input
                                      type="text"
                                      placeholder="e.g. Roman Catholic"
                                      value={m.religion}
                                      onChange={(e) =>
                                        updateMember(
                                          i,
                                          "religion",
                                          e.target.value,
                                        )
                                      }
                                    />
                                  </div>
                                  <div className="field-group">
                                    <label>Citizenship</label>
                                    <input
                                      type="text"
                                      value={m.citizenship}
                                      onChange={(e) =>
                                        updateMember(
                                          i,
                                          "citizenship",
                                          e.target.value,
                                        )
                                      }
                                    />
                                  </div>
                                </div>

                                <div
                                  className="grid-4-cols"
                                  style={{ marginTop: "15px" }}
                                >
                                  <div className="field-group">
                                    <label>Educational Attainment</label>
                                    <select
                                      className="modern-select"
                                      value={m.edu}
                                      onChange={(e) =>
                                        updateMember(i, "edu", e.target.value)
                                      }
                                    >
                                      <option value="" disabled>
                                        Select Education
                                      </option>
                                      {withLegacyValue(
                                        EDUCATION_OPTIONS,
                                        m.edu,
                                      ).map((option) => (
                                        <option key={option} value={option}>
                                          {option}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="field-group">
                                    <label>Occupation</label>
                                    <input
                                      type="text"
                                      placeholder="e.g. Student"
                                      value={m.occupation}
                                      onChange={(e) =>
                                        updateMember(
                                          i,
                                          "occupation",
                                          e.target.value,
                                        )
                                      }
                                    />
                                  </div>
                                  <div className="field-group">
                                    <label>Voter Information</label>
                                    <select
                                      className="modern-select"
                                      value={m.is_voter}
                                      onChange={(e) =>
                                        updateMember(
                                          i,
                                          "is_voter",
                                          e.target.value,
                                        )
                                      }
                                    >
                                      {withLegacyValue(
                                        VOTER_OPTIONS,
                                        m.is_voter,
                                      ).map((option) => (
                                        <option key={option}>{option}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="field-group">
                                    <label>4Ps Beneficiary</label>
                                    <select
                                      className="modern-select"
                                      value={m.is_4ps ? "Yes" : "No"}
                                      onChange={(e) =>
                                        updateMember(
                                          i,
                                          "is_4ps",
                                          e.target.value === "Yes",
                                        )
                                      }
                                    >
                                      <option value="No">No</option>
                                      <option value="Yes">Yes</option>
                                    </select>
                                  </div>
                                </div>

                                {/* Special Classification */}
                                <div className="classification-box">
                                  <p className="classification-title">
                                    Special Classification & ID Status
                                  </p>
                                  <div className="classification-grid">
                                    {/* PWD Card */}
                                    <div
                                      className={`classification-card ${m.is_pwd ? "active" : ""}`}
                                    >
                                      <div className="class-header">
                                        <label className="checkbox-container">
                                          <input
                                            type="checkbox"
                                            checked={m.is_pwd}
                                            onChange={(e) =>
                                              updateMemberClassification(
                                                i,
                                                "is_pwd",
                                                e.target.checked,
                                              )
                                            }
                                          />
                                          <span className="class-label">
                                            Person with Disability (PWD)
                                          </span>
                                        </label>
                                      </div>
                                      {m.is_pwd && (
                                        <div className="id-options animate-fade-in">
                                          <label className="radio-container">
                                            <input
                                              type="radio"
                                              name={`member_${i}_pwd_id`}
                                              checked={m.has_pwd_id === true}
                                              onChange={() =>
                                                updateMember(
                                                  i,
                                                  "has_pwd_id",
                                                  true,
                                                )
                                              }
                                            />
                                            <span>Has PWD ID</span>
                                          </label>
                                          <label className="radio-container">
                                            <input
                                              type="radio"
                                              name={`member_${i}_pwd_id`}
                                              checked={m.has_pwd_id === false}
                                              onChange={() =>
                                                updateMember(
                                                  i,
                                                  "has_pwd_id",
                                                  false,
                                                )
                                              }
                                            />
                                            <span>No ID</span>
                                          </label>
                                        </div>
                                      )}
                                    </div>

                                    {/* Senior Citizen Card — derived
                                        automatically from the calculated age */}
                                    <div
                                      className={`classification-card ${m.is_senior ? "active" : ""} ${!hasKnownAge(m) ? "disabled" : ""}`}
                                    >
                                      <div className="class-header">
                                        <label className="checkbox-container">
                                          <input
                                            type="checkbox"
                                            checked={m.is_senior}
                                            disabled
                                          />
                                          <span className="class-label">
                                            Senior Citizen
                                          </span>
                                        </label>
                                        <span
                                          className="auto-classified-tag"
                                          title="Set automatically from the calculated age."
                                        >
                                          <i className="fa-solid fa-wand-magic-sparkles"></i>{" "}
                                          Auto
                                        </span>
                                      </div>
                                      {hasKnownAge(m) ? (
                                        <span className="auto-classified-note">
                                          Age {m.age}{" "}
                                          {describeAgeReference(
                                            selectedDataYear(),
                                          )}{" "}
                                          — classified automatically at 60 and
                                          above.
                                        </span>
                                      ) : (
                                        <span className="auto-classified-note muted">
                                          Enter a birth date or an age to
                                          classify.
                                        </span>
                                      )}
                                      {m.is_senior && (
                                        <div className="id-options animate-fade-in">
                                          <label className="radio-container">
                                            <input
                                              type="radio"
                                              name={`member_${i}_senior_id`}
                                              checked={m.has_senior_id === true}
                                              onChange={() =>
                                                updateMember(i, {
                                                  senior_id_reported: true,
                                                  has_senior_id: true,
                                                })
                                              }
                                            />
                                            <span>Has Senior ID</span>
                                          </label>
                                          <label className="radio-container">
                                            <input
                                              type="radio"
                                              name={`member_${i}_senior_id`}
                                              checked={
                                                m.has_senior_id === false
                                              }
                                              onChange={() =>
                                                updateMember(i, {
                                                  senior_id_reported: false,
                                                  has_senior_id: false,
                                                })
                                              }
                                            />
                                            <span>No ID</span>
                                          </label>
                                        </div>
                                      )}
                                    </div>

                                    {/* Solo Parent Card */}
                                    <div
                                      className={`classification-card ${m.is_solo_parent ? "active" : ""}`}
                                    >
                                      <div className="class-header">
                                        <label className="checkbox-container">
                                          <input
                                            type="checkbox"
                                            checked={m.is_solo_parent}
                                            onChange={(e) =>
                                              updateMemberClassification(
                                                i,
                                                "is_solo_parent",
                                                e.target.checked,
                                              )
                                            }
                                          />
                                          <span className="class-label">
                                            Solo Parent
                                          </span>
                                        </label>
                                      </div>
                                      {m.is_solo_parent && (
                                        <div className="id-options animate-fade-in">
                                          <label className="radio-container">
                                            <input
                                              type="radio"
                                              name={`member_${i}_solo_id`}
                                              checked={
                                                m.has_solo_parent_id === true
                                              }
                                              onChange={() =>
                                                updateMember(
                                                  i,
                                                  "has_solo_parent_id",
                                                  true,
                                                )
                                              }
                                            />
                                            <span>Has Solo Parent ID</span>
                                          </label>
                                          <label className="radio-container">
                                            <input
                                              type="radio"
                                              name={`member_${i}_solo_id`}
                                              checked={
                                                m.has_solo_parent_id === false
                                              }
                                              onChange={() =>
                                                updateMember(
                                                  i,
                                                  "has_solo_parent_id",
                                                  false,
                                                )
                                              }
                                            />
                                            <span>No ID</span>
                                          </label>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Age-aware pregnancy classification */}
                                <PregnancyClassificationSection
                                  person={m}
                                  title="Household Member"
                                  style={{ marginTop: "15px" }}
                                  onAgeFirstBirthChange={(val) =>
                                    handleMemberAgeFirstBirthChange(i, val)
                                  }
                                  onTeenagePregnancyChange={(checked) =>
                                    updateMember(
                                      i,
                                      "teenage_pregnancy",
                                      checked,
                                    )
                                  }
                                  onTeenMotherChange={(checked) =>
                                    handleMemberTeenMotherChange(i, checked)
                                  }
                                  onChildPregnancyChange={(checked) =>
                                    handleMemberChildPregnancyChange(i, checked)
                                  }
                                />

                                <div className="field-group" style={{ marginTop: "18px" }}>
                                  <label>Services/Program Attended:</label>
                                  <AttendanceCheckboxes
                                    groups={attendanceGroups}
                                    selected={m.attended_items || []}
                                    onChange={(attended_items) =>
                                      updateMember(i, "attended_items", attended_items)
                                    }
                                    loading={attendanceLoading}
                                    error={attendanceError}
                                    onRetry={loadAttendanceCatalog}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div style={{ textAlign: "center", marginTop: "20px" }}>
                    <button
                      type="button"
                      className="btn-add-member"
                      onClick={addMember}
                    >
                      {verificationStatus === "matched"
                        ? "+ Add New Member"
                        : "+ Add Household Member"}
                    </button>
                    {verificationStatus === "matched" && (
                      <p style={{ fontSize: "11.5px", color: "#64748b", marginTop: "8px" }}>
                        Use this for people who joined the household after {matchedHousehold?.dataYear} —
                        prior records are carried over above.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {currentStep === 4 && (
                <div className="summary-area animate-fade-up">
                  {/* ── Incremental Population Tracker Banner ── */}
                  {verificationStatus === "matched" && matchedHousehold && (
                    <div className="increment-tracker-banner">
                      <h4 style={{ margin: "0 0 10px", fontSize: "14px", color: "#1e40af", display: "flex", alignItems: "center", gap: "6px" }}>
                        <i className="fa-solid fa-chart-column"></i> Retention & Incremental Population Tracker
                      </h4>
                      <div className="increment-tracker-stats">
                        <div className="increment-stat">
                          <small>Prior Year ({matchedHousehold.dataYear})</small>
                          <strong>{matchedHousehold.memberCount} record{matchedHousehold.memberCount !== 1 ? "s" : ""}</strong>
                        </div>
                        <div className="increment-stat">
                          <small>Carried Forward</small>
                          <strong>{retentionSummary.retained} retained</strong>
                        </div>
                        <div className="increment-stat">
                          <small>Not Carried Forward</small>
                          <strong>
                            {retentionSummary.excluded}
                            {retentionSummary.excluded > 0
                              ? ` (${retentionSummary.deceased} deceased / ${retentionSummary.migrated} migrated)`
                              : ""}
                          </strong>
                        </div>
                        <div className="increment-stat">
                          <small>Data Year {household.data_year}</small>
                          <strong>{1 + activeMemberList.length} member{(1 + activeMemberList.length) !== 1 ? "s" : ""}</strong>
                        </div>
                        <div className="increment-stat">
                          <small>Net Increment</small>
                          <span className="increment-badge-pill">
                            {1 + activeMemberList.length - matchedHousehold.memberCount >= 0 ? "+" : ""}
                            {1 + activeMemberList.length - matchedHousehold.memberCount}
                          </span>
                        </div>
                      </div>
                      {(retentionSummary.excluded > 0 || headIsSuccessor) && (
                        <ul className="increment-tracker-notes">
                          {retentionSummary.excluded > 0 && (
                            <li>
                              <b>Excluded from {household.data_year} (audit only):</b>{" "}
                              {members
                                .filter((m) => m.source === "prior" && !isMemberRetained(m))
                                .map(
                                  (m) =>
                                    `${formatResidentName({
                                      first_name: m.fname,
                                      middle_name: m.mname,
                                      last_name: m.lname,
                                      qualifier: m.q,
                                    })} — ${RETENTION_LABELS[m.retentionStatus]}`,
                                )
                                .join("; ")}
                            </li>
                          )}
                          {headIsSuccessor && priorHeadForm && (
                            <li>
                              <b>Head replaced:</b>{" "}
                              {formatResidentName({
                                first_name: priorHeadForm.fname,
                                middle_name: priorHeadForm.mname,
                                last_name: priorHeadForm.lname,
                                qualifier: priorHeadForm.q,
                              })}{" "}
                              ({RETENTION_LABELS[headRetention]}) →{" "}
                              {formatResidentName({
                                first_name: head.fname,
                                middle_name: head.mname,
                                last_name: head.lname,
                                qualifier: head.q,
                              })}
                            </li>
                          )}
                          <li>
                            Programs/seminars attended from prior years are not carried into{" "}
                            {household.data_year}.
                          </li>
                        </ul>
                      )}
                    </div>
                  )}
                  {verificationStatus === "new_household" && (
                    <div className="increment-tracker-banner" style={{ background: "linear-gradient(135deg, #fffbeb, #fef3c7)", borderColor: "#fbbf24" }}>
                      <h4 style={{ margin: "0 0 6px", fontSize: "14px", color: "#92400e", display: "flex", alignItems: "center", gap: "6px" }}>
                        <i className="fa-solid fa-house-chimney-medical"></i> New Household Entry
                      </h4>
                      <p style={{ margin: 0, fontSize: "12.5px", color: "#78716c" }}>
                        This household has no prior-year records. Registering <strong>{1 + activeMemberList.length}</strong> new member{(1 + activeMemberList.length) !== 1 ? "s" : ""} for Data Year {household.data_year}.
                      </p>
                    </div>
                  )}

                  <div className="summary-section">
                    <h3>Household Location & Residence</h3>
                    <div className="summary-grid">
                      <span>
                        <b>HH #:</b> {household.hh_num}
                        {verificationStatus === "matched" && (
                          <span style={{ marginLeft: "8px", fontSize: "10.5px", color: "#16a34a", fontWeight: 600 }}>
                            <i className="fa-solid fa-lock"></i> Continuity
                          </span>
                        )}
                      </span>
                      <span>
                        <b>Brgy:</b> {household.brgy}
                      </span>
                      <span>
                        <b>Address:</b> {household.house_no} {household.street},{" "}
                        {household.purok}
                      </span>
                      <span>
                        <b>Residence Type:</b>{" "}
                        {household.residence_type === "Other"
                          ? household.residence_type_other
                          : household.residence_type}
                      </span>
                      <span>
                        <b>Data Year:</b> {household.data_year}
                      </span>
                      <span>
                        <b>Lookup:</b>{" "}
                        {verificationStatus === "matched"
                          ? `Prior household ${matchedHousehold?.hNo} (${matchedHousehold?.dataYear}) matched`
                          : verificationStatus === "new_household"
                            ? "New Household (no prior-year record)"
                            : verificationStatus === "candidates"
                              ? "Candidate household not selected"
                              : "Not looked up"}
                      </span>
                      {verificationStatus === "matched" && (
                        <span>
                          <b>Roster:</b>{" "}
                          {retentionReviewed
                            ? `Confirmed — ${retentionSummary.retained} retained, ${retentionSummary.excluded} excluded`
                            : "Not confirmed"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="summary-section">
                    <h3>Head of Household</h3>
                    <div className="summary-grid">
                      <span>
                        <b>Name:</b> {head.lname}, {head.fname} {head.mname}{" "}
                        {head.q}
                      </span>
                      <span>
                        <b>Gender:</b> {head.sex}
                      </span>
                      <span>
                        <b>Civil Status:</b> {head.civil}
                      </span>
                      <span>
                        <b>DOB / Age:</b> {head.dob} ({head.age || "N/A"} yrs)
                      </span>
                      <span>
                        <b>Religion:</b> {head.religion || "N/A"}
                      </span>
                      <span>
                        <b>Citizenship:</b> {head.citizenship}
                      </span>
                      <span>
                        <b>Education:</b> {head.edu || "N/A"}
                      </span>
                      <span>
                        <b>Occupation:</b> {head.occupation || "N/A"}
                      </span>
                      <span>
                        <b>Voter Info:</b> {head.is_voter}
                      </span>
                      <span>
                        <b>4Ps Beneficiary:</b> {head.is_4ps ? "Yes" : "No"}
                      </span>
                      <span>
                        <b>Classification:</b>{" "}
                        {[
                          head.is_senior &&
                          `Senior Citizen (${head.has_senior_id ? "Has ID" : "No ID"})`,
                          head.is_pwd &&
                          `PWD (${head.has_pwd_id ? "Has ID" : "No ID"})`,
                          head.is_solo_parent &&
                          `Solo Parent (${head.has_solo_parent_id ? "Has ID" : "No ID"})`,
                        ]
                          .filter(Boolean)
                          .join(", ") || "Regular"}
                      </span>
                      {isFemaleSex(head.sex) && !head.child_pregnancy_case && (
                        <span>
                          <b>Pregnancy Classification:</b>{" "}
                          {head.age_first_birth
                            ? `First birth at ${head.age_first_birth} yrs ${head.teenage_pregnancy ? "(Teen Case)" : ""}${head.teenage_mother ? ", (Current Teenage Mother)" : ""}`
                            : "None"}
                        </span>
                      )}
                      {attendanceText(head.attended_items) && (
                        <span>
                          <b>Services/Program Attended:</b>{" "}
                          {attendanceText(head.attended_items)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="summary-section">
                    <h3>
                      Members to Save ({activeMemberList.length})
                      {retentionSummary.excluded > 0 &&
                        ` · ${retentionSummary.excluded} not carried forward`}
                    </h3>
                    {activeMemberList.length === 0 ? (
                      <p
                        style={{
                          fontSize: "13px",
                          color: "var(--gray-500)",
                          fontStyle: "italic",
                        }}
                      >
                        No additional household members registered.
                      </p>
                    ) : (
                      <div className="summary-table-wrapper">
                        <table className="summary-table">
                          <thead>
                            <tr>
                              <th>No.</th>
                              <th>Name</th>
                              <th>Relation</th>
                              <th>Source</th>
                              <th>Basic Details</th>
                              <th>Classification</th>
                              <th>Services/Program Attended</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeMemberList.map((m, i) => {
                              const mName = formatResidentName({
                                first_name: m.fname,
                                middle_name: m.mname,
                                last_name: m.lname,
                                qualifier: m.q,
                              });
                              const basicDetails = `${m.sex}, ${m.civil}, DOB: ${m.dob || "N/A"} (${m.age || "N/A"} yrs), Job: ${m.occupation || "N/A"}`;
                              const classList =
                                [
                                  m.is_senior &&
                                  `Senior Citizen (${m.has_senior_id ? "S" : "No ID"})`,
                                  m.is_pwd &&
                                  `PWD (${m.has_pwd_id ? "P" : "No ID"})`,
                                  m.is_solo_parent &&
                                  `Solo Parent (${m.has_solo_parent_id ? "SP" : "No ID"})`,
                                ]
                                  .filter(Boolean)
                                  .join(", ") || "Regular";

                              return (
                                <tr key={i}>
                                  <td>{i + 1}</td>
                                  <td>
                                    <b>{mName}</b>
                                  </td>
                                  <td>{m.rel}</td>
                                  <td>
                                    {m.source === "prior"
                                      ? `Carried from ${m.priorDataYear}`
                                      : "New"}
                                  </td>
                                  <td>{basicDetails}</td>
                                  <td>{classList}</td>
                                  <td>
                                    {attendanceText(m.attended_items) || "—"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {retentionSummary.excluded > 0 && (
                    <div className="summary-section excluded-section">
                      <h3>Not Carried Forward ({retentionSummary.excluded})</h3>
                      <div className="summary-table-wrapper">
                        <table className="summary-table">
                          <thead>
                            <tr>
                              <th>No.</th>
                              <th>Name</th>
                              <th>Prior Year</th>
                              <th>Status</th>
                              <th>Disposition</th>
                            </tr>
                          </thead>
                          <tbody>
                            {members
                              .filter((m) => m.source === "prior" && !isMemberRetained(m))
                              .map((m, i) => (
                                <tr key={`ex-${i}`}>
                                  <td>{i + 1}</td>
                                  <td>
                                    <b>
                                      {formatResidentName({
                                        first_name: m.fname,
                                        middle_name: m.mname,
                                        last_name: m.lname,
                                        qualifier: m.q,
                                      })}
                                    </b>
                                  </td>
                                  <td>{m.priorDataYear}</td>
                                  <td>
                                    <span className={`retention-pill ${m.retentionStatus}`}>
                                      {RETENTION_LABELS[m.retentionStatus]}
                                    </span>
                                  </td>
                                  <td>
                                    Excluded from {household.data_year} — prior record left
                                    unchanged, logged in the transaction history only.
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="form-nav-buttons">
                {/* <button
                  type="button"
                  className="btn-clear-fields"
                  onClick={resetForm}
                  disabled={isLoading}
                  style={{
                    background: "none",
                    border: "1px solid #cbd5e1",
                    color: "#64748b",
                    fontSize: "13px",
                    fontWeight: "600",
                    padding: "10px 18px",
                    borderRadius: "8px",
                    cursor: "pointer",
                  }}
                >
                  Clear Fields
                </button> */}

                <button
                  type="button"
                  className="btn-back"
                  onClick={() => handleStep(-1)}
                  style={{ display: currentStep === 1 ? "none" : undefined }}
                >
                  Previous
                </button>

                <button
                  type="button"
                  className={`btn-next ${isLoading ? "loading" : ""}`}
                  onClick={() => handleStep(1)}
                  disabled={isLoading}
                >
                  {isLoading
                    ? "Saving..."
                    : currentStep === 4
                      ? "Confirm & Submit"
                      : "Next"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
