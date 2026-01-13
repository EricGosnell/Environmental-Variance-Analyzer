import { useMemo, useState } from "react";
import { FiArrowLeft } from "react-icons/fi";
import type { User } from "../utils/apiTypes";
import { ApiError, authLogin, authRegister } from "../utils/api";
import "../styles/AuthPanel.css";

type AuthPanelProps = {
  onAuthSuccess: (user: User) => void;
};

type Mode = "login" | "signup";

export default function AuthPanel({ onAuthSuccess }: AuthPanelProps) {
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // signup
  const [signupStep, setSignupStep] = useState<1 | 2>(1);
  const [invitationToken, setInvitationToken] = useState("");
  const [signupUsername, setSignupUsername] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  const signupProgress = useMemo(() => (signupStep === 1 ? 50 : 100), [signupStep]);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setLoading(false);
    if (next === "login") {
      setSignupStep(1);
    }
  }

  function formatError(err: unknown): string {
    if (err instanceof ApiError) return err.message;
    if (err instanceof Error) return err.message;
    return "Request failed. Please try again.";
  }

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await authLogin({ email: loginEmail, password: loginPassword });
      onAuthSuccess(res.user);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  }

  async function submitSignup(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await authRegister({
        invitationToken,
        username: signupUsername,
        email: signupEmail,
        password: signupPassword,
      });
      onAuthSuccess(res.user);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-panel">
      {mode === "login" && (
        <form className="auth-form" onSubmit={submitLogin} aria-label="Log in form">
          <div className="auth-header">
            <h3 className="auth-title">Log in</h3>
          </div>

          <label className="auth-label">
            Email
            <input
              className="auth-input"
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              autoComplete="email"
              required
              disabled={loading}
            />
          </label>

          <label className="auth-label">
            Password
            <input
              className="auth-input"
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              autoComplete="current-password"
              required
              disabled={loading}
            />
          </label>

          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}

          <button className="btn primary-btn auth-submit" type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Log in"}
          </button>

          <button
            type="button"
            className="btn secondary-btn auth-secondary"
            onClick={() => switchMode("signup")}
            disabled={loading}
          >
            Sign up
          </button>
        </form>
      )}

      {mode === "signup" && (
        <div className="auth-signup" aria-label="Sign up flow">
          <div className="auth-header">
            <button
              type="button"
              className="auth-link"
              onClick={() => switchMode("login")}
              disabled={loading}
            >
              <FiArrowLeft aria-hidden="true" focusable="false" />
              <span>Back to login</span>
            </button>
            <h3 className="auth-title">Sign up</h3>
          </div>

          <div className="auth-stepper" aria-label="Sign up progress">
            <div className="auth-stepper-top">
              <span className={`auth-step ${signupStep === 1 ? "active" : "done"}`}>
                <span className="auth-step-circle">1</span>
                <span className="auth-step-text">Invitation</span>
              </span>
              <span className={`auth-step ${signupStep === 2 ? "active" : ""}`}>
                <span className="auth-step-circle">2</span>
                <span className="auth-step-text">Account</span>
              </span>
            </div>
            <div className="auth-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={signupProgress}>
              <div className="auth-progress-fill" style={{ width: `${signupProgress}%` }} />
            </div>
          </div>

          {signupStep === 1 && (
            <form
              className="auth-form"
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                setSignupStep(2);
              }}
              aria-label="Invitation code step"
            >
              <label className="auth-label">
                Invitation code
                <input
                  className="auth-input"
                  type="text"
                  value={invitationToken}
                  onChange={(e) => setInvitationToken(e.target.value)}
                  placeholder="ABCD-EFGH"
                  required
                  disabled={loading}
                />
              </label>

              {error && (
                <div className="auth-error" role="alert">
                  {error}
                </div>
              )}

              <button className="btn primary-btn auth-submit" type="submit" disabled={loading || invitationToken.trim().length === 0}>
                Continue
              </button>
            </form>
          )}

          {signupStep === 2 && (
            <form className="auth-form" onSubmit={submitSignup} aria-label="Create account step">
              <label className="auth-label">
                Username
                <input
                  className="auth-input"
                  type="text"
                  value={signupUsername}
                  onChange={(e) => setSignupUsername(e.target.value)}
                  autoComplete="username"
                  required
                  disabled={loading}
                />
              </label>

              <label className="auth-label">
                Email
                <input
                  className="auth-input"
                  type="email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  autoComplete="email"
                  required
                  disabled={loading}
                />
              </label>

              <label className="auth-label">
                Password
                <input
                  className="auth-input"
                  type="password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  disabled={loading}
                />
              </label>

              {error && (
                <div className="auth-error" role="alert">
                  {error}
                </div>
              )}

              <div className="auth-actions">
                <button
                  type="button"
                  className="btn secondary-btn auth-back"
                  onClick={() => {
                    setError(null);
                    setSignupStep(1);
                  }}
                  disabled={loading}
                >
                  Back
                </button>
                <button className="btn primary-btn auth-submit" type="submit" disabled={loading}>
                  {loading ? "Creating..." : "Create account"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}


