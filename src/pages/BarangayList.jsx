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
  const [activeBrgy, setActiveBrgy] = useState("Poblacion");
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
          `last_name.ilike.${q},first_name.ilike.${q},house_no.ilike.${q}`,
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

  const handleArchive = async (res) => {
    if (userRole === "Staff") {
      alert("Access Denied: Staff users are not permitted to archive residents.");
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to archive resident ${res.first} ${res.last}?`,
      )
    )
      return;

    const adminPassword = prompt(
      "Security Check: Please enter Admin Password to archive this record:",
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
        .update({
          is_archived: true,
          archive_date: new Date().toISOString(),
        })
        .eq("id", res.id);

      if (error) throw error;

      // Update local state
      const updatedRecords = allRecords.filter((r) => r.id !== res.id);
      setAllRecords(updatedRecords);

      setSelectedHousehold(null);

      logTransaction({
        action: "Archive Resident",
        category: "Resident Management",
        details: `Archived resident ${res.first} ${res.last} (HH# ${res.h_no || "N/A"}) from Barangay ${activeBrgy}.`,
      });

      alert("Successfully archived!");
    } catch (err) {
      console.error("Error archiving:", err);
      alert("Failed to archive: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteBrgyData = async () => {
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
                    {y}
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
                className="btn btn-import"
                onClick={() => document.getElementById("csvFileInput").click()}
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
                className="btn btn-add"
                onClick={() => navigate("/add-resident")}
              >
                <i className="fa-solid fa-user-plus"></i> Add Resident
              </button>
              {/* <button className="btn btn-delete-all" onClick={handleDeleteBrgyData}>
                <i className="fa-solid fa-trash-can"></i> Delete All {activeBrgy}
              </button> */}
              {/* <button className="btn btn-mock" onClick={generateMockData}>
                <i className="fa-solid fa-database"></i> Add Mock Data
              </button> */}
            </div>

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
                                <button
                                  className="action-btn archive-btn"
                                  onClick={() => handleArchive(res)}
                                  title="Archive Resident"
                                >
                                  <i className="fa-solid fa-box-archive"></i>
                                </button>
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

            <div style={{ maxHeight: '520px', overflowY: 'auto', paddingRight: '4px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px', padding: '4px 0' }}>
                {selectedHousehold.members.map((m, i) => {
                  const isHead = (m.rel || '').toUpperCase() === 'HEAD';
                  const fullName = `${m.first || ''} ${m.mid ? (m.mid.endsWith('.') ? m.mid : m.mid[0] + '.') + ' ' : ''}${m.last || ''} ${m.q || ''}`.trim();
                  const initials = `${(m.first?.[0] || '').toUpperCase()}${(m.last?.[0] || '').toUpperCase()}`;
                  return (
                    <div
                      key={i}
                      style={{
                        background: isHead ? 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)' : '#f8fafc',
                        border: isHead ? '2px solid #f6ad55' : '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '18px',
                        position: 'relative',
                        boxShadow: isHead ? '0 4px 12px rgba(246,173,85,0.15)' : '0 2px 6px rgba(0,0,0,0.04)',
                      }}
                    >
                      {/* Card Header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px', paddingBottom: '12px', borderBottom: isHead ? '1px dashed #f6ad55' : '1px dashed #e2e8f0' }}>
                        <div style={{
                          width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
                          background: isHead ? 'linear-gradient(135deg, #f6ad55 0%, #ed8936 100%)' : 'linear-gradient(135deg, #4a8df0 0%, #2c5282 100%)',
                          color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: '700', fontSize: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)'
                        }}>
                          {initials || 'M'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: '700', fontSize: '14px', color: '#1a202c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fullName || '—'}</div>
                          <div style={{ fontSize: '12px', color: isHead ? '#c05621' : '#718096', fontWeight: '600', marginTop: '2px' }}>
                            {m.rel || 'MEMBER'}
                            {isHead && <span style={{ marginLeft: '6px', background: '#f6ad55', color: 'white', fontSize: '10px', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>HEAD</span>}
                          </div>
                        </div>
                      </div>

                      {/* Card Info Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
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
                          <div key={label} style={{ fontSize: '12px' }}>
                            <div style={{ color: '#718096', fontWeight: '500', marginBottom: '1px' }}>{label}</div>
                            <div style={{ color: '#2d3748', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Tags Row */}
                      {(m.isSenior || m.isPwd || m.isSoloParent || m.is4ps) && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #e2e8f0' }}>
                          {m.isSenior && <span style={{ fontSize: '10px', background: '#3182ce', color: 'white', padding: '2px 8px', borderRadius: '10px', fontWeight: '600' }}>Senior</span>}
                          {m.isPwd && <span style={{ fontSize: '10px', background: '#38a169', color: 'white', padding: '2px 8px', borderRadius: '10px', fontWeight: '600' }}>PWD</span>}
                          {m.isSoloParent && <span style={{ fontSize: '10px', background: '#e53e3e', color: 'white', padding: '2px 8px', borderRadius: '10px', fontWeight: '600' }}>Solo Parent</span>}
                          {m.is4ps && <span style={{ fontSize: '10px', background: '#d69e2e', color: 'white', padding: '2px 8px', borderRadius: '10px', fontWeight: '600' }}>4Ps</span>}
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                        <button
                          className="btn-view-indiv"
                          style={{ flex: 1, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '5px' }}
                          onClick={() => setSelectedResident(m)}
                        >
                          <i className="fa-solid fa-eye" style={{ fontSize: '11px' }}></i> View Full Profile
                        </button>
                        {userRole !== 'Staff' && (
                          <button
                            className="btn-archive-row"
                            style={{ padding: '4px 10px' }}
                            onClick={() => handleArchive(m)}
                          >
                            Archive
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
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
                  Household ID: <strong>{selectedResident.h_no || "N/A"}</strong> &bull; Relation: <strong>{selectedResident.rel || "MEMBER"}</strong> &bull; Barangay <strong>{selectedResident.brgy}</strong>
                </p>
              </div>
            </div>

            {/* Grid Details */}
            <div className="res-details-grid">
              {/* Personal Info */}
              <div className="res-card-section">
                <h3><i className="fa-solid fa-id-card"></i> Personal Information</h3>
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

              {/* Address & Housing */}
              <div className="res-card-section">
                <h3><i className="fa-solid fa-house-user"></i> Address & Household</h3>
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

              {/* Education & Occupation */}
              <div className="res-card-section">
                <h3><i className="fa-solid fa-briefcase"></i> Work & Education</h3>
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
                  <span className="res-detail-value">{selectedResident.isVoter || "N/A"}</span>
                </div>
              </div>

              {/* Special Sectors & Programs */}
              <div className="res-card-section">
                <h3><i className="fa-solid fa-layer-group"></i> Special Sectors & Programs</h3>
                <div className="res-detail-row">
                  <span className="res-detail-label">Senior Citizen</span>
                  <span className="res-detail-value">
                    {selectedResident.isSenior ? `Yes ${selectedResident.hasSeniorId ? '(With ID)' : ''}` : 'No'}
                  </span>
                </div>
                <div className="res-detail-row">
                  <span className="res-detail-label">PWD</span>
                  <span className="res-detail-value">
                    {selectedResident.isPwd ? `Yes ${selectedResident.hasPwdId ? '(With ID)' : ''}` : 'No'}
                  </span>
                </div>
                <div className="res-detail-row">
                  <span className="res-detail-label">Solo Parent</span>
                  <span className="res-detail-value">
                    {selectedResident.isSoloParent ? `Yes ${selectedResident.hasSoloParentId ? '(With ID)' : ''}` : 'No'}
                  </span>
                </div>
                <div className="res-detail-row">
                  <span className="res-detail-label">4Ps Beneficiary</span>
                  <span className="res-detail-value">{selectedResident.is4ps ? 'Yes' : 'No'}</span>
                </div>
                <div className="res-detail-row">
                  <span className="res-detail-label">Teenage Pregnancy Case</span>
                  <span className="res-detail-value">{selectedResident.teenagePregnancy ? 'Yes' : 'No'}</span>
                </div>
                <div className="res-detail-row">
                  <span className="res-detail-label">Current Teenage Mother</span>
                  <span className="res-detail-value">
                    {selectedResident.teenageMother ? `Yes ${selectedResident.ageFirstBirth ? `(Age ${selectedResident.ageFirstBirth})` : ''}` : 'No'}
                  </span>
                </div>
                <div className="res-detail-row">
                  <span className="res-detail-label">Data Year</span>
                  <span className="res-detail-value">{selectedResident.dataYear || "N/A"}</span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              {!isStaff && (
                <button
                  className="btn btn-view-archive"
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
                style={{ background: "#cbd5e1", color: "#1e293b" }}
                onClick={() => setSelectedResident(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
