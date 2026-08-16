import { useState, useEffect, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import UserProfileBadge from '../components/UserProfileBadge';
import { supabase } from '../lib/supabase';
import { barangayNames } from '../data/brgyData';
import '../css/Reports.css';

const START_YEAR = 2020;
const CURRENT_YEAR = new Date().getFullYear();
const DATA_YEAR_OPTIONS = Array.from(
  { length: CURRENT_YEAR - START_YEAR + 1 },
  (_, i) => CURRENT_YEAR - i
);

const REPORT_SECTIONS = [
  { id: 'age-gender', label: 'Age and Gender Distribution' },
  { id: 'household', label: 'Total Household Population (14 Barangays)' },
  { id: 'brgy-stats', label: 'Barangay Statistics Summary' },
  { id: 'senior-pwd', label: 'Senior Citizen & PWD Report' },
  { id: 'voters-report', label: 'Total Voters per Barangay' },
  { id: 'generations', label: 'Generations Report' },
];

function ReportHeader({ selectedYear, currentDate }) {
  return (
    <div className="report-header-wrapper" style={{ marginBottom: '20px' }}>
      <div className="report-header-logos" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '30px', marginBottom: '15px' }}>
        <img src="/BP LOGO.png" alt="Bagong Pilipinas Logo" style={{ height: '70px', width: '70px', objectFit: 'contain' }} />
        <img src="/bustos-logo.png" alt="Bustos Logo" style={{ height: '70px', width: '70px', objectFit: 'contain' }} />
        <img src="/POPDEV LOGO.png" alt="POPDEV Logo" style={{ height: '70px', width: '70px', objectFit: 'contain' }} />
      </div>
      
      <div className="report-header-text" style={{ textAlign: 'center', marginBottom: '25px' }}>
        <p style={{ margin: '2px 0', fontSize: '11px', textTransform: 'uppercase', color: '#4a5568', letterSpacing: '0.5px' }}>Republic of the Philippines</p>
        <p style={{ margin: '2px 0', fontSize: '11px', textTransform: 'uppercase', color: '#4a5568', letterSpacing: '0.5px' }}>Province of Bulacan</p>
        <h2 style={{ margin: '5px 0', fontSize: '18px', fontWeight: '800', color: '#1a365d' }}>Municipality of Bustos</h2>
        <p style={{ margin: '8px 0 3px 0', fontSize: '13px', fontWeight: '800', letterSpacing: '1px', color: '#2b6cb0' }}><strong>OFFICIAL CENSUS AND POPULATION REPORT ({selectedYear})</strong></p>
        <p style={{ margin: '2px 0', fontSize: '10px', color: '#718096' }}>Date Generated: <span>{currentDate}</span></p>
      </div>
    </div>
  );
}

function ReportFooter() {
  return (
    <div className="report-footer-signatures" style={{ marginTop: '35px', pageBreakInside: 'avoid' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '40px', padding: '0 10px' }}>
        <div style={{ minWidth: '220px' }}>
          <p style={{ margin: '0 0 35px 0', fontSize: '11px', fontWeight: '600', color: '#2d3748' }}>Prepared by:</p>
          <p style={{ margin: '0', fontSize: '12px', fontWeight: 'bold', color: '#1a202c' }}>_______________________________</p>
          <p style={{ margin: '4px 0 0 0', fontSize: '11px', fontWeight: '700', color: '#1a365d', textTransform: 'uppercase' }}>POPDEV STAFF / ENUMERATOR</p>
        </div>

        <div style={{ minWidth: '220px' }}>
          <p style={{ margin: '0 0 35px 0', fontSize: '11px', fontWeight: '600', color: '#2d3748' }}>Noted by:</p>
          <p style={{ margin: '0', fontSize: '12px', fontWeight: 'bold', color: '#1a202c' }}>_______________________________</p>
          <p style={{ margin: '4px 0 0 0', fontSize: '11px', fontWeight: '700', color: '#1a365d', textTransform: 'uppercase' }}>POPDEV OFFICER</p>
        </div>
      </div>
    </div>
  );
}

