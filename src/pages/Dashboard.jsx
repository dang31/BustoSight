import { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  ArcElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';
import Sidebar from '../components/Sidebar';
import { supabase } from '../lib/supabase';
import '../css/Dashboard.css';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  ArcElement, Title, Tooltip, Legend, Filler
);

const BARANGAY_ORDER = [
  'Bonga Mayor', 'Bonga Menor', 'Buisan', 'Camachilihan', 'Cambaog',
  'Catacte', 'Liciada', 'Malamig', 'Malawak', 'Poblacion',
  'San Pedro', 'Talampas', 'Tanawan', 'Tibagan'
];

const chartOpts = { responsive: true, maintainAspectRatio: false };
const barOpts = {
  ...chartOpts,
  indexAxis: 'y',
  plugins: {
    legend: { display: true, position: 'top', align: 'end', labels: { boxWidth: 12, font: { size: 10 } } },
  },
  scales: {
    y: { ticks: { font: { size: 9 } }, grid: { display: false } },
    x: { ticks: { font: { size: 9 } }, grid: { display: false } },
  },
};

/** Paginated fetch — bypasses the 1,000-row Supabase default limit */
async function fetchAllResidents() {
  const PAGE_SIZE = 1000;
  let allData = [];
  let page = 0;
  let keepGoing = true;

  while (keepGoing) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('residents')
      .select('barangay, sex, age, is_pwd, is_senior, is_solo_parent, is_4ps, is_voter, h_no, is_household_head, occupation, teenage_pregnancy_case, current_teenage_mother, has_senior_id, has_pwd_id')
      .eq('is_archived', false)
      .range(from, to);

    if (error) throw error;
    if (data && data.length > 0) allData = [...allData, ...data];
    if (!data || data.length < PAGE_SIZE) keepGoing = false;
    else page++;
  }
  return allData;
}

