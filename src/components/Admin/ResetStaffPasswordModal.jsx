import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import PasswordInput from '../Common/PasswordInput';

export default function ResetStaffPasswordModal({ targetUser, onClose, onSuccess }) {
  const [adminPassword, setAdminPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!adminPassword) {
      setError("Admin password is required.");
      return;
    }

    setIsLoading(true);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('admin-reset-password', {
        body: {
          admin_current_password: adminPassword,
          target_user_id: targetUser.id,
          new_password: newPassword
        }
      });

      if (invokeError) {
        throw new Error(invokeError.message || "Failed to call edge function");
      }
      
      if (data && data.error) {
        throw new Error(data.error);
      }

      onSuccess("Staff password has been reset securely!");
      onClose();
    } catch (err) {
      setError(err.message || "Failed to reset password.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="acc-modal-content sm-modal animate-fade-up">
        <div className="modal-header-blue">
          <h2>Force Reset Staff Password</h2>
          <span className="acc-close-modal" onClick={onClose}>
            ×
          </span>
        </div>
        <form onSubmit={handleSubmit} className="modal-body-form">
          <p style={{ fontSize: "13.5px", color: "var(--gray-600)", marginBottom: "16px", lineHeight: "1.5" }}>
            You are resetting the password for <strong>@{targetUser?.username}</strong>. 
            They will be forced to change this password on their next login.
          </p>
          
          {error && <div style={{ color: '#ef4444', marginBottom: '12px', fontSize: '14px', padding: '8px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px' }}>{error}</div>}

          <div className="field-group" style={{ marginBottom: "12px" }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--gray-700)', marginBottom: '6px' }}>New Password for Staff</label>
            <PasswordInput
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{ border: '1px solid var(--gray-300)', borderRadius: '6px', fontSize: '14px' }}
              required
            />
          </div>

          <div className="field-group" style={{ marginBottom: "12px" }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--gray-700)', marginBottom: '6px' }}>Confirm New Password</label>
            <PasswordInput
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{ border: '1px solid var(--gray-300)', borderRadius: '6px', fontSize: '14px' }}
              required
            />
          </div>

          <hr style={{ margin: '20px 0', borderColor: '#e2e8f0', borderStyle: 'solid', borderWidth: '1px 0 0 0' }} />

          <div className="field-group" style={{ marginBottom: "20px" }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--gray-700)', marginBottom: '6px' }}>Your Admin Password (Security Check)</label>
            <PasswordInput
              placeholder="Enter your current password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              style={{ border: '1px solid var(--gray-300)', borderRadius: '6px', fontSize: '14px' }}
              required
            />
          </div>

          <div className="modal-footer-btns">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-submit"
              disabled={isLoading}
            >
              {isLoading ? "Resetting..." : "Reset Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
