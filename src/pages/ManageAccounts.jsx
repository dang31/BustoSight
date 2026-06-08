import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import '../css/ManageAccounts.css';
import '../css/AddResident.css'; // Reusing some classes

export default function ManageAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [newUser, setNewUser] = useState({ username: '', password: '' });
  const [adminVerify, setAdminVerify] = useState({ open: false, action: '', index: null, password: '' });

  useEffect(() => {
    const data = JSON.parse(localStorage.getItem('popdevUsers')) || [
      { username: 'admin_bustos', role: 'Administrator' }
    ];
    setAccounts(data);
  }, []);

  const handleProcess = () => {
    if (adminVerify.password !== 'admin123') {
      alert('Mali ang Admin Password!');
      return;
    }

    if (adminVerify.action === 'create') {
      if (!newUser.username || !newUser.password) {
        alert('Please fill in both fields.');
        return;
      }
      const updated = [...accounts, { username: newUser.username, password: newUser.password, role: 'User' }];
      save(updated);
      setNewUser({ username: '', password: '' });
    } else if (adminVerify.action === 'delete') {
      const updated = accounts.filter((_, i) => i !== adminVerify.index);
      save(updated);
    }

    setAdminVerify({ open: false, action: '', index: null, password: '' });
  };

  const save = (data) => {
    localStorage.setItem('popdevUsers', JSON.stringify(data));
    setAccounts(data);
  };

  return (
    <div className="dashboard-wrapper">
      <div className="bg-image" />
      <div className="overlay" />
      <Sidebar />

      <main className="content">
        <div className="form-card-container animate-fade-up">
          <div className="form-blue-header">
            <h1>Manage User Accounts</h1>
          </div>

          <div className="form-white-body">
            <div className="form-step">
              <h2 className="form-section-title">Create New User</h2>
              <div className="grid-2-cols">
                <div className="field-group">
                  <label>Username</label>
                  <input 
                    type="text" 
                    placeholder="Enter username" 
                    value={newUser.username}
                    onChange={e => setNewUser({...newUser, username: e.target.value})}
                  />
                </div>
                <div className="field-group">
                  <label>Password</label>
                  <input 
                    type="password" 
                    placeholder="••••••••" 
                    value={newUser.password}
                    onChange={e => setNewUser({...newUser, password: e.target.value})}
                  />
                </div>
              </div>
              <div style={{ textAlign: 'center', marginTop: '20px' }}>
                <button 
                  className="btn-next" 
                  onClick={() => setAdminVerify({ ...adminVerify, open: true, action: 'create' })}
                >
                  Register Account
                </button>
              </div>
            </div>

            <hr style={{ margin: '40px 0', border: '0', borderTop: '2px dashed #e2e8f0' }} />

            <div className="form-step">
              <h2 className="form-section-title">Active System Users</h2>
              <div className="account-table-container">
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Role / Position</th>
                      <th style={{ textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((acc, i) => (
                      <tr key={i}>
                        <td><b>{acc.username}</b></td>
                        <td><span style={{ color: '#4a5568', fontSize: '12px' }}>{acc.role}</span></td>
                        <td style={{ textAlign: 'center' }}>
                          {acc.role !== 'Administrator' ? (
                            <button 
                              className="btn-delete" 
                              onClick={() => setAdminVerify({ open: true, action: 'delete', index: i })}
                            >
                              Delete
                            </button>
                          ) : (
                            <span className="protected-badge">Protected</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>

      {adminVerify.open && (
        <div className="modal-overlay">
          <div className="admin-modal">
            <h2>Admin Verification</h2>
            <p>Please enter admin's password before proceeding.</p>
            <div className="field-group">
              <label>Admin Password</label>
              <input 
                type="password" 
                style={{ textAlign: 'center' }} 
                value={adminVerify.password}
                onChange={e => setAdminVerify({...adminVerify, password: e.target.value})}
                autoFocus
              />
            </div>
            <div className="modal-btns">
              <button 
                className="btn-back" style={{ flex: 1 }} 
                onClick={() => setAdminVerify({ open: false, action: '', index: null, password: '' })}
              >
                Cancel
              </button>
              <button className="btn-next" style={{ flex: 1 }} onClick={handleProcess}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
