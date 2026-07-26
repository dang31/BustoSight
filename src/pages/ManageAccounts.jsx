import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@supabase/supabase-js';
import Sidebar from '../components/Sidebar';
import { supabase } from '../lib/supabase';
import '../css/ManageAccounts.css';
import '../css/AddResident.css';

export default function ManageAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Tabs: 'active' | 'archived'
  const [activeTab, setActiveTab] = useState('active');

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Sorting & Pagination
  const [sortField, setSortField] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Selection for Bulk Actions
  const [selectedIds, setSelectedIds] = useState([]);

  // Action Dropdown Menu state
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const menuRef = useRef(null);

  // Modals state
  const [modalState, setModalState] = useState({
    type: null, // 'create' | 'edit' | 'view' | 'changePassword' | 'confirm'
    data: null,
  });

  // Toast state
  const [toast, setToast] = useState(null);

  // Form inputs
  const [formData, setFormData] = useState({
    employee_id: '',
    first_name: '',
    last_name: '',
    email: '',
    username: '',
    password: '',
    confirm_password: '',
    role: 'Staff',
    status: 'Active',
  });

  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  const [formErrors, setFormErrors] = useState({});

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  // Close action dropdown menu when clicking outside or scrolling
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (e.target.closest('.btn-action-icon')) return;
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    };
    const handleScroll = () => setOpenMenuId(null);
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
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
      console.warn('Supabase fetch failed or table incomplete. Using local/fallback handling:', err.message);
      const localData = JSON.parse(localStorage.getItem('popdevUsers')) || [
        {
          id: 'admin-001',
          employee_id: 'EMP-001',
          first_name: 'System',
          last_name: 'Admin',
          username: 'admin_bustos',
          email: 'admin@bustos.gov.ph',
          role: 'Admin',
          status: 'Active',
          archived: false,
          created_at: new Date().toISOString(),
        },
      ];
      setAccounts(localData);
    } finally {
      setIsLoading(false);
    }
  };

  const updateAccountsState = (newAccounts) => {
    setAccounts(newAccounts);
    localStorage.setItem('popdevUsers', JSON.stringify(newAccounts));
  };

  // --- Statistics Calculation ---
  const stats = useMemo(() => {
    const nonArchived = accounts.filter((a) => !a.archived);
    const archived = accounts.filter((a) => a.archived);

    return {
      totalUsers: nonArchived.length,
      activeUsers: nonArchived.filter((a) => (a.status || 'Active') === 'Active').length,
      inactiveUsers: nonArchived.filter((a) => a.status === 'Inactive').length,
      archivedUsers: archived.length,
      admins: nonArchived.filter((a) => a.role === 'Admin' || a.role === 'Administrator').length,
      staff: nonArchived.filter((a) => a.role === 'Staff' || a.role === 'Encoder').length,
    };
  }, [accounts]);

  // --- Filter, Sort, Paginate ---
  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      const isArchived = Boolean(acc.archived);

      if (activeTab === 'active' && isArchived) return false;
      if (activeTab === 'archived' && !isArchived) return false;

      // Role Filter
      if (roleFilter !== 'ALL') {
        const accRole = acc.role === 'Administrator' ? 'Admin' : acc.role;
        if (accRole !== roleFilter) return false;
      }

      // Status Filter
      if (statusFilter !== 'ALL') {
        if ((acc.status || 'Active') !== statusFilter) return false;
      }

      // Search Term
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        const fullName = `${acc.first_name || ''} ${acc.last_name || ''}`.toLowerCase();
        const empId = (acc.employee_id || '').toLowerCase();
        const username = (acc.username || '').toLowerCase();
        const email = (acc.email || '').toLowerCase();

        return (
          fullName.includes(term) ||
          empId.includes(term) ||
          username.includes(term) ||
          email.includes(term)
        );
      }

      return true;
    });
  }, [accounts, activeTab, roleFilter, statusFilter, searchTerm]);

  const sortedAccounts = useMemo(() => {
    return [...filteredAccounts].sort((a, b) => {
      let aVal = a[sortField] || '';
      let bVal = b[sortField] || '';

      if (sortField === 'name') {
        aVal = `${a.first_name || ''} ${a.last_name || ''}`.toLowerCase();
        bVal = `${b.first_name || ''} ${b.last_name || ''}`.toLowerCase();
      } else if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredAccounts, sortField, sortDirection]);

  // Reset page on tab/filter change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds([]);
    setOpenMenuId(null);
  }, [activeTab, searchTerm, roleFilter, statusFilter]);

  const totalPages = Math.ceil(sortedAccounts.length / itemsPerPage) || 1;
  const paginatedAccounts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedAccounts.slice(start, start + itemsPerPage);
  }, [sortedAccounts, currentPage, itemsPerPage]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Checkbox Selection
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const pageIds = paginatedAccounts.map((a) => a.id).filter(Boolean);
      setSelectedIds(pageIds);
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // --- CRUD & Actions ---
  const validateForm = (isEdit = false) => {
    const errors = {};
    if (!formData.first_name.trim()) errors.first_name = 'First name is required';
    if (!formData.last_name.trim()) errors.last_name = 'Last name is required';
    if (!formData.username.trim()) errors.username = 'Username is required';

    if (!isEdit) {
      if (!formData.password) errors.password = 'Password is required';
      else if (formData.password.length < 6) errors.password = 'Minimum 6 characters';
      if (formData.password !== formData.confirm_password) {
        errors.confirm_password = 'Passwords do not match';
      }
    }

    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Invalid email address';
    }

    const otherAccounts = isEdit
      ? accounts.filter((a) => a.id !== modalState.data?.id)
      : accounts;

    if (
      formData.username &&
      otherAccounts.some(
        (a) => (a.username || '').toLowerCase() === formData.username.toLowerCase()
      )
    ) {
      errors.username = 'Username already exists';
    }

    if (
      formData.employee_id &&
      otherAccounts.some(
        (a) => (a.employee_id || '').toLowerCase() === formData.employee_id.toLowerCase()
      )
    ) {
      errors.employee_id = 'Employee ID already in use';
    }

    if (
      formData.email &&
      otherAccounts.some(
        (a) => (a.email || '').toLowerCase() === formData.email.toLowerCase()
      )
    ) {
      errors.email = 'Email address already in use';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    if (!validateForm(false)) return;

    setIsLoading(true);

    try {
      // Create a secondary client for auth creation to avoid logging out the current admin session
      const authClient = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
        }
      );

      // Supabase auth requires email
      const signupEmail = formData.email?.trim() || `${formData.username.trim()}@bustos.gov.ph`;

      const { data, error } = await authClient.auth.signUp({
        email: signupEmail,
        password: formData.password,
        options: {
          data: {
            employee_id: formData.employee_id.trim() || null,
            first_name: formData.first_name.trim(),
            last_name: formData.last_name.trim(),
            username: formData.username.trim(),
            role: formData.role,
          }
        }
      });

      if (error) throw error;
      
      // Wait a moment for the database trigger to insert the profile
      await new Promise(resolve => setTimeout(resolve, 1000));
      fetchAccounts();
      showToast('Account registered securely!', 'success');
    } catch (err) {
      console.warn('Account creation failed:', err.message);
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
      closeModal();
    }
  };

  const handleEditAccount = async (e) => {
    e.preventDefault();
    if (!validateForm(true)) return;

    setIsLoading(true);
    const updatedFields = {
      employee_id: formData.employee_id.trim() || null,
      first_name: formData.first_name.trim(),
      last_name: formData.last_name.trim(),
      email: formData.email.trim() || null,
      username: formData.username.trim(),
      role: formData.role,
      status: formData.status,
      updated_at: new Date().toISOString(),
    };

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updatedFields)
        .eq('id', modalState.data.id);

      if (error) throw error;
      fetchAccounts();
      showToast('Account details updated successfully!', 'success');
    } catch (err) {
      console.warn('Supabase update fallback:', err.message);
      const updated = accounts.map((a) =>
        a.id === modalState.data.id ? { ...a, ...updatedFields } : a
      );
      updateAccountsState(updated);
      showToast('Account details updated successfully.', 'success');
    } finally {
      setIsLoading(false);
      closeModal();
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    setIsLoading(true);
    try {
      // In a secure RLS setup, admins cannot arbitrarily update passwords without the service_role key.
      // We use Supabase Auth reset password feature instead.
      const targetEmail = modalState.data.email || `${modalState.data.username}@bustos.gov.ph`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(targetEmail);
      if (error) throw error;

      showToast('Password reset email sent securely!', 'success');
    } catch (err) {
      console.warn('Password reset error:', err.message);
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
      closeModal();
    }
  };

  const handleToggleStatus = async (account) => {
    const newStatus = account.status === 'Active' ? 'Inactive' : 'Active';
    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', account.id);

      if (error) throw error;
      fetchAccounts();
      showToast(`Account status updated to ${newStatus}.`, 'info');
    } catch (err) {
      const updated = accounts.map((a) => (a.id === account.id ? { ...a, status: newStatus } : a));
      updateAccountsState(updated);
      showToast(`Account status updated to ${newStatus}.`, 'info');
    } finally {
      setIsLoading(false);
      setOpenMenuId(null);
    }
  };

  const handleArchiveAccount = async (account) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ archived: true, updated_at: new Date().toISOString() })
        .eq('id', account.id);

      if (error) throw error;
      fetchAccounts();
      showToast('Account moved to Archive.', 'info');
    } catch (err) {
      const updated = accounts.map((a) => (a.id === account.id ? { ...a, archived: true } : a));
      updateAccountsState(updated);
      showToast('Account moved to Archive.', 'info');
    } finally {
      setIsLoading(false);
      closeModal();
      setOpenMenuId(null);
    }
  };

  const handleRestoreAccount = async (account) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ archived: false, updated_at: new Date().toISOString() })
        .eq('id', account.id);

      if (error) throw error;
      fetchAccounts();
      showToast('Account restored to Active list.', 'success');
    } catch (err) {
      const updated = accounts.map((a) => (a.id === account.id ? { ...a, archived: false } : a));
      updateAccountsState(updated);
      showToast('Account restored to Active list.', 'success');
    } finally {
      setIsLoading(false);
      closeModal();
      setOpenMenuId(null);
    }
  };

  const handlePermanentDelete = async (account) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', account.id);
      if (error) throw error;
      fetchAccounts();
      showToast('Account permanently deleted.', 'error');
    } catch (err) {
      const updated = accounts.filter((a) => a.id !== account.id);
      updateAccountsState(updated);
      showToast('Account permanently deleted.', 'error');
    } finally {
      setIsLoading(false);
      closeModal();
      setOpenMenuId(null);
    }
  };

  // Bulk Actions
  const handleExecuteBulkAction = async (action) => {
    if (selectedIds.length === 0) return;
    setIsLoading(true);

    try {
      if (action === 'activate') {
        await supabase.from('profiles').update({ status: 'Active' }).in('id', selectedIds);
        showToast(`${selectedIds.length} account(s) activated.`, 'success');
      } else if (action === 'deactivate') {
        await supabase.from('profiles').update({ status: 'Inactive' }).in('id', selectedIds);
        showToast(`${selectedIds.length} account(s) deactivated.`, 'info');
      } else if (action === 'archive') {
        await supabase.from('profiles').update({ archived: true }).in('id', selectedIds);
        showToast(`${selectedIds.length} account(s) archived.`, 'info');
      } else if (action === 'delete') {
        await supabase.from('profiles').delete().in('id', selectedIds);
        showToast(`${selectedIds.length} account(s) permanently deleted.`, 'error');
      }
      fetchAccounts();
    } catch (err) {
      let updated = [...accounts];
      if (action === 'activate') {
        updated = updated.map((a) => (selectedIds.includes(a.id) ? { ...a, status: 'Active' } : a));
      } else if (action === 'deactivate') {
        updated = updated.map((a) => (selectedIds.includes(a.id) ? { ...a, status: 'Inactive' } : a));
      } else if (action === 'archive') {
        updated = updated.map((a) => (selectedIds.includes(a.id) ? { ...a, archived: true } : a));
      } else if (action === 'delete') {
        updated = updated.filter((a) => !selectedIds.includes(a.id));
      }
      updateAccountsState(updated);
      showToast(`Bulk action applied for ${selectedIds.length} account(s).`, 'info');
    } finally {
      setIsLoading(false);
      setSelectedIds([]);
      closeModal();
      setOpenMenuId(null);
    }
  };

  // Modal Openers
  const openCreateModal = () => {
    setFormData({
      employee_id: '',
      first_name: '',
      last_name: '',
      email: '',
      username: '',
      password: '',
      confirm_password: '',
      role: 'Staff',
      status: 'Active',
    });
    setFormErrors({});
    setModalState({ type: 'create', data: null });
  };

  const openEditModal = (account) => {
    setFormData({
      employee_id: account.employee_id || '',
      first_name: account.first_name || '',
      last_name: account.last_name || '',
      email: account.email || '',
      username: account.username || '',
      role: account.role === 'Administrator' ? 'Admin' : account.role || 'Staff',
      status: account.status || 'Active',
    });
    setFormErrors({});
    setModalState({ type: 'edit', data: account });
    setOpenMenuId(null);
  };

  const openChangePasswordModal = (account) => {
    setPasswordData({ newPassword: '', confirmPassword: '' });
    setFormErrors({});
    setModalState({ type: 'changePassword', data: account });
    setOpenMenuId(null);
  };

  const openViewModal = (account) => {
    setModalState({ type: 'view', data: account });
    setOpenMenuId(null);
  };

  const openConfirmModal = (actionType, targetData, message) => {
    setModalState({
      type: 'confirm',
      data: { actionType, targetData, message },
    });
    setOpenMenuId(null);
  };

  const closeModal = () => {
    setModalState({ type: null, data: null });
    setFormErrors({});
  };

  const getInitials = (firstName, lastName) => {
    const f = firstName ? firstName[0] : '';
    const l = lastName ? lastName[0] : '';
    return (f + l).toUpperCase() || 'U';
  };

  return (
    <div className="dashboard-wrapper">
      <div className="bg-image" />
      <div className="overlay" />
      <Sidebar />

      <main className="content">
        {/* Toast Notification */}
        {toast && (
          <div className={`acc-toast acc-toast-${toast.type} animate-fade-up`}>
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)}>×</button>
          </div>
        )}

        {/* Header */}
        <header className="main-header">
          <h1>Account Lifecycle & Access Control Management</h1>
        </header>

        {/* Stat Cards */}
        <div className="acc-stats-grid animate-fade-up">
          <div className="acc-stat-card">
            <div className="acc-stat-info">
              <span>Total Active Users</span>
              <h2>{isLoading ? '...' : stats.totalUsers}</h2>
            </div>
          </div>

          <div className="acc-stat-card">
            <div className="acc-stat-info">
              <span>Active Accounts</span>
              <h2>{isLoading ? '...' : stats.activeUsers}</h2>
            </div>
          </div>

          <div className="acc-stat-card">
            <div className="acc-stat-info">
              <span>Inactive Accounts</span>
              <h2>{isLoading ? '...' : stats.inactiveUsers}</h2>
            </div>
          </div>

          {/* <div className="acc-stat-card">
            <div className="acc-stat-info">
              <span>Archived Users</span>
              <h2>{isLoading ? '...' : stats.archivedUsers}</h2>
            </div>
          </div> */}

          <div className="acc-stat-card">
            <div className="acc-stat-info">
              <span>Administrators</span>
              <h2>{isLoading ? '...' : stats.admins}</h2>
            </div>
          </div>

          <div className="acc-stat-card">
            <div className="acc-stat-info">
              <span>Staff Personnel</span>
              <h2>{isLoading ? '...' : stats.staff}</h2>
            </div>
          </div>
        </div>

        {/* Main Card Container */}
        <div className="form-card-container animate-fade-up" style={{ marginTop: '20px' }}>
          {/* Header & Tabs */}
          <div className="acc-card-top">
            <div className="acc-tabs">
              <button
                className={`acc-tab-btn ${activeTab === 'active' ? 'active' : ''}`}
                onClick={() => setActiveTab('active')}
              >
                Active Accounts ({stats.totalUsers})
              </button>
              {/* <button
                className={`acc-tab-btn ${activeTab === 'archived' ? 'active' : ''}`}
                onClick={() => setActiveTab('archived')}
              >
                Archived Accounts ({stats.archivedUsers})
              </button> */}
            </div>

            <button className="btn-add-account" onClick={openCreateModal}>
              Create New Account
            </button>
          </div>

          <div className="form-white-body">
            <div className="account-table-container">
              {/* Filter & Search Bar */}
              <div className="acc-filter-bar">
                <div className="acc-search-wrapper">
                  <span className="search-icon-svg">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                  </span>
                  <input
                    type="text"
                    placeholder="Search by ID, name, username, email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="acc-search-input"
                  />
                  {searchTerm && (
                    <button className="clear-search" onClick={() => setSearchTerm('')}>
                      ×
                    </button>
                  )}
                </div>

                <div className="acc-filter-controls">
                  <div className="acc-filter-group">
                    <label>Role:</label>
                    <select
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value)}
                      className="modern-select filter-select"
                    >
                      <option value="ALL">All Roles</option>
                      <option value="Admin">Admin</option>
                      <option value="Staff">Staff</option>
                    </select>
                  </div>

                  <div className="acc-filter-group">
                    <label>Status:</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="modern-select filter-select"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Bulk Action Controls */}
              {selectedIds.length > 0 && (
                <div className="bulk-action-bar animate-fade-up">
                  <span>
                    <strong>{selectedIds.length}</strong> accounts selected
                  </span>
                  <div className="bulk-btns">
                    {activeTab === 'active' && (
                      <>
                        <button
                          className="btn-bulk btn-bulk-activate"
                          onClick={() =>
                            openConfirmModal(
                              'bulk-activate',
                              null,
                              `Are you sure you want to activate ${selectedIds.length} selected account(s)?`
                            )
                          }
                        >
                          Activate Selected
                        </button>
                        <button
                          className="btn-bulk btn-bulk-deactivate"
                          onClick={() =>
                            openConfirmModal(
                              'bulk-deactivate',
                              null,
                              `Are you sure you want to deactivate ${selectedIds.length} selected account(s)?`
                            )
                          }
                        >
                          Deactivate Selected
                        </button>
                        <button
                          className="btn-bulk btn-bulk-archive"
                          onClick={() =>
                            openConfirmModal(
                              'bulk-archive',
                              null,
                              `Are you sure you want to archive ${selectedIds.length} selected account(s)?`
                            )
                          }
                        >
                          Archive Selected
                        </button>
                      </>
                    )}
                    <button
                      className="btn-bulk btn-bulk-delete"
                      onClick={() =>
                        openConfirmModal(
                          'bulk-delete',
                          null,
                          `PERMANENT ACTION: Are you sure you want to permanently delete ${selectedIds.length} selected account(s)?`
                        )
                      }
                    >
                      Delete Selected
                    </button>
                  </div>
                </div>
              )}

              {/* Responsive Scrollable Table Wrapper */}
              <div className="table-responsive-wrapper">
                <table className="modern-table acc-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={
                            paginatedAccounts.length > 0 &&
                            paginatedAccounts.every((a) => selectedIds.includes(a.id))
                          }
                          onChange={handleSelectAll}
                        />
                      </th>
                      <th onClick={() => handleSort('employee_id')} className="sortable-th">
                        Employee ID {sortField === 'employee_id' && (sortDirection === 'asc' ? '▲' : '▼')}
                      </th>
                      <th onClick={() => handleSort('name')} className="sortable-th">
                        User Name {sortField === 'name' && (sortDirection === 'asc' ? '▲' : '▼')}
                      </th>
                      <th onClick={() => handleSort('username')} className="sortable-th">
                        Username {sortField === 'username' && (sortDirection === 'asc' ? '▲' : '▼')}
                      </th>
                      <th onClick={() => handleSort('email')} className="sortable-th">
                        Email Address {sortField === 'email' && (sortDirection === 'asc' ? '▲' : '▼')}
                      </th>
                      <th onClick={() => handleSort('role')} className="sortable-th">
                        Role {sortField === 'role' && (sortDirection === 'asc' ? '▲' : '▼')}
                      </th>
                      <th onClick={() => handleSort('status')} className="sortable-th">
                        Status {sortField === 'status' && (sortDirection === 'asc' ? '▲' : '▼')}
                      </th>
                      <th style={{ textAlign: 'center', width: '80px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan="8" style={{ textAlign: 'center', padding: '40px' }}>
                          <div className="loading-spinner">Loading account records...</div>
                        </td>
                      </tr>
                    ) : paginatedAccounts.length > 0 ? (
                      paginatedAccounts.map((acc) => {
                        const isProtected = acc.username === 'admin_bustos';
                        const roleDisplay = acc.role === 'Administrator' ? 'Admin' : acc.role || 'Staff';
                        const statusDisplay = acc.status || 'Active';
                        const isMenuOpen = openMenuId === acc.id;

                        return (
                          <tr key={acc.id} className={selectedIds.includes(acc.id) ? 'row-selected' : ''}>
                            <td style={{ textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(acc.id)}
                                onChange={() => handleSelectOne(acc.id)}
                              />
                            </td>
                            {/* Standardized font for Employee ID */}
                            <td className="cell-empid-standard">{acc.employee_id || '—'}</td>
                            <td>
                              <div className="user-profile-cell">
                                <div className={`avatar-circle role-bg-${roleDisplay.toLowerCase()}`}>
                                  {getInitials(acc.first_name, acc.last_name)}
                                </div>
                                <div>
                                  <div className="user-name-text">
                                    {acc.first_name} {acc.last_name}
                                  </div>
                                  <div className="user-created-sub">
                                    Added {acc.created_at ? new Date(acc.created_at).toLocaleDateString() : 'N/A'}
                                  </div>
                                </div>
                              </div>
                            </td>
                            {/* Standardized font for Username */}
                            <td className="cell-username-standard">@{acc.username}</td>
                            <td>{acc.email || '—'}</td>
                            <td>
                              <span className={`role-badge role-${roleDisplay.toLowerCase()}`}>
                                {roleDisplay}
                              </span>
                            </td>
                            <td>
                              <span className={`status-badge status-${statusDisplay.toLowerCase()}`}>
                                {statusDisplay}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center', position: 'relative' }}>
                              {/* Clean Dropdown Menu Action Button */}
                              <div className="action-menu-container">
                                <button
                                  className={`btn-action-icon ${isMenuOpen ? 'active' : ''}`}
                                  title="Account Actions"
                                  onClick={(e) => {
                                    if (isMenuOpen) {
                                      setOpenMenuId(null);
                                    } else {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                                      setOpenMenuId(acc.id);
                                    }
                                  }}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                    <circle cx="12" cy="5" r="2" />
                                    <circle cx="12" cy="12" r="2" />
                                    <circle cx="12" cy="19" r="2" />
                                  </svg>
                                </button>

                                {isMenuOpen && createPortal(
                                  <div 
                                    className="action-dropdown-menu animate-fade-up"
                                    ref={menuRef}
                                    style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 99999 }}
                                  >
                                    <button
                                      className="dropdown-item"
                                      onClick={() => openViewModal(acc)}
                                    >
                                      View Details
                                    </button>

                                    {activeTab === 'active' ? (
                                      <>
                                        <button
                                          className="dropdown-item"
                                          onClick={() => openEditModal(acc)}
                                        >
                                          Edit Account
                                        </button>

                                        <button
                                          className="dropdown-item"
                                          onClick={() => openChangePasswordModal(acc)}
                                        >
                                          Change Password
                                        </button>

                                        {!isProtected && (
                                          <>
                                            <button
                                              className="dropdown-item"
                                              onClick={() => handleToggleStatus(acc)}
                                            >
                                              {statusDisplay === 'Active' ? 'Deactivate Account' : 'Activate Account'}
                                            </button>

                                            <button
                                              className="dropdown-item dropdown-item-warning"
                                              onClick={() =>
                                                openConfirmModal(
                                                  'archive',
                                                  acc,
                                                  `Archive account for "${acc.first_name} ${acc.last_name}"?`
                                                )
                                              }
                                            >
                                              Archive Account
                                            </button>
                                          </>
                                        )}
                                      </>
                                    ) : (
                                      <>
                                        <button
                                          className="dropdown-item dropdown-item-success"
                                          onClick={() => handleRestoreAccount(acc)}
                                        >
                                          Restore Account
                                        </button>

                                        {!isProtected && (
                                          <button
                                            className="dropdown-item dropdown-item-danger"
                                            onClick={() =>
                                              openConfirmModal(
                                                'delete',
                                                acc,
                                                `PERMANENT DELETION: Are you sure you want to permanently delete account "@${acc.username}"?`
                                              )
                                            }
                                          >
                                            Delete Permanently
                                          </button>
                                        )}
                                      </>
                                    )}
                                  </div>,
                                  document.body
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="8" style={{ textAlign: 'center', padding: '40px' }}>
                          <div className="empty-state">
                            <p>No user accounts found matching current criteria.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="acc-pagination-bar">
                <div className="pagination-info">
                  Showing{' '}
                  {sortedAccounts.length > 0
                    ? (currentPage - 1) * itemsPerPage + 1
                    : 0}{' '}
                  to {Math.min(currentPage * itemsPerPage, sortedAccounts.length)} of{' '}
                  {sortedAccounts.length} accounts
                </div>

                <div className="pagination-controls">
                  <label style={{ fontSize: '12px', color: 'var(--gray-600)' }}>Rows per page:</label>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    className="modern-select rows-select"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>

                  <button
                    className="page-btn"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                  >
                    Prev
                  </button>
                  <span className="page-indicator">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    className="page-btn"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* --- MODAL: CREATE ACCOUNT --- */}
      {modalState.type === 'create' && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="acc-modal-content animate-fade-up">
            <div className="modal-header-blue">
              <h2>Create New User Account</h2>
              <span className="close-modal" onClick={closeModal}>
                ×
              </span>
            </div>
            <form onSubmit={handleCreateAccount} className="modal-body-form">
              <div className="grid-3-cols">
                <div className="field-group">
                  <label>Employee ID</label>
                  <input
                    type="text"
                    placeholder="e.g. EMP-2026-089"
                    value={formData.employee_id}
                    onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                  />
                  {formErrors.employee_id && <span className="err-msg">{formErrors.employee_id}</span>}
                </div>

                <div className="field-group">
                  <label>First Name *</label>
                  <input
                    type="text"
                    placeholder="First Name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    required
                  />
                  {formErrors.first_name && <span className="err-msg">{formErrors.first_name}</span>}
                </div>

                <div className="field-group">
                  <label>Last Name *</label>
                  <input
                    type="text"
                    placeholder="Last Name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    required
                  />
                  {formErrors.last_name && <span className="err-msg">{formErrors.last_name}</span>}
                </div>
              </div>

              <div className="grid-3-cols" style={{ marginTop: '12px' }}>
                <div className="field-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    placeholder="email@bustos.gov.ph"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                  {formErrors.email && <span className="err-msg">{formErrors.email}</span>}
                </div>

                <div className="field-group">
                  <label>Username *</label>
                  <input
                    type="text"
                    placeholder="Username"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required
                  />
                  {formErrors.username && <span className="err-msg">{formErrors.username}</span>}
                </div>

                <div className="field-group">
                  <label>Role *</label>
                  <select
                    className="modern-select"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value="Staff">Staff</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
              </div>

              <div className="grid-3-cols" style={{ marginTop: '12px' }}>
                <div className="field-group">
                  <label>Password *</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                  {formErrors.password && <span className="err-msg">{formErrors.password}</span>}
                </div>

                <div className="field-group">
                  <label>Confirm Password *</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={formData.confirm_password}
                    onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                    required
                  />
                  {formErrors.confirm_password && (
                    <span className="err-msg">{formErrors.confirm_password}</span>
                  )}
                </div>

                <div className="field-group">
                  <label>Status</label>
                  <select
                    className="modern-select"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer-btns">
                <button type="button" className="btn-cancel" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={isLoading}>
                  {isLoading ? 'Creating...' : 'Register Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: EDIT ACCOUNT --- */}
      {modalState.type === 'edit' && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="acc-modal-content animate-fade-up">
            <div className="modal-header-blue">
              <h2>Edit User Account</h2>
              <span className="close-modal" onClick={closeModal}>
                ×
              </span>
            </div>
            <form onSubmit={handleEditAccount} className="modal-body-form">
              <div className="grid-3-cols">
                <div className="field-group">
                  <label>Employee ID</label>
                  <input
                    type="text"
                    value={formData.employee_id}
                    onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                  />
                  {formErrors.employee_id && <span className="err-msg">{formErrors.employee_id}</span>}
                </div>

                <div className="field-group">
                  <label>First Name *</label>
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    required
                  />
                  {formErrors.first_name && <span className="err-msg">{formErrors.first_name}</span>}
                </div>

                <div className="field-group">
                  <label>Last Name *</label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    required
                  />
                  {formErrors.last_name && <span className="err-msg">{formErrors.last_name}</span>}
                </div>
              </div>

              <div className="grid-2-cols" style={{ marginTop: '12px' }}>
                <div className="field-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                  {formErrors.email && <span className="err-msg">{formErrors.email}</span>}
                </div>

                <div className="field-group">
                  <label>Username *</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required
                  />
                  {formErrors.username && <span className="err-msg">{formErrors.username}</span>}
                </div>
              </div>

              <div className="grid-2-cols" style={{ marginTop: '12px' }}>
                <div className="field-group">
                  <label>Role</label>
                  <select
                    className="modern-select"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value="Staff">Staff</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>

                <div className="field-group">
                  <label>Status</label>
                  <select
                    className="modern-select"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer-btns">
                <button type="button" className="btn-cancel" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={isLoading}>
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: CHANGE PASSWORD / RESET EMAIL --- */}
      {modalState.type === 'changePassword' && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="acc-modal-content sm-modal animate-fade-up">
            <div className="modal-header-blue">
              <h2>Reset Account Password</h2>
              <span className="close-modal" onClick={closeModal}>
                ×
              </span>
            </div>
            <form onSubmit={handleChangePassword} className="modal-body-form">
              <p style={{ fontSize: '13.5px', color: 'var(--gray-600)', marginBottom: '16px', lineHeight: '1.5' }}>
                For security reasons, administrators cannot directly set a user's password. 
                Are you sure you want to send a secure password reset link to <strong>@{modalState.data?.username}</strong>?
              </p>

              <div className="modal-footer-btns">
                <button type="button" className="btn-cancel" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={isLoading}>
                  {isLoading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: VIEW ACCOUNT DETAILS --- */}
      {modalState.type === 'view' && modalState.data && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="acc-modal-content sm-modal animate-fade-up">
            <div className="modal-header-blue">
              <h2>Account Profile Overview</h2>
              <span className="close-modal" onClick={closeModal}>
                ×
              </span>
            </div>
            <div className="modal-body-details">
              <div className="view-header-profile">
                <div className="avatar-circle-large">
                  {getInitials(modalState.data.first_name, modalState.data.last_name)}
                </div>
                <div>
                  <h3>
                    {modalState.data.first_name} {modalState.data.last_name}
                  </h3>
                  <p className="view-sub-title">@{modalState.data.username}</p>
                </div>
              </div>

              <div className="view-details-grid">
                <div className="view-detail-item">
                  <span className="detail-label">Employee ID</span>
                  <span className="detail-value">{modalState.data.employee_id || 'Not Set'}</span>
                </div>
                <div className="view-detail-item">
                  <span className="detail-label">Email Address</span>
                  <span className="detail-value">{modalState.data.email || 'Not Set'}</span>
                </div>
                <div className="view-detail-item">
                  <span className="detail-label">System Role</span>
                  <span className="detail-value">
                    <span
                      className={`role-badge role-${(
                        modalState.data.role || 'Staff'
                      ).toLowerCase()}`}
                    >
                      {modalState.data.role === 'Administrator'
                        ? 'Admin'
                        : modalState.data.role || 'Staff'}
                    </span>
                  </span>
                </div>
                <div className="view-detail-item">
                  <span className="detail-label">Account Status</span>
                  <span className="detail-value">
                    <span
                      className={`status-badge status-${(
                        modalState.data.status || 'Active'
                      ).toLowerCase()}`}
                    >
                      {modalState.data.status || 'Active'}
                    </span>
                  </span>
                </div>
                <div className="view-detail-item">
                  <span className="detail-label">Archived State</span>
                  <span className="detail-value">
                    {modalState.data.archived ? 'Archived' : 'Active'}
                  </span>
                </div>
                <div className="view-detail-item">
                  <span className="detail-label">Registration Date</span>
                  <span className="detail-value">
                    {modalState.data.created_at
                      ? new Date(modalState.data.created_at).toLocaleString()
                      : 'N/A'}
                  </span>
                </div>
              </div>

              <div className="modal-footer-btns" style={{ marginTop: '24px' }}>
                <button className="btn-cancel" style={{ width: '100%' }} onClick={closeModal}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: CONFIRMATION DIALOG --- */}
      {modalState.type === 'confirm' && modalState.data && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="admin-modal animate-fade-up">
            <h2>Confirm Action</h2>
            <p>{modalState.data.message}</p>
            <div className="modal-btns">
              <button className="btn-back" style={{ flex: 1 }} onClick={closeModal}>
                Cancel
              </button>
              <button
                className="btn-next"
                style={{ flex: 1, background: 'var(--primary)' }}
                onClick={() => {
                  const { actionType, targetData } = modalState.data;
                  if (actionType === 'archive') handleArchiveAccount(targetData);
                  else if (actionType === 'delete') handlePermanentDelete(targetData);
                  else if (actionType === 'bulk-activate') handleExecuteBulkAction('activate');
                  else if (actionType === 'bulk-deactivate') handleExecuteBulkAction('deactivate');
                  else if (actionType === 'bulk-archive') handleExecuteBulkAction('archive');
                  else if (actionType === 'bulk-delete') handleExecuteBulkAction('delete');
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