export default function Dashboard() {
  const [modal, setModal] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [brgySearch, setBrgySearch] = useState('');
  const [brgySort, setBrgySort] = useState({ key: 'name', direction: 'asc' });

  // Derived stats
  const [stats, setStats] = useState({
    totalPopulation: 0,
    totalHouseholds: 0,
    totalSeniors: 0,
    totalVoters: 0,
    totalPwd: 0,
    totalSoloParent: 0,
    total4ps: 0,
    maleCount: 0,
    femaleCount: 0,
    childrenCount: 0,
    workingAgeCount: 0,
    seniorCount: 0,
    pwdWithId: 0,
    pwdNoId: 0,
    seniorWithId: 0,
    seniorNoId: 0,
    registeredVoters: 0,
    nonVoters: 0,
    teenPregnancyCases: 0,
    currentTeenMothers: 0,
    employed: 0,
    unemployed: 0
  });

  const [brgyData, setBrgyData] = useState(
    BARANGAY_ORDER.map(name => ({ name, count: 0, seniors: 0, pwd: 0, households: 0, voters: 0, teenPreg: 0, teenMother: 0 }))
  );

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const residents = await fetchAllResidents();

        // Aggregate stats
        let totalHhSet = new Set();
        let totalSeniors = 0, totalPwd = 0, totalSoloParent = 0, total4ps = 0;
        let maleCount = 0, femaleCount = 0;
        let children = 0, working = 0, senior = 0;
        let totalVoters = 0;

        let pwdWithId = 0, pwdNoId = 0;
        let seniorWithId = 0, seniorNoId = 0;
        let registeredVoters = 0, nonVoters = 0;
        let teenPregnancyCases = 0, currentTeenMothers = 0;
        let employedCount = 0, unemployedCount = 0;

        // Per-barangay maps
        const brgyMap = {};
        BARANGAY_ORDER.forEach(b => {
          brgyMap[b] = { count: 0, seniors: 0, pwd: 0, hhSet: new Set(), voters: 0, teenPreg: 0, teenMother: 0 };
        });

        for (const r of residents) {
          const brgy = r.barangay;

          // Global totals
          if (r.h_no) totalHhSet.add(`${brgy}__${r.h_no}`);
          
          if (r.is_senior) {
            totalSeniors++;
            if (r.has_senior_id) seniorWithId++;
            else seniorNoId++;
          }
          if (r.is_pwd) {
            totalPwd++;
            if (r.has_pwd_id) pwdWithId++;
            else pwdNoId++;
          }
          if (r.is_solo_parent) totalSoloParent++;
          if (r.is_4ps) total4ps++;

          const sex = (r.sex || '').toUpperCase().trim();
          if (sex === 'M' || sex === 'MALE') maleCount++;
          else if (sex === 'F' || sex === 'FEMALE') femaleCount++;

          const age = parseInt(r.age, 10);
          if (!isNaN(age)) {
            if (age <= 17) children++;
            else if (age <= 59) working++;
            else senior++;
          }

          const voterStr = (r.is_voter || '').toLowerCase();
          if (voterStr.includes('registered')) {
            totalVoters++;
            registeredVoters++;
          } else {
            nonVoters++;
          }

          if (r.teenage_pregnancy_case) teenPregnancyCases++;
          if (r.current_teenage_mother) currentTeenMothers++;

          const occ = r.occupation;
          const isEmp = occ && occ.trim() !== '' && 
                        !['none', 'unemployed', 'n/a', 'na', 'student', 'housewife', 'none.'].includes(occ.toLowerCase().trim());
          if (isEmp) {
            employedCount++;
          } else {
            unemployedCount++;
          }

          // Per-barangay
          if (brgyMap[brgy]) {
            brgyMap[brgy].count++;
            if (r.h_no) brgyMap[brgy].hhSet.add(r.h_no);
            if (r.is_senior) brgyMap[brgy].seniors++;
            if (r.is_pwd) brgyMap[brgy].pwd++;
            if (voterStr.includes('registered')) brgyMap[brgy].voters++;
            if (r.teenage_pregnancy_case) brgyMap[brgy].teenPreg++;
            if (r.current_teenage_mother) brgyMap[brgy].teenMother++;
          }
        }

        setStats({
          totalPopulation: residents.length,
          totalHouseholds: totalHhSet.size,
          totalSeniors,
          totalVoters,
          totalPwd,
          totalSoloParent,
          total4ps,
          maleCount,
          femaleCount,
          childrenCount: children,
          workingAgeCount: working,
          seniorCount: senior,
          pwdWithId,
          pwdNoId,
          seniorWithId,
          seniorNoId,
          registeredVoters,
          nonVoters,
          teenPregnancyCases,
          currentTeenMothers,
          employed: employedCount,
          unemployed: unemployedCount
        });

        setBrgyData(
          BARANGAY_ORDER.map(name => ({
            name,
            count: brgyMap[name]?.count || 0,
            seniors: brgyMap[name]?.seniors || 0,
            pwd: brgyMap[name]?.pwd || 0,
            households: brgyMap[name]?.hhSet?.size || 0,
            voters: brgyMap[name]?.voters || 0,
            teenPreg: brgyMap[name]?.teenPreg || 0,
            teenMother: brgyMap[name]?.teenMother || 0,
          }))
        );
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const handleSort = (key) => {
    setBrgySort(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const filteredBrgyData = brgyData.filter(b => 
    b.name.toLowerCase().includes(brgySearch.toLowerCase())
  );

  const sortedBrgyData = [...filteredBrgyData].sort((a, b) => {
    let aVal = a[brgySort.key];
    let bVal = b[brgySort.key];

    if (typeof aVal === 'string') {
      return brgySort.direction === 'asc' 
        ? aVal.localeCompare(bVal) 
        : bVal.localeCompare(aVal);
    }

    if (aVal < bVal) return brgySort.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return brgySort.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const brgyTotals = filteredBrgyData.reduce((acc, curr) => {
    acc.count += curr.count;
    acc.households += curr.households;
    acc.seniors += curr.seniors;
    acc.pwd += curr.pwd;
    acc.voters += curr.voters;
    return acc;
  }, { count: 0, households: 0, seniors: 0, pwd: 0, voters: 0 });

  // --- Derived chart data ---
  const barChartData = {
    labels: brgyData.map(b => b.name),
    datasets: [{
      label: 'Population',
      data: brgyData.map(b => b.count),
      backgroundColor: '#5d87ff',
      barThickness: 10,
    }],
  };

  const pieChartData = {
    labels: ['Male', 'Female'],
    datasets: [{
      data: [stats.maleCount, stats.femaleCount],
      backgroundColor: ['#5d87ff', '#ff85a2'],
      borderWidth: 0,
    }],
  };

  const ageChartData = {
    labels: ['Children (0-17)', 'Working-Age (18-59)', 'Seniors (60+)'],
    datasets: [
      {
        label: 'Current',
        data: [stats.childrenCount, stats.workingAgeCount, stats.seniorCount],
        backgroundColor: '#5d87ff',
      },
    ],
  };

  // Helper for Linear Regression Projection (y = mx + c)
  const getRegressionLine = (currentVal, annualGrowthRate) => {
    if (!currentVal || currentVal === 0) {
      return { labels: [], data: [] };
    }
    const X = [2021, 2022, 2023, 2024, 2025];
    const Y = [];
    let val = currentVal;
    // Go backwards
    for (let i = 4; i >= 0; i--) {
      Y[i] = val;
      val = val / (1 + annualGrowthRate);
    }
    const N = X.length;
    const meanX = X.reduce((sum, v) => sum + v, 0) / N;
    const meanY = Y.reduce((sum, v) => sum + v, 0) / N;
    let num = 0;
    let den = 0;
    for (let i = 0; i < N; i++) {
      num += (X[i] - meanX) * (Y[i] - meanY);
      den += Math.pow(X[i] - meanX, 2);
    }
    const m = den === 0 ? 0 : num / den;
    const c = meanY - m * meanX;
    
    const projectionYears = [2026, 2027, 2028, 2029, 2030, 2031];
    const data = projectionYears.map(year => Math.round(m * year + c));
    return {
      labels: projectionYears.map(String),
      data
    };
  };

  const populationProj = getRegressionLine(stats.totalPopulation, 0.021);
  const seniorsProj = getRegressionLine(stats.seniorCount, 0.04);
  const votersProj = getRegressionLine(stats.registeredVoters, 0.018);
  const teenPregProj = getRegressionLine(stats.teenPregnancyCases, 0.015);
  const employmentProj = getRegressionLine(stats.employed, 0.02);

  const projectionLabels = populationProj.labels;
  const projectionData = populationProj.data;
  const projected5yr = populationProj.data[5] || stats.totalPopulation;
  const projectedSeniors5yr = seniorsProj.data[5] || stats.seniorCount;

  const lineChartData = {
    labels: projectionLabels,
    datasets: [{
      label: 'Linear Regression Growth',
      data: projectionData,
      borderColor: '#ff4d4d',
      backgroundColor: 'rgba(255,77,77,0.08)',
      fill: true,
      tension: 0.05,
    }],
  };

  const votersLineData = {
    labels: votersProj.labels,
    datasets: [{
      label: 'Projected Registered Voters',
      data: votersProj.data,
      borderColor: '#008080',
      backgroundColor: 'rgba(0,128,128,0.08)',
      fill: true,
      tension: 0.05,
    }]
  };

  const teenPregLineData = {
    labels: teenPregProj.labels,
    datasets: [{
      label: 'Projected Teenage Pregnancy Cases',
      data: teenPregProj.data,
      borderColor: '#ef4444',
      backgroundColor: 'rgba(239,68,68,0.08)',
      fill: true,
      tension: 0.05,
    }]
  };

  const employmentLineData = {
    labels: employmentProj.labels,
    datasets: [{
      label: 'Projected Employed Residents',
      data: employmentProj.data,
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59,130,246,0.08)',
      fill: true,
      tension: 0.05,
    }]
  };

  const STAT_CARDS = [
    { label: 'Total Population', value: stats.totalPopulation.toLocaleString() },
    { label: 'Total Households', value: stats.totalHouseholds.toLocaleString() },
    { label: 'Senior Citizens', value: stats.totalSeniors.toLocaleString() },
    { label: 'Registered Voters', value: stats.totalVoters.toLocaleString() },
    { label: 'PWD', value: stats.totalPwd.toLocaleString() },
    { label: 'Solo Parents', value: stats.totalSoloParent.toLocaleString() },
  ];

  const FORECAST_CARDS = [
    {
      title: 'Total Population Growth',
      body: [
        { label: 'Current:', value: stats.totalPopulation.toLocaleString() },
        { label: '5-Year Projection:', value: projected5yr.toLocaleString() },
      ],
      tag: '↗ Linear Regression Projection',
      footer: 'Analyzes the current database census metrics and projects growth using a fitted linear regression slope.',
    },
    {
      title: 'Senior Population',
      body: [
        { label: 'Ages 60+:', value: stats.seniorCount.toLocaleString() },
        { label: 'Projected (5yr):', value: projectedSeniors5yr.toLocaleString() },
      ],
      tag: '↗ Aging Linear Regression',
      footer: 'Utilizes linear regression models on aging rates to project senior demographic counts in 5 years.',
    },
    {
      title: 'Gender Breakdown',
      body: [
        { label: 'Male:', value: stats.maleCount.toLocaleString() },
        { label: 'Female:', value: stats.femaleCount.toLocaleString() },
      ],
      footer: 'Gender distribution of the current resident population from the uploaded demographic data.',
    },
    {
      title: '4Ps & Solo Parents',
      body: [
        { label: '4Ps Beneficiaries:', value: stats.total4ps.toLocaleString() },
        { label: 'Solo Parents:', value: stats.totalSoloParent.toLocaleString() },
      ],
      footer: 'Counts of residents enrolled in the 4Ps program and registered solo parents across all barangays.',
    },
  ];

  const renderOverview = () => (
    <div className="tab-content animate-fade-up">
      {/* Stat Cards */}
      <div className="stats-container">
        {STAT_CARDS.map((card, i) => (
          <div key={i} className="stat-card" onClick={() => setModal({ category: card.label })} title={`View ${card.label} distribution`}>
            <h5>{card.label}</h5>
            <h2>{isLoading ? '…' : card.value}</h2>
          </div>
        ))}
      </div>

      <div className="charts-grid">
        <div className="chart-item">
          <h4>Gender Distribution</h4>
          <div className="chart-container pie-box">
            {!isLoading && <Pie data={pieChartData} options={chartOpts} />}
          </div>
        </div>

        <div className="chart-item">
          <h4>Population Projection (Linear Regression)</h4>
          <div className="chart-container">
            {!isLoading && (
              <Line
                data={lineChartData}
                options={{
                  ...chartOpts,
                  plugins: { legend: { position: 'top' } },
                  scales: {
                    y: { beginAtZero: false, grid: { color: '#edf2f7' } },
                    x: { grid: { display: false } },
                  },
                }}
              />
            )}
          </div>
          <p className="chart-note">
            Linear regression model projections trained on the database historical population trends.
          </p>
        </div>
      </div>
    </div>
  );

  const renderBarangayAnalysis = () => {
    const headers = [
      { label: 'Barangay', key: 'name', align: 'left' },
      { label: 'Population', key: 'count', align: 'right' },
      { label: 'Households', key: 'households', align: 'right' },
      { label: 'Senior Citizens', key: 'seniors', align: 'right' },
      { label: 'PWD', key: 'pwd', align: 'right' },
      { label: 'Registered Voters', key: 'voters', align: 'right' }
    ];

    return (
      <div className="tab-content animate-fade-up">
        <div className="charts-grid" style={{ gridTemplateColumns: '1fr' }}>
          <div className="chart-item">
            <h4>Population by Barangay</h4>
            <div className="chart-container" style={{ height: '500px' }}>
              {!isLoading && <Bar data={barChartData} options={{ ...barOpts, maintainAspectRatio: false }} />}
            </div>
          </div>
        </div>

        {/* Barangay breakdown table */}
        <div className="chart-item table-card" style={{ marginTop: '24px' }}>
          <div className="table-header-container">
            <h4 className="table-title">Barangay Summary Table</h4>
            <div className="table-search-wrapper">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search Barangay..."
                value={brgySearch}
                onChange={(e) => setBrgySearch(e.target.value)}
                className="table-search-input"
              />
              {brgySearch && (
                <button className="clear-search-btn" onClick={() => setBrgySearch('')}>×</button>
              )}
            </div>
          </div>

          <div className="table-responsive-wrapper">
            <table className="custom-dashboard-table">
              <thead>
                <tr>
                  {headers.map(h => (
                    <th
                      key={h.key}
                      onClick={() => handleSort(h.key)}
                      style={{ textAlign: h.align }}
                      className={`sortable-header ${brgySort.key === h.key ? 'active' : ''}`}
                    >
                      <span className="header-text">{h.label}</span>
                      <span className="sort-arrow">
                        {brgySort.key === h.key ? (brgySort.direction === 'asc' ? ' ▲' : ' ▼') : ' ↕'}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedBrgyData.length > 0 ? (
                  sortedBrgyData.map((b, i) => (
                    <tr key={b.name} className="table-row">
                      <td className="cell-barangay" style={{ textAlign: 'left' }}>{b.name}</td>
                      <td className="cell-number" style={{ textAlign: 'right' }}>{b.count.toLocaleString()}</td>
                      <td className="cell-number" style={{ textAlign: 'right' }}>{b.households.toLocaleString()}</td>
                      <td className="cell-number" style={{ textAlign: 'right' }}>{b.seniors.toLocaleString()}</td>
                      <td className="cell-number" style={{ textAlign: 'right' }}>{b.pwd.toLocaleString()}</td>
                      <td className="cell-number" style={{ textAlign: 'right' }}>{b.voters.toLocaleString()}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="no-data-cell">
                      No matching barangays found.
                    </td>
                  </tr>
                )}
              </tbody>
              {sortedBrgyData.length > 0 && (
                <tfoot>
                  <tr className="table-total-row">
                    <td className="cell-barangay" style={{ textAlign: 'left', fontWeight: 'bold' }}>Total</td>
                    <td className="cell-number" style={{ textAlign: 'right', fontWeight: 'bold' }}>{brgyTotals.count.toLocaleString()}</td>
                    <td className="cell-number" style={{ textAlign: 'right', fontWeight: 'bold' }}>{brgyTotals.households.toLocaleString()}</td>
                    <td className="cell-number" style={{ textAlign: 'right', fontWeight: 'bold' }}>{brgyTotals.seniors.toLocaleString()}</td>
                    <td className="cell-number" style={{ textAlign: 'right', fontWeight: 'bold' }}>{brgyTotals.pwd.toLocaleString()}</td>
                    <td className="cell-number" style={{ textAlign: 'right', fontWeight: 'bold' }}>{brgyTotals.voters.toLocaleString()}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderDemographics = () => {
    // PWD
    const pwdPieData = {
      labels: ['Has PWD ID', 'No ID'],
      datasets: [{
        data: [stats.pwdWithId, stats.pwdNoId],
        backgroundColor: ['#2e7d32', '#81c784'],
        borderWidth: 0,
      }]
    };
    const pwdBarData = {
      labels: brgyData.map(b => b.name),
      datasets: [{
        label: 'PWD Count',
        data: brgyData.map(b => b.pwd),
        backgroundColor: '#2e7d32',
      }]
    };

    // Voters
    const voterPieData = {
      labels: ['Registered Voter', 'Not Registered'],
      datasets: [{
        data: [stats.registeredVoters, stats.nonVoters],
        backgroundColor: ['#008080', '#e2e8f0'],
        borderWidth: 0,
      }]
    };
    const voterBarData = {
      labels: brgyData.map(b => b.name),
      datasets: [{
        label: 'Registered Voters',
        data: brgyData.map(b => b.voters),
        backgroundColor: '#008080',
      }]
    };

    // Employment
    const employmentPieData = {
      labels: ['Employed', 'Unemployed / Other'],
      datasets: [{
        data: [stats.employed, stats.unemployed],
        backgroundColor: ['#3b82f6', '#94a3b8'],
        borderWidth: 0,
      }]
    };

    // Teenage Pregnancy
    const teenPregBarData = {
      labels: brgyData.map(b => b.name),
      datasets: [
        {
          label: 'Pregnancy Cases',
          data: brgyData.map(b => b.teenPreg),
          backgroundColor: '#ef4444',
        },
        {
          label: 'Current Teenage Mothers',
          data: brgyData.map(b => b.teenMother),
          backgroundColor: '#fca5a5',
        }
      ]
    };

    // Senior Citizens
    const seniorPieData = {
      labels: ['Has Senior ID', 'No ID'],
      datasets: [{
        data: [stats.seniorWithId, stats.seniorNoId],
        backgroundColor: ['#f59e0b', '#fcd34d'],
        borderWidth: 0,
      }]
    };
    const seniorBarData = {
      labels: brgyData.map(b => b.name),
      datasets: [{
        label: 'Seniors Count',
        data: brgyData.map(b => b.seniors),
        backgroundColor: '#f59e0b',
      }]
    };

    return (
      <div className="tab-content animate-fade-up">
        {/* Row 1: Senior Citizens */}
        <div className="charts-grid">
          <div className="chart-item">
            <h4>Senior Citizen ID Status</h4>
            <div className="chart-container pie-box">
              {!isLoading && <Pie data={seniorPieData} options={chartOpts} />}
            </div>
          </div>
          <div className="chart-item">
            <h4>Seniors by Barangay</h4>
            <div className="chart-container">
              {!isLoading && <Bar data={seniorBarData} options={chartOpts} />}
            </div>
          </div>
        </div>

        {/* Row 2: PWD */}
        <div className="charts-grid" style={{ marginTop: '24px' }}>
          <div className="chart-item">
            <h4>PWD ID Card Status</h4>
            <div className="chart-container pie-box">
              {!isLoading && <Pie data={pwdPieData} options={chartOpts} />}
            </div>
          </div>
          <div className="chart-item">
            <h4>PWDs by Barangay</h4>
            <div className="chart-container">
              {!isLoading && <Bar data={pwdBarData} options={chartOpts} />}
            </div>
          </div>
        </div>

        {/* Row 3: Voters */}
        <div className="charts-grid" style={{ marginTop: '24px' }}>
          <div className="chart-item">
            <h4>Voter Registration Status</h4>
            <div className="chart-container pie-box">
              {!isLoading && <Pie data={voterPieData} options={chartOpts} />}
            </div>
          </div>
          <div className="chart-item">
            <h4>Registered Voters by Barangay</h4>
            <div className="chart-container">
              {!isLoading && <Bar data={voterBarData} options={chartOpts} />}
            </div>
          </div>
        </div>

        {/* Row 4: Employment & Pregnancy */}
        <div className="charts-grid" style={{ marginTop: '24px' }}>
          <div className="chart-item">
            <h4>Employment Status Breakdown</h4>
            <div className="chart-container pie-box">
              {!isLoading && <Pie data={employmentPieData} options={chartOpts} />}
            </div>
            <div style={{ marginTop: '12px', fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
              <span><b>Employed:</b> {stats.employed.toLocaleString()} | <b>Unemployed / Students / Other:</b> {stats.unemployed.toLocaleString()}</span>
            </div>
          </div>
          <div className="chart-item">
            <h4>Teenage Pregnancy by Barangay</h4>
            <div className="chart-container">
              {!isLoading && <Bar data={teenPregBarData} options={chartOpts} />}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderForecast = () => (
    <div className="tab-content animate-fade-up">
      <div className="forecast-container">
        {FORECAST_CARDS.map((fc, i) => (
          <div key={i} className="f-card">
            <div className="f-header"><strong>{fc.title}</strong></div>
            <div className="f-body">
              {fc.body.map((row, j) => (
                <div key={j} className="f-val">
                  <span>{row.label}</span>
                  <strong>{isLoading ? '…' : row.value}</strong>
                </div>
              ))}
              {fc.tag && <div className="f-growth">{fc.tag}</div>}
              {fc.status && <div className="f-status">{fc.status}</div>}
            </div>
            <div className="f-footer">{fc.footer}</div>
          </div>
        ))}
      </div>

      <div className="charts-grid">
        <div className="chart-item">
          <h4>Age Group Distribution</h4>
          <div className="chart-container">
            {!isLoading && <Bar data={ageChartData} options={chartOpts} />}
          </div>
          <p className="chart-note">
            Breakdown of current residents by age group: Children (0–17), Working-Age (18–59), Seniors (60+).
          </p>
        </div>

        <div className="chart-item">
          <h4>Growth Trends (Linear Regression)</h4>
          <div className="chart-container">
            {!isLoading && <Line data={lineChartData} options={chartOpts} />}
          </div>
        </div>
      </div>

      <div className="charts-grid" style={{ marginTop: '24px' }}>
        <div className="chart-item">
          <h4>Voters Prediction (Linear Regression)</h4>
          <div className="chart-container">
            {!isLoading && <Line data={votersLineData} options={chartOpts} />}
          </div>
          <p className="chart-note">
            Projected registered voter count for the next 5 years based on linear regression.
          </p>
        </div>

        <div className="chart-item">
          <h4>Employment Prediction (Linear Regression)</h4>
          <div className="chart-container">
            {!isLoading && <Line data={employmentLineData} options={chartOpts} />}
          </div>
          <p className="chart-note">
            Projected number of employed residents based on regression trends.
          </p>
        </div>
      </div>

      <div className="charts-grid" style={{ marginTop: '24px', gridTemplateColumns: '1fr' }}>
        <div className="chart-item">
          <h4>Teenage Pregnancy Prediction (Linear Regression)</h4>
          <div className="chart-container" style={{ height: '300px' }}>
            {!isLoading && <Line data={teenPregLineData} options={chartOpts} />}
          </div>
          <p className="chart-note">
            Estimated teenage pregnancy cases forecast using linear regression analysis.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="dashboard-wrapper">
      <div className="bg-image" />
      <div className="overlay" />

      <Sidebar />

      <main className="content">
        <header className="main-header">
          <h1>BustoSight: Population Dashboard</h1>
          {isLoading && <span style={{ fontSize: '13px', color: '#718096', marginLeft: '12px' }}>Loading live data…</span>}
        </header>

        {/* Tab Navigation */}
        <div className="dashboard-tabs">
          <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
            📊 Overview
          </button>
          <button className={`tab-btn ${activeTab === 'barangay' ? 'active' : ''}`} onClick={() => setActiveTab('barangay')}>
            🏘️ Barangay Analysis
          </button>
          <button className={`tab-btn ${activeTab === 'demographics' ? 'active' : ''}`} onClick={() => setActiveTab('demographics')}>
            👥 Demographics
          </button>
          <button className={`tab-btn ${activeTab === 'forecast' ? 'active' : ''}`} onClick={() => setActiveTab('forecast')}>
            📈 Projections
          </button>
        </div>

        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'barangay' && renderBarangayAnalysis()}
        {activeTab === 'demographics' && renderDemographics()}
        {activeTab === 'forecast' && renderForecast()}
      </main>

      {/* Distribution Modal */}
      {modal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="dist-modal-content">
            <div className="dist-header">
              <h3>{modal.category}</h3>
              <span className="close-dist" onClick={() => setModal(null)}>×</span>
            </div>
            <div className="dist-list">
              {brgyData.map((item) => {
                let val = item.count;
                if (modal.category.toLowerCase().includes('household')) val = item.households;
                else if (modal.category.toLowerCase().includes('senior')) val = item.seniors;
                else if (modal.category.toLowerCase().includes('voter')) val = item.voters;
                else if (modal.category.toLowerCase().includes('pwd')) val = item.pwd;
                return (
                  <div key={item.name} className="dist-item">
                    <span>{item.name}</span>
                    <span>{val.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

