import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import UserProfileBadge from "../components/UserProfileBadge";
import { brgyStats } from "../data/brgyData";
import { supabase } from "../lib/supabase";
import "../css/BarangayList.css";
import { logTransaction } from "../utils/logger";

export default function BarangayList({ defaultMode = "household" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const storedUser = sessionStorage.getItem("popdev_user") || localStorage.getItem("popdev_user");
  const userProfile = storedUser ? JSON.parse(storedUser) : null;
  const userRole = userProfile?.role || "Staff";
  const isStaff = userRole !== "Admin" && userRole !== "Administrator";
  const [activeBrgy, setActiveBrgy] = useState("Bonga Mayor");
  const [allRecords, setAllRecords] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [selectedYear, setSelectedYear] = useState(
    new Date().getFullYear().toString(),
  );

  useEffect(() => {
    async function fetchLatestYear() {
      try {
        const { data } = await supabase
          .from("residents")
          .select("data_year")
          .not("data_year", "is", null)
          .order("data_year", { ascending: false })
          .limit(1);

        if (data && data.length > 0 && data[0].data_year) {
          setSelectedYear(data[0].data_year.toString());
        }
      } catch (err) {
        console.error("Error fetching latest year:", err);
      }
    }
    fetchLatestYear();
  }, []);

  const [selectedHousehold, setSelectedHousehold] = useState(null);
  const [selectedResident, setSelectedResident] = useState(null);
  const [editingResident, setEditingResident] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editLoading, setEditLoading] = useState(false);

  // Archive Reason Modal state
  const [archiveModal, setArchiveModal] = useState({
    open: false,
    resident: null,
    reason: "",          // "deceased" | "relocated"
    adminPassword: "",
    isLoading: false,
    error: "",
  });

  const getInitialMode = () => {
    if (location.pathname === '/resident') return 'resident';
    if (location.pathname === '/household') return 'household';
    return searchParams.get('mode') || defaultMode || 'household';
  };

  const [viewMode, setViewMode] = useState(getInitialMode);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (location.pathname === '/resident') {
      setViewMode('resident');
    } else if (location.pathname === '/household') {
      setViewMode('household');
    } else {
      const mode = searchParams.get("mode");
      if (mode) setViewMode(mode);
    }
  }, [location.pathname, searchParams]);

  const handleModeToggle = (mode) => {
    setViewMode(mode);
    if (mode === "resident") {
      navigate("/resident");
    } else {
      navigate("/household");
    }
  };

  const handleRowClick = (res) => {
    if (viewMode === "household") {
      openHousehold(res.h_no, res.dataYear);
    } else {
      setSelectedResident(res);
    }
  };

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const itemsPerPage = 50;

  // Statically generated years for filter
  const currentYear = new Date().getFullYear();
  const availableYears = Array.from(
    { length: currentYear - 2019 },
    (_, i) => currentYear - i,
  );
  const isReadOnly = selectedYear !== "all" && Number(selectedYear) < currentYear;
  const isRecordPastYear = (rec) => {
    if (isReadOnly) return true;
    if (rec?.dataYear && Number(rec.dataYear) < currentYear) return true;
    return false;
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeBrgy, selectedYear]);

  useEffect(() => {
    fetchResidents();
  }, [activeBrgy, debouncedSearchQuery, selectedYear, currentPage]);

  const fetchResidents = async () => {
    setIsLoading(true);
    try {
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      let query = supabase
        .from("residents")
        .select("*", { count: "exact" })
        .eq("is_archived", false)
        .eq("barangay", activeBrgy)
        .order("id", { ascending: true })
        .range(from, to);

      if (debouncedSearchQuery) {
        const q = `%${debouncedSearchQuery}%`;
        query = query.or(
          `last_name.ilike.${q},first_name.ilike.${q},h_no.ilike.${q}`,
        );
      }

      if (selectedYear !== "all") {
        query = query.eq("data_year", selectedYear);
      }

      const { data, count, error } = await query;
      if (error) throw error;

      // Map Supabase columns to UI state structure
      const mappedData = (data || []).map((r) => ({
        id: r.id,
        h_no: r.h_no,
        last: r.last_name,
        first: r.first_name,
        mid: r.middle_name,
        q: r.qualifier,
        no: r.house_no,
        st: r.street,
        p: r.purok,
        bp: r.birth_place,
        bd: r.birth_date,
        s: r.sex,
        cs: r.civil_status,
        cz: r.citizenship,
        oc: r.occupation,
        rel: r.relation_to_head,
        isVoter: r.is_voter,
        brgy: r.barangay,
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
        childPregnancy: r.child_pregnancy_case || false,
        is4ps: r.is_4ps,
        createdAt: r.created_at,
        dataYear: r.data_year,
      }));

      setAllRecords(mappedData);
      setTotalRecords(count || 0);
    } catch (err) {
      console.error("Error fetching residents:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredRecords = allRecords;

  const openEditModal = (res) => {
    if (isRecordPastYear(res)) {
      alert(`Records from previous years (${res.dataYear || selectedYear}) cannot be edited. Past data is strictly read-only.`);
      return;
    }
    setEditingResident(res);
    const resAge = res.age !== null && res.age !== undefined ? res.age : "";
    const ageNum = parseInt(resAge, 10);
    const isSenior = !isNaN(ageNum) && ageNum >= 60;
    setEditForm({
      h_no: res.h_no || "",
      last_name: res.last || "",
      first_name: res.first || "",
      middle_name: res.mid || "",
      qualifier: res.q || "",
      house_no: res.no || "",
      street: res.st || "",
      purok: res.p || "",
      birth_place: res.bp || "",
      birth_date: res.bd || "",
      sex: res.s || "",
      civil_status: res.cs || "",
      citizenship: res.cz || "FILIPINO",
      occupation: res.oc || "",
      relation_to_head: res.rel || "",
      is_voter: res.isVoter || "NO",
      age: resAge,
      residence_type: res.residenceType || "",
      religion: res.religion || "",
      educational_attainment: res.edu || "",
      is_pwd: res.isPwd || false,
      has_pwd_id: res.hasPwdId || false,
      is_senior: isSenior,
      has_senior_id: isSenior ? (res.hasSeniorId || false) : false,
      is_solo_parent: res.isSoloParent || false,
      has_solo_parent_id: res.hasSoloParentId || false,
      is_4ps: res.is4ps || false,
      teenage_pregnancy_case: res.teenagePregnancy || false,
      current_teenage_mother: res.teenageMother || false,
      child_pregnancy_case: res.childPregnancy || false,
      age_at_first_birth: res.ageFirstBirth !== null && res.ageFirstBirth !== undefined ? res.ageFirstBirth : "",
    });
  };

  const handleEditDobChange = (dobValue) => {
    let calculatedAge = "";
    if (dobValue) {
      const today = new Date();
      const birthDate = new Date(dobValue);
      let a = today.getFullYear() - birthDate.getFullYear();
      const mDiff = today.getMonth() - birthDate.getMonth();
      if (mDiff < 0 || (mDiff === 0 && today.getDate() < birthDate.getDate())) a--;
      calculatedAge = a >= 0 ? a : "";
    }
    const ageNum = parseInt(calculatedAge, 10);
    const isSenior = !isNaN(ageNum) && ageNum >= 60;
    setEditForm((f) => ({
      ...f,
      birth_date: dobValue,
      age: calculatedAge,
      is_senior: isSenior,
      has_senior_id: isSenior ? f.has_senior_id : false,
    }));
  };

  const handleEditAgeChange = (ageValue) => {
    const ageNum = parseInt(ageValue, 10);
    const isSenior = !isNaN(ageNum) && ageNum >= 60;
    setEditForm((f) => ({
      ...f,
      age: ageValue,
      is_senior: isSenior,
      has_senior_id: isSenior ? f.has_senior_id : false,
    }));
  };

  const handleSaveEdit = async () => {
    if (!editingResident) return;
    if (isRecordPastYear(editingResident)) {
      alert("Editing is disabled for records from previous years. These records are read-only.");
      return;
    }

    const adminPassword = prompt(
      "Security Check: Enter Admin Password to save changes:"
    );
    if (adminPassword === null) return;

    setEditLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !user.email) {
        alert("Session error. Please log in again.");
        setEditLoading(false);
        return;
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: adminPassword,
      });

      if (authError) {
        alert("Access Denied: Incorrect Admin Password.");
        setEditLoading(false);
        return;
      }

      const updatePayload = {
        h_no: editForm.h_no,
        last_name: editForm.last_name,
        first_name: editForm.first_name,
        middle_name: editForm.middle_name,
        qualifier: editForm.qualifier,
        house_no: editForm.house_no,
        street: editForm.street,
        purok: editForm.purok,
        birth_place: editForm.birth_place,
        birth_date: editForm.birth_date || null,
        sex: editForm.sex,
        civil_status: editForm.civil_status,
        citizenship: editForm.citizenship,
        occupation: editForm.occupation,
        relation_to_head: editForm.relation_to_head,
        is_voter: editForm.is_voter,
        age: editForm.age !== "" ? Number(editForm.age) : null,
        residence_type: editForm.residence_type,
        religion: editForm.religion,
        educational_attainment: editForm.educational_attainment,
        is_pwd: editForm.is_pwd,
        has_pwd_id: editForm.has_pwd_id,
        is_senior: editForm.is_senior,
        has_senior_id: editForm.has_senior_id,
        is_solo_parent: editForm.is_solo_parent,
        has_solo_parent_id: editForm.has_solo_parent_id,
        is_4ps: editForm.is_4ps,
        teenage_pregnancy_case: editForm.teenage_pregnancy_case,
        current_teenage_mother: editForm.current_teenage_mother,
        child_pregnancy_case: editForm.child_pregnancy_case,
        age_at_first_birth: editForm.age_at_first_birth !== "" ? Number(editForm.age_at_first_birth) : null,
      };

      const { error } = await supabase
        .from("residents")
        .update(updatePayload)
        .eq("id", editingResident.id);

      if (error) throw error;

      // Update local state
      const updatedMapped = {
        ...editingResident,
        h_no: editForm.h_no,
        last: editForm.last_name,
        first: editForm.first_name,
        mid: editForm.middle_name,
        q: editForm.qualifier,
        no: editForm.house_no,
        st: editForm.street,
        p: editForm.purok,
        bp: editForm.birth_place,
        bd: editForm.birth_date,
        s: editForm.sex,
        cs: editForm.civil_status,
        cz: editForm.citizenship,
        oc: editForm.occupation,
        rel: editForm.relation_to_head,
        isVoter: editForm.is_voter,
        age: editForm.age !== "" ? Number(editForm.age) : null,
        residenceType: editForm.residence_type,
        religion: editForm.religion,
        edu: editForm.educational_attainment,
        isPwd: editForm.is_pwd,
        hasPwdId: editForm.has_pwd_id,
        isSenior: editForm.is_senior,
        hasSeniorId: editForm.has_senior_id,
        isSoloParent: editForm.is_solo_parent,
        hasSoloParentId: editForm.has_solo_parent_id,
        is4ps: editForm.is_4ps,
        teenagePregnancy: editForm.teenage_pregnancy_case,
        teenageMother: editForm.current_teenage_mother,
        childPregnancy: editForm.child_pregnancy_case,
        ageFirstBirth: editForm.age_at_first_birth !== "" ? Number(editForm.age_at_first_birth) : null,
      };

      setAllRecords(prev => prev.map(r => r.id === editingResident.id ? updatedMapped : r));

      // Also update the household modal if open
      if (selectedHousehold) {
        setSelectedHousehold(prev => ({
          ...prev,
          members: prev.members.map(m => m.id === editingResident.id ? updatedMapped : m),
        }));
      }

      // Also update the resident modal if it was the one being edited
      if (selectedResident && selectedResident.id === editingResident.id) {
        setSelectedResident(updatedMapped);
      }

      logTransaction({
        action: "Edit Resident",
        category: "Resident Management",
        details: `Edited resident ${editForm.first_name} ${editForm.last_name} (HH# ${editForm.h_no || "N/A"}) in Barangay ${activeBrgy}.`,
      });

      setEditingResident(null);
      alert("Resident updated successfully!");
    } catch (err) {
      console.error("Error updating resident:", err);
      alert("Failed to update: " + err.message);
    } finally {
      setEditLoading(false);
    }
  };

  // Open archive reason modal (replaces old window.confirm+prompt flow)
  const handleArchive = (res) => {
    if (userRole === "Staff") {
      alert("Access Denied: Staff users are not permitted to archive residents.");
      return;
    }
    if (isRecordPastYear(res)) {
      alert(`Records from previous years (${res.dataYear || selectedYear}) cannot be deleted or archived. Past data is strictly read-only.`);
      return;
    }
    setArchiveModal({
      open: true,
      resident: res,
      reason: "",
      adminPassword: "",
      isLoading: false,
      error: "",
    });
  };

  const closeArchiveModal = () => {
    setArchiveModal(prev => ({ ...prev, open: false, isLoading: false, error: "" }));
  };

  const handleConfirmArchive = async () => {
    const { resident: res, reason, adminPassword } = archiveModal;

    if (!reason) {
      setArchiveModal(prev => ({ ...prev, error: "Please select an archive reason before proceeding." }));
      return;
    }
    if (!adminPassword.trim()) {
      setArchiveModal(prev => ({ ...prev, error: "Admin Password is required for security verification." }));
      return;
    }

    setArchiveModal(prev => ({ ...prev, isLoading: true, error: "" }));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !user.email) {
        setArchiveModal(prev => ({ ...prev, isLoading: false, error: "Session error. Please log in again." }));
        return;
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: adminPassword,
      });

      if (authError) {
        setArchiveModal(prev => ({ ...prev, isLoading: false, error: "Access Denied: Incorrect Admin Password." }));
        return;
      }

      const updatePayload = {
        is_archived: true,
        archive_date: new Date().toISOString(),
        archive_reason: reason,
      };

      // Try with archive_reason column; fall back if column doesn't exist yet
      let { error } = await supabase
        .from("residents")
        .update(updatePayload)
        .eq("id", res.id);

      if (error && (error.message || "").toLowerCase().includes("archive_reason")) {
        // Fallback: column not yet migrated
        const fallback = await supabase
          .from("residents")
          .update({ is_archived: true, archive_date: new Date().toISOString() })
          .eq("id", res.id);
        if (fallback.error) throw fallback.error;
      } else if (error) {
        throw error;
      }

      // Remove from active list
      setAllRecords(prev => prev.filter(r => r.id !== res.id));
      setSelectedHousehold(null);
      setSelectedResident(null);

      const reasonLabel = reason === "deceased" ? "Deceased" : "Relocated / Migrated";
      logTransaction({
        action: "Archive Resident",
        category: "Resident Management",
        details: `Archived resident ${res.first} ${res.last} (HH# ${res.h_no || "N/A"}) from Brgy. ${activeBrgy}. Reason: ${reasonLabel}.`,
      });

      closeArchiveModal();
      alert(`Successfully archived! Reason: ${reasonLabel}.`);
    } catch (err) {
      console.error("Error archiving:", err);
      setArchiveModal(prev => ({ ...prev, isLoading: false, error: "Failed to archive: " + err.message }));
    }
  };

  const handleDeleteBrgyData = async () => {
    if (isReadOnly) {
      alert(`Cannot delete records: Data for previous year ${selectedYear} is archived and read-only.`);
      return;
    }
    if (
      !window.confirm(
        `WARNING: Are you sure you want to PERMANENTLY DELETE ALL records in Barangay ${activeBrgy}? This action cannot be undone.`,
      )
    )
      return;

    const adminPassword = prompt(
      "Security Check: Please enter Admin Password to delete these records:",
    );
    if (adminPassword === null) return;

    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !user.email) {
        setIsLoading(false);
        alert("Session error. Could not verify your identity. Please log in again.");
        return;
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: adminPassword,
      });

      if (authError) {
        setIsLoading(false);
        alert("Access Denied: Incorrect Admin Password.");
        return;
      }
      const { error } = await supabase
        .from("residents")
        .delete()
        .eq("barangay", activeBrgy);

      if (error) throw error;

      fetchResidents();

      logTransaction({
        action: "Delete All Barangay Records",
        category: "Resident Management",
        details: `Permanently deleted ALL resident records for Barangay ${activeBrgy} (Year: ${selectedYear}).`,
      });

      alert(`Successfully deleted all records in Barangay ${activeBrgy}!`);
    } catch (err) {
      console.error("Error deleting records:", err);
      alert("Failed to delete records: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const generateMockData = () => {
    const nowIso = new Date().toISOString();
    const currentYear = new Date().getFullYear();
    const mockResidents = [
      {
        h_no: "MOCK-001",
        last: "Dela Cruz",
        first: "Juan",
        mid: "P",
        q: "",
        no: "123",
        st: "Main St",
        p: "Purok 1",
        bp: "Bustos",
        bd: "1990-01-01",
        s: "M",
        cs: "Single",
        cz: "FILIPINO",
        oc: "Engineer",
        rel: "HEAD",
        isVoter: "YES",
        brgy: activeBrgy,
        age: 36,
        residenceType: "Owner",
        isHead: true,
        religion: "Catholic",
        edu: "College",
        isPwd: false,
        hasPwdId: false,
        isSenior: false,
        hasSeniorId: false,
        isSoloParent: false,
        hasSoloParentId: false,
        ageFirstBirth: null,
        teenagePregnancy: false,
        teenageMother: false,
        is4ps: false,
        createdAt: nowIso,
        dataYear: currentYear,
      },
      {
        h_no: "MOCK-001",
        last: "Dela Cruz",
        first: "Maria",
        mid: "S",
        q: "",
        no: "123",
        st: "Main St",
        p: "Purok 1",
        bp: "Bustos",
        bd: "1992-05-15",
        s: "F",
        cs: "Married",
        cz: "FILIPINO",
        oc: "Teacher",
        rel: "WIFE",
        isVoter: "YES",
        brgy: activeBrgy,
        age: 34,
        residenceType: "Owner",
        isHead: false,
        religion: "Catholic",
        edu: "College",
        isPwd: false,
        hasPwdId: false,
        isSenior: false,
        hasSeniorId: false,
        isSoloParent: false,
        hasSoloParentId: false,
        ageFirstBirth: null,
        teenagePregnancy: false,
        teenageMother: false,
        is4ps: false,
        createdAt: nowIso,
        dataYear: currentYear,
      },
      {
        h_no: "MOCK-002",
        last: "Santos",
        first: "Ricardo",
        mid: "L",
        q: "JR",
        no: "45",
        st: "Daisy St",
        p: "Purok 3",
        bp: "Baliuag",
        bd: "1985-11-20",
        s: "M",
        cs: "Single",
        cz: "FILIPINO",
        oc: "Driver",
        rel: "HEAD",
        isVoter: "NO",
        brgy: activeBrgy,
        age: 40,
        residenceType: "Tenant",
        isHead: true,
        religion: "Christian",
        edu: "High School",
        isPwd: false,
        hasPwdId: false,
        isSenior: false,
        hasSeniorId: false,
        isSoloParent: false,
        hasSoloParentId: false,
        ageFirstBirth: null,
        teenagePregnancy: false,
        teenageMother: false,
        is4ps: false,
        createdAt: nowIso,
        dataYear: currentYear,
      },
    ];

    const newRecords = [...allRecords, ...mockResidents];
    setAllRecords(newRecords);
    alert("Mock data generated successfully!");
  };

  const openHousehold = async (hhNo, dataYear) => {
    if (!hhNo) return;
    try {
      let query = supabase
        .from("residents")
        .select("*")
        .eq("h_no", hhNo)
        .eq("is_archived", false);

      if (dataYear) {
        query = query.eq("data_year", dataYear);
      }

      const { data, error } = await query;

      if (error) throw error;

      const members = (data || []).map((r) => ({
        id: r.id,
        h_no: r.h_no,
        last: r.last_name,
        first: r.first_name,
        mid: r.middle_name,
        q: r.qualifier,
        no: r.house_no,
        st: r.street,
        p: r.purok,
        bp: r.birth_place,
        bd: r.birth_date,
        s: r.sex,
        cs: r.civil_status,
        cz: r.citizenship,
        oc: r.occupation,
        rel: r.relation_to_head,
        isVoter: r.is_voter,
        brgy: r.barangay,
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
        is4ps: r.is_4ps,
        createdAt: r.created_at,
        dataYear: r.data_year,
      }));

      members.sort((a, b) => ((a.rel || "").toUpperCase() === "HEAD" ? -1 : 1));
      setSelectedHousehold({ hhNo, members });
    } catch (err) {
      console.error("Error fetching household members:", err);
    }
  };

  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const nowIso = new Date().toISOString();
      const currentYear = new Date().getFullYear();
      const lines = event.target.result
        .split(/\r?\n/)
        .filter((l) => l.trim() !== "");
      let importedData = [];
      lines.forEach((line) => {
        const c = parseCSVLine(line);
        const isHeader =
          line.toLowerCase().includes("hh no.") ||
          line.toLowerCase().includes("first name");
        if (!isHeader && c.length >= 2) {
          importedData.push({
            h_no: c[0] || "",
            last: c[1] || "",
            first: c[2] || "",
            mid: c[3] || "",
            q: c[4] || "",
            no: c[5] || "",
            st: c[6] || "",
            p: c[7] || "",
            bp: c[8] || "",
            bd: c[9] || "",
            s: c[10] || "",
            cs: c[11] || "",
            cz: c[12] || "",
            oc: c[13] || "",
            rel: c[14] || "",
            isVoter: "N/A",
            brgy: activeBrgy,
            age: null,
            residenceType: "N/A",
            isHead: false,
            religion: "N/A",
            edu: "N/A",
            isPwd: false,
            hasPwdId: false,
            isSenior: false,
            hasSeniorId: false,
            isSoloParent: false,
            hasSoloParentId: false,
            ageFirstBirth: null,
            teenagePregnancy: false,
            teenageMother: false,
            is4ps: false,
            createdAt: nowIso,
            dataYear: currentYear,
          });
        }
      });
      const newAllRecords = [...allRecords, ...importedData];
      setAllRecords(newAllRecords);
      alert("Import Successful!");
    };
    reader.readAsText(file);
  };

  function parseCSVLine(text) {
    const result = [];
    let cell = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      let char = text[i];
      if (char === '"') inQuotes = !inQuotes;
      else if (char === "," && !inQuotes) {
        result.push(cell.trim());
        cell = "";
      } else {
        cell += char;
      }
    }
    result.push(cell.trim());
    return result;
  }

  const getCivilStatusBadge = (status) => {
    const s = (status || "").toLowerCase().trim();
    if (s.includes("single"))
      return <span className="status-badge single">Single</span>;
    if (s.includes("married"))
      return <span className="status-badge married">Married</span>;
    if (s.includes("widow"))
      return <span className="status-badge widowed">Widowed</span>;
    if (s.includes("separat"))
      return <span className="status-badge separated">Separated</span>;
    return <span className="status-badge others">{status || "N/A"}</span>;
  };

  return (
    <div className="dashboard-wrapper">
      <div className="bg-image" />
      <div className="overlay" />
      <Sidebar />

      <main className="content">
        <header className="main-header">
          <h1>Barangay {activeBrgy}</h1>
          <UserProfileBadge />
        </header>

        <div className="main-layout">
          <div className="brgy-selector animate-fade-up">
            <div className="brgy-header">Barangays</div>
            <div className="brgy-list">
              {brgyStats.map((b) => (
                <div
                  key={b.name}
                  className={`brgy-item ${activeBrgy === b.name ? "active" : ""}`}
                  onClick={() => setActiveBrgy(b.name)}
                >
                  {b.name}
                </div>
              ))}
            </div>
          </div>

          <div className="table-section">
            <div className="table-controls animate-fade-up">
              <div className="search-container">
                <i className="fa-solid fa-magnifying-glass search-icon"></i>
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search HH No., Full Name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>



              <select
                className="year-filter-select"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                title="Filter by year data was collected"
              >
                <option value="all">All Years</option>
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    {y} {y < currentYear ? "(Read-Only)" : ""}
                  </option>
                ))}
              </select>

              <input
                type="file"
                id="csvFileInput"
                style={{ display: "none" }}
                accept=".csv"
                onChange={handleImportCSV}
              />
              <button
                className={`btn btn-import ${isReadOnly ? "disabled-btn" : ""}`}
                disabled={isReadOnly}
                onClick={() => {
                  if (isReadOnly) {
                    alert(`Importing data into previous year (${selectedYear}) is disabled to prevent accidental modifications.`);
                    return;
                  }
                  document.getElementById("csvFileInput").click();
                }}
                title={isReadOnly ? "Importing to previous years is disabled (Read-Only)" : "Import Data"}
              >
                <i className="fa-solid fa-file-import"></i> Import Data
              </button>
              <button
                className="btn btn-view-archive"
                onClick={() => navigate("/archive")}
              >
                <i className="fa-solid fa-box-archive"></i> View Archive
              </button>
              <button
                className={`btn btn-add ${isReadOnly ? "disabled-btn" : ""}`}
                disabled={isReadOnly}
                onClick={() => {
                  if (isReadOnly) {
                    alert(`Cannot add resident to previous year (${selectedYear}). Please switch to current year (${currentYear}).`);
                    return;
                  }
                  navigate("/add-resident");
                }}
                title={isReadOnly ? "Adding residents to previous years is disabled (Read-Only)" : "Add Resident"}
              >
                <i className="fa-solid fa-user-plus"></i> Add Resident
              </button>
            </div>

            {isReadOnly && (
              <div className="read-only-banner animate-fade-in">
                <div className="read-only-icon">
                  <i className="fa-solid fa-lock"></i>
                </div>
                <div className="read-only-text">
                  <strong>Read-Only Mode ({selectedYear})</strong>: Viewing historical census data. Editing and deleting/archiving records from previous years are strictly disabled to prevent accidental data loss.
                </div>
                <span className="read-only-pill">Locked Archive</span>
              </div>
            )}

            <div className="table-wrapper animate-fade-up">
              <table>
                <thead>
                  <tr>
                    <th className="text-center">HH NO.</th>
                    <th className="text-left">FULL NAME</th>
                    <th className="text-center col-mobile-hide">QUAL.</th>
                    <th className="text-center col-tablet-hide">NO.</th>
                    <th className="text-left col-tablet-hide">STREET</th>
                    <th className="text-left col-tablet-hide">PUROK</th>
                    <th className="text-left col-tablet-hide">BIRTH PLACE</th>
                    <th className="text-center col-mobile-hide">BIRTH DATE</th>
                    <th className="text-center">AGE</th>
                    <th className="text-center">GENDER</th>
                    <th className="text-center">CIVIL STATUS</th>
                    <th className="text-left col-tablet-hide">CITIZENSHIP</th>
                    <th className="text-left col-mobile-hide">OCCUPATION</th>
                    <th className="text-left col-mobile-hide">REL. TO HEAD</th>
                    <th className="text-left col-tablet-hide">RES. TYPE</th>
                    <th className="text-left col-tablet-hide">RELIGION</th>
                    <th className="text-left col-tablet-hide">EDUCATION</th>
                    <th className="text-center col-mobile-hide">PWD</th>
                    <th className="text-center col-mobile-hide">
                      SR. CITIZEN
                    </th>
                    <th className="text-center col-mobile-hide">
                      SOLO PARENT
                    </th>
                    <th className="text-center col-mobile-hide">4PS</th>
                    <th className="text-center col-tablet-hide">TEEN PREG</th>
                    <th className="text-center col-tablet-hide">
                      TEEN MOTHER
                    </th>
                    <th className="text-center col-mobile-hide">VOTER</th>
                    <th className="text-center">ACTION</th>
                  </tr>
                </thead>

                <tbody>
                  {isLoading ? (
                    <tr>
                      <td
                        colSpan="25"
                        style={{ textAlign: "center", padding: "30px" }}
                      >
                        <div className="loading-spinner">
                          Loading residents...
                        </div>
                      </td>
                    </tr>
                  ) : filteredRecords.length > 0 ? (
                    filteredRecords.map((res, i) => {
                      const middle = res.mid
                        ? (res.mid.trim().endsWith(".")
                          ? res.mid.trim()
                          : res.mid.trim()[0] + ".") + " "
                        : "";
                      const fullName = `${res.first} ${middle}${res.last}`;
                      return (
                        <tr
                          key={res.id || i}
                          onClick={() => handleRowClick(res)}
                        >
                          <td className="text-center">{res.h_no}</td>
                          <td className="text-left font-semibold">
                            {fullName}
                          </td>
                          <td className="text-center col-mobile-hide">
                            {res.q || "—"}
                          </td>
                          <td className="text-center col-tablet-hide">
                            {res.no || "—"}
                          </td>
                          <td className="text-left col-tablet-hide">
                            {res.st || "—"}
                          </td>
                          <td className="text-left col-tablet-hide">
                            {res.p || "—"}
                          </td>
                          <td className="text-left col-tablet-hide">
                            {res.bp || "—"}
                          </td>
                          <td className="text-center col-mobile-hide">
                            {res.bd || "—"}
                          </td>
                          <td className="text-center">
                            {res.age !== null && res.age !== undefined
                              ? res.age
                              : "—"}
                          </td>
                          <td className="text-center">
                            <span
                              className={`sex-badge ${(res.s || "").toLowerCase().includes("lgbt") ? "lgbt" : (res.s || "").toLowerCase() === "m" || (res.s || "").toLowerCase() === "male" ? "male" : "female"}`}
                            >
                              {res.s || "—"}
                            </span>
                          </td>
                          <td className="text-center">
                            {getCivilStatusBadge(res.cs)}
                          </td>
                          <td className="text-left col-tablet-hide">
                            {res.cz || "FILIPINO"}
                          </td>
                          <td className="text-left col-mobile-hide">
                            {res.oc || "—"}
                          </td>
                          <td className="text-left col-mobile-hide">
                            {res.rel || "—"}
                          </td>
                          <td className="text-left col-tablet-hide">
                            {res.residenceType || "—"}
                          </td>
                          <td className="text-left col-tablet-hide">
                            {res.religion || "—"}
                          </td>
                          <td className="text-left col-tablet-hide">
                            {res.edu || "—"}
                          </td>
                          <td className="text-center col-mobile-hide">
                            <span
                              className={`boolean-badge ${res.isPwd ? "yes" : "no"}`}
                            >
                              {res.isPwd ? "Yes" : "No"}
                            </span>
                          </td>
                          <td className="text-center col-mobile-hide">
                            <span
                              className={`boolean-badge ${res.isSenior ? "yes" : "no"}`}
                            >
                              {res.isSenior ? "Yes" : "No"}
                            </span>
                          </td>
                          <td className="text-center col-mobile-hide">
                            <span
                              className={`boolean-badge ${res.isSoloParent ? "yes" : "no"}`}
                            >
                              {res.isSoloParent ? "Yes" : "No"}
                            </span>
                          </td>
                          <td className="text-center col-mobile-hide">
                            <span
                              className={`boolean-badge ${res.is4ps ? "yes" : "no"}`}
                            >
                              {res.is4ps ? "Yes" : "No"}
                            </span>
                          </td>
                          <td className="text-center col-tablet-hide">
                            <span
                              className={`boolean-badge ${res.teenagePregnancy ? "yes" : "no"}`}
                            >
                              {res.teenagePregnancy ? "Yes" : "No"}
                            </span>
                          </td>
                          <td className="text-center col-tablet-hide">
                            <span
                              className={`boolean-badge ${res.teenageMother ? "yes" : "no"}`}
                            >
                              {res.teenageMother ? "Yes" : "No"}
                            </span>
                          </td>
                          <td className="text-center col-mobile-hide">
                            <span
                              className={`boolean-badge voter-badge ${(res.isVoter || "").toUpperCase() === "YES" ? "yes" : "no"}`}
                            >
                              {res.isVoter || "N/A"}
                            </span>
                          </td>
                          <td
                            className="text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="actions-cell">
                              <button
                                className="action-btn view-btn"
                                onClick={() => handleRowClick(res)}
                                title={viewMode === "household" ? "View Household Family Members" : "View Individual Resident Details"}
                              >
                                <i className="fa-solid fa-eye"></i>
                              </button>
                              {!isStaff && (
                                !isRecordPastYear(res) ? (
                                  <>
                                    <button
                                      className="action-btn edit-btn"
                                      onClick={() => openEditModal(res)}
                                      title="Edit Resident"
                                    >
                                      <i className="fa-solid fa-pen-to-square"></i>
                                    </button>
                                    <button
                                      className="action-btn archive-btn"
                                      onClick={() => handleArchive(res)}
                                      title="Archive Resident"
                                    >
                                      <i className="fa-solid fa-box-archive"></i>
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    className="action-btn disabled-btn"
                                    disabled
                                    title="Read-Only: Editing and deleting are disabled for past year records."
                                  >
                                    <i className="fa-solid fa-lock" style={{ fontSize: "11px", color: "#94a3b8" }}></i>
                                  </button>
                                )
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan="25"
                        style={{
                          textAlign: "center",
                          padding: "30px",
                          color: "#999",
                        }}
                      >
                        Walang record sa Barangay {activeBrgy}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalRecords > 0 && (
              <div className="pagination-controls" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px', padding: '10px', background: '#fff', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                <span style={{ fontSize: '0.9rem', color: '#555' }}>
                  Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalRecords)} of {totalRecords} records
                </span>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    className="btn"
                    disabled={currentPage === 1 || isLoading}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    style={{ padding: '6px 12px', opacity: (currentPage === 1 || isLoading) ? 0.5 : 1, cursor: (currentPage === 1 || isLoading) ? 'not-allowed' : 'pointer', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '4px' }}
                  >
                    Previous
                  </button>
                  <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.9rem', fontWeight: 'bold', color: '#333' }}>
                    Page {currentPage} of {Math.ceil(totalRecords / itemsPerPage)}
                  </span>
                  <button
                    className="btn"
                    disabled={currentPage >= Math.ceil(totalRecords / itemsPerPage) || isLoading}
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    style={{ padding: '6px 12px', opacity: (currentPage >= Math.ceil(totalRecords / itemsPerPage) || isLoading) ? 0.5 : 1, cursor: (currentPage >= Math.ceil(totalRecords / itemsPerPage) || isLoading) ? 'not-allowed' : 'pointer', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '4px' }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Household Modal */}
      {selectedHousehold && (
        <div
          className="modal-overlay"
          onClick={() => setSelectedHousehold(null)}
        >
          <div
            className="hh-modal-content"
            style={{ maxWidth: '960px', width: '95%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="close-modal" onClick={() => setSelectedHousehold(null)}>&times;</span>
            <div className="household-header">
              <h2>Household Family Members</h2>
              <p>Household ID: <strong>{selectedHousehold.hhNo}</strong> &bull; {selectedHousehold.members.length} member{selectedHousehold.members.length !== 1 ? 's' : ''}</p>
            </div>

            <div className="hh-members-grid">
              {selectedHousehold.members.map((m, i) => {
                const isHead = (m.rel || '').toUpperCase() === 'HEAD';
                const fullName = `${m.first || ''} ${m.mid ? (m.mid.endsWith('.') ? m.mid : m.mid[0] + '.') + ' ' : ''}${m.last || ''} ${m.q || ''}`.trim();
                const initials = `${(m.first?.[0] || '').toUpperCase()}${(m.last?.[0] || '').toUpperCase()}`;
                return (
                  <div
                    key={m.id || i}
                    className={`hh-member-card ${isHead ? 'is-head' : ''}`}
                  >
                    {/* Card Header */}
                    <div className="hh-card-header">
                      <div className="hh-card-avatar">
                        {initials || 'M'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: '700', fontSize: '14px', color: '#1a202c', wordBreak: 'break-word', lineHeight: '1.3' }}>{fullName || '—'}</div>
                        <div style={{ fontSize: '12px', color: isHead ? '#c05621' : '#718096', fontWeight: '600', marginTop: '2px' }}>
                          {m.rel || 'MEMBER'}
                          {isHead && <span style={{ marginLeft: '6px', background: '#f6ad55', color: 'white', fontSize: '10px', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>HEAD</span>}
                        </div>
                      </div>
                    </div>

                    {/* Card Info Grid */}
                    <div className="hh-card-info-grid">
                      {[
                        { label: 'Age', value: m.age != null ? `${m.age} yrs` : '—' },
                        { label: 'Gender', value: m.s || '—' },
                        { label: 'Birthday', value: m.bd || '—' },
                        { label: 'Civil Status', value: m.cs || '—' },
                        { label: 'Occupation', value: m.oc || '—' },
                        { label: 'Education', value: m.edu || '—' },
                        { label: 'Religion', value: m.religion || '—' },
                        { label: 'Voter', value: m.isVoter || '—' },
                      ].map(({ label, value }) => (
                        <div key={label} className="hh-card-field">
                          <div className="hh-card-field-label">{label}</div>
                          <div className="hh-card-field-value">{value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Tags Row */}
                    <div className="hh-card-tags">
                      {m.isSenior && <span style={{ fontSize: '10px', background: '#3182ce', color: 'white', padding: '2px 8px', borderRadius: '10px', fontWeight: '600' }}>Senior</span>}
                      {m.isPwd && <span style={{ fontSize: '10px', background: '#38a169', color: 'white', padding: '2px 8px', borderRadius: '10px', fontWeight: '600' }}>PWD</span>}
                      {m.isSoloParent && <span style={{ fontSize: '10px', background: '#e53e3e', color: 'white', padding: '2px 8px', borderRadius: '10px', fontWeight: '600' }}>Solo Parent</span>}
                      {m.is4ps && <span style={{ fontSize: '10px', background: '#d69e2e', color: 'white', padding: '2px 8px', borderRadius: '10px', fontWeight: '600' }}>4Ps</span>}
                    </div>

                    {/* Action Buttons */}
                    <div className="hh-card-actions">
                      <button
                        className="btn-view-indiv"
                        onClick={() => setSelectedResident(m)}
                      >
                        <i className="fa-solid fa-eye" style={{ fontSize: '11px' }}></i> View Profile
                      </button>
                      {userRole !== 'Staff' && (
                        !isRecordPastYear(m) ? (
                          <>
                            <button
                              className="btn-edit-card"
                              onClick={() => openEditModal(m)}
                              title="Edit Resident"
                            >
                              <i className="fa-solid fa-pen-to-square" style={{ fontSize: '11px' }}></i> Edit
                            </button>
                            <button
                              className="btn-archive-card"
                              onClick={() => handleArchive(m)}
                              title="Archive Resident"
                            >
                              <i className="fa-solid fa-box-archive" style={{ fontSize: '11px' }}></i> Archive
                            </button>
                          </>
                        ) : (
                          <span style={{ fontSize: "11px", color: "#94a3b8", display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 8px" }}>
                            <i className="fa-solid fa-lock"></i> Read-Only
                          </span>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Individual Resident Profile Modal */}
      {selectedResident && (
        <div
          className="modal-overlay"
          onClick={() => setSelectedResident(null)}
        >
          <div
            className="res-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <span
              className="close-modal"
              onClick={() => setSelectedResident(null)}
            >
              &times;
            </span>

            {/* Modal Header */}
            <div className="res-modal-header">
              <div className="res-modal-avatar">
                {(selectedResident.first?.[0] || "R").toUpperCase()}
                {(selectedResident.last?.[0] || "").toUpperCase()}
              </div>
              <div className="res-modal-title">
                <h2>
                  {selectedResident.first} {selectedResident.mid ? (selectedResident.mid.endsWith('.') ? selectedResident.mid + ' ' : selectedResident.mid[0] + '. ') : ''}{selectedResident.last} {selectedResident.q || ''}
                </h2>
                <p>
                  Household ID: <strong>{selectedResident.h_no || "N/A"}</strong> &bull; Relation: <strong>{selectedResident.rel || "MEMBER"}</strong> &bull; Barangay: <strong>{selectedResident.brgy}</strong>
                  {isRecordPastYear(selectedResident) && (
                    <span style={{ marginLeft: "10px", fontSize: "11px", background: "#fef3c7", color: "#92400e", padding: "2px 8px", borderRadius: "10px", border: "1px solid #fde68a", display: "inline-flex", alignItems: "center", gap: "4px", fontWeight: "600" }}>
                      <i className="fa-solid fa-lock"></i> Read-Only ({selectedResident.dataYear || selectedYear})
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Grid Details - scrollable */}
            <div className="res-modal-scrollable-body">
              <div className="res-details-grid">
                {/* Personal Info */}
                <div className="res-card-section">
                  <h3><i className="fa-solid fa-id-card"></i> Personal Information</h3>
                  <div className="res-card-content">
                    <div className="res-detail-row">
                      <span className="res-detail-label">Full Name</span>
                      <span className="res-detail-value">{selectedResident.first} {selectedResident.mid || ''} {selectedResident.last} {selectedResident.q || ''}</span>
                    </div>
                    <div className="res-detail-row">
                      <span className="res-detail-label">Age</span>
                      <span className="res-detail-value">{selectedResident.age !== null && selectedResident.age !== undefined ? `${selectedResident.age} years old` : "N/A"}</span>
                    </div>
                    <div className="res-detail-row">
                      <span className="res-detail-label">Gender</span>
                      <span className="res-detail-value">{selectedResident.s || "N/A"}</span>
                    </div>
                    <div className="res-detail-row">
                      <span className="res-detail-label">Birth Date</span>
                      <span className="res-detail-value">{selectedResident.bd || "N/A"}</span>
                    </div>
                    <div className="res-detail-row">
                      <span className="res-detail-label">Birth Place</span>
                      <span className="res-detail-value">{selectedResident.bp || "N/A"}</span>
                    </div>
                    <div className="res-detail-row">
                      <span className="res-detail-label">Civil Status</span>
                      <span className="res-detail-value">{selectedResident.cs || "N/A"}</span>
                    </div>
                    <div className="res-detail-row">
                      <span className="res-detail-label">Citizenship</span>
                      <span className="res-detail-value">{selectedResident.cz || "FILIPINO"}</span>
                    </div>
                    <div className="res-detail-row">
                      <span className="res-detail-label">Religion</span>
                      <span className="res-detail-value">{selectedResident.religion || "N/A"}</span>
                    </div>
                  </div>
                </div>

                {/* Address & Housing */}
                <div className="res-card-section">
                  <h3><i className="fa-solid fa-house-user"></i> Address & Household</h3>
                  <div className="res-card-content">
                    <div className="res-detail-row">
                      <span className="res-detail-label">Household No.</span>
                      <span className="res-detail-value">{selectedResident.h_no || "N/A"}</span>
                    </div>
                    <div className="res-detail-row">
                      <span className="res-detail-label">House No.</span>
                      <span className="res-detail-value">{selectedResident.no || "N/A"}</span>
                    </div>
                    <div className="res-detail-row">
                      <span className="res-detail-label">Street</span>
                      <span className="res-detail-value">{selectedResident.st || "N/A"}</span>
                    </div>
                    <div className="res-detail-row">
                      <span className="res-detail-label">Purok</span>
                      <span className="res-detail-value">{selectedResident.p || "N/A"}</span>
                    </div>
                    <div className="res-detail-row">
                      <span className="res-detail-label">Barangay</span>
                      <span className="res-detail-value">{selectedResident.brgy || "N/A"}</span>
                    </div>
                    <div className="res-detail-row">
                      <span className="res-detail-label">Relation to Head</span>
                      <span className="res-detail-value">{selectedResident.rel || "N/A"}</span>
                    </div>
                    <div className="res-detail-row">
                      <span className="res-detail-label">Residence Type</span>
                      <span className="res-detail-value">{selectedResident.residenceType || "N/A"}</span>
                    </div>
                  </div>
                </div>

                {/* Education & Occupation */}
                <div className="res-card-section">
                  <h3><i className="fa-solid fa-briefcase"></i> Work & Education</h3>
                  <div className="res-card-content">
                    <div className="res-detail-row">
                      <span className="res-detail-label">Occupation</span>
                      <span className="res-detail-value">{selectedResident.oc || "N/A"}</span>
                    </div>
                    <div className="res-detail-row">
                      <span className="res-detail-label">Educational Attainment</span>
                      <span className="res-detail-value">{selectedResident.edu || "N/A"}</span>
                    </div>
                    <div className="res-detail-row">
                      <span className="res-detail-label">Registered Voter</span>
                      <span className="res-detail-value">
                        <span className={`boolean-badge ${(selectedResident.isVoter || '').toUpperCase() === 'YES' ? 'yes' : 'no'}`}>
                          {selectedResident.isVoter || 'No'}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Special Sectors & Programs */}
                <div className="res-card-section">
                  <h3><i className="fa-solid fa-layer-group"></i> Special Sectors & Programs</h3>
                  <div className="res-card-content">
                    <div className="res-detail-row">
                      <span className="res-detail-label">Senior Citizen</span>
                      <span className="res-detail-value">
                        <span className={`boolean-badge ${selectedResident.isSenior ? 'yes' : 'no'}`}>
                          {selectedResident.isSenior ? `Yes ${selectedResident.hasSeniorId ? '(With ID)' : ''}` : 'No'}
                        </span>
                      </span>
                    </div>
                    <div className="res-detail-row">
                      <span className="res-detail-label">PWD</span>
                      <span className="res-detail-value">
                        <span className={`boolean-badge ${selectedResident.isPwd ? 'yes' : 'no'}`}>
                          {selectedResident.isPwd ? `Yes ${selectedResident.hasPwdId ? '(With ID)' : ''}` : 'No'}
                        </span>
                      </span>
                    </div>
                    <div className="res-detail-row">
                      <span className="res-detail-label">Solo Parent</span>
                      <span className="res-detail-value">
                        <span className={`boolean-badge ${selectedResident.isSoloParent ? 'yes' : 'no'}`}>
                          {selectedResident.isSoloParent ? `Yes ${selectedResident.hasSoloParentId ? '(With ID)' : ''}` : 'No'}
                        </span>
                      </span>
                    </div>
                    <div className="res-detail-row">
                      <span className="res-detail-label">4Ps Beneficiary</span>
                      <span className="res-detail-value">
                        <span className={`boolean-badge ${selectedResident.is4ps ? 'yes' : 'no'}`}>
                          {selectedResident.is4ps ? 'Yes' : 'No'}
                        </span>
                      </span>
                    </div>
                    <div className="res-detail-row">
                      <span className="res-detail-label">Teenage Pregnancy Case</span>
                      <span className="res-detail-value">
                        <span className={`boolean-badge ${selectedResident.teenagePregnancy ? 'yes' : 'no'}`}>
                          {selectedResident.teenagePregnancy ? 'Yes' : 'No'}
                        </span>
                      </span>
                    </div>
                    <div className="res-detail-row">
                      <span className="res-detail-label">Current Teenage Mother</span>
                      <span className="res-detail-value">
                        <span className={`boolean-badge ${selectedResident.teenageMother ? 'yes' : 'no'}`}>
                          {selectedResident.teenageMother ? `Yes ${selectedResident.ageFirstBirth ? `(Age ${selectedResident.ageFirstBirth})` : ''}` : 'No'}
                        </span>
                      </span>
                    </div>
                    <div className="res-detail-row">
                      <span className="res-detail-label">Data Year</span>
                      <span className="res-detail-value">{selectedResident.dataYear || "N/A"}</span>
                    </div>
                  </div>
                </div>
              </div>{/* end res-details-grid */}
            </div>{/* end res-modal-scrollable-body */}

            <div className="res-modal-footer">
              {!isStaff && !isRecordPastYear(selectedResident) && (
                <button
                  className="btn-edit-modal"
                  onClick={() => {
                    const target = selectedResident;
                    setSelectedResident(null);
                    openEditModal(target);
                  }}
                >
                  <i className="fa-solid fa-pen-to-square"></i> Edit Resident
                </button>
              )}
              {!isStaff && !isRecordPastYear(selectedResident) && (
                <button
                  className="btn-archive-modal"
                  onClick={() => {
                    const target = selectedResident;
                    setSelectedResident(null);
                    handleArchive(target);
                  }}
                >
                  <i className="fa-solid fa-box-archive"></i> Archive Resident
                </button>
              )}
              <button
                className="btn"
                style={{ background: "#e2e8f0", color: "#334155", fontWeight: "600" }}
                onClick={() => setSelectedResident(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          EDIT RESIDENT MODAL
          ============================================================ */}
      {editingResident && (
        <div className="modal-overlay" onClick={() => setEditingResident(null)}>
          <div className="edit-modal-content" onClick={e => e.stopPropagation()}>
            <span className="close-modal" onClick={() => setEditingResident(null)}>&times;</span>

            <div className="edit-modal-header">
              <div className="edit-modal-avatar">
                {(editingResident.first?.[0] || 'R').toUpperCase()}
                {(editingResident.last?.[0] || '').toUpperCase()}
              </div>
              <div>
                <h2>Edit Resident</h2>
                <p>HH#: <strong>{editingResident.h_no || "N/A"}</strong> &bull; Barangay: <strong>{activeBrgy}</strong></p>
              </div>
            </div>

            <div className="edit-modal-body">

              {/* --- Section: Identity --- */}
              <div className="edit-section-title"><i className="fa-solid fa-id-card"></i> Identity</div>
              <div className="edit-form-grid">
                <div className="edit-field">
                  <label>Household No.</label>
                  <input value={editForm.h_no} onChange={e => setEditForm(f => ({ ...f, h_no: e.target.value }))} />
                </div>
                <div className="edit-field">
                  <label>Last Name</label>
                  <input value={editForm.last_name} onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))} />
                </div>
                <div className="edit-field">
                  <label>First Name</label>
                  <input value={editForm.first_name} onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))} />
                </div>
                <div className="edit-field">
                  <label>Middle Name</label>
                  <input value={editForm.middle_name} onChange={e => setEditForm(f => ({ ...f, middle_name: e.target.value }))} />
                </div>
                <div className="edit-field">
                  <label>Qualifier (Jr./Sr./III)</label>
                  <input value={editForm.qualifier} onChange={e => setEditForm(f => ({ ...f, qualifier: e.target.value }))} />
                </div>
                <div className="edit-field">
                  <label>Relation to Head</label>
                  <input value={editForm.relation_to_head} onChange={e => setEditForm(f => ({ ...f, relation_to_head: e.target.value }))} />
                </div>
              </div>

              {/* --- Section: Personal --- */}
              <div className="edit-section-title"><i className="fa-solid fa-person"></i> Personal Info</div>
              <div className="edit-form-grid">
                <div className="edit-field">
                  <label>Birth Date</label>
                  <input type="date" value={editForm.birth_date} onChange={e => handleEditDobChange(e.target.value)} />
                </div>
                <div className="edit-field">
                  <label>Birth Place</label>
                  <input value={editForm.birth_place} onChange={e => setEditForm(f => ({ ...f, birth_place: e.target.value }))} />
                </div>
                <div className="edit-field">
                  <label>Age</label>
                  <input type="number" min="0" value={editForm.age} onChange={e => handleEditAgeChange(e.target.value)} />
                </div>
                <div className="edit-field">
                  <label>Sex</label>
                  <select value={editForm.sex} onChange={e => setEditForm(f => ({ ...f, sex: e.target.value }))}>
                    <option value="M">Male (M)</option>
                    <option value="F">Female (F)</option>
                    <option value="LGBTQ+">LGBTQ+</option>
                  </select>
                </div>
                <div className="edit-field">
                  <label>Civil Status</label>
                  <select value={editForm.civil_status} onChange={e => setEditForm(f => ({ ...f, civil_status: e.target.value }))}>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Widowed">Widowed</option>
                    <option value="Separated">Separated</option>
                    <option value="Annulled">Annulled</option>
                    <option value="Live-in">Live-in</option>
                  </select>
                </div>
                <div className="edit-field">
                  <label>Citizenship</label>
                  <input value={editForm.citizenship} onChange={e => setEditForm(f => ({ ...f, citizenship: e.target.value }))} />
                </div>
                <div className="edit-field">
                  <label>Religion</label>
                  <input value={editForm.religion} onChange={e => setEditForm(f => ({ ...f, religion: e.target.value }))} />
                </div>
                <div className="edit-field">
                  <label>Registered Voter</label>
                  <select value={editForm.is_voter} onChange={e => setEditForm(f => ({ ...f, is_voter: e.target.value }))}>
                    <option value="YES">YES</option>
                    <option value="NO">NO</option>
                    <option value="N/A">N/A</option>
                  </select>
                </div>
              </div>

              {/* --- Section: Address --- */}
              <div className="edit-section-title"><i className="fa-solid fa-house"></i> Address</div>
              <div className="edit-form-grid">
                <div className="edit-field">
                  <label>House No.</label>
                  <input value={editForm.house_no} onChange={e => setEditForm(f => ({ ...f, house_no: e.target.value }))} />
                </div>
                <div className="edit-field">
                  <label>Street</label>
                  <input value={editForm.street} onChange={e => setEditForm(f => ({ ...f, street: e.target.value }))} />
                </div>
                <div className="edit-field">
                  <label>Purok</label>
                  <input value={editForm.purok} onChange={e => setEditForm(f => ({ ...f, purok: e.target.value }))} />
                </div>
                <div className="edit-field">
                  <label>Residence Type</label>
                  <select value={editForm.residence_type} onChange={e => setEditForm(f => ({ ...f, residence_type: e.target.value }))}>
                    <option value="Owner">Owner</option>
                    <option value="Tenant">Tenant</option>
                    <option value="Sharer">Sharer</option>
                    <option value="N/A">N/A</option>
                  </select>
                </div>
              </div>

              {/* --- Section: Work & Education --- */}
              <div className="edit-section-title"><i className="fa-solid fa-briefcase"></i> Work &amp; Education</div>
              <div className="edit-form-grid">
                <div className="edit-field">
                  <label>Occupation</label>
                  <input value={editForm.occupation} onChange={e => setEditForm(f => ({ ...f, occupation: e.target.value }))} />
                </div>
                <div className="edit-field">
                  <label>Educational Attainment</label>
                  <select value={editForm.educational_attainment} onChange={e => setEditForm(f => ({ ...f, educational_attainment: e.target.value }))}>
                    <option value="No Formal Education">No Formal Education</option>
                    <option value="Elementary">Elementary</option>
                    <option value="High School">High School</option>
                    <option value="Senior High School">Senior High School</option>
                    <option value="Vocational">Vocational</option>
                    <option value="College">College</option>
                    <option value="Post Graduate">Post Graduate</option>
                    <option value="N/A">N/A</option>
                  </select>
                </div>
              </div>

              {/* --- Section: Special Sectors --- */}
              <div className="edit-section-title"><i className="fa-solid fa-layer-group"></i> Special Sectors &amp; Programs</div>
              <div className="edit-toggles-grid">
                {(() => {
                  const isEligible = parseInt(editForm.age, 10) >= 60;
                  return (
                    <>
                      <label className={`edit-toggle-item ${!isEligible ? "disabled" : ""}`} style={!isEligible ? { opacity: 0.55, cursor: "not-allowed" } : {}}>
                        <input
                          type="checkbox"
                          checked={editForm.is_senior && isEligible}
                          disabled={!isEligible}
                          onChange={e => setEditForm(f => ({ ...f, is_senior: e.target.checked }))}
                        />
                        <span>Senior Citizen {!isEligible && "(Age 60+ only)"}</span>
                      </label>

                      {isEligible && editForm.is_senior && (
                        <div style={{ display: "flex", gap: "14px", alignItems: "center", gridColumn: "span 2", padding: "6px 12px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                          <span style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>Senior ID:</span>
                          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", cursor: "pointer" }}>
                            <input
                              type="radio"
                              name="edit_senior_id"
                              checked={editForm.has_senior_id === true}
                              onChange={() => setEditForm(f => ({ ...f, has_senior_id: true }))}
                            />
                            <span>With Senior ID</span>
                          </label>
                          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", cursor: "pointer" }}>
                            <input
                              type="radio"
                              name="edit_senior_id"
                              checked={editForm.has_senior_id === false}
                              onChange={() => setEditForm(f => ({ ...f, has_senior_id: false }))}
                            />
                            <span>Without Senior ID</span>
                          </label>
                        </div>
                      )}
                    </>
                  );
                })()}
                <label className="edit-toggle-item">
                  <input type="checkbox" checked={editForm.is_pwd} onChange={e => setEditForm(f => ({ ...f, is_pwd: e.target.checked }))} />
                  <span>PWD</span>
                </label>
                <label className="edit-toggle-item">
                  <input type="checkbox" checked={editForm.has_pwd_id} onChange={e => setEditForm(f => ({ ...f, has_pwd_id: e.target.checked }))} />
                  <span>Has PWD ID</span>
                </label>
                <label className="edit-toggle-item">
                  <input type="checkbox" checked={editForm.is_solo_parent} onChange={e => setEditForm(f => ({ ...f, is_solo_parent: e.target.checked }))} />
                  <span>Solo Parent</span>
                </label>
                <label className="edit-toggle-item">
                  <input type="checkbox" checked={editForm.has_solo_parent_id} onChange={e => setEditForm(f => ({ ...f, has_solo_parent_id: e.target.checked }))} />
                  <span>Has Solo Parent ID</span>
                </label>
                <label className="edit-toggle-item">
                  <input type="checkbox" checked={editForm.is_4ps} onChange={e => setEditForm(f => ({ ...f, is_4ps: e.target.checked }))} />
                  <span>4Ps Beneficiary</span>
                </label>

                {/* Pregnancy Classification - 3-tier */}
                {(() => {
                  const editAge = parseInt(editForm.age, 10);
                  const isFemale = editForm.sex === "Female";
                  const isChildAge = !isNaN(editAge) && editAge <= 9;
                  const isTeenAge = !isNaN(editAge) && editAge >= 10 && editAge <= 19;
                  const isAdultPlus = !isNaN(editAge) && editAge >= 20;

                  if (!isFemale) return (
                    <div style={{ gridColumn: 'span 2', padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className="fa-solid fa-circle-minus"></i>
                      <span>Pregnancy Classification — Not Applicable (Male / LGBTQ+)</span>
                    </div>
                  );

                  if (isChildAge) return (
                    <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label className="edit-toggle-item" style={{ gridColumn: 'span 2' }}>
                        <input
                          type="checkbox"
                          checked={editForm.child_pregnancy_case || false}
                          onChange={e => setEditForm(f => ({
                            ...f,
                            child_pregnancy_case: e.target.checked,
                            teenage_pregnancy_case: false // strictly excluded
                          }))}
                        />
                        <span style={{ fontWeight: editForm.child_pregnancy_case ? '700' : 'normal', color: editForm.child_pregnancy_case ? '#dc2626' : 'inherit' }}>
                          Pregnant / Child Pregnancy Case (Age ≤ 9)
                        </span>
                      </label>
                      {editForm.child_pregnancy_case && (
                        <div style={{ padding: '10px 14px', background: 'linear-gradient(135deg, #fff1f2, #ffe4e6)', border: '1.5px solid #fca5a5', borderRadius: '8px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <i className="fa-solid fa-triangle-exclamation" style={{ color: '#dc2626', fontSize: '14px' }}></i>
                          <div style={{ fontWeight: '700', fontSize: '12px', color: '#dc2626' }}>Child Pregnancy — Highly Sensitive Case</div>
                        </div>
                      )}
                    </div>
                  );

                  if (isAdultPlus) return (
                    <div style={{ gridColumn: 'span 2', padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className="fa-solid fa-circle-minus"></i>
                      <span>Pregnancy Classification — Not Applicable (Age ≥ 20)</span>
                    </div>
                  );

                  // isTeenAge (10-19, female): show editable fields
                  return (
                    <>
                      <label className="edit-toggle-item" style={{ gridColumn: 'span 1' }}>
                        <input type="checkbox" checked={editForm.teenage_pregnancy_case} onChange={e => setEditForm(f => ({ ...f, teenage_pregnancy_case: e.target.checked }))} />
                        <span>Teenage Pregnancy Case</span>
                      </label>
                      <label className="edit-toggle-item" style={{ gridColumn: 'span 1' }}>
                        <input type="checkbox" checked={editForm.current_teenage_mother} onChange={e => setEditForm(f => ({ ...f, current_teenage_mother: e.target.checked }))} />
                        <span>Current Teenage Mother</span>
                      </label>
                      {editForm.current_teenage_mother && (
                        <div style={{ gridColumn: 'span 2', display: 'flex', gap: '12px', alignItems: 'center', padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', whiteSpace: 'nowrap' }}>Age at First Birth:</label>
                          <input type="number" min="10" max="19" value={editForm.age_at_first_birth} onChange={e => setEditForm(f => ({ ...f, age_at_first_birth: e.target.value }))} style={{ width: '80px', padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px' }} />
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>{/* end edit-toggles-grid */}

            </div>{/* end edit-modal-body */}

            <div className="edit-modal-footer">
              <button className="btn" style={{ background: '#e2e8f0', color: '#334155', fontWeight: '600' }} onClick={() => setEditingResident(null)} disabled={editLoading}>
                Cancel
              </button>
              <button className="btn-save-edit" onClick={handleSaveEdit} disabled={editLoading}>
                {editLoading ? <><i className="fa-solid fa-spinner fa-spin"></i> Saving...</> : <><i className="fa-solid fa-floppy-disk"></i> Save Changes</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================
        ARCHIVE REASON MODAL
        ================================================================ */}
      {archiveModal.open && (
        <div className="modal-overlay archive-reason-overlay" onClick={closeArchiveModal}>
          <div
            className="archive-reason-modal"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="archive-reason-header">
              <div className="archive-reason-icon-wrap">
                <i className="fa-solid fa-box-archive"></i>
              </div>
              <div style={{ flex: 1 }}>
                <h2 className="archive-reason-title">Archive Resident</h2>
                <p className="archive-reason-sub">
                  <strong>{archiveModal.resident?.first} {archiveModal.resident?.mid ? archiveModal.resident.mid.charAt(0) + ". " : ""}{archiveModal.resident?.last}</strong>
                  {archiveModal.resident?.q ? " " + archiveModal.resident.q : ""}
                  &nbsp;&bull;&nbsp;HH# {archiveModal.resident?.h_no || "N/A"}
                </p>
              </div>
              <button className="archive-reason-close" onClick={closeArchiveModal}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Notice banner */}
            <div className="archive-notice-banner">
              <i className="fa-solid fa-triangle-exclamation"></i>
              <span>The archived resident will be <strong>automatically removed</strong> from active population counts for year <strong>{archiveModal.resident?.dataYear || selectedYear}</strong>. Prior-year records <strong>remain strictly Read-Only</strong> for auditing purposes.</span>
            </div>

            <div className="archive-reason-body">
              {/* Reason selection — MANDATORY */}
              <p className="archive-reason-label-required">
                <i className="fa-solid fa-asterisk" style={{ fontSize: "8px", verticalAlign: "middle", color: "#ef4444" }}></i>{" "}Select Reason for Archiving <span className="required-tag">(Required)</span>
              </p>

              <div className="archive-reason-cards">
                {/* DECEASED */}
                <label
                  className={`archive-reason-card ${archiveModal.reason === "deceased" ? "selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="archiveReason"
                    value="deceased"
                    checked={archiveModal.reason === "deceased"}
                    onChange={() => setArchiveModal(prev => ({ ...prev, reason: "deceased", error: "" }))}
                  />
                  <div className="archive-card-icon deceased">
                    <i className="fa-solid fa-heart-crack"></i>
                  </div>
                  <div className="archive-card-text">
                    <strong>Deceased</strong>
                    <span>Resident has passed away</span>
                  </div>
                  {archiveModal.reason === "deceased" && <i className="fa-solid fa-circle-check archive-check"></i>}
                </label>

                {/* RELOCATED */}
                <label
                  className={`archive-reason-card ${archiveModal.reason === "relocated" ? "selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="archiveReason"
                    value="relocated"
                    checked={archiveModal.reason === "relocated"}
                    onChange={() => setArchiveModal(prev => ({ ...prev, reason: "relocated", error: "" }))}
                  />
                  <div className="archive-card-icon relocated">
                    <i className="fa-solid fa-truck-moving"></i>
                  </div>
                  <div className="archive-card-text">
                    <strong>Relocated / Migrated</strong>
                    <span>Moved to another barangay, municipality, or province</span>
                  </div>
                  {archiveModal.reason === "relocated" && <i className="fa-solid fa-circle-check archive-check"></i>}
                </label>
              </div>

              {/* Security Check — Admin Password */}
              <div className="archive-security-section">
                <p className="archive-detail-section-title">
                  <i className="fa-solid fa-shield-halved"></i> Security Verification
                </p>
                <div className="archive-detail-field">
                  <label>Admin Password <span style={{ color: "#ef4444" }}>*</span></label>
                  <input
                    type="password"
                    placeholder="Enter Admin Password"
                    value={archiveModal.adminPassword}
                    onChange={e => setArchiveModal(prev => ({ ...prev, adminPassword: e.target.value, error: "" }))}
                    onKeyDown={e => { if (e.key === "Enter") handleConfirmArchive(); }}
                    autoComplete="current-password"
                  />
                </div>
              </div>

              {/* Error message */}
              {archiveModal.error && (
                <div className="archive-error-msg">
                  <i className="fa-solid fa-circle-exclamation"></i>
                  {archiveModal.error}
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="archive-reason-footer">
              <button
                className="btn-archive-cancel"
                onClick={closeArchiveModal}
                disabled={archiveModal.isLoading}
              >
                Cancel
              </button>
              <button
                className={`btn-archive-confirm${!archiveModal.reason ? " disabled" : ""}`}
                onClick={handleConfirmArchive}
                disabled={archiveModal.isLoading || !archiveModal.reason}
              >
                {archiveModal.isLoading
                  ? <><i className="fa-solid fa-spinner fa-spin"></i> Archiving...</>
                  : <><i className="fa-solid fa-box-archive"></i> Confirm Archive</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
