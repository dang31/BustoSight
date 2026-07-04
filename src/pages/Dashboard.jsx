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
      .select('barangay, sex, age, is_pwd, is_senior, is_solo_parent, is_4ps, is_voter, h_no, is_household_head')
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
  });

  const [brgyData, setBrgyData] = useState(
    BARANGAY_ORDER.map(name => ({ name, count: 0, seniors: 0, pwd: 0, households: 0, voters: 0 }))
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

        // Per-barangay maps
        const brgyMap = {};
        BARANGAY_ORDER.forEach(b => {
          brgyMap[b] = { count: 0, seniors: 0, pwd: 0, hhSet: new Set(), voters: 0 };
        });

        for (const r of residents) {
          const brgy = r.barangay;

          // Global totals
          if (r.h_no) totalHhSet.add(`${brgy}__${r.h_no}`);
          if (r.is_senior) totalSeniors++;
          if (r.is_pwd) totalPwd++;
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
          if (voterStr.includes('registered')) totalVoters++;

          // Per-barangay
          if (brgyMap[brgy]) {
            brgyMap[brgy].count++;
            if (r.h_no) brgyMap[brgy].hhSet.add(r.h_no);
            if (r.is_senior) brgyMap[brgy].seniors++;
            if (r.is_pwd) brgyMap[brgy].pwd++;
            if (voterStr.includes('registered')) brgyMap[brgy].voters++;
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
        });

        setBrgyData(
          BARANGAY_ORDER.map(name => ({
            name,
            count: brgyMap[name]?.count || 0,
            seniors: brgyMap[name]?.seniors || 0,
            pwd: brgyMap[name]?.pwd || 0,
            households: brgyMap[name]?.hhSet?.size || 0,
            voters: brgyMap[name]?.voters || 0,
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

  // Simple linear projection for total population (+2.1% per year)
  const growthRate = 0.021;
  const currentYear = 2026;
  const projectionLabels = Array.from({ length: 6 }, (_, i) => String(currentYear + i));
  const projectionData = Array.from({ length: 6 }, (_, i) =>
    Math.round(stats.totalPopulation * Math.pow(1 + growthRate, i))
  );
  const lineChartData = {
    labels: projectionLabels,
    datasets: [{
      label: 'Predicted Growth',
      data: projectionData,
      borderColor: '#ff4d4d',
      backgroundColor: 'rgba(255,77,77,0.08)',
      fill: true,
      tension: 0.4,
    }],
  };

  const projected5yr = projectionData[5] || stats.totalPopulation;

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
      footer: 'Analyzes the current data and projects the additional population for the next 5 years at an estimated 2.1% annual growth rate.',
    },
    {
      title: 'Senior Population',
      body: [
        { label: 'Ages 60+:', value: stats.seniorCount.toLocaleString() },
        { label: 'Projected (5yr):', value: Math.round(stats.seniorCount * 1.22).toLocaleString() },
      ],
      tag: '↗ Aging Population Trend',
      footer: 'Focuses on residents aged 60 and above, utilizing aging population trends to forecast future growth.',
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
          <h4>Population Projection (2026–2031)</h4>
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
            Linear projection based on current population using an estimated 2.1% annual growth rate.
          </p>
        </div>
      </div>
    </div>
  );

  const renderBarangayAnalysis = () => (
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
      <div className="chart-item" style={{ marginTop: '24px' }}>
        <h4>Barangay Summary Table</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginTop: '8px' }}>
          <thead>
            <tr style={{ background: '#f0f4ff' }}>
              {['Barangay', 'Population', 'Households', 'Senior Citizens', 'PWD', 'Registered Voters'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {brgyData.map((b, i) => (
              <tr key={b.name} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                <td style={{ padding: '7px 12px', fontWeight: 500 }}>{b.name}</td>
                <td style={{ padding: '7px 12px' }}>{b.count.toLocaleString()}</td>
                <td style={{ padding: '7px 12px' }}>{b.households.toLocaleString()}</td>
                <td style={{ padding: '7px 12px' }}>{b.seniors.toLocaleString()}</td>
                <td style={{ padding: '7px 12px' }}>{b.pwd.toLocaleString()}</td>
                <td style={{ padding: '7px 12px' }}>{b.voters.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

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
          <button className={`tab-btn ${activeTab === 'forecast' ? 'active' : ''}`} onClick={() => setActiveTab('forecast')}>
            📈 Projections
          </button>
        </div>

        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'barangay' && renderBarangayAnalysis()}
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
