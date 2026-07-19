import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { brgyStats } from '../data/brgyData';
import { supabase } from '../lib/supabase';
import '../css/AddResident.css';

export default function AddResident() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [household, setHousehold] = useState({
    hh_num: '', house_no: '', street: '', purok: '', brgy: '', mun: 'Bustos',
    residence_type: 'Owner', residence_type_other: ''
  });
  const [head, setHead] = useState({
    lname: '', fname: '', mname: '', q: '', pob: '', dob: '', age: '', sex: 'Male', civil: 'Single',
    religion: '', citizenship: 'FILIPINO', edu: '', occupation: '',
    is_voter: 'Registered Voter', is_4ps: false,
    is_pwd: false, has_pwd_id: false,
    is_senior: false, has_senior_id: false,
    is_solo_parent: false, has_solo_parent_id: false,
    age_first_birth: '', teenage_pregnancy: false, teenage_mother: false
  });
  const [members, setMembers] = useState([]);
  const [expandedMemberIndex, setExpandedMemberIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [formWarning, setFormWarning] = useState('');

  const calculateAge = (dobString) => {
    if (!dobString) return '';
    const today = new Date();
    const birthDate = new Date(dobString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 0 ? age : '';
  };

  const handleHeadDobChange = (dobValue) => {
    const calculatedAge = calculateAge(dobValue);
    setHead(prev => ({
      ...prev,
      dob: dobValue,
      age: calculatedAge
    }));
  };

  const handleMemberDobChange = (index, dobValue) => {
    const calculatedAge = calculateAge(dobValue);
    const newMembers = [...members];
    newMembers[index].dob = dobValue;
    newMembers[index].age = calculatedAge;
    setMembers(newMembers);
  };

  const handleHeadAgeFirstBirthChange = (val) => {
    const ageNum = parseInt(val, 10);
    const isTeenPreg = !isNaN(ageNum) && ageNum > 0 && ageNum <= 19;
    setHead(prev => ({
      ...prev,
      age_first_birth: val,
      teenage_pregnancy: isTeenPreg
    }));
  };

  const handleMemberAgeFirstBirthChange = (index, val) => {
    const ageNum = parseInt(val, 10);
    const isTeenPreg = !isNaN(ageNum) && ageNum > 0 && ageNum <= 19;
    const newMembers = [...members];
    newMembers[index].age_first_birth = val;
    newMembers[index].teenage_pregnancy = isTeenPreg;
    setMembers(newMembers);
  };

  const handleHeadClassification = (field, checked) => {
    setHead(prev => {
      const next = { ...prev, [field]: checked };
      if (field === 'is_pwd' && !checked) next.has_pwd_id = false;
      if (field === 'is_senior' && !checked) next.has_senior_id = false;
      if (field === 'is_solo_parent' && !checked) next.has_solo_parent_id = false;
      return next;
    });
  };

  const updateMemberClassification = (index, field, checked) => {
    const newMembers = [...members];
    newMembers[index][field] = checked;
    if (field === 'is_pwd' && !checked) newMembers[index].has_pwd_id = false;
    if (field === 'is_senior' && !checked) newMembers[index].has_senior_id = false;
    if (field === 'is_solo_parent' && !checked) newMembers[index].has_solo_parent_id = false;
    setMembers(newMembers);
  };

  const validateStep = (step = currentStep) => {
    if (step === 1) {
      if (!household.hh_num || !household.house_no || !household.street || !household.purok || !household.brgy) {
        return 'Please fill in all required household information fields.';
      }
      if (household.residence_type === 'Other' && !household.residence_type_other) {
        return 'Please specify the residence type.';
      }
    }

    // Step 2: Household Head Validation
    if (step === 2) {
      if (!head.lname || !head.fname || !head.pob || !head.dob) {
        return 'Please fill in all required household head fields.';
      }
    }

    if (step === 3) {
      for (let i = 0; i < members.length; i += 1) {
        const member = members[i];
        const hasAnyMemberValue = member.lname || member.fname || member.rel || member.dob || member.pob || member.religion || member.edu || member.occupation;
        if (hasAnyMemberValue && (!member.lname || !member.fname || !member.rel)) {
          return `Please complete the required fields (First Name, Last Name, and Relation) for member ${i + 1} or remove the incomplete member.`;
        }
      }
    }

    return '';
  };

  const validateAll = () => {
    const householdWarning = validateStep(1);
    if (householdWarning) return householdWarning;

    const headWarning = validateStep(2);
    if (headWarning) return headWarning;

    return validateStep(3);
  };

  const addMember = () => {
    setMembers([...members, {
      lname: '', fname: '', mname: '', q: '', rel: '', pob: '', dob: '', age: '', sex: 'Male', civil: 'Single',
      religion: '', citizenship: 'FILIPINO', edu: '', occupation: '',
      is_voter: 'Registered Voter', is_4ps: false,
      is_pwd: false, has_pwd_id: false,
      is_senior: false, has_senior_id: false,
      is_solo_parent: false, has_solo_parent_id: false,
      age_first_birth: '', teenage_pregnancy: false, teenage_mother: false
    }]);
    setExpandedMemberIndex(members.length);
  };

  const removeMember = (index) => {
    setMembers(members.filter((_, i) => i !== index));
    if (expandedMemberIndex === index) {
      setExpandedMemberIndex(-1);
    } else if (expandedMemberIndex > index) {
      setExpandedMemberIndex(expandedMemberIndex - 1);
    }
  };

  const updateMember = (index, field, value) => {
    const newMembers = [...members];
    newMembers[index][field] = value;
    setMembers(newMembers);
  };

  const handleStep = (dir) => {
    if (dir === 1) {
      const warning = validateStep();
      if (warning) {
        setFormWarning(warning);
        return;
      }
    }

    if (currentStep === 4 && dir === 1) {
      saveData();
      return;
    }

    setFormWarning('');
    setCurrentStep(currentStep + dir);
  };

  const saveData = async () => {
    const warning = validateAll();
    if (warning) {
      setFormWarning(warning);
      return;
    }

    setFormWarning('');
    setIsLoading(true);
    try {
      const common = {
        h_no: household.hh_num,
        house_no: household.house_no,
        street: household.street,
        purok: household.purok,
        barangay: household.brgy,
        residence_type: household.residence_type === 'Other' ? household.residence_type_other : household.residence_type
      };

      const residentsToSave = [
        {
          ...common,
          last_name: head.lname,
          first_name: head.fname,
          middle_name: head.mname || null,
          qualifier: head.q || null,
          birth_place: head.pob,
          birth_date: head.dob || null,
          sex: head.sex,
          civil_status: head.civil,
          relation_to_head: 'HEAD',
          is_household_head: true,
          age: head.age ? parseInt(head.age, 10) : null,
          religion: head.religion || null,
          educational_attainment: head.edu || null,
          citizenship: head.citizenship || 'FILIPINO',
          occupation: head.occupation || null,
          is_voter: head.is_voter,
          is_4ps: head.is_4ps,
          is_pwd: head.is_pwd,
          has_pwd_id: head.is_pwd ? head.has_pwd_id : false,
          is_senior: head.is_senior,
          has_senior_id: head.is_senior ? head.has_senior_id : false,
          is_solo_parent: head.is_solo_parent,
          has_solo_parent_id: head.is_solo_parent ? head.has_solo_parent_id : false,
          age_at_first_birth: head.sex === 'Female' && head.age_first_birth ? parseInt(head.age_first_birth, 10) : null,
          teenage_pregnancy_case: head.sex === 'Female' ? head.teenage_pregnancy : false,
          current_teenage_mother: head.sex === 'Female' ? head.teenage_mother : false,
          is_archived: false
        },
        ...members.map(m => ({
          ...common,
          last_name: m.lname,
          first_name: m.fname,
          middle_name: m.mname || null,
          qualifier: m.q || null,
          birth_place: m.pob,
          birth_date: m.dob || null,
          sex: m.sex,
          civil_status: m.civil,
          relation_to_head: m.rel || 'MEMBER',
          is_household_head: false,
          age: m.age ? parseInt(m.age, 10) : null,
          religion: m.religion || null,
          educational_attainment: m.edu || null,
          citizenship: m.citizenship || 'FILIPINO',
          occupation: m.occupation || null,
          is_voter: m.is_voter,
          is_4ps: m.is_4ps,
          is_pwd: m.is_pwd,
          has_pwd_id: m.is_pwd ? m.has_pwd_id : false,
          is_senior: m.is_senior,
          has_senior_id: m.is_senior ? m.has_senior_id : false,
          is_solo_parent: m.is_solo_parent,
          has_solo_parent_id: m.is_solo_parent ? m.has_solo_parent_id : false,
          age_at_first_birth: m.sex === 'Female' && m.age_first_birth ? parseInt(m.age_first_birth, 10) : null,
          teenage_pregnancy_case: m.sex === 'Female' ? m.teenage_pregnancy : false,
          current_teenage_mother: m.sex === 'Female' ? m.teenage_mother : false,
          is_archived: false
        }))
      ];

      const { error } = await supabase.from('residents').insert(residentsToSave);

      if (error) throw error;

      // Sync to localStorage
      const allRecords = JSON.parse(localStorage.getItem('tanawanData')) || [];
      const newRecordsLocal = residentsToSave.map(r => ({
        id: r.id || 'local_' + Math.random().toString(36).substr(2, 9),
        h_no: r.h_no,
        brgy: r.barangay,
        no: r.house_no,
        st: r.street,
        p: r.purok,
        last: r.last_name,
        first: r.first_name,
        mid: r.middle_name,
        q: r.qualifier,
        bd: r.birth_date,
        bp: r.birth_place,
        s: r.sex,
        cs: r.civil_status,
        cz: r.citizenship,
        oc: r.occupation,
        rel: r.relation_to_head,
        isVoter: r.is_voter,
        age: r.age,
        residenceType: r.residence_type,
        isHead: r.is_household_head,
        religion: r.religion,
        edu: r.educational_attainment,
        isPwd: r.is_pwd,
        hasPwdId: r.has_pwd_id,
        isSenior: r.is_senior,
        hasSeniorId: r.has_senior_id,
        isSoloParent: r.is_solo_parent,
        hasSoloParentId: r.has_solo_parent_id,
        ageFirstBirth: r.age_at_first_birth,
        teenagePregnancy: r.teenage_pregnancy_case,
        teenageMother: r.current_teenage_mother,
        is4ps: r.is_4ps
      }));

      localStorage.setItem('tanawanData', JSON.stringify([...allRecords, ...newRecordsLocal]));

      alert('Resident successfully saved to Supabase!');
      navigate('/barangay');
    } catch (err) {
      console.error('Error saving to Supabase:', err);
      alert('Failed to save to Supabase: ' + err.message);
    } finally {
      setIsLoading(false);
    }
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
              {formWarning && (
                <div className="form-warning">⚠ {formWarning}</div>
              )}

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
                      <label>Purok / Sitio</label>
                      <input type="text" placeholder="Purok" value={household.purok} onChange={e => setHousehold({...household, purok: e.target.value})} />
                    </div>
                  </div>
                  <div className="grid-3-cols" style={{ marginTop: '20px' }}>
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
                    <div className="field-group">
                      <label>Province</label>
                      <input type="text" value="Bulacan" readOnly />
                    </div>
                  </div>
                  
                  <h2 className="form-section-title" style={{ marginTop: '30px' }}>Resident Information</h2>
                  <div className="grid-2-cols">
                    <div className="field-group">
                      <label>Type of Residence</label>
                      <select className="modern-select" value={household.residence_type} onChange={e => setHousehold({...household, residence_type: e.target.value})}>
                        <option>Owner</option>
                        <option>Renter</option>
                        <option>Boarder</option>
                        <option>Living with relatives</option>
                        <option>Apartment</option>
                        <option>Other</option>
                      </select>
                    </div>
                    {household.residence_type === 'Other' && (
                      <div className="field-group animate-fade-in">
                        <label>Specify Residence Type</label>
                        <input type="text" placeholder="Specify..." value={household.residence_type_other} onChange={e => setHousehold({...household, residence_type_other: e.target.value})} />
                      </div>
                    )}
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
                      <label>Name Extension</label>
                      <select className="modern-select" value={head.q} onChange={e => setHead({...head, q: e.target.value})}>
                        <option value="">None</option>
                        <option>JR.</option>
                        <option>SR.</option>
                        <option>III</option>
                        <option>IV</option>
                        <option>V</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid-4-cols" style={{ marginTop: '15px' }}>
                    <div className="field-group"><label>Place of Birth</label><input type="text" value={head.pob} onChange={e => setHead({...head, pob: e.target.value})} /></div>
                    <div className="field-group"><label>Date of Birth</label><input type="date" value={head.dob} onChange={e => handleHeadDobChange(e.target.value)} /></div>
                    <div className="field-group"><label>Age</label><input type="number" placeholder="Calculated" value={head.age} onChange={e => setHead({...head, age: e.target.value})} /></div>
                    <div className="field-group">
                      <label>Sex</label>
                      <select className="modern-select" value={head.sex} onChange={e => setHead({...head, sex: e.target.value})}>
                        <option>Male</option>
                        <option>Female</option>
                        <option>LGBTQ+</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid-4-cols" style={{ marginTop: '15px' }}>
                    <div className="field-group">
                      <label>Civil Status</label>
                      <select className="modern-select" value={head.civil} onChange={e => setHead({...head, civil: e.target.value})}>
                        <option>Single</option>
                        <option>Married</option>
                        <option>Widowed</option>
                        <option>Separated</option>
                      </select>
                    </div>
                    <div className="field-group"><label>Religion</label><input type="text" placeholder="e.g. Roman Catholic" value={head.religion} onChange={e => setHead({...head, religion: e.target.value})} /></div>
                    <div className="field-group"><label>Citizenship</label><input type="text" value={head.citizenship} onChange={e => setHead({...head, citizenship: e.target.value})} /></div>
                    <div className="field-group"><label>Educational Attainment</label><input type="text" placeholder="e.g. College Graduate" value={head.edu} onChange={e => setHead({...head, edu: e.target.value})} /></div>
                  </div>

                  <div className="grid-3-cols" style={{ marginTop: '15px' }}>
                    <div className="field-group"><label>Occupation</label><input type="text" placeholder="e.g. Teacher" value={head.occupation} onChange={e => setHead({...head, occupation: e.target.value})} /></div>
                    <div className="field-group">
                      <label>Voter Information</label>
                      <select className="modern-select" value={head.is_voter} onChange={e => setHead({...head, is_voter: e.target.value})}>
                        <option>Registered Voter</option>
                        <option>Not Registered Voter</option>
                      </select>
                    </div>
                    <div className="field-group">
                      <label>4Ps Beneficiary</label>
                      <select className="modern-select" value={head.is_4ps ? "Yes" : "No"} onChange={e => setHead({...head, is_4ps: e.target.value === "Yes"})}>
                        <option value="No">No</option>
                        <option value="Yes">Yes</option>
                      </select>
                    </div>
                  </div>

                  {/* Special Classification Grid */}
                  <div className="classification-box">
                    <p className="classification-title">Special Classification & ID Status</p>
                    <div className="classification-grid">
                      {/* PWD Card */}
                      <div className={`classification-card ${head.is_pwd ? 'active' : ''}`}>
                        <div className="class-header">
                          <label className="checkbox-container">
                            <input type="checkbox" checked={head.is_pwd} onChange={e => handleHeadClassification('is_pwd', e.target.checked)} />
                            <span className="class-label">Person with Disability (PWD)</span>
                          </label>
                        </div>
                        {head.is_pwd && (
                          <div className="id-options animate-fade-in">
                            <label className="radio-container">
                              <input type="radio" name="head_pwd_id" checked={head.has_pwd_id === true} onChange={() => setHead({...head, has_pwd_id: true})} />
                              <span>Has PWD ID</span>
                            </label>
                            <label className="radio-container">
                              <input type="radio" name="head_pwd_id" checked={head.has_pwd_id === false} onChange={() => setHead({...head, has_pwd_id: false})} />
                              <span>No ID</span>
                            </label>
                          </div>
                        )}
                      </div>
                      
                      {/* Senior Citizen Card */}
                      <div className={`classification-card ${head.is_senior ? 'active' : ''}`}>
                        <div className="class-header">
                          <label className="checkbox-container">
                            <input type="checkbox" checked={head.is_senior} onChange={e => handleHeadClassification('is_senior', e.target.checked)} />
                            <span className="class-label">Senior Citizen</span>
                          </label>
                        </div>
                        {head.is_senior && (
                          <div className="id-options animate-fade-in">
                            <label className="radio-container">
                              <input type="radio" name="head_senior_id" checked={head.has_senior_id === true} onChange={() => setHead({...head, has_senior_id: true})} />
                              <span>Has Senior Citizen ID</span>
                            </label>
                            <label className="radio-container">
                              <input type="radio" name="head_senior_id" checked={head.has_senior_id === false} onChange={() => setHead({...head, has_senior_id: false})} />
                              <span>No ID</span>
                            </label>
                          </div>
                        )}
                      </div>

                      {/* Solo Parent Card */}
                      <div className={`classification-card ${head.is_solo_parent ? 'active' : ''}`}>
                        <div className="class-header">
                          <label className="checkbox-container">
                            <input type="checkbox" checked={head.is_solo_parent} onChange={e => handleHeadClassification('is_solo_parent', e.target.checked)} />
                            <span className="class-label">Solo Parent</span>
                          </label>
                        </div>
                        {head.is_solo_parent && (
                          <div className="id-options animate-fade-in">
                            <label className="radio-container">
                              <input type="radio" name="head_solo_id" checked={head.has_solo_parent_id === true} onChange={() => setHead({...head, has_solo_parent_id: true})} />
                              <span>Has Solo Parent ID</span>
                            </label>
                            <label className="radio-container">
                              <input type="radio" name="head_solo_id" checked={head.has_solo_parent_id === false} onChange={() => setHead({...head, has_solo_parent_id: false})} />
                              <span>No ID</span>
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Teenage Pregnancy Section */}
                  {head.sex === 'Female' && (
                    <div className="teenage-pregnancy-box animate-fade-in">
                      <p className="teenage-pregnancy-title">Teenage Pregnancy (For Female Head Only)</p>
                      <div className="grid-3-cols">
                        <div className="field-group">
                          <label>Age at First Birth</label>
                          <input type="number" placeholder="e.g. 18" value={head.age_first_birth} onChange={e => handleHeadAgeFirstBirthChange(e.target.value)} />
                        </div>
                        <div className="check-item-fancy">
                          <div className="check-item-text">
                            <label>Teenage Pregnancy Case</label>
                            <span className="sub-desc">(Auto-checked if age at first birth is 19 or below)</span>
                          </div>
                          <input type="checkbox" checked={head.teenage_pregnancy} onChange={e => setHead({...head, teenage_pregnancy: e.target.checked})} />
                        </div>
                        <div className="check-item-fancy">
                          <div className="check-item-text">
                            <label>Current Teenage Mother</label>
                            <span className="sub-desc">(If currently age 10-19 and has child)</span>
                          </div>
                          <input type="checkbox" checked={head.teenage_mother} onChange={e => setHead({...head, teenage_mother: e.target.checked})} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {currentStep === 3 && (
                <div className="form-step animate-fade-up">
                  <h2 className="form-section-title">Household Members</h2>
                  
                  {members.length === 0 ? (
                    <div className="empty-members-state" style={{ textAlign: 'center', padding: '40px 20px', background: '#f8fafc', borderRadius: '8px', border: '2px dashed #cbd5e1', marginBottom: '20px' }}>
                      <p style={{ color: '#64748b', fontSize: '14px', fontWeight: '500' }}>No household members added yet. Click the button below to add family members.</p>
                    </div>
                  ) : (
                    <div className="members-cards-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '20px' }}>
                      {members.map((m, i) => {
                        const isExpanded = expandedMemberIndex === i;
                        const fullName = [m.fname, m.mname, m.lname].filter(Boolean).join(' ') || `Member ${i + 1}`;
                        
                        return (
                          <div key={i} className={`member-card ${isExpanded ? 'expanded' : ''}`} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', background: 'white', overflow: 'hidden', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
                            <div className="member-card-header" onClick={() => setExpandedMemberIndex(isExpanded ? -1 : i)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: isExpanded ? '#f1f5f9' : '#f8fafc', borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none', cursor: 'pointer', transition: 'background-color 0.2s' }}>
                              <div className="member-card-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span className="member-number" style={{ background: '#3b82f6', color: 'white', fontWeight: 'bold', fontSize: '11px', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center' }}>{i + 1}</span>
                                <span className="member-name" style={{ fontWeight: '700', fontSize: '14px', color: '#1e293b' }}>{fullName} {m.rel ? `(${m.rel})` : ''}</span>
                              </div>
                              <div className="member-card-actions" onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <button type="button" className="btn-toggle-expand" onClick={() => setExpandedMemberIndex(isExpanded ? -1 : i)} style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '12px', fontWeight: '600', cursor: 'pointer', padding: '5px' }}>
                                  {isExpanded ? 'Collapse ▲' : 'Expand / Edit ▼'}
                                </button>
                                <button type="button" className="btn-remove-member" onClick={() => removeMember(i)} style={{ color: '#ef4444', background: 'none', border: 'none', fontSize: '12px', fontWeight: '600', textDecoration: 'underline', cursor: 'pointer', padding: '5px' }}>
                                  Remove
                                </button>
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="member-card-body animate-slide-down" style={{ padding: '24px 20px', background: 'white' }}>
                                <div className="grid-4-cols">
                                  <div className="field-group"><label>Last Name</label><input type="text" value={m.lname} onChange={e => updateMember(i, 'lname', e.target.value)} /></div>
                                  <div className="field-group"><label>First Name</label><input type="text" value={m.fname} onChange={e => updateMember(i, 'fname', e.target.value)} /></div>
                                  <div className="field-group"><label>Middle Name</label><input type="text" value={m.mname} onChange={e => updateMember(i, 'mname', e.target.value)} /></div>
                                  <div className="field-group">
                                    <label>Name Extension</label>
                                    <select className="modern-select" value={m.q} onChange={e => updateMember(i, 'q', e.target.value)}>
                                      <option value="">None</option>
                                      <option>JR.</option>
                                      <option>SR.</option>
                                      <option>III</option>
                                      <option>IV</option>
                                      <option>V</option>
                                    </select>
                                  </div>
                                </div>

                                <div className="grid-4-cols" style={{ marginTop: '15px' }}>
                                  <div className="field-group"><label>Relationship to Head</label><input type="text" placeholder="e.g. Spouse / Son / Daughter" value={m.rel} onChange={e => updateMember(i, 'rel', e.target.value)} /></div>
                                  <div className="field-group"><label>Place of Birth</label><input type="text" value={m.pob} onChange={e => updateMember(i, 'pob', e.target.value)} /></div>
                                  <div className="field-group"><label>Date of Birth</label><input type="date" value={m.dob} onChange={e => handleMemberDobChange(i, e.target.value)} /></div>
                                  <div className="field-group"><label>Age</label><input type="number" placeholder="Calculated" value={m.age} onChange={e => updateMember(i, 'age', e.target.value)} /></div>
                                </div>

                                <div className="grid-4-cols" style={{ marginTop: '15px' }}>
                                  <div className="field-group">
                                    <label>Sex</label>
                                    <select className="modern-select" value={m.sex} onChange={e => updateMember(i, 'sex', e.target.value)}>
                                      <option>Male</option>
                                      <option>Female</option>
                                      <option>LGBTQ+</option>
                                    </select>
                                  </div>
                                  <div className="field-group">
                                    <label>Civil Status</label>
                                    <select className="modern-select" value={m.civil} onChange={e => updateMember(i, 'civil', e.target.value)}>
                                      <option>Single</option>
                                      <option>Married</option>
                                      <option>Widowed</option>
                                      <option>Separated</option>
                                    </select>
                                  </div>
                                  <div className="field-group"><label>Religion</label><input type="text" placeholder="e.g. Roman Catholic" value={m.religion} onChange={e => updateMember(i, 'religion', e.target.value)} /></div>
                                  <div className="field-group"><label>Citizenship</label><input type="text" value={m.citizenship} onChange={e => updateMember(i, 'citizenship', e.target.value)} /></div>
                                </div>

                                <div className="grid-4-cols" style={{ marginTop: '15px' }}>
                                  <div className="field-group"><label>Educational Attainment</label><input type="text" placeholder="e.g. High School Graduate" value={m.edu} onChange={e => updateMember(i, 'edu', e.target.value)} /></div>
                                  <div className="field-group"><label>Occupation</label><input type="text" placeholder="e.g. Student" value={m.occupation} onChange={e => updateMember(i, 'occupation', e.target.value)} /></div>
                                  <div className="field-group">
                                    <label>Voter Information</label>
                                    <select className="modern-select" value={m.is_voter} onChange={e => updateMember(i, 'is_voter', e.target.value)}>
                                      <option>Registered Voter</option>
                                      <option>Not Registered Voter</option>
                                    </select>
                                  </div>
                                  <div className="field-group">
                                    <label>4Ps Beneficiary</label>
                                    <select className="modern-select" value={m.is_4ps ? "Yes" : "No"} onChange={e => updateMember(i, 'is_4ps', e.target.value === "Yes")}>
                                      <option value="No">No</option>
                                      <option value="Yes">Yes</option>
                                    </select>
                                  </div>
                                </div>

                                {/* Special Classification */}
                                <div className="classification-box">
                                  <p className="classification-title">Special Classification & ID Status</p>
                                  <div className="classification-grid">
                                    {/* PWD Card */}
                                    <div className={`classification-card ${m.is_pwd ? 'active' : ''}`}>
                                      <div className="class-header">
                                        <label className="checkbox-container">
                                          <input type="checkbox" checked={m.is_pwd} onChange={e => updateMemberClassification(i, 'is_pwd', e.target.checked)} />
                                          <span className="class-label">Person with Disability (PWD)</span>
                                        </label>
                                      </div>
                                      {m.is_pwd && (
                                        <div className="id-options animate-fade-in">
                                          <label className="radio-container">
                                            <input type="radio" name={`member_${i}_pwd_id`} checked={m.has_pwd_id === true} onChange={() => updateMember(i, 'has_pwd_id', true)} />
                                            <span>Has PWD ID</span>
                                          </label>
                                          <label className="radio-container">
                                            <input type="radio" name={`member_${i}_pwd_id`} checked={m.has_pwd_id === false} onChange={() => updateMember(i, 'has_pwd_id', false)} />
                                            <span>No ID</span>
                                          </label>
                                        </div>
                                      )}
                                    </div>
                                    
                                    {/* Senior Citizen Card */}
                                    <div className={`classification-card ${m.is_senior ? 'active' : ''}`}>
                                      <div className="class-header">
                                        <label className="checkbox-container">
                                          <input type="checkbox" checked={m.is_senior} onChange={e => updateMemberClassification(i, 'is_senior', e.target.checked)} />
                                          <span className="class-label">Senior Citizen</span>
                                        </label>
                                      </div>
                                      {m.is_senior && (
                                        <div className="id-options animate-fade-in">
                                          <label className="radio-container">
                                            <input type="radio" name={`member_${i}_senior_id`} checked={m.has_senior_id === true} onChange={() => updateMember(i, 'has_senior_id', true)} />
                                            <span>Has Senior ID</span>
                                          </label>
                                          <label className="radio-container">
                                            <input type="radio" name={`member_${i}_senior_id`} checked={m.has_senior_id === false} onChange={() => updateMember(i, 'has_senior_id', false)} />
                                            <span>No ID</span>
                                          </label>
                                        </div>
                                      )}
                                    </div>

                                    {/* Solo Parent Card */}
                                    <div className={`classification-card ${m.is_solo_parent ? 'active' : ''}`}>
                                      <div className="class-header">
                                        <label className="checkbox-container">
                                          <input type="checkbox" checked={m.is_solo_parent} onChange={e => updateMemberClassification(i, 'is_solo_parent', e.target.checked)} />
                                          <span className="class-label">Solo Parent</span>
                                        </label>
                                      </div>
                                      {m.is_solo_parent && (
                                        <div className="id-options animate-fade-in">
                                          <label className="radio-container">
                                            <input type="radio" name={`member_${i}_solo_id`} checked={m.has_solo_parent_id === true} onChange={() => updateMember(i, 'has_solo_parent_id', true)} />
                                            <span>Has Solo Parent ID</span>
                                          </label>
                                          <label className="radio-container">
                                            <input type="radio" name={`member_${i}_solo_id`} checked={m.has_solo_parent_id === false} onChange={() => updateMember(i, 'has_solo_parent_id', false)} />
                                            <span>No ID</span>
                                          </label>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Teenage Pregnancy Section */}
                                {m.sex === 'Female' && (
                                  <div className="teenage-pregnancy-box animate-fade-in" style={{ marginTop: '15px' }}>
                                    <p className="teenage-pregnancy-title">Teenage Pregnancy (For Female Member Only)</p>
                                    <div className="grid-3-cols">
                                      <div className="field-group">
                                        <label>Age at First Birth</label>
                                        <input type="number" placeholder="e.g. 18" value={m.age_first_birth} onChange={e => handleMemberAgeFirstBirthChange(i, e.target.value)} />
                                      </div>
                                      <div className="check-item-fancy">
                                        <div className="check-item-text">
                                          <label>Teenage Pregnancy Case</label>
                                          <span className="sub-desc">(Auto-checked if age at first birth is 19 or below)</span>
                                        </div>
                                        <input type="checkbox" checked={m.teenage_pregnancy} onChange={e => updateMember(i, 'teenage_pregnancy', e.target.checked)} />
                                      </div>
                                      <div className="check-item-fancy">
                                        <div className="check-item-text">
                                          <label>Current Teenage Mother</label>
                                          <span className="sub-desc">(If currently age 10-19 and has child)</span>
                                        </div>
                                        <input type="checkbox" checked={m.teenage_mother} onChange={e => updateMember(i, 'teenage_mother', e.target.checked)} />
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div style={{ textAlign: 'center', marginTop: '20px' }}>
                    <button type="button" className="btn-add-member" onClick={addMember}>+ Add Household Member</button>
                  </div>
                </div>
              )}

              {currentStep === 4 && (
                <div className="summary-area animate-fade-up">
                  <div className="summary-section">
                    <h3>Household Location & Residence</h3>
                    <div className="summary-grid">
                      <span><b>HH #:</b> {household.hh_num}</span>
                      <span><b>Brgy:</b> {household.brgy}</span>
                      <span><b>Address:</b> {household.house_no} {household.street}, {household.purok}</span>
                      <span><b>Residence Type:</b> {household.residence_type === 'Other' ? household.residence_type_other : household.residence_type}</span>
                    </div>
                  </div>
                  <div className="summary-section">
                    <h3>Head of Household</h3>
                    <div className="summary-grid">
                      <span><b>Name:</b> {head.lname}, {head.fname} {head.mname} {head.q}</span>
                      <span><b>Gender:</b> {head.sex}</span>
                      <span><b>Civil Status:</b> {head.civil}</span>
                      <span><b>DOB / Age:</b> {head.dob} ({head.age || 'N/A'} yrs)</span>
                      <span><b>Religion:</b> {head.religion || 'N/A'}</span>
                      <span><b>Citizenship:</b> {head.citizenship}</span>
                      <span><b>Education:</b> {head.edu || 'N/A'}</span>
                      <span><b>Occupation:</b> {head.occupation || 'N/A'}</span>
                      <span><b>Voter Info:</b> {head.is_voter}</span>
                      <span><b>4Ps Beneficiary:</b> {head.is_4ps ? 'Yes' : 'No'}</span>
                      <span>
                        <b>Classification:</b> {[
                          head.is_senior && `Senior Citizen (${head.has_senior_id ? 'Has ID' : 'No ID'})`,
                          head.is_pwd && `PWD (${head.has_pwd_id ? 'Has ID' : 'No ID'})`,
                          head.is_solo_parent && `Solo Parent (${head.has_solo_parent_id ? 'Has ID' : 'No ID'})`
                        ].filter(Boolean).join(', ') || 'Regular'}
                      </span>
                      {head.sex === 'Female' && (
                        <span>
                          <b>Teenage Pregnancy Details:</b> {
                            head.age_first_birth 
                              ? `First birth at ${head.age_first_birth} yrs ${head.teenage_pregnancy ? '(Teen Case)' : ''}${head.teenage_mother ? ', (Current Teenage Mother)' : ''}`
                              : 'None'
                          }
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="summary-section">
                    <h3>Members ({members.length})</h3>
                    {members.length === 0 ? (
                      <p style={{ fontSize: '13px', color: 'var(--gray-500)', fontStyle: 'italic' }}>No additional household members registered.</p>
                    ) : (
                      <table className="summary-table">
                        <thead>
                          <tr>
                            <th>No.</th>
                            <th>Name</th>
                            <th>Relation</th>
                            <th>Basic Details</th>
                            <th>Classification</th>
                          </tr>
                        </thead>
                        <tbody>
                          {members.map((m, i) => {
                            const mName = [m.fname, m.mname, m.lname, m.q].filter(Boolean).join(' ');
                            const basicDetails = `${m.sex}, ${m.civil}, DOB: ${m.dob || 'N/A'} (${m.age || 'N/A'} yrs), Job: ${m.occupation || 'N/A'}`;
                            const classList = [
                              m.is_senior && `Senior Citizen (${m.has_senior_id ? 'S' : 'No ID'})`,
                              m.is_pwd && `PWD (${m.has_pwd_id ? 'P' : 'No ID'})`,
                              m.is_solo_parent && `Solo Parent (${m.has_solo_parent_id ? 'SP' : 'No ID'})`
                            ].filter(Boolean).join(', ') || 'Regular';
                            
                            return (
                              <tr key={i}>
                                <td>{i + 1}</td>
                                <td><b>{mName}</b></td>
                                <td>{m.rel}</td>
                                <td>{basicDetails}</td>
                                <td>{classList}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}

              <div className="form-nav-buttons">
                <button type="button" className={`btn-back ${currentStep === 1 ? 'hidden' : ''}`} onClick={() => handleStep(-1)}>
                  Previous
                </button>
                <button 
                  type="button" 
                  className={`btn-next ${isLoading ? 'loading' : ''}`} 
                  onClick={() => handleStep(1)}
                  disabled={isLoading}
                >
                  {isLoading ? 'Saving...' : (currentStep === 4 ? 'Confirm & Submit' : 'Next')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
