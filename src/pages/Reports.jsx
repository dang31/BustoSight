import { useState } from 'react';
import Sidebar from '../components/Sidebar';
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
  const currentDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

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
        </div>
      </main>

      {/* Printable Area */}
      <div id="printable-area">
        <div className="report-header" style={{ textAlign: 'center', marginBottom: '30px' }}>
          <p>Republic of the Philippines</p>
          <p>Province of Bulacan</p>
          <h2>Municipality of Bustos</h2>
          <p><strong>OFFICIAL CENSUS AND POPULATION REPORT</strong></p>
          <p>Date Generated: <span>{currentDate}</span></p>
        </div>

        {selectedSections.includes('age-gender') && (
          <div id="age-gender" className="report-section show-print">
            <h3>I. Age and Gender Distribution</h3>
            <table>
              <thead>
                <tr><th rowSpan="2">AGE GROUP</th><th colSpan="2">SEX</th><th rowSpan="2">TOTAL</th></tr>
                <tr><th>MALE</th><th>FEMALE</th></tr>
              </thead>
              <tbody>
                <tr><td>Under 5</td><td>120</td><td>115</td><td>235</td></tr>
                <tr><td>5-17 (Youth)</td><td>450</td><td>430</td><td>880</td></tr>
                <tr><td>18-59 (Adult)</td><td>890</td><td>910</td><td>1,800</td></tr>
                <tr><td>60+ (Senior)</td><td>150</td><td>180</td><td>330</td></tr>
                <tr><td><strong>GRAND TOTAL</strong></td><td><strong>1,610</strong></td><td><strong>1,635</strong></td><td><strong>3,245</strong></td></tr>
              </tbody>
            </table>
          </div>
        )}

        {selectedSections.includes('household') && (
          <div id="household" className="report-section show-print">
            <h3>II. Total Household Population (14 Barangays)</h3>
            <table>
              <thead>
                <tr><th>#</th><th>BARANGAY</th><th>HOUSEHOLDS</th><th>POPULATION</th></tr>
              </thead>
              <tbody>
                <tr><td>1</td><td>Bonga Mayor</td><td>320</td><td>1,450</td></tr>
                <tr><td>2</td><td>Bonga Menor</td><td>280</td><td>1,210</td></tr>
                <tr><td>10</td><td>Poblacion</td><td>510</td><td>2,450</td></tr>
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
                <tr><td>Bonga Mayor</td><td>85</td><td>24</td><td>410</td></tr>
                <tr><td>Poblacion</td><td>112</td><td>38</td><td>850</td></tr>
              </tbody>
            </table>
          </div>
        )}

        <div className="signature-section" style={{ marginTop: '50px' }}>
          <p>Certified Correct by:</p>
          <br /><br />
          <p>__________________________</p>
          <p><strong>POPDEV OFFICER</strong></p>
        </div>
      </div>
    </div>
  );
}
