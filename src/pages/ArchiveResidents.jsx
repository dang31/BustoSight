import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import '../css/BarangayList.css';
import '../css/ArchiveResidents.css';

export default function ArchiveResidents() {
  const [archived, setArchived] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchArchived();
  }, []);

  const fetchArchived = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('residents')
        .select('*')
        .eq('is_archived', true);

      if (error) throw error;

      const mappedData = data.map(r => ({
        id: r.id,
        h_no: r.h_no,
        last: r.last_name,
        first: r.first_name,
        mid: r.middle_name,
        q: r.qualifier,
        bp: r.birth_place,
        bd: r.birth_date,
        s: r.sex,
        cs: r.civil_status,
        cz: r.citizenship,
        oc: r.occupation,
        rel: r.relation_to_head,
        isVoter: r.is_voter,
        brgy: r.barangay,
        archiveDate: r.archive_date ? new Date(r.archive_date).toLocaleDateString() : 'N/A'
      }));

      setArchived(mappedData);
    } catch (err) {
      console.error('Error fetching archived:', err);
      const cached = JSON.parse(localStorage.getItem('archivedResidents')) || [];
      setArchived(cached);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (res) => {
    if (!window.confirm('Are you sure you want to restore this resident to the active list?')) return;

    const adminPassword = prompt('SECURITY CHECK: Enter Admin Password to confirm restoration:');
    if (adminPassword === null) return;
    if (adminPassword !== 'admin123') {
      alert('Error: Incorrect Admin Password.');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('residents')
        .update({ 
          is_archived: false, 
          archive_date: null 
        })
        .eq('id', res.id);

      if (error) throw error;

      const updatedArchived = archived.filter(r => r.id !== res.id);
      setArchived(updatedArchived);
      
      alert('Success! The resident has been restored.');
    } catch (err) {
      console.error('Error restoring:', err);
      alert('Failed to restore: ' + err.message);
    } finally {
      setIsLoading(false);
    }
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
                {isLoading ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '50px' }}>
                      <div className="loading-spinner">Loading archive...</div>
                    </td>
                  </tr>
                ) : filtered.length > 0 ? (
                  filtered.map((res, i) => (
                    <tr key={res.id || i}>
                      <td>{res.h_no || 'N/A'}</td>
                      <td><strong>{res.last}, {res.first} {res.mid || ''}</strong></td>
                      <td>{res.brgy || 'Unknown'}</td>
                      <td>{res.s || ''}</td>
                      <td>{res.rel || ''}</td>
                      <td>{res.archiveDate || 'N/A'}</td>
                      <td><span className="status-badge">Archived</span></td>
                      <td>
                        <button className="btn-restore" onClick={() => handleRestore(res)}>
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
