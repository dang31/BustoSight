import { useState, useEffect } from "react";
import "./SessionTimeoutModal.css";

/**
 * SessionTimeoutModal
 *
 * Props
 *   show         – boolean to show/hide
 *   countdown    – remaining seconds to display in the modal
 *   onExtend     – called when user clicks "Stay Logged In"
 *   onLogout     – called when user clicks "Logout Now" or timer hits 0
 */
export default function SessionTimeoutModal({ show, countdown, onExtend, onLogout }) {
  if (!show) return null;

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;
  const timeStr = minutes > 0
    ? `${minutes}:${String(seconds).padStart(2, "0")}`
    : `${seconds}s`;

  const isUrgent = countdown <= 60;

  return (
    <div className="stm-overlay" role="dialog" aria-modal="true" aria-labelledby="stm-title">
      <div className={`stm-box ${isUrgent ? "urgent" : ""}`}>
        {/* Icon */}
        <div className={`stm-icon-wrap ${isUrgent ? "urgent" : ""}`}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>

        {/* Content */}
        <h2 className="stm-title" id="stm-title">Session Expiring Soon</h2>
        <p className="stm-message">
          Your session will automatically expire due to inactivity. Do you want to stay logged in?
        </p>

        {/* Countdown */}
        <div className={`stm-countdown ${isUrgent ? "urgent" : ""}`}>
          <span className="stm-countdown-label">Time remaining</span>
          <span className="stm-countdown-time">{timeStr}</span>
        </div>

        {/* Progress bar */}
        <div className="stm-progress-track">
          <div
            className={`stm-progress-bar ${isUrgent ? "urgent" : ""}`}
            style={{ width: `${Math.min((countdown / 120) * 100, 100)}%` }}
          />
        </div>

        {/* Actions */}
        <div className="stm-actions">
          <button className="stm-btn-logout" onClick={onLogout}>
            Logout Now
          </button>
          <button className="stm-btn-extend" onClick={onExtend}>
            Stay Logged In
          </button>
        </div>
      </div>
    </div>
  );
}