export default function Reports() {
  const [selectedSections, setSelectedSections] = useState([]);
  const [residents, setResidents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [genderFilter, setGenderFilter] = useState('both');
  const [generationFilter, setGenerationFilter] = useState('all');
  const [customStartYear, setCustomStartYear] = useState(1990);
  const [customEndYear, setCustomEndYear] = useState(2005);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const currentDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const PAGE_SIZE = 1000;
        let allData = [];
        let page = 0;
        let keepGoing = true;

        while (keepGoing) {
          const from = page * PAGE_SIZE;
          const to = from + PAGE_SIZE - 1;
          const { data, error } = await supabase
            .from('residents')
            .select('barangay, sex, age, birth_date, is_pwd, is_senior, is_solo_parent, is_4ps, is_voter, h_no, is_household_head, has_senior_id, has_pwd_id, has_solo_parent_id')
            .eq('is_archived', false)
            .eq('data_year', selectedYear)
            .range(from, to);

          if (error) throw error;
          if (data && data.length > 0) allData = [...allData, ...data];
          if (!data || data.length < PAGE_SIZE) keepGoing = false;
          else page++;
        }
        setResidents(allData);
      } catch (err) {
        console.error('Error fetching residents for reports:', err);
        // Fallback to localStorage
        const cached = JSON.parse(localStorage.getItem('tanawanData')) || [];
        const mapped = cached.map(c => ({
          barangay: c.brgy,
          sex: c.s,
          age: c.age,
          birth_date: c.bd,
          is_pwd: c.isPwd,
          has_pwd_id: c.hasPwdId,
          is_senior: c.isSenior,
          has_senior_id: c.hasSeniorId,
          is_solo_parent: c.isSoloParent,
          has_solo_parent_id: c.hasSoloParentId,
          is_4ps: c.is4ps,
          is_voter: c.isVoter,
          h_no: c.h_no,
          is_household_head: c.isHead
        }));
        setResidents(mapped);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [selectedYear]);

  const toggleSection = (id) => {
    setSelectedSections(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedSections.length === REPORT_SECTIONS.length) {
      setSelectedSections([]);
    } else {
      setSelectedSections(REPORT_SECTIONS.map(s => s.id));
    }
  };

  const handlePrint = () => {
    if (selectedSections.length === 0) {
      alert('Please select at least one report!');
      return;
    }

    if (selectedSections.includes('generations') && generationFilter === 'custom') {
      const s = parseInt(customStartYear, 10);
      const e = parseInt(customEndYear, 10);
      if (!customStartYear || !customEndYear || isNaN(s) || isNaN(e)) {
        alert('Invalid Year Range: Please enter both Start Year and End Year.');
        return;
      }
      if (s > e) {
        alert(`Invalid Year Range: Start Year (${s}) cannot be greater than End Year (${e}).`);
        return;
      }
    }

    window.print();
  };

  // Calculations
  const ageGenderDist = () => {
    const barangayData = {};
    barangayNames.forEach(name => {
      barangayData[name] = {
        b0_17: { male: 0, female: 0, total: 0 },
        b18_24: { male: 0, female: 0, total: 0 },
        b25_34: { male: 0, female: 0, total: 0 },
        b35_44: { male: 0, female: 0, total: 0 },
        b45_54: { male: 0, female: 0, total: 0 },
        b55_64: { male: 0, female: 0, total: 0 },
        b65plus: { male: 0, female: 0, total: 0 },
        total: { male: 0, female: 0, total: 0 }
      };
    });

    residents.forEach(r => {
      const brgy = r.barangay;
      if (!barangayData[brgy]) return;

      const sex = (r.sex || '').toUpperCase();
      const isMale = sex === 'MALE' || sex === 'M';
      const isFemale = sex === 'FEMALE' || sex === 'F';
      
      const age = parseInt(r.age, 10);
      if (isNaN(age) || age < 0) return;

      let key = '';
      if (age <= 17) key = 'b0_17';
      else if (age <= 24) key = 'b18_24';
      else if (age <= 34) key = 'b25_34';
      else if (age <= 44) key = 'b35_44';
      else if (age <= 54) key = 'b45_54';
      else if (age <= 64) key = 'b55_64';
      else key = 'b65plus';

      if (isMale) {
        barangayData[brgy][key].male++;
        barangayData[brgy][key].total++;
        barangayData[brgy].total.male++;
        barangayData[brgy].total.total++;
      } else if (isFemale) {
        barangayData[brgy][key].female++;
        barangayData[brgy][key].total++;
        barangayData[brgy].total.female++;
        barangayData[brgy].total.total++;
      }
    });

    const grandTotal = {
      b0_17: { male: 0, female: 0, total: 0 },
      b18_24: { male: 0, female: 0, total: 0 },
      b25_34: { male: 0, female: 0, total: 0 },
      b35_44: { male: 0, female: 0, total: 0 },
      b45_54: { male: 0, female: 0, total: 0 },
      b55_64: { male: 0, female: 0, total: 0 },
      b65plus: { male: 0, female: 0, total: 0 },
      total: { male: 0, female: 0, total: 0 }
    };

    const keys = ['b0_17', 'b18_24', 'b25_34', 'b35_44', 'b45_54', 'b55_64', 'b65plus', 'total'];

    barangayNames.forEach(name => {
      const d = barangayData[name];
      keys.forEach(k => {
        grandTotal[k].male += d[k].male;
        grandTotal[k].female += d[k].female;
        grandTotal[k].total += d[k].total;
      });
    });

    const rows = barangayNames.map(name => ({
      name,
      ...barangayData[name]
    }));

    return { rows, grandTotal };
  };

  const householdPop = () => {
    const dataMap = {};
    barangayNames.forEach(name => {
      dataMap[name] = { households: new Set(), population: 0 };
    });

    residents.forEach(r => {
      const brgy = r.barangay;
      if (dataMap[brgy]) {
        if (r.h_no) {
          dataMap[brgy].households.add(r.h_no);
        }
        dataMap[brgy].population++;
      }
    });

    let grandHouseholds = 0;
    let grandPopulation = 0;

    const rows = barangayNames.map(name => {
      const hhCount = dataMap[name].households.size;
      const popCount = dataMap[name].population;
      grandHouseholds += hhCount;
      grandPopulation += popCount;
      return { name, households: hhCount, population: popCount };
    });

    return { rows, grandTotal: { households: grandHouseholds, population: grandPopulation } };
  };

  const brgyStatsSum = () => {
    const dataMap = {};
    barangayNames.forEach(name => {
      dataMap[name] = { seniors: 0, pwds: 0, voters: 0 };
    });

    residents.forEach(r => {
      const brgy = r.barangay;
      if (dataMap[brgy]) {
        if (r.is_senior) dataMap[brgy].seniors++;
        if (r.is_pwd) dataMap[brgy].pwds++;
        const voterStr = (r.is_voter || '').toLowerCase();
        if (voterStr.includes('registered')) dataMap[brgy].voters++;
      }
    });

    let grandSeniors = 0;
    let grandPwds = 0;
    let grandVoters = 0;

    const rows = barangayNames.map(name => {
      const s = dataMap[name].seniors;
      const p = dataMap[name].pwds;
      const v = dataMap[name].voters;
      grandSeniors += s;
      grandPwds += p;
      grandVoters += v;
      return { name, seniors: s, pwds: p, voters: v };
    });

    return { rows, grandTotal: { seniors: grandSeniors, pwds: grandPwds, voters: grandVoters } };
  };

  const seniorPwdRep = () => {
    const dataMap = {};
    barangayNames.forEach(name => {
      dataMap[name] = { 
        seniors: 0, seniorsWithId: 0, seniorsNoId: 0,
        pwds: 0, pwdsWithId: 0, pwdsNoId: 0
      };
    });

    residents.forEach(r => {
      const brgy = r.barangay;
      if (dataMap[brgy]) {
        if (r.is_senior) {
          dataMap[brgy].seniors++;
          if (r.has_senior_id) dataMap[brgy].seniorsWithId++;
          else dataMap[brgy].seniorsNoId++;
        }
        if (r.is_pwd) {
          dataMap[brgy].pwds++;
          if (r.has_pwd_id) dataMap[brgy].pwdsWithId++;
          else dataMap[brgy].pwdsNoId++;
        }
      }
    });

    let totalSeniors = 0, totalSeniorsWithId = 0, totalSeniorsNoId = 0;
    let totalPwds = 0, totalPwdsWithId = 0, totalPwdsNoId = 0;

    const rows = barangayNames.map(name => {
      const d = dataMap[name];
      totalSeniors += d.seniors;
      totalSeniorsWithId += d.seniorsWithId;
      totalSeniorsNoId += d.seniorsNoId;
      totalPwds += d.pwds;
      totalPwdsWithId += d.pwdsWithId;
      totalPwdsNoId += d.pwdsNoId;
      return { name, ...d };
    });

    return {
      rows,
      grandTotal: {
        seniors: totalSeniors,
        seniorsWithId: totalSeniorsWithId,
        seniorsNoId: totalSeniorsNoId,
        pwds: totalPwds,
        pwdsWithId: totalPwdsWithId,
        pwdsNoId: totalPwdsNoId
      }
    };
  };

  const votersRep = () => {
    const dataMap = {};
    barangayNames.forEach(name => {
      dataMap[name] = { registered: 0, notRegistered: 0, total: 0 };
    });

    residents.forEach(r => {
      const brgy = r.barangay;
      if (dataMap[brgy]) {
        dataMap[brgy].total++;
        const voterStr = (r.is_voter || '').toLowerCase();
        if (voterStr.includes('registered')) {
          dataMap[brgy].registered++;
        } else {
          dataMap[brgy].notRegistered++;
        }
      }
    });

    let totalRegistered = 0, totalNotRegistered = 0, totalResidents = 0;

    const rows = barangayNames.map(name => {
      const d = dataMap[name];
      totalRegistered += d.registered;
      totalNotRegistered += d.notRegistered;
      totalResidents += d.total;
      return { name, ...d };
    });

    return {
      rows,
      grandTotal: {
        registered: totalRegistered,
        notRegistered: totalNotRegistered,
        total: totalResidents
      }
    };
  };

  const getGenerationTitle = () => {
    switch (generationFilter) {
      case 'gen-z': return 'Generation Z (1997–2012)';
      case 'millennials': return 'Millennials (1981–1996)';
      case 'gen-x': return 'Generation X (1965–1980)';
      case 'boomers-2': return 'Boomers II (1955–1964)';
      case 'boomers-1': return 'Boomers I (1946–1954)';
      case 'post-war': return 'Post War (1928–1945)';
      case 'ww2': return 'WWII (1922–1927)';
      case 'custom': {
        const s = customStartYear || '...';
        const e = customEndYear || '...';
        return `Specific Year Range (${s}–${e})`;
      }
      default: return 'All Generations';
    }
  };

  const generationsRep = () => {
    const barangayData = {};
    barangayNames.forEach(name => {
      barangayData[name] = {
        genZ: 0,
        millennials: 0,
        genX: 0,
        boomers2: 0,
        boomers1: 0,
        postWar: 0,
        ww2: 0,
        male: 0,
        female: 0,
        total: 0,
      };
    });

    const startYr = generationFilter === 'custom' ? parseInt(customStartYear, 10) : null;
    const endYr = generationFilter === 'custom' ? parseInt(customEndYear, 10) : null;

    residents.forEach(r => {
      const brgy = r.barangay;
      if (!barangayData[brgy]) return;

      let birthYear = null;
      if (r.birth_date) {
        const yr = new Date(r.birth_date).getFullYear();
        if (!isNaN(yr)) birthYear = yr;
      }
      if (birthYear === null && r.age !== null && r.age !== undefined && r.age !== '') {
        const ageNum = parseInt(r.age, 10);
        if (!isNaN(ageNum) && ageNum >= 0) {
          birthYear = selectedYear - ageNum;
        }
      }

      if (birthYear === null) return;

      const sex = (r.sex || '').toUpperCase();
      const isMale = sex === 'MALE' || sex === 'M';
      const isFemale = sex === 'FEMALE' || sex === 'F';

      // Count by generation for 'all' breakdown
      if (birthYear >= 1997 && birthYear <= 2012) barangayData[brgy].genZ++;
      else if (birthYear >= 1981 && birthYear <= 1996) barangayData[brgy].millennials++;
      else if (birthYear >= 1965 && birthYear <= 1980) barangayData[brgy].genX++;
      else if (birthYear >= 1955 && birthYear <= 1964) barangayData[brgy].boomers2++;
      else if (birthYear >= 1946 && birthYear <= 1954) barangayData[brgy].boomers1++;
      else if (birthYear >= 1928 && birthYear <= 1945) barangayData[brgy].postWar++;
      else if (birthYear >= 1922 && birthYear <= 1927) barangayData[brgy].ww2++;

      // Check filter match for single selection
      let isMatch = false;
      if (generationFilter === 'all') {
        isMatch = true;
      } else if (generationFilter === 'gen-z' && birthYear >= 1997 && birthYear <= 2012) {
        isMatch = true;
      } else if (generationFilter === 'millennials' && birthYear >= 1981 && birthYear <= 1996) {
        isMatch = true;
      } else if (generationFilter === 'gen-x' && birthYear >= 1965 && birthYear <= 1980) {
        isMatch = true;
      } else if (generationFilter === 'boomers-2' && birthYear >= 1955 && birthYear <= 1964) {
        isMatch = true;
      } else if (generationFilter === 'boomers-1' && birthYear >= 1946 && birthYear <= 1954) {
        isMatch = true;
      } else if (generationFilter === 'post-war' && birthYear >= 1928 && birthYear <= 1945) {
        isMatch = true;
      } else if (generationFilter === 'ww2' && birthYear >= 1922 && birthYear <= 1927) {
        isMatch = true;
      } else if (generationFilter === 'custom') {
        const s = parseInt(customStartYear, 10);
        const e = parseInt(customEndYear, 10);
        if (!isNaN(s) && !isNaN(e) && s <= e) {
          if (birthYear >= s && birthYear <= e) {
            isMatch = true;
          }
        }
      }

      if (isMatch) {
        if (isMale) barangayData[brgy].male++;
        else if (isFemale) barangayData[brgy].female++;
        barangayData[brgy].total++;
      }
    });

    let grandGenZ = 0, grandMillennials = 0, grandGenX = 0, grandBoomers2 = 0, grandBoomers1 = 0, grandPostWar = 0, grandWw2 = 0;
    let grandMale = 0, grandFemale = 0, grandTotal = 0;

    const rows = barangayNames.map(name => {
      const d = barangayData[name];
      grandGenZ += d.genZ;
      grandMillennials += d.millennials;
      grandGenX += d.genX;
      grandBoomers2 += d.boomers2;
      grandBoomers1 += d.boomers1;
      grandPostWar += d.postWar;
      grandWw2 += d.ww2;
      grandMale += d.male;
      grandFemale += d.female;
      grandTotal += d.total;
      return { name, ...d };
    });

    return {
      rows,
      grandTotal: {
        genZ: grandGenZ,
        millennials: grandMillennials,
        genX: grandGenX,
        boomers2: grandBoomers2,
        boomers1: grandBoomers1,
        postWar: grandPostWar,
        ww2: grandWw2,
        male: grandMale,
        female: grandFemale,
        total: grandTotal,
      }
    };
  };

  const ageData = ageGenderDist();
  const householdData = householdPop();
  const statsSummary = brgyStatsSum();
  const seniorPwdData = seniorPwdRep();
  const votersData = votersRep();
  const generationsData = generationsRep();

  return (
    <div className="dashboard-wrapper">
      <div className="bg-image" />
      <div className="overlay" />
      <Sidebar />

      <main className="content reports-content">
        <header className="main-header reports-header">
          <h1>Bustos Population Reports</h1>
          <UserProfileBadge />
        </header>

        <div className="report-card animate-fade-up">
          <div className="report-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
            <div>
              <h2>Generate Reports</h2>
              <p>Select the components to include in the printed report:</p>
            </div>
            
            <div 
              className="year-selector" 
              ref={dropdownRef}
              style={{ position: 'relative', background: 'rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', minWidth: '120px' }}
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <label style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.9, display: 'block', marginBottom: '2px', cursor: 'pointer' }}>Data Year</label>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'white', fontSize: '15px', fontWeight: 'bold' }}>{selectedYear}</span>
                <i className={`fas fa-chevron-${isDropdownOpen ? 'up' : 'down'}`} style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', marginLeft: '10px' }}></i>
              </div>

              {isDropdownOpen && (
                <div style={{ 
                  position: 'absolute', 
                  top: '100%', 
                  left: 0, 
                  right: 0, 
                  marginTop: '8px', 
                  background: 'white', 
                  borderRadius: '8px', 
                  boxShadow: '0 10px 25px rgba(0,0,0,0.15)', 
                  overflow: 'hidden', 
                  zIndex: 50,
                  border: '1px solid var(--gray-200)'
                }}>
                  {DATA_YEAR_OPTIONS.map(y => (
                    <div 
                      key={y}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedYear(y);
                        setIsDropdownOpen(false);
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f0f7ff'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                      style={{ 
                        padding: '10px 15px', 
                        fontSize: '14px', 
                        fontWeight: selectedYear === y ? '700' : '500', 
                        color: selectedYear === y ? 'var(--primary)' : 'var(--gray-700)', 
                        background: 'white',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      {y}
                      {selectedYear === y && <i className="fas fa-check" style={{ fontSize: '12px' }}></i>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-600)' }}>
              <div className="loading-spinner" style={{ marginBottom: '15px' }} />
              <p>Loading census database records...</p>
            </div>
          ) : (
            <>
              <div className="report-selection-list">
                <label className="checkbox-group">
                  <input 
                    type="checkbox" 
                    checked={selectedSections.length === REPORT_SECTIONS.length} 
                    onChange={toggleAll}
                  />
                  <span className="main-toggle-label">Select All Reports</span>
                </label>

                <div className="sub-items">
                  {REPORT_SECTIONS.map(section => (
                    <div key={section.id} style={{ display: 'flex', flexDirection: 'column' }}>
                      <label className="checkbox-group">
                        <input 
                          type="checkbox" 
                          checked={selectedSections.includes(section.id)}
                          onChange={() => toggleSection(section.id)}
                        />
                        <span className="report-item-label">{section.label}</span>
                      </label>

                      {section.id === 'age-gender' && selectedSections.includes('age-gender') && (
                        <div style={{ marginLeft: '32px', marginTop: '4px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--gray-600)' }}>Select Gender:</span>
                          <div style={{ display: 'inline-flex', gap: '4px', background: '#e2e8f0', padding: '3px', borderRadius: '6px' }}>
                            {[
                              { id: 'both', label: 'Both' },
                              { id: 'male', label: 'Male' },
                              { id: 'female', label: 'Female' }
                            ].map(opt => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setGenderFilter(opt.id);
                                }}
                                style={{
                                  padding: '3px 10px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  border: 'none',
                                  background: genderFilter === opt.id ? 'var(--primary)' : 'transparent',
                                  color: genderFilter === opt.id ? 'white' : '#4a5568',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {section.id === 'generations' && selectedSections.includes('generations') && (
                        <div style={{ marginLeft: '32px', marginTop: '6px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '10px', background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--primary-dark)' }}>Select Generation Target:</span>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '8px' }}>
                            {[
                              { id: 'custom', label: 'Specific Year Range' },
                              { id: 'all', label: 'All' },
                              { id: 'gen-z', label: 'Generation Z (1997–2012)' },
                              { id: 'millennials', label: 'Millennials (1981–1996)' },
                              { id: 'gen-x', label: 'Generation X (1965–1980)' },
                              { id: 'boomers-2', label: 'Boomers II (1955–1964)' },
                              { id: 'boomers-1', label: 'Boomers I (1946–1954)' },
                              { id: 'post-war', label: 'Post War (1928–1945)' },
                              { id: 'ww2', label: 'WWII (1922–1927)' },
                            ].map(opt => (
                              <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12.5px', color: '#334155', fontWeight: generationFilter === opt.id ? '700' : '500' }}>
                                <input
                                  type="radio"
                                  name="generationFilter"
                                  value={opt.id}
                                  checked={generationFilter === opt.id}
                                  onChange={() => setGenerationFilter(opt.id)}
                                  style={{ accentColor: 'var(--primary)', cursor: 'pointer', width: '15px', height: '15px' }}
                                />
                                {opt.label}
                              </label>
                            ))}
                          </div>

                          {generationFilter === 'custom' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px', padding: '10px 14px', background: 'white', borderRadius: '6px', border: '1px solid #94a3b8' }}>
                              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                <span style={{ fontSize: '12px', fontWeight: '700', color: '#334155' }}>Specific Year Range (Birth Year):</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <input
                                    type="number"
                                    placeholder="Start (e.g. 1990)"
                                    value={customStartYear}
                                    onChange={(e) => setCustomStartYear(e.target.value)}
                                    style={{ width: '130px', padding: '6px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#1e293b', fontWeight: '600' }}
                                  />
                                  <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#64748b' }}>–</span>
                                  <input
                                    type="number"
                                    placeholder="End (e.g. 2005)"
                                    value={customEndYear}
                                    onChange={(e) => setCustomEndYear(e.target.value)}
                                    style={{ width: '130px', padding: '6px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#1e293b', fontWeight: '600' }}
                                  />
                                </div>
                              </div>
                              {customStartYear && customEndYear && parseInt(customStartYear, 10) > parseInt(customEndYear, 10) && (
                                <span style={{ color: '#ef4444', fontSize: '12px', fontWeight: '600' }}>
                                  ⚠ Invalid Year Range: Start Year ({customStartYear}) cannot be greater than End Year ({customEndYear}).
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="report-actions">
                <button className="generate-print-btn" onClick={handlePrint}>
                  <i className="fas fa-print"></i> Generate &amp; Print Selected
                </button>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Printable Area */}
      <div id="printable-area">
        {selectedSections.includes('age-gender') && (
          <div id="age-gender" className="report-section show-print">
            <ReportHeader selectedYear={selectedYear} currentDate={currentDate} />
            <h3>I. Age and Gender Distribution per Barangay{genderFilter !== 'both' ? ` (${genderFilter === 'male' ? 'Male Only' : 'Female Only'})` : ''}</h3>
            <table style={{ fontSize: '11px' }}>
              <thead>
                {genderFilter === 'both' ? (
                  <>
                    <tr>
                      <th rowSpan="2" style={{ verticalAlign: 'middle', textAlign: 'center', width: '30px' }}>#</th>
                      <th rowSpan="2" style={{ verticalAlign: 'middle', textAlign: 'left' }}>BARANGAY</th>
                      <th colSpan="3">(0-17)</th>
                      <th colSpan="3">(18-24)</th>
                      <th colSpan="3">(25-34)</th>
                      <th colSpan="3">(35-44)</th>
                      <th colSpan="3">(45-54)</th>
                      <th colSpan="3">(55-64)</th>
                      <th colSpan="3">(65 and above)</th>
                      <th colSpan="3">TOTAL</th>
                    </tr>
                    <tr>
                      <th style={{ padding: '3px 2px' }}>M</th><th style={{ padding: '3px 2px' }}>F</th><th style={{ padding: '3px 2px' }}>T</th>
                      <th style={{ padding: '3px 2px' }}>M</th><th style={{ padding: '3px 2px' }}>F</th><th style={{ padding: '3px 2px' }}>T</th>
                      <th style={{ padding: '3px 2px' }}>M</th><th style={{ padding: '3px 2px' }}>F</th><th style={{ padding: '3px 2px' }}>T</th>
                      <th style={{ padding: '3px 2px' }}>M</th><th style={{ padding: '3px 2px' }}>F</th><th style={{ padding: '3px 2px' }}>T</th>
                      <th style={{ padding: '3px 2px' }}>M</th><th style={{ padding: '3px 2px' }}>F</th><th style={{ padding: '3px 2px' }}>T</th>
                      <th style={{ padding: '3px 2px' }}>M</th><th style={{ padding: '3px 2px' }}>F</th><th style={{ padding: '3px 2px' }}>T</th>
                      <th style={{ padding: '3px 2px' }}>M</th><th style={{ padding: '3px 2px' }}>F</th><th style={{ padding: '3px 2px' }}>T</th>
                      <th style={{ padding: '3px 2px' }}>M</th><th style={{ padding: '3px 2px' }}>F</th><th style={{ padding: '3px 2px' }}>T</th>
                    </tr>
                  </>
                ) : (
                  <tr>
                    <th style={{ textAlign: 'center', width: '30px' }}>#</th>
                    <th style={{ textAlign: 'left' }}>BARANGAY</th>
                    <th>(0-17)</th>
                    <th>(18-24)</th>
                    <th>(25-34)</th>
                    <th>(35-44)</th>
                    <th>(45-54)</th>
                    <th>(55-64)</th>
                    <th>(65 and above)</th>
                    <th>TOTAL ({genderFilter.toUpperCase()})</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {ageData.rows.map((row, idx) => (
                  <tr key={row.name}>
                    <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                    <td>{row.name}</td>
                    {genderFilter === 'both' ? (
                      <>
                        <td style={{ padding: '4px 2px', textAlign: 'center' }}>{row.b0_17.male}</td>
                        <td style={{ padding: '4px 2px', textAlign: 'center' }}>{row.b0_17.female}</td>
                        <td style={{ padding: '4px 2px', textAlign: 'center' }}>{row.b0_17.total}</td>

                        <td style={{ padding: '4px 2px', textAlign: 'center' }}>{row.b18_24.male}</td>
                        <td style={{ padding: '4px 2px', textAlign: 'center' }}>{row.b18_24.female}</td>
                        <td style={{ padding: '4px 2px', textAlign: 'center' }}>{row.b18_24.total}</td>

                        <td style={{ padding: '4px 2px', textAlign: 'center' }}>{row.b25_34.male}</td>
                        <td style={{ padding: '4px 2px', textAlign: 'center' }}>{row.b25_34.female}</td>
                        <td style={{ padding: '4px 2px', textAlign: 'center' }}>{row.b25_34.total}</td>

                        <td style={{ padding: '4px 2px', textAlign: 'center' }}>{row.b35_44.male}</td>
                        <td style={{ padding: '4px 2px', textAlign: 'center' }}>{row.b35_44.female}</td>
                        <td style={{ padding: '4px 2px', textAlign: 'center' }}>{row.b35_44.total}</td>

                        <td style={{ padding: '4px 2px', textAlign: 'center' }}>{row.b45_54.male}</td>
                        <td style={{ padding: '4px 2px', textAlign: 'center' }}>{row.b45_54.female}</td>
                        <td style={{ padding: '4px 2px', textAlign: 'center' }}>{row.b45_54.total}</td>

                        <td style={{ padding: '4px 2px', textAlign: 'center' }}>{row.b55_64.male}</td>
                        <td style={{ padding: '4px 2px', textAlign: 'center' }}>{row.b55_64.female}</td>
                        <td style={{ padding: '4px 2px', textAlign: 'center' }}>{row.b55_64.total}</td>

                        <td style={{ padding: '4px 2px', textAlign: 'center' }}>{row.b65plus.male}</td>
                        <td style={{ padding: '4px 2px', textAlign: 'center' }}>{row.b65plus.female}</td>
                        <td style={{ padding: '4px 2px', textAlign: 'center' }}>{row.b65plus.total}</td>

                        <td style={{ padding: '4px 2px', textAlign: 'center' }}><strong>{row.total.male}</strong></td>
                        <td style={{ padding: '4px 2px', textAlign: 'center' }}><strong>{row.total.female}</strong></td>
                        <td style={{ padding: '4px 2px', textAlign: 'center' }}><strong>{row.total.total}</strong></td>
                      </>
                    ) : (
                      <>
                        <td style={{ textAlign: 'center' }}>{row.b0_17[genderFilter]}</td>
                        <td style={{ textAlign: 'center' }}>{row.b18_24[genderFilter]}</td>
                        <td style={{ textAlign: 'center' }}>{row.b25_34[genderFilter]}</td>
                        <td style={{ textAlign: 'center' }}>{row.b35_44[genderFilter]}</td>
                        <td style={{ textAlign: 'center' }}>{row.b45_54[genderFilter]}</td>
                        <td style={{ textAlign: 'center' }}>{row.b55_64[genderFilter]}</td>
                        <td style={{ textAlign: 'center' }}>{row.b65plus[genderFilter]}</td>
                        <td style={{ textAlign: 'center' }}><strong>{row.total[genderFilter]}</strong></td>
                      </>
                    )}
                  </tr>
                ))}
                <tr>
                  <td colSpan="2" style={{ textAlign: 'left' }}><strong>GRAND TOTAL</strong></td>
                  {genderFilter === 'both' ? (
                    <>
                      <td style={{ padding: '4px 2px', textAlign: 'center' }}><strong>{ageData.grandTotal.b0_17.male}</strong></td>
                      <td style={{ padding: '4px 2px', textAlign: 'center' }}><strong>{ageData.grandTotal.b0_17.female}</strong></td>
                      <td style={{ padding: '4px 2px', textAlign: 'center' }}><strong>{ageData.grandTotal.b0_17.total}</strong></td>

                      <td style={{ padding: '4px 2px', textAlign: 'center' }}><strong>{ageData.grandTotal.b18_24.male}</strong></td>
                      <td style={{ padding: '4px 2px', textAlign: 'center' }}><strong>{ageData.grandTotal.b18_24.female}</strong></td>
                      <td style={{ padding: '4px 2px', textAlign: 'center' }}><strong>{ageData.grandTotal.b18_24.total}</strong></td>

                      <td style={{ padding: '4px 2px', textAlign: 'center' }}><strong>{ageData.grandTotal.b25_34.male}</strong></td>
                      <td style={{ padding: '4px 2px', textAlign: 'center' }}><strong>{ageData.grandTotal.b25_34.female}</strong></td>
                      <td style={{ padding: '4px 2px', textAlign: 'center' }}><strong>{ageData.grandTotal.b25_34.total}</strong></td>

                      <td style={{ padding: '4px 2px', textAlign: 'center' }}><strong>{ageData.grandTotal.b35_44.male}</strong></td>
                      <td style={{ padding: '4px 2px', textAlign: 'center' }}><strong>{ageData.grandTotal.b35_44.female}</strong></td>
                      <td style={{ padding: '4px 2px', textAlign: 'center' }}><strong>{ageData.grandTotal.b35_44.total}</strong></td>

                      <td style={{ padding: '4px 2px', textAlign: 'center' }}><strong>{ageData.grandTotal.b45_54.male}</strong></td>
                      <td style={{ padding: '4px 2px', textAlign: 'center' }}><strong>{ageData.grandTotal.b45_54.female}</strong></td>
                      <td style={{ padding: '4px 2px', textAlign: 'center' }}><strong>{ageData.grandTotal.b45_54.total}</strong></td>

                      <td style={{ padding: '4px 2px', textAlign: 'center' }}><strong>{ageData.grandTotal.b55_64.male}</strong></td>
                      <td style={{ padding: '4px 2px', textAlign: 'center' }}><strong>{ageData.grandTotal.b55_64.female}</strong></td>
                      <td style={{ padding: '4px 2px', textAlign: 'center' }}><strong>{ageData.grandTotal.b55_64.total}</strong></td>

                      <td style={{ padding: '4px 2px', textAlign: 'center' }}><strong>{ageData.grandTotal.b65plus.male}</strong></td>
                      <td style={{ padding: '4px 2px', textAlign: 'center' }}><strong>{ageData.grandTotal.b65plus.female}</strong></td>
                      <td style={{ padding: '4px 2px', textAlign: 'center' }}><strong>{ageData.grandTotal.b65plus.total}</strong></td>

                      <td style={{ padding: '4px 2px', textAlign: 'center' }}><strong>{ageData.grandTotal.total.male}</strong></td>
                      <td style={{ padding: '4px 2px', textAlign: 'center' }}><strong>{ageData.grandTotal.total.female}</strong></td>
                      <td style={{ padding: '4px 2px', textAlign: 'center' }}><strong>{ageData.grandTotal.total.total}</strong></td>
                    </>
                  ) : (
                    <>
                      <td style={{ textAlign: 'center' }}><strong>{ageData.grandTotal.b0_17[genderFilter]}</strong></td>
                      <td style={{ textAlign: 'center' }}><strong>{ageData.grandTotal.b18_24[genderFilter]}</strong></td>
                      <td style={{ textAlign: 'center' }}><strong>{ageData.grandTotal.b25_34[genderFilter]}</strong></td>
                      <td style={{ textAlign: 'center' }}><strong>{ageData.grandTotal.b35_44[genderFilter]}</strong></td>
                      <td style={{ textAlign: 'center' }}><strong>{ageData.grandTotal.b45_54[genderFilter]}</strong></td>
                      <td style={{ textAlign: 'center' }}><strong>{ageData.grandTotal.b55_64[genderFilter]}</strong></td>
                      <td style={{ textAlign: 'center' }}><strong>{ageData.grandTotal.b65plus[genderFilter]}</strong></td>
                      <td style={{ textAlign: 'center' }}><strong>{ageData.grandTotal.total[genderFilter]}</strong></td>
                    </>
                  )}
                </tr>
              </tbody>
            </table>
            <ReportFooter />
          </div>
        )}

        {selectedSections.includes('household') && (
          <div id="household" className="report-section show-print">
            <ReportHeader selectedYear={selectedYear} currentDate={currentDate} />
            <h3>II. Total Household Population (14 Barangays)</h3>
            <table>
              <thead>
                <tr><th style={{ width: '50px', textAlign: 'center' }}>#</th><th>BARANGAY</th><th>HOUSEHOLDS</th><th>POPULATION</th></tr>
              </thead>
              <tbody>
                {householdData.rows.map((row, idx) => (
                  <tr key={row.name}>
                    <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                    <td>{row.name}</td>
                    <td>{row.households}</td>
                    <td>{row.population}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan="2"><strong>GRAND TOTAL</strong></td>
                  <td><strong>{householdData.grandTotal.households}</strong></td>
                  <td><strong>{householdData.grandTotal.population}</strong></td>
                </tr>
              </tbody>
            </table>
            <ReportFooter />
          </div>
        )}

        {selectedSections.includes('brgy-stats') && (
          <div id="brgy-stats" className="report-section show-print">
            <ReportHeader selectedYear={selectedYear} currentDate={currentDate} />
            <h3>III. Barangay Statistics Summary</h3>
            <table>
              <thead>
                <tr><th>BARANGAY</th><th>SENIORS</th><th>PWDs</th><th>VOTERS</th></tr>
              </thead>
              <tbody>
                {statsSummary.rows.map(row => (
                  <tr key={row.name}>
                    <td>{row.name}</td>
                    <td>{row.seniors}</td>
                    <td>{row.pwds}</td>
                    <td>{row.voters}</td>
                  </tr>
                ))}
                <tr>
                  <td><strong>GRAND TOTAL</strong></td>
                  <td><strong>{statsSummary.grandTotal.seniors}</strong></td>
                  <td><strong>{statsSummary.grandTotal.pwds}</strong></td>
                  <td><strong>{statsSummary.grandTotal.voters}</strong></td>
                </tr>
              </tbody>
            </table>
            <ReportFooter />
          </div>
        )}

        {selectedSections.includes('senior-pwd') && (
          <div id="senior-pwd" className="report-section show-print">
            <ReportHeader selectedYear={selectedYear} currentDate={currentDate} />
            <h3>IV. Senior Citizen &amp; PWD Detailed Report</h3>
            <table>
              <thead>
                <tr>
                  <th rowSpan="2" style={{ verticalAlign: 'middle', textAlign: 'left' }}>BARANGAY</th>
                  <th colSpan="3">SENIOR CITIZENS</th>
                  <th colSpan="3">PERSONS WITH DISABILITIES (PWD)</th>
                </tr>
                <tr>
                  <th>TOTAL</th>
                  <th>WITH ID</th>
                  <th>NO ID</th>
                  <th>TOTAL</th>
                  <th>WITH ID</th>
                  <th>NO ID</th>
                </tr>
              </thead>
              <tbody>
                {seniorPwdData.rows.map(row => (
                  <tr key={row.name}>
                    <td>{row.name}</td>
                    <td>{row.seniors}</td>
                    <td>{row.seniorsWithId}</td>
                    <td>{row.seniorsNoId}</td>
                    <td>{row.pwds}</td>
                    <td>{row.pwdsWithId}</td>
                    <td>{row.pwdsNoId}</td>
                  </tr>
                ))}
                <tr>
                  <td><strong>GRAND TOTAL</strong></td>
                  <td><strong>{seniorPwdData.grandTotal.seniors}</strong></td>
                  <td><strong>{seniorPwdData.grandTotal.seniorsWithId}</strong></td>
                  <td><strong>{seniorPwdData.grandTotal.seniorsNoId}</strong></td>
                  <td><strong>{seniorPwdData.grandTotal.pwds}</strong></td>
                  <td><strong>{seniorPwdData.grandTotal.pwdsWithId}</strong></td>
                  <td><strong>{seniorPwdData.grandTotal.pwdsNoId}</strong></td>
                </tr>
              </tbody>
            </table>
            <ReportFooter />
          </div>
        )}

        {selectedSections.includes('voters-report') && (
          <div id="voters-report" className="report-section show-print">
            <ReportHeader selectedYear={selectedYear} currentDate={currentDate} />
            <h3>V. Total Voters per Barangay</h3>
            <table>
              <thead>
                <tr>
                  <th>BARANGAY</th>
                  <th>REGISTERED VOTERS</th>
                  <th>NOT REGISTERED VOTERS</th>
                  <th>TOTAL RESIDENTS</th>
                </tr>
              </thead>
              <tbody>
                {votersData.rows.map(row => (
                  <tr key={row.name}>
                    <td>{row.name}</td>
                    <td>{row.registered}</td>
                    <td>{row.notRegistered}</td>
                    <td>{row.total}</td>
                  </tr>
                ))}
                <tr>
                  <td><strong>GRAND TOTAL</strong></td>
                  <td><strong>{votersData.grandTotal.registered}</strong></td>
                  <td><strong>{votersData.grandTotal.notRegistered}</strong></td>
                  <td><strong>{votersData.grandTotal.total}</strong></td>
                </tr>
              </tbody>
            </table>
            <ReportFooter />
          </div>
        )}

        {selectedSections.includes('generations') && (
          <div id="generations" className="report-section show-print">
            <ReportHeader selectedYear={selectedYear} currentDate={currentDate} />
            <h3>VI. Generations Population Report ({getGenerationTitle()})</h3>
            
            {generationFilter === 'all' ? (
              <table style={{ fontSize: '11px' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'center', width: '30px' }}>#</th>
                    <th style={{ textAlign: 'left' }}>BARANGAY</th>
                    <th style={{ textAlign: 'center' }}>GEN Z<br/><span style={{ fontSize: '9px', fontWeight: 'normal' }}>(1997–2012)</span></th>
                    <th style={{ textAlign: 'center' }}>MILLENNIALS<br/><span style={{ fontSize: '9px', fontWeight: 'normal' }}>(1981–1996)</span></th>
                    <th style={{ textAlign: 'center' }}>GEN X<br/><span style={{ fontSize: '9px', fontWeight: 'normal' }}>(1965–1980)</span></th>
                    <th style={{ textAlign: 'center' }}>BOOMERS II<br/><span style={{ fontSize: '9px', fontWeight: 'normal' }}>(1955–1964)</span></th>
                    <th style={{ textAlign: 'center' }}>BOOMERS I<br/><span style={{ fontSize: '9px', fontWeight: 'normal' }}>(1946–1954)</span></th>
                    <th style={{ textAlign: 'center' }}>POST WAR<br/><span style={{ fontSize: '9px', fontWeight: 'normal' }}>(1928–1945)</span></th>
                    <th style={{ textAlign: 'center' }}>WWII<br/><span style={{ fontSize: '9px', fontWeight: 'normal' }}>(1922–1927)</span></th>
                    <th style={{ textAlign: 'center' }}>TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {generationsData.rows.map((row, idx) => (
                    <tr key={row.name}>
                      <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                      <td>{row.name}</td>
                      <td style={{ textAlign: 'center' }}>{row.genZ}</td>
                      <td style={{ textAlign: 'center' }}>{row.millennials}</td>
                      <td style={{ textAlign: 'center' }}>{row.genX}</td>
                      <td style={{ textAlign: 'center' }}>{row.boomers2}</td>
                      <td style={{ textAlign: 'center' }}>{row.boomers1}</td>
                      <td style={{ textAlign: 'center' }}>{row.postWar}</td>
                      <td style={{ textAlign: 'center' }}>{row.ww2}</td>
                      <td style={{ textAlign: 'center' }}><strong>{row.total}</strong></td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan="2" style={{ textAlign: 'left' }}><strong>GRAND TOTAL</strong></td>
                    <td style={{ textAlign: 'center' }}><strong>{generationsData.grandTotal.genZ}</strong></td>
                    <td style={{ textAlign: 'center' }}><strong>{generationsData.grandTotal.millennials}</strong></td>
                    <td style={{ textAlign: 'center' }}><strong>{generationsData.grandTotal.genX}</strong></td>
                    <td style={{ textAlign: 'center' }}><strong>{generationsData.grandTotal.boomers2}</strong></td>
                    <td style={{ textAlign: 'center' }}><strong>{generationsData.grandTotal.boomers1}</strong></td>
                    <td style={{ textAlign: 'center' }}><strong>{generationsData.grandTotal.postWar}</strong></td>
                    <td style={{ textAlign: 'center' }}><strong>{generationsData.grandTotal.ww2}</strong></td>
                    <td style={{ textAlign: 'center' }}><strong>{generationsData.grandTotal.total}</strong></td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                    <th style={{ textAlign: 'left' }}>BARANGAY</th>
                    <th style={{ textAlign: 'center' }}>MALE</th>
                    <th style={{ textAlign: 'center' }}>FEMALE</th>
                    <th style={{ textAlign: 'center' }}>TOTAL POPULATION</th>
                  </tr>
                </thead>
                <tbody>
                  {generationsData.rows.map((row, idx) => (
                    <tr key={row.name}>
                      <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                      <td>{row.name}</td>
                      <td style={{ textAlign: 'center' }}>{row.male}</td>
                      <td style={{ textAlign: 'center' }}>{row.female}</td>
                      <td style={{ textAlign: 'center' }}><strong>{row.total}</strong></td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan="2" style={{ textAlign: 'left' }}><strong>GRAND TOTAL</strong></td>
                    <td style={{ textAlign: 'center' }}><strong>{generationsData.grandTotal.male}</strong></td>
                    <td style={{ textAlign: 'center' }}><strong>{generationsData.grandTotal.female}</strong></td>
                    <td style={{ textAlign: 'center' }}><strong>{generationsData.grandTotal.total}</strong></td>
                  </tr>
                </tbody>
              </table>
            )}
            <ReportFooter />
          </div>
        )}
      </div>
    </div>
  );
}
