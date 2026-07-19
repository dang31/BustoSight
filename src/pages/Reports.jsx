import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { supabase } from '../lib/supabase';
import { barangayNames } from '../data/brgyData';
import '../css/Reports.css';

const REPORT_SECTIONS = [
  { id: 'age-gender', label: 'Age and Gender Distribution' },
  { id: 'household', label: 'Total Household Population (14 Barangays)' },
  { id: 'brgy-stats', label: 'Barangay Statistics Summary' },
  { id: 'senior-pwd', label: 'Senior Citizen & PWD Report' },
  { id: 'voters-report', label: 'Total Voters per Barangay' },
];

export default function Reports() {
  const [selectedSections, setSelectedSections] = useState([]);
  const [residents, setResidents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const currentDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

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
            .select('barangay, sex, age, is_pwd, is_senior, is_solo_parent, is_4ps, is_voter, h_no, is_household_head, has_senior_id, has_pwd_id, has_solo_parent_id')
            .eq('is_archived', false)
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
  }, []);

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
    window.print();
  };

  // Calculations
  const ageGenderDist = () => {
    let under5M = 0, under5F = 0;
    let youthM = 0, youthF = 0;
    let adultM = 0, adultF = 0;
    let seniorM = 0, seniorF = 0;

    residents.forEach(r => {
      const sex = (r.sex || '').toUpperCase();
      const isMale = sex === 'MALE' || sex === 'M';
      const isFemale = sex === 'FEMALE' || sex === 'F';
      
      const age = parseInt(r.age, 10);
      if (isNaN(age) || age < 0) return;

      if (age < 5) {
        if (isMale) under5M++;
        else if (isFemale) under5F++;
      } else if (age <= 17) {
        if (isMale) youthM++;
        else if (isFemale) youthF++;
      } else if (age <= 59) {
        if (isMale) adultM++;
        else if (isFemale) adultF++;
      } else {
        if (isMale) seniorM++;
        else if (isFemale) seniorF++;
      }
    });

    return {
      under5: { male: under5M, female: under5F, total: under5M + under5F },
      youth: { male: youthM, female: youthF, total: youthM + youthF },
      adult: { male: adultM, female: adultF, total: adultM + adultF },
      senior: { male: seniorM, female: seniorF, total: seniorM + seniorF },
      grand: {
        male: under5M + youthM + adultM + seniorM,
        female: under5F + youthF + adultF + seniorF,
        total: under5M + youthM + adultM + seniorM + under5F + youthF + adultF + seniorF
      }
    };
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

  const ageData = ageGenderDist();
  const householdData = householdPop();
  const statsSummary = brgyStatsSum();
  const seniorPwdData = seniorPwdRep();
  const votersData = votersRep();

  return (
    <div className="dashboard-wrapper">
      <div className="bg-image" />
      <div className="overlay" />
      <Sidebar />

      <main className="content">
        <header className="main-header">
          <h1>Bustos Population Reports</h1>
        </header>

        <div className="report-card animate-fade-up">
          <div className="report-card-header">
            <h2>Generate Reports</h2>
            <p>Select the components to include in the printed report:</p>
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
                    <label key={section.id} className="checkbox-group">
                      <input 
                        type="checkbox" 
                        checked={selectedSections.includes(section.id)}
                        onChange={() => toggleSection(section.id)}
                      />
                      <span className="report-item-label">{section.label}</span>
                    </label>
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
        <div className="report-header-logos" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '30px', marginBottom: '15px' }}>
          <img src="/BP LOGO.png" alt="Bagong Pilipinas Logo" style={{ height: '70px', width: '70px', objectFit: 'contain' }} />
          <img src="/bustos-logo.png" alt="Bustos Logo" style={{ height: '70px', width: '70px', objectFit: 'contain' }} />
          <img src="/POPDEV LOGO.png" alt="POPDEV Logo" style={{ height: '70px', width: '70px', objectFit: 'contain' }} />
        </div>
        
        <div className="report-header-text" style={{ textAlign: 'center', marginBottom: '30px' }}>
          <p style={{ margin: '2px 0', fontSize: '11px', textTransform: 'uppercase', color: '#4a5568', letterSpacing: '0.5px' }}>Republic of the Philippines</p>
          <p style={{ margin: '2px 0', fontSize: '11px', textTransform: 'uppercase', color: '#4a5568', letterSpacing: '0.5px' }}>Province of Bulacan</p>
          <h2 style={{ margin: '5px 0', fontSize: '18px', fontWeight: '800', color: '#1a365d' }}>Municipality of Bustos</h2>
          <p style={{ margin: '8px 0 3px 0', fontSize: '13px', fontWeight: '800', letterSpacing: '1px', color: '#2b6cb0' }}><strong>OFFICIAL CENSUS AND POPULATION REPORT</strong></p>
          <p style={{ margin: '2px 0', fontSize: '10px', color: '#718096' }}>Date Generated: <span>{currentDate}</span></p>
        </div>

        {selectedSections.includes('age-gender') && (
          <div id="age-gender" className="report-section show-print">
            <h3>I. Age and Gender Distribution</h3>
            <table>
              <thead>
                <tr><th rowSpan="2" style={{ verticalAlign: 'middle', textAlign: 'left' }}>AGE GROUP</th><th colSpan="2">SEX</th><th rowSpan="2" style={{ verticalAlign: 'middle' }}>TOTAL</th></tr>
                <tr><th>MALE</th><th>FEMALE</th></tr>
              </thead>
              <tbody>
                <tr><td>Under 5</td><td>{ageData.under5.male}</td><td>{ageData.under5.female}</td><td>{ageData.under5.total}</td></tr>
                <tr><td>5-17 (Youth)</td><td>{ageData.youth.male}</td><td>{ageData.youth.female}</td><td>{ageData.youth.total}</td></tr>
                <tr><td>18-59 (Adult)</td><td>{ageData.adult.male}</td><td>{ageData.adult.female}</td><td>{ageData.adult.total}</td></tr>
                <tr><td>60+ (Senior)</td><td>{ageData.senior.male}</td><td>{ageData.senior.female}</td><td>{ageData.senior.total}</td></tr>
                <tr><td><strong>GRAND TOTAL</strong></td><td><strong>{ageData.grand.male}</strong></td><td><strong>{ageData.grand.female}</strong></td><td><strong>{ageData.grand.total}</strong></td></tr>
              </tbody>
            </table>
          </div>
        )}

        {selectedSections.includes('household') && (
          <div id="household" className="report-section show-print">
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
          </div>
        )}

        {selectedSections.includes('brgy-stats') && (
          <div id="brgy-stats" className="report-section show-print">
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
          </div>
        )}

        {selectedSections.includes('senior-pwd') && (
          <div id="senior-pwd" className="report-section show-print">
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
          </div>
        )}

        {selectedSections.includes('voters-report') && (
          <div id="voters-report" className="report-section show-print">
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
          </div>
        )}

        <div className="signature-section" style={{ marginTop: '50px', pageBreakInside: 'avoid' }}>
          <p>Certified Correct by:</p>
          <br /><br />
          <p>__________________________</p>
          <p><strong>POPDEV OFFICER</strong></p>
        </div>
      </div>
    </div>
  );
}
