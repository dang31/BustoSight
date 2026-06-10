import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { supabase } from '../lib/supabase';
import '../css/ManageAccounts.css';
import '../css/AddResident.css'; // Reusing some classes

export default function ManageAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [newUser, setNewUser] = useState({ 
    employee_id: '', first_name: '', last_name: '', email: '', 
    username: '', password: '', role: 'Staff', status: 'Active' 
  });
  const [adminVerify, setAdminVerify] = useState({ open: false, action: '', index: null, password: '' });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAccounts(data || []);
    } catch (err) {
      console.error('Error fetching accounts:', err);
      // Fallback
      const data = JSON.parse(localStorage.getItem('popdevUsers')) || [
        { username: 'admin_bustos', role: 'Administrator', first_name: 'Admin', last_name: 'Bustos' }
      ];
      setAccounts(data);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProcess = async () => {
    if (adminVerify.password !== 'admin123') {
      alert('Mali ang Admin Password!');
      return;
    }

    setIsLoading(true);
    try {
      if (adminVerify.action === 'create') {
        if (!newUser.username || !newUser.password || !newUser.first_name || !newUser.last_name) {
          alert('Please fill in required fields (Name, Username, Password).');
          setIsLoading(false);
          return;
        }

        const { error } = await supabase
          .from('profiles')
          .insert([newUser]);

        if (error) throw error;

        alert('Account successfully registered!');
        setNewUser({ 
          employee_id: '', first_name: '', last_name: '', email: '', 
          username: '', password: '', role: 'Staff', status: 'Active' 
        });
        fetchAccounts();
      } else if (adminVerify.action === 'delete') {
        const accountToDelete = accounts[adminVerify.index];
        const { error } = await supabase
          .from('profiles')
          .delete()
          .eq('id', accountToDelete.id);

        if (error) throw error;
        
        alert('Account deleted.');
        fetchAccounts();
      }
    } catch (err) {
      console.error('Operation failed:', err);
      alert('Failed: ' + err.message);
    } finally {
      setIsLoading(false);
      setAdminVerify({ open: false, action: '', index: null, password: '' });
    }
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
              <h2 className="form-section-title">Account Details</h2>
              <div className="grid-3-cols">
                <div className="field-group">
                  <label>Employee ID</label>
                  <input type="text" placeholder="EMP-2024-XXX" value={newUser.employee_id} onChange={e => setNewUser({...newUser, employee_id: e.target.value})} />
                </div>
                <div className="field-group">
                  <label>First Name</label>
                  <input type="text" placeholder="First Name" value={newUser.first_name} onChange={e => setNewUser({...newUser, first_name: e.target.value})} />
                </div>
                <div className="field-group">
                  <label>Last Name</label>
                  <input type="text" placeholder="Last Name" value={newUser.last_name} onChange={e => setNewUser({...newUser, last_name: e.target.value})} />
                </div>
              </div>

              <div className="grid-3-cols" style={{ marginTop: '15px' }}>
                <div className="field-group">
                  <label>Email Address</label>
                  <input type="email" placeholder="email@example.com" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
                </div>
                <div className="field-group">
                  <label>Username</label>
                  <input type="text" placeholder="Username" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} />
                </div>
                <div className="field-group">
                  <label>Password</label>
                  <input type="password" placeholder="••••••••" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                </div>
              </div>

              <div className="grid-2-cols" style={{ marginTop: '15px' }}>
                <div className="field-group">
                  <label>Role</label>
                  <select className="modern-select" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                    <option>Staff</option>
                    <option>Administrator</option>
                    <option>Encoder</option>
                  </select>
                </div>
                <div className="field-group">
                  <label>Status</label>
                  <select className="modern-select" value={newUser.status} onChange={e => setNewUser({...newUser, status: e.target.value})}>
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </div>
              </div>

              <div style={{ textAlign: 'center', marginTop: '30px' }}>
                <button 
                  className={`btn-next ${isLoading ? 'loading' : ''}`} 
                  onClick={() => setAdminVerify({ ...adminVerify, open: true, action: 'create' })}
                  disabled={isLoading}
                >
                  {isLoading ? 'Processing...' : 'Register Account'}
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
                      <th>Employee ID</th>
                      <th>Name</th>
                      <th>Username</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>Updating...</td>
                      </tr>
                    ) : accounts.length > 0 ? (
                      accounts.map((acc, i) => (
                        <tr key={acc.id || i}>
                          <td>{acc.employee_id || '---'}</td>
                          <td><b>{acc.first_name} {acc.last_name}</b></td>
                          <td>{acc.username}</td>
                          <td><span className="role-badge">{acc.role}</span></td>
                          <td>
                            <span className={`status-badge ${acc.status?.toLowerCase()}`}>
                              {acc.status}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {acc.username !== 'admin_bustos' ? (
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
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>No users found.</td>
                      </tr>
                    )}
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
