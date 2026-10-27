import { useEffect, useState } from "react";
import "./LoadingScreen.css";

/**
 * LoadingScreen
 *
 * Full-screen branded loader shown while a route resolves its session and
 * permissions. Replaces the bare <h2>Loading...</h2> that used to flash after
 * login and on every guarded navigation.
 */
export default function LoadingScreen({
  title = "Loading your workspace",
  messages = [
    "Verifying your session",
    "Loading your account",
    "Checking access permissions",
    "Preparing your data",
  ],
  cycleMs = 1800,
}) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (messages.length <= 1) return undefined;
    const id = setInterval(() => {
      setStep((prev) => (prev + 1) % messages.length);
    }, cycleMs);
    return () => clearInterval(id);
  }, [messages.length, cycleMs]);

  return (
    <div className="ls-screen" role="status" aria-live="polite" aria-busy="true">
      <div className="ls-bg" aria-hidden="true" />

      <div className="ls-card">
        <header className="ls-logos">
          <img src="/bustos-logo.png" alt="" className="ls-logo" />
          <img src="/popdev-logo.png" alt="" className="ls-logo" />
        </header>

        <div className="ls-spinner-wrap">
          <span className="ls-glow" aria-hidden="true" />
          <svg
            className="ls-spinner"
            viewBox="0 0 50 50"
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              <linearGradient id="ls-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--primary-light)" />
                <stop offset="100%" stopColor="#63b3ed" />
              </linearGradient>
            </defs>
            <circle
              className="ls-track"
              cx="25"
              cy="25"
              r="20"
              fill="none"
              strokeWidth="4"
            />
            <circle
              className="ls-arc"
              cx="25"
              cy="25"
              r="20"
              fill="none"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <h1 className="ls-title">{title}</h1>

        <p className="ls-step" key={step}>
          {messages[step]}
          <span className="ls-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </p>

        <div className="ls-bar" aria-hidden="true">
          <span className="ls-bar-fill" />
        </div>
      </div>
    </div>
  );
}