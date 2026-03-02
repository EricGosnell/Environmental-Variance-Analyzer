import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import type { User } from "../utils/apiTypes";
import { ApiError, authLogin, authRegister, sendVerification } from "../utils/api";
import "../styles/AuthPanel.css";

type AuthPanelProps = {
  onAuthSuccess: (user: User) => void;
  initialMode?: Mode;
  initialLoginEmail?: string;
};

type Mode = "login" | "signup";

export default function AuthPanel({
  onAuthSuccess,
  initialMode = "login",
  initialLoginEmail = "",
}: AuthPanelProps) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // login
  const [loginEmail, setLoginEmail] = useState(initialLoginEmail);
  const [loginPassword, setLoginPassword] = useState("");

  // signup
  const [signupUsername, setSignupUsername] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupPasswordRetype, setSignupPasswordRetype] = useState("");

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    setLoginEmail(initialLoginEmail);
  }, [initialLoginEmail]);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setLoading(false);
  }

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    const normalizedLoginEmail = loginEmail.trim();
    setLoading(true);
    try {
      const res = await authLogin({ email: normalizedLoginEmail, password: loginPassword });
      onAuthSuccess(res.user);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        const next = `/?${new URLSearchParams({ auth: "login", email: normalizedLoginEmail, verified: "1" }).toString()}`;
        navigate(`/verify-email?${new URLSearchParams({ email: normalizedLoginEmail, next, reason: "login" }).toString()}`);
        return;
      }
      if (err instanceof ApiError && err.status === 400) {
        setError(err.message);
      } else {
        setError(null);
      }
    } finally {
      setLoading(false);
    }
  }

  async function submitSignup(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    const normalizedSignupEmail = signupEmail.trim();
    if (signupPassword !== signupPasswordRetype) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await authRegister({
        username: signupUsername,
        email: normalizedSignupEmail,
        password: signupPassword,
        phone_number: signupPhone.trim(),
      });

      let verificationSent = true;
      try {
        await sendVerification({ email: normalizedSignupEmail });
      } catch {
        verificationSent = false;
      }

      const nextParams = new URLSearchParams({
        auth: "login",
        email: normalizedSignupEmail,
        verified: "1",
      });
      const verificationParams = new URLSearchParams({
        email: normalizedSignupEmail,
        next: `/?${nextParams.toString()}`,
        reason: "signup",
        sent: verificationSent ? "1" : "0",
      });
      navigate(`/verify-email?${verificationParams.toString()}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setError(err.message);
      } else {
        setError(null);
      }
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
        <form className="auth-form" onSubmit={submitSignup} aria-label="Sign up form">
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
            Phone number
            <input
              className="auth-input"
              type="tel"
              value={signupPhone}
              onChange={(e) => setSignupPhone(e.target.value)}
              autoComplete="tel"
              required
              disabled={loading}
              title="US numbers only"
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

          <label className="auth-label">
            Retype password
            <input
              className="auth-input"
              type="password"
              value={signupPasswordRetype}
              onChange={(e) => setSignupPasswordRetype(e.target.value)}
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

          <button className="btn primary-btn auth-submit" type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create account"}
          </button>
        </form>
      )}
    </div>
  );
}
