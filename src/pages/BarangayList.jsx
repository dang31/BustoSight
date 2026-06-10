import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { brgyStats } from '../data/brgyData';
import { supabase } from '../lib/supabase';
import '../css/BarangayList.css';

export default function BarangayList() {
  const navigate = useNavigate();
  const [activeBrgy, setActiveBrgy] = useState('Poblacion');
  const [allRecords, setAllRecords] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHousehold, setSelectedHousehold] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchResidents();
  }, []);

  const fetchResidents = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('residents')
        .select('*')
        .eq('is_archived', false);

      if (error) throw error;

      // Map Supabase columns to UI state structure
      const mappedData = data.map(r => ({
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
        brgy: r.barangay
      }));

      setAllRecords(mappedData);
      
      // Sync to localStorage as backup if needed
      localStorage.setItem('tanawanData', JSON.stringify(mappedData));
    } catch (err) {
      console.error('Error fetching residents:', err);
      // Fallback to localStorage if offline or error
      const cached = JSON.parse(localStorage.getItem('tanawanData')) || [];
      setAllRecords(cached);
    } finally {
      setIsLoading(false);
    }
  };

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

  const handleArchive = async (res) => {
    if (!window.confirm(`Are you sure you want to archive resident ${res.first} ${res.last}?`)) return;

    const adminPassword = prompt('Security Check: Please enter Admin Password to archive this record:');
    if (adminPassword === null) return;
    if (adminPassword !== 'admin123') {
      alert('Access Denied: Incorrect Admin Password.');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('residents')
        .update({ 
          is_archived: true, 
          archive_date: new Date().toISOString() 
        })
        .eq('id', res.id);

      if (error) throw error;

      // Update local state
      const updatedRecords = allRecords.filter(r => r.id !== res.id);
      setAllRecords(updatedRecords);
      localStorage.setItem('tanawanData', JSON.stringify(updatedRecords));
      
      setSelectedHousehold(null);
      alert('Successfully archived!');
    } catch (err) {
      console.error('Error archiving:', err);
      alert('Failed to archive: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteBrgyData = async () => {
    if (!window.confirm(`WARNING: Are you sure you want to PERMANENTLY DELETE ALL records in Barangay ${activeBrgy}? This action cannot be undone.`)) return;

    const adminPassword = prompt('Security Check: Please enter Admin Password to delete these records:');
    if (adminPassword === null) return;
    if (adminPassword !== 'admin123') {
      alert('Access Denied: Incorrect Admin Password.');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('residents')
        .delete()
        .eq('barangay', activeBrgy);

      if (error) throw error;

      const updatedRecords = allRecords.filter(res => (res.brgy || 'Poblacion').toLowerCase() !== activeBrgy.toLowerCase());
      setAllRecords(updatedRecords);
      localStorage.setItem('tanawanData', JSON.stringify(updatedRecords));
      
      alert(`Successfully deleted all records in Barangay ${activeBrgy}!`);
    } catch (err) {
      console.error('Error deleting records:', err);
      alert('Failed to delete records: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const generateMockData = () => {
    const mockResidents = [
      { h_no: 'MOCK-001', last: 'Dela Cruz', first: 'Juan', mid: 'P', q: '', no: '123', st: 'Main St', p: 'Purok 1', bp: 'Bustos', bd: '1990-01-01', s: 'M', cs: 'Single', cz: 'FILIPINO', oc: 'Engineer', rel: 'HEAD', isVoter: 'YES', brgy: activeBrgy },
      { h_no: 'MOCK-001', last: 'Dela Cruz', first: 'Maria', mid: 'S', q: '', no: '123', st: 'Main St', p: 'Purok 1', bp: 'Bustos', bd: '1992-05-15', s: 'F', cs: 'Married', cz: 'FILIPINO', oc: 'Teacher', rel: 'WIFE', isVoter: 'YES', brgy: activeBrgy },
      { h_no: 'MOCK-002', last: 'Santos', first: 'Ricardo', mid: 'L', q: 'JR', no: '45', st: 'Daisy St', p: 'Purok 3', bp: 'Baliuag', bd: '1985-11-20', s: 'M', cs: 'Single', cz: 'FILIPINO', oc: 'Driver', rel: 'HEAD', isVoter: 'NO', brgy: activeBrgy },
    ];
    
    const newRecords = [...allRecords, ...mockResidents];
    localStorage.setItem('tanawanData', JSON.stringify(newRecords));
    setAllRecords(newRecords);
    alert('Mock data generated successfully!');
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
              <button className="btn btn-delete-all" onClick={handleDeleteBrgyData}>
                Delete All {activeBrgy}
              </button>
              <button className="btn btn-mock" onClick={generateMockData}>
                Add Mock Data
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
                  {isLoading ? (
                    <tr>
                      <td colSpan="17" style={{ textAlign: 'center', padding: '30px' }}>
                        <div className="loading-spinner">Loading residents...</div>
                      </td>
                    </tr>
                  ) : filteredRecords.length > 0 ? (
                    filteredRecords.map((res, i) => (
                      <tr key={res.id || i} onClick={() => openHousehold(res.h_no)}>
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
