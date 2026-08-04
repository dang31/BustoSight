import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { brgyStats } from "../data/brgyData";
import { supabase } from "../lib/supabase";
import "../css/BarangayList.css";

export default function BarangayList() {
  const navigate = useNavigate();
  const storedUser = localStorage.getItem("popdev_user");
  const userProfile = storedUser ? JSON.parse(storedUser) : null;
  const userRole = userProfile?.role || "Staff";
  const isStaff = userRole !== "Admin" && userRole !== "Administrator";
  const [activeBrgy, setActiveBrgy] = useState("Poblacion");
  const [allRecords, setAllRecords] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [selectedYear, setSelectedYear] = useState("all");
  const [selectedHousehold, setSelectedHousehold] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

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

  const openHousehold = async (hhNo) => {
    if (!hhNo) return;
    try {
      const { data, error } = await supabase
        .from("residents")
        .select("*")
        .eq("house_no", hhNo)
        .eq("is_archived", false);

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
                    <th className="text-center">SEX</th>
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
                          onClick={() => openHousehold(res.h_no)}
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
                              className={`sex-badge ${(res.s || "").toLowerCase() === "m" || (res.s || "").toLowerCase() === "male" ? "male" : "female"}`}
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
                                onClick={() => openHousehold(res.h_no)}
                                title="View Household"
                              >
                                <i className="fa-solid fa-eye"></i>
                              </button>
                              <button
                                className="action-btn edit-btn"
                                onClick={() =>
                                  alert("Edit feature is under development.")
                                }
                                title="Edit Resident"
                              >
                                <i className="fa-solid fa-pen-to-square"></i>
                              </button>
                              {!isStaff && (
                                <button
                                  className="action-btn delete-btn"
                                  onClick={() => handleArchive(res)}
                                  title="Archive Resident"
                                >
                                  <i className="fa-solid fa-trash-can"></i>
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
            onClick={(e) => e.stopPropagation()}
          >
            <span
              className="close-modal"
              onClick={() => setSelectedHousehold(null)}
            >
              &times;
            </span>
            <div className="household-header">
              <h2>Household Family Members</h2>
              <p>Household ID: {selectedHousehold.hhNo}</p>
            </div>
            <div style={{ maxHeight: "450px", overflowY: "auto" }}>
              <table className="family-table">
                <thead>
                  <tr>
                    <th>FULL NAME</th>
                    <th>RELATION</th>
                    <th>SEX</th>
                    <th>BIRTHDAY</th>
                    <th>OCCUPATION</th>
                    <th>VOTER?</th>
                    <th>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedHousehold.members.map((m, i) => (
                    <tr
                      key={i}
                      className={
                        (m.rel || "").toUpperCase() === "HEAD" ? "head-row" : ""
                      }
                    >
                      <td>
                        {m.last}, {m.first} {m.mid}
                        {m.isSenior && (
                          <span
                            style={{
                              marginLeft: "5px",
                              fontSize: "9px",
                              background: "#3182ce",
                              color: "white",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              display: "inline-block",
                            }}
                          >
                            Senior
                          </span>
                        )}
                        {m.isPwd && (
                          <span
                            style={{
                              marginLeft: "5px",
                              fontSize: "9px",
                              background: "#38a169",
                              color: "white",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              display: "inline-block",
                            }}
                          >
                            PWD
                          </span>
                        )}
                        {m.isSoloParent && (
                          <span
                            style={{
                              marginLeft: "5px",
                              fontSize: "9px",
                              background: "#e53e3e",
                              color: "white",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              display: "inline-block",
                            }}
                          >
                            Solo Parent
                          </span>
                        )}
                        {m.is4ps && (
                          <span
                            style={{
                              marginLeft: "5px",
                              fontSize: "9px",
                              background: "#f6ad55",
                              color: "white",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              display: "inline-block",
                            }}
                          >
                            4Ps
                          </span>
                        )}
                      </td>
                      <td>{m.rel || "MEMBER"}</td>
                      <td>{m.s || ""}</td>
                      <td>{m.bd || ""}</td>
                      <td>{m.oc || "N/A"}</td>
                      <td>{m.isVoter || "N/A"}</td>
                      <td>
                        <button
                          className="btn-archive-row"
                          onClick={() => handleArchive(m)}
                        >
                          Archive
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
