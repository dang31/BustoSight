import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { brgyStats } from '../data/brgyData';
import '../css/AddResident.css';

export default function AddResident() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [household, setHousehold] = useState({
    hh_num: '', house_no: '', street: '', purok: '', brgy: '', mun: 'Bustos'
  });
  const [head, setHead] = useState({
    lname: '', fname: '', mname: '', q: '', pob: '', dob: '', sex: 'Male', civil: 'Single',
    is_senior: false, is_pwd: false, is_voter: false
  });
  const [members, setMembers] = useState([]);

  const addMember = () => {
    setMembers([...members, {
      lname: '', fname: '', mname: '', q: '', rel: '', pob: '', dob: '', sex: 'Male', civil: 'Single',
      is_senior: false, is_pwd: false, is_voter: false
    }]);
  };

  const removeMember = (index) => {
    setMembers(members.filter((_, i) => i !== index));
  };

  const updateMember = (index, field, value) => {
    const newMembers = [...members];
    newMembers[index][field] = value;
    setMembers(newMembers);
  };

  const handleStep = (dir) => {
    if (currentStep === 4 && dir === 1) {
      saveData();
      return;
    }
    setCurrentStep(currentStep + dir);
  };

  const saveData = () => {
    const allRecords = JSON.parse(localStorage.getItem('tanawanData')) || [];
    
    const common = {
      h_no: household.hh_num,
      brgy: household.brgy,
      no: household.house_no,
      st: household.street,
      p: household.purok,
      mun: 'Bustos'
    };

    // Save Head
    const headRecord = {
      ...common,
      last: head.lname, first: head.fname, mid: head.mname, q: head.q,
      bd: head.dob, bp: head.pob, s: head.sex, cs: head.civil,
      is_voter: head.is_voter ? 'Yes' : 'No',
      is_senior: head.is_senior ? 'Yes' : 'No',
      is_pwd: head.is_pwd ? 'Yes' : 'No',
      rel: 'HEAD'
    };
    
    const newRecords = [headRecord];

    // Save Members
    members.forEach(m => {
      newRecords.push({
        ...common,
        last: m.lname, first: m.fname, mid: m.mname, q: m.q,
        bd: m.dob, bp: m.pob, s: m.sex, cs: m.civil,
        rel: m.rel || 'MEMBER',
        is_voter: m.is_voter ? 'Yes' : 'No',
        is_senior: m.is_senior ? 'Yes' : 'No',
        is_pwd: m.is_pwd ? 'Yes' : 'No'
      });
    });

    const updatedData = [...allRecords, ...newRecords];
    localStorage.setItem('tanawanData', JSON.stringify(updatedData));
    alert('Resident successfully added!');
    navigate('/barangay');
  };

  return (
    <div className="dashboard-wrapper">
      <div className="bg-image" />
      <div className="overlay" />
      <Sidebar />

      <main className="content">
        <div className="step-wrapper">
          {[1, 2, 3, 4].map(s => (
            <div key={s} style={{ display: 'contents' }}>
              <div className={`step ${currentStep === s ? 'active' : ''} ${currentStep > s ? 'done' : ''}`}>
                {currentStep > s ? '✓' : s}
              </div>
              {s < 4 && <div className="step-divider" />}
            </div>
          ))}
        </div>

        <div className="form-card-container">
          <div className="form-blue-header">
            <h1>{currentStep === 4 ? 'Review Registration Details' : 'Add Resident Form'}</h1>
          </div>

          <div className="form-white-body">
            <form onSubmit={(e) => e.preventDefault()}>
              
              {currentStep === 1 && (
                <div className="form-step animate-fade-up">
                  <h2 className="form-section-title">Household Information</h2>
                  <div className="grid-4-cols">
                    <div className="field-group">
                      <label>Household Number</label>
                      <input type="text" placeholder="2024-XXXX" value={household.hh_num} onChange={e => setHousehold({...household, hh_num: e.target.value})} />
                    </div>
                    <div className="field-group">
                      <label>House Number</label>
                      <input type="text" placeholder="No." value={household.house_no} onChange={e => setHousehold({...household, house_no: e.target.value})} />
                    </div>
                    <div className="field-group">
                      <label>Street</label>
                      <input type="text" placeholder="Street Name" value={household.street} onChange={e => setHousehold({...household, street: e.target.value})} />
                    </div>
                    <div className="field-group">
                      <label>Purok</label>
                      <input type="text" placeholder="Purok" value={household.purok} onChange={e => setHousehold({...household, purok: e.target.value})} />
                    </div>
                  </div>
                  <div className="grid-2-cols" style={{ marginTop: '20px' }}>
                    <div className="field-group">
                      <label>Barangay</label>
                      <select className="modern-select" value={household.brgy} onChange={e => setHousehold({...household, brgy: e.target.value})}>
                        <option value="" disabled>Select Barangay</option>
                        {brgyStats.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                      </select>
                    </div>
                    <div className="field-group">
                      <label>Municipality</label>
                      <input type="text" value="Bustos" readOnly />
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="form-step animate-fade-up">
                  <h2 className="form-section-title">Household Head Information</h2>
                  <div className="grid-4-cols">
                    <div className="field-group"><label>Last Name</label><input type="text" value={head.lname} onChange={e => setHead({...head, lname: e.target.value})} /></div>
                    <div className="field-group"><label>First Name</label><input type="text" value={head.fname} onChange={e => setHead({...head, fname: e.target.value})} /></div>
                    <div className="field-group"><label>Middle Name</label><input type="text" value={head.mname} onChange={e => setHead({...head, mname: e.target.value})} /></div>
                    <div className="field-group">
                      <label>Qualifier</label>
                      <select className="modern-select" value={head.q} onChange={e => setHead({...head, q: e.target.value})}>
                        <option value="">None</option><option>JR.</option><option>SR.</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid-4-cols" style={{ marginTop: '15px' }}>
                    <div className="field-group"><label>Place of Birth</label><input type="text" value={head.pob} onChange={e => setHead({...head, pob: e.target.value})} /></div>
                    <div className="field-group"><label>Date of Birth</label><input type="date" value={head.dob} onChange={e => setHead({...head, dob: e.target.value})} /></div>
                    <div className="field-group">
                      <label>Sex</label>
                      <select className="modern-select" value={head.sex} onChange={e => setHead({...head, sex: e.target.value})}>
                        <option>Male</option><option>Female</option>
                      </select>
                    </div>
                    <div className="field-group">
                      <label>Civil Status</label>
                      <select className="modern-select" value={head.civil} onChange={e => setHead({...head, civil: e.target.value})}>
                        <option>Single</option><option>Married</option><option>Widowed</option>
                      </select>
                    </div>
                  </div>
                  <div className="classification-box">
                    <p className="classification-title">Head Classification</p>
                    <div className="grid-3-cols">
                      <div className="check-item">
                        <label>Senior Citizen</label>
                        <input type="checkbox" checked={head.is_senior} onChange={e => setHead({...head, is_senior: e.target.checked})} />
                      </div>
                      <div className="check-item">
                        <label>PWD</label>
                        <input type="checkbox" checked={head.is_pwd} onChange={e => setHead({...head, is_pwd: e.target.checked})} />
                      </div>
                      <div className="check-item voter-box">
                        <label>Registered Voter</label>
                        <input type="checkbox" checked={head.is_voter} onChange={e => setHead({...head, is_voter: e.target.checked})} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="form-step animate-fade-up">
                  <h2 className="form-section-title">Household Members</h2>
                  {members.map((m, i) => (
                    <div key={i} className="member-entry">
                      <div className="grid-4-cols">
                        <div className="field-group"><label>Last Name</label><input type="text" value={m.lname} onChange={e => updateMember(i, 'lname', e.target.value)} /></div>
                        <div className="field-group"><label>First Name</label><input type="text" value={m.fname} onChange={e => updateMember(i, 'fname', e.target.value)} /></div>
                        <div className="field-group"><label>Relation</label><input type="text" placeholder="e.g. Son" value={m.rel} onChange={e => updateMember(i, 'rel', e.target.value)} /></div>
                        <div className="field-group">
                           <label>Qualifier</label>
                           <select className="modern-select" value={m.q} onChange={e => updateMember(i, 'q', e.target.value)}>
                             <option value="">None</option><option>JR.</option><option>SR.</option>
                           </select>
                        </div>
                      </div>
                      <div className="grid-4-cols" style={{ marginTop: '10px' }}>
                        <div className="field-group"><label>Date of Birth</label><input type="date" value={m.dob} onChange={e => updateMember(i, 'dob', e.target.value)} /></div>
                        <div className="field-group">
                           <label>Sex</label>
                           <select className="modern-select" value={m.sex} onChange={e => updateMember(i, 'sex', e.target.value)}>
                             <option>Male</option><option>Female</option>
                           </select>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <button type="button" className="btn-remove-member" onClick={() => removeMember(i)}>Remove Member</button>
                      </div>
                    </div>
                  ))}
                  <div style={{ textAlign: 'center' }}>
                    <button type="button" className="btn-add-member" onClick={addMember}>+ Add Another Member</button>
                  </div>
                </div>
              )}

              {currentStep === 4 && (
                <div className="summary-area animate-fade-up">
                  <div className="summary-section">
                    <h3>Household Location</h3>
                    <div className="summary-grid">
                      <span><b>HH #:</b> {household.hh_num}</span>
                      <span><b>Brgy:</b> {household.brgy}</span>
                      <span><b>Address:</b> {household.house_no} {household.street}, {household.purok}</span>
                    </div>
                  </div>
                  <div className="summary-section">
                    <h3>Head of Household</h3>
                    <div className="summary-grid">
                      <span><b>Name:</b> {head.last}, {head.first}</span>
                      <span><b>Classification:</b> {[head.is_senior && 'Senior', head.is_pwd && 'PWD', head.is_voter && 'Voter'].filter(Boolean).join(', ') || 'Regular'}</span>
                    </div>
                  </div>
                  <div className="summary-section">
                    <h3>Members ({members.length})</h3>
                    <table className="summary-table">
                      <thead>
                        <tr><th>No.</th><th>Name</th><th>Relation</th><th>Classification</th></tr>
                      </thead>
                      <tbody>
                        {members.map((m, i) => (
                          <tr key={i}>
                            <td>{i+1}</td><td>{m.last}, {m.first}</td><td>{m.rel}</td>
                            <td>{[m.is_senior && 'S', m.is_pwd && 'P', m.is_voter && 'V'].filter(Boolean).join('/') || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="form-nav-buttons">
                <button type="button" className={`btn-back ${currentStep === 1 ? 'hidden' : ''}`} onClick={() => handleStep(-1)}>
                  Previous
                </button>
                <button type="button" className="btn-next" onClick={() => handleStep(1)}>
                  {currentStep === 4 ? 'Confirm & Submit' : 'Next'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
