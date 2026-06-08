import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { brgyStats } from '../data/brgyData';
import '../css/BarangayList.css';

export default function BarangayList() {
  const navigate = useNavigate();
  const [activeBrgy, setActiveBrgy] = useState('Poblacion');
  const [allRecords, setAllRecords] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHousehold, setSelectedHousehold] = useState(null); // { householdNum: string, members: [] }

  useEffect(() => {
    const data = JSON.parse(localStorage.getItem('tanawanData')) || [];
    setAllRecords(data);
  }, []);

  const filteredRecords = allRecords.filter((res) => {
    const residentBrgy = res.brgy || 'Poblacion';
    const matchesBrgy = residentBrgy.toLowerCase() === activeBrgy.toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      (res.last || '').toLowerCase().includes(query) ||
      (res.first || '').toLowerCase().includes(query) ||
      (res.h_no || '').toLowerCase().includes(query);
    return matchesBrgy && matchesSearch;
  });

  const handleArchive = (res) => {
    if (!window.confirm(`Are you sure you want to archive resident ${res.first} ${res.last}?`)) return;

    const adminPassword = prompt('Security Check: Please enter Admin Password to archive this record:');
    if (adminPassword === null) return;
    if (adminPassword !== 'admin123') {
      alert('Access Denied: Incorrect Admin Password.');
      return;
    }

    let archivedData = JSON.parse(localStorage.getItem('archivedResidents')) || [];
    const updatedRecords = allRecords.filter(r => !(r.h_no === res.h_no && r.last === res.last && r.first === res.first));
    
    const personToArchive = { ...res, archiveDate: new Date().toLocaleDateString(), brgy: res.brgy || activeBrgy };
    archivedData.push(personToArchive);

    localStorage.setItem('tanawanData', JSON.stringify(updatedRecords));
    localStorage.setItem('archivedResidents', JSON.stringify(archivedData));
    setAllRecords(updatedRecords);
    setSelectedHousehold(null);
    alert('Successfully archived!');
  };

  const openHousehold = (hhNo) => {
    if (!hhNo) return;
    const members = allRecords.filter(r => r.h_no === hhNo);
    // Sort so HEAD comes first
    members.sort((a, b) => (a.rel || '').toUpperCase() === 'HEAD' ? -1 : 1);
    setSelectedHousehold({ hhNo, members });
  };

  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const lines = event.target.result.split(/\r?\n/).filter(l => l.trim() !== '');
      let importedData = [];
      lines.forEach((line) => {
        const c = parseCSVLine(line);
        const isHeader = line.toLowerCase().includes('hh no.') || line.toLowerCase().includes('first name');
        if (!isHeader && c.length >= 2) {
          importedData.push({
            h_no: c[0] || '', last: c[1] || '', first: c[2] || '', mid: c[3] || '', q: c[4] || '',
            no: c[5] || '', st: c[6] || '', p: c[7] || '', bp: c[8] || '', bd: c[9] || '',
            s: c[10] || '', cs: c[11] || '', cz: c[12] || '', oc: c[13] || '', rel: c[14] || '',
            isVoter: 'N/A',
            brgy: activeBrgy
          });
        }
      });
      const newAllRecords = [...allRecords, ...importedData];
      localStorage.setItem('tanawanData', JSON.stringify(newAllRecords));
      setAllRecords(newAllRecords);
      alert('Import Successful!');
    };
    reader.readAsText(file);
  };

  function parseCSVLine(text) {
    const result = []; let cell = ''; let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      let char = text[i];
      if (char === '"') inQuotes = !inQuotes;
      else if (char === ',' && !inQuotes) { result.push(cell.trim()); cell = ''; }
      else { cell += char; }
    }
    result.push(cell.trim()); return result;
  }

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
          <div className="brgy-selector">
            <div className="brgy-header">Barangays</div>
            <div className="brgy-list">
              {brgyStats.map(b => (
                <div
                  key={b.name}
                  className={`brgy-item ${activeBrgy === b.name ? 'active' : ''}`}
                  onClick={() => setActiveBrgy(b.name)}
                >
                  {b.name}
                </div>
              ))}
            </div>
          </div>

          <div className="table-section">
            <div className="table-controls">
              <input
                type="text"
                className="search-input"
                placeholder="Search name or HH No..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <input
                type="file"
                id="csvFileInput"
                style={{ display: 'none' }}
                accept=".csv"
                onChange={handleImportCSV}
              />
              <button className="btn btn-import" onClick={() => document.getElementById('csvFileInput').click()}>
                Import Data
              </button>
              <button className="btn btn-view-archive" onClick={() => navigate('/archive')}>
                View Archive
              </button>
              <button className="btn btn-add" onClick={() => navigate('/add-resident')}>
                Add Resident
              </button>
            </div>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>HH NO.</th><th>LAST NAME</th><th>FIRST NAME</th><th>MIDDLE</th><th>QUAL.</th>
                    <th>NO.</th><th>STREET</th><th>PUROK</th><th>BIRTH PLACE</th><th>BIRTH DATE</th>
                    <th>SEX</th><th>CIVIL STATUS</th><th>CITIZENSHIP</th><th>OCCUPATION</th><th>REL. TO HEAD</th>
                    <th>VOTER?</th><th>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.length > 0 ? (
                    filteredRecords.map((res, i) => (
                      <tr key={i} onClick={() => openHousehold(res.h_no)}>
                        <td>{res.h_no}</td><td>{res.last}</td><td>{res.first}</td>
                        <td>{res.mid}</td><td>{res.q}</td><td>{res.no}</td>
                        <td>{res.st}</td><td>{res.p}</td><td>{res.bp}</td>
                        <td>{res.bd}</td><td>{res.s}</td><td>{res.cs}</td>
                        <td>{res.cz || 'FILIPINO'}</td><td>{res.oc || 'N/A'}</td><td>{res.rel}</td>
                        <td><strong>{res.isVoter || 'N/A'}</strong></td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <button className="btn-archive-row" onClick={() => handleArchive(res)}>
                            Archive
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="17" style={{ textAlign: 'center', padding: '30px', color: '#999' }}>
                        Walang record sa Barangay {activeBrgy}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* Household Modal */}
      {selectedHousehold && (
        <div className="modal-overlay" onClick={() => setSelectedHousehold(null)}>
          <div className="hh-modal-content" onClick={(e) => e.stopPropagation()}>
            <span className="close-modal" onClick={() => setSelectedHousehold(null)}>&times;</span>
            <div className="household-header">
              <h2>Household Family Members</h2>
              <p>Household ID: {selectedHousehold.hhNo}</p>
            </div>
            <div style={{ maxHeight: '450px', overflowY: 'auto' }}>
              <table className="family-table">
                <thead>
                  <tr>
                    <th>FULL NAME</th><th>RELATION</th><th>SEX</th><th>BIRTHDAY</th><th>OCCUPATION</th><th>VOTER?</th><th>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedHousehold.members.map((m, i) => (
                    <tr key={i} className={(m.rel || '').toUpperCase() === 'HEAD' ? 'head-row' : ''}>
                      <td>{m.last}, {m.first} {m.mid}</td>
                      <td>{m.rel || 'MEMBER'}</td>
                      <td>{m.s || ''}</td>
                      <td>{m.bd || ''}</td>
                      <td>{m.oc || 'N/A'}</td>
                      <td>{m.isVoter || 'N/A'}</td>
                      <td>
                        <button className="btn-archive-row" onClick={() => handleArchive(m)}>
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
