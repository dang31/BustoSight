import { useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  ArcElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';
import Sidebar from '../components/Sidebar';
import { brgyStats } from '../data/brgyData';
import '../css/Dashboard.css';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  ArcElement, Title, Tooltip, Legend, Filler
);

const STAT_CARDS = [
  { label: 'Total Household', value: '2,945', key: 'Total Household' },
  { label: 'Total Senior Citizen', value: '140', key: 'Total Senior Citizen' },
  { label: 'Total Voters', value: '5,440', key: 'Total Voters' },
  { label: 'Total PWD', value: '25', key: 'Total PWD' },
  { label: 'Total Citizen', value: '8,550', key: 'Total Citizen' },
  { label: 'Registered Voters', value: '5,440', key: 'Total Voters' },
];

const FORECAST_CARDS = [
  {
    title: 'Total Population Growth',
    body: [
      { label: 'Current:', value: '8,550' },
      { label: '5-Year Project:', value: '9,440' },
    ],
    tag: '↗ Linear Regression Projection',
    footer: 'Analyzes the past 5 years of data to calculate average increase and project the additional population for the next 5 years.',
  },
  {
    title: 'Senior Population',
    body: [
      { label: 'Ages 60+:', value: '140' },
      { label: 'Projected:', value: '172' },
    ],
    tag: '↗ Aging Population Trend',
    footer: 'Focuses on residents aged 60 and above, utilizing aging population trends to forecast future growth.',
  },
  {
    title: 'Migration Trend',
    body: [{ label: 'Net Change:', value: '+2.4%' }],
    status: 'Status: In-Migration',
    footer: 'An approximation based on net population changes not explained by natural growth (births/deaths).',
  },
  {
    title: 'Change Trend',
    body: [
      { label: 'Overall Trend:', value: 'Increasing' },
      { label: 'Scope:', value: '5-Year Review' },
    ],
    footer: 'Reviews overall population shifts over the last 5 years to determine if the count will rise or fall.',
  },
];

// Chart configs
const ageChartData = {
  labels: ['Children (0-17)', 'Working-Age (18-59)', 'Seniors (60+)'],
  datasets: [
    { label: 'Current', data: [2500, 5000, 1050], backgroundColor: '#5d87ff' },
    { label: 'Projected (5 Yrs)', data: [2800, 5400, 1240], backgroundColor: '#00d1b2' },
  ],
};

const barChartData = {
  labels: brgyStats.map(b => b.name),
  datasets: [{
    label: 'Population',
    data: brgyStats.map(b => b.citizen),
    backgroundColor: '#5d87ff',
    barThickness: 10,
  }],
};

const lineChartData = {
  labels: ['2026', '2027', '2028', '2029', '2030', '2031'],
  datasets: [{
    label: 'Predicted Growth',
    data: [8550, 8729, 8910, 9100, 9280, 9440],
    borderColor: '#ff4d4d',
    backgroundColor: 'rgba(255,77,77,0.08)',
    fill: true,
    tension: 0.4,
  }],
};

const pieChartData = {
  labels: ['Male', 'Female'],
  datasets: [{
    data: [4200, 4350],
    backgroundColor: ['#5d87ff', '#ff85a2'],
    borderWidth: 0,
  }],
};

const historyChartData = {
  labels: ['2021', '2022', '2023', '2024', '2025'],
  datasets: [
    {
      label: 'Total Population',
      data: [7200, 7550, 7900, 8200, 8550],
      borderColor: '#2c5282',
      backgroundColor: 'rgba(44, 82, 130, 0.08)',
      fill: true,
      tension: 0.3,
    },
    {
      label: 'Registered Voters',
      data: [4100, 4300, 4800, 5100, 5440],
      borderColor: '#38a169',
      backgroundColor: 'transparent',
      borderDash: [5, 5],
      pointStyle: 'circle',
      pointRadius: 5,
    },
  ],
};

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

function getDistributionValues(category, item) {
  if (category.includes('Household')) return item.hh;
  if (category.includes('Senior')) return item.senior;
  if (category.includes('Voters')) return item.voters;
  if (category.includes('PWD')) return item.pwd;
  return item.citizen;
}

export default function Dashboard() {
  const [modal, setModal] = useState(null); // { category: string }
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'barangay' | 'forecast'

  const sortedBrgy = [...brgyStats].sort((a, b) => a.name.localeCompare(b.name));

  const renderOverview = () => (
    <div className="tab-content animate-fade-up">
      {/* Stat Cards */}
      <div className="stats-container">
        {STAT_CARDS.map((card, i) => (
          <div
            key={i}
            className="stat-card"
            onClick={() => setModal({ category: card.key })}
            title={`View ${card.label} distribution`}
          >
            <h5>{card.label}</h5>
            <h2>{card.value}</h2>
          </div>
        ))}
      </div>

      <div className="charts-grid">
        <div className="chart-item">
          <h4>Gender Distribution</h4>
          <div className="chart-container pie-box">
            <Pie data={pieChartData} options={chartOpts} />
          </div>
        </div>

        <div className="chart-item">
          <h4>Historical Population &amp; Voters Trend</h4>
          <div className="chart-container">
            <Line data={historyChartData} options={{ ...chartOpts, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: false, grid: { color: '#edf2f7' } }, x: { grid: { display: false } } } }} />
          </div>
          <p className="chart-note">
            Comparative analysis of total population vs. registered voters from 2021 to 2025.
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
            <Bar data={barChartData} options={{ ...barOpts, maintainAspectRatio: false }} />
          </div>
        </div>
      </div>
    </div>
  );

  const renderForecast = () => (
    <div className="tab-content animate-fade-up">
      {/* Forecast Cards */}
      <div className="forecast-container">
        {FORECAST_CARDS.map((fc, i) => (
          <div key={i} className="f-card">
            <div className="f-header"><strong>{fc.title}</strong></div>
            <div className="f-body">
              {fc.body.map((row, j) => (
                <div key={j} className="f-val">
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
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
          <h4>Age Group Distribution (5-Year Forecast)</h4>
          <div className="chart-container">
            <Bar data={ageChartData} options={chartOpts} />
          </div>
          <p className="chart-note">
            Analyzes historical age breakdowns to show how many people will enter each age group in the next 5 years.
          </p>
        </div>

        <div className="chart-item">
          <h4>Growth Trends (Linear Regression)</h4>
          <div className="chart-container">
            <Line data={lineChartData} options={chartOpts} />
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
        </header>

        {/* Tab Navigation */}
        <div className="dashboard-tabs">
          <button 
            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            📊 Overview
          </button>
          <button 
            className={`tab-btn ${activeTab === 'barangay' ? 'active' : ''}`}
            onClick={() => setActiveTab('barangay')}
          >
            🏘️ Barangay Analysis
          </button>
          <button 
            className={`tab-btn ${activeTab === 'forecast' ? 'active' : ''}`}
            onClick={() => setActiveTab('forecast')}
          >
            📈 Projections
          </button>
        </div>

        {/* Dynamic Content */}
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
              {sortedBrgy.map((item) => (
                <div key={item.name} className="dist-item">
                  <span>{item.name}</span>
                  <span>{getDistributionValues(modal.category, item).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
