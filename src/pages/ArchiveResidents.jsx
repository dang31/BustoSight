import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../css/BarangayList.css';
import '../css/ArchiveResidents.css';

export default function ArchiveResidents() {
  const [archived, setArchived] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const data = JSON.parse(localStorage.getItem('archivedResidents')) || [];
    setArchived(data);
  }, []);

  const handleRestore = (index) => {
    if (!window.confirm('Are you sure you want to restore this resident to the active list?')) return;

    const adminPassword = prompt('SECURITY CHECK: Enter Admin Password to confirm restoration:');
    if (adminPassword === null) return;
    if (adminPassword !== 'admin123') {
      alert('Error: Incorrect Admin Password.');
      return;
    }

    const archivedData = [...archived];
    const activeData = JSON.parse(localStorage.getItem('tanawanData')) || [];

    const restoredPerson = archivedData[index];
    delete restoredPerson.archiveDate;

    const newActiveData = [...activeData, restoredPerson];
    const newArchivedData = archivedData.filter((_, i) => i !== index);

    localStorage.setItem('tanawanData', JSON.stringify(newActiveData));
    localStorage.setItem('archivedResidents', JSON.stringify(newArchivedData));
    setArchived(newArchivedData);
    alert('Success! The resident has been restored.');
  };

  const filtered = archived.filter(res => {
    const query = searchQuery.toLowerCase();
    return (
      (res.last || '').toLowerCase().includes(query) ||
      (res.first || '').toLowerCase().includes(query) ||
      (res.h_no || '').toLowerCase().includes(query)
    );
  });

  return (
    <div className="dashboard-wrapper">
      <div className="bg-image" />
      <div className="overlay" />

      <main className="content" style={{ padding: '40px' }}>
        <div className="archive-controls animate-fade-up">
          <Link to="/barangay" className="back-archive-btn">← Back to Barangay List</Link>
          <div className="archive-title-group">
            <h2>Archived Residents</h2>
            <p>Inactive or Deceased Records</p>
          </div>
        </div>

        <div className="table-section animate-fade-up">
          <div className="table-controls">
            <input 
              type="text" 
              className="search-input" 
              placeholder="Search archived name or HH No..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>HH NO.</th>
                  <th>FULL NAME</th>
                  <th>BARANGAY</th>
                  <th>SEX</th>
                  <th>RELATION</th>
                  <th>DATE ARCHIVED</th>
                  <th>STATUS</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? (
                  filtered.map((res, i) => (
                    <tr key={i}>
                      <td>{res.h_no || 'N/A'}</td>
                      <td><strong>{res.last}, {res.first} {res.mid || ''}</strong></td>
                      <td>{res.brgy || 'Unknown'}</td>
                      <td>{res.s || ''}</td>
                      <td>{res.rel || ''}</td>
                      <td>{res.archiveDate || 'N/A'}</td>
                      <td><span className="status-badge">Archived</span></td>
                      <td>
                        <button className="btn-restore" onClick={() => handleRestore(i)}>
                          Restore
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '50px', color: '#a0aec0' }}>
                      No archived records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
