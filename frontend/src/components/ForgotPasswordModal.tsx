import { useEffect, useState } from "react";
import { FiArrowLeft } from "react-icons/fi";
import { ApiError, authForgotPassword, authResetPassword } from "../utils/api";
import "../styles/ForgotPasswordModal.css";

type ForgotPasswordModalProps = {
  isOpen: boolean;
  initialEmail?: string;
  onClose: () => void;
  onResetSuccess: (email: string) => void;
};

type Step = "email" | "reset";

const RESET_CODE_LENGTH = 6;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordModal({
  isOpen,
  initialEmail = "",
  onClose,
  onResetSuccess,
}: ForgotPasswordModalProps) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [sendLoading, setSendLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    setStep("email");
    setEmail(initialEmail.trim());
    setCode("");
    setNewPassword("");
    setConfirmPassword("");
    setSendLoading(false);
    setSubmitLoading(false);
    setError(null);
    setInfo(null);
    setCooldownSeconds(0);
  }, [isOpen, initialEmail]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timerId = window.setInterval(() => {
      setCooldownSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [cooldownSeconds]);

  function handleClose() {
    if (sendLoading || submitLoading) return;
    onClose();
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    if (sendLoading || submitLoading) return;

    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    setSendLoading(true);
    setError(null);
    setInfo(null);

    try {
      await authForgotPassword({ email: normalizedEmail });
      setEmail(normalizedEmail);
      setInfo("If the email exists, a password reset code was sent.");
      setCooldownSeconds(60);
      setStep("reset");
    } catch {
      setError("Unable to send password reset code right now. Please try again.");
    } finally {
      setSendLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (sendLoading || submitLoading) return;

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.trim();

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (normalizedCode.length !== RESET_CODE_LENGTH) {
      setError("Please enter a valid 6-digit reset code.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitLoading(true);
    setError(null);

    try {
      await authResetPassword({
        email: normalizedEmail,
        token: normalizedCode,
        newPassword,
      });
      onResetSuccess(normalizedEmail);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Unable to reset password right now. Please try again.");
      }
    } finally {
      setSubmitLoading(false);
    }
  }

  function goBackToEmailStep() {
    if (sendLoading || submitLoading) return;
    setStep("email");
    setCode("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
  }

  if (!isOpen) return null;

  return (
    <div
      className="forgot-password-overlay"
      onClick={handleClose}
    >
      <section
        className="forgot-password-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="forgot-password-title"
        onClick={(e) => e.stopPropagation()}
      >
        {step === "email" ? (
          <>
            <div className="forgot-password-header">
              <h3 id="forgot-password-title" className="forgot-password-title">Reset password</h3>
              <button
                type="button"
                className="dismiss-btn"
                onClick={handleClose}
                disabled={sendLoading || submitLoading}
              >
                Close
              </button>
            </div>

            <form className="forgot-password-form" onSubmit={handleSendCode}>
              <label className="form-label">
                Email
                <input
                  className="form-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  disabled={sendLoading || submitLoading}
                />
              </label>

              {error && (
                <div className="alert alert--error" role="alert">
                  {error}
                </div>
              )}

              <button
                className="btn primary-btn btn--full"
                type="submit"
                disabled={sendLoading || submitLoading || cooldownSeconds > 0}
              >
                {sendLoading
                  ? "Sending..."
                  : cooldownSeconds > 0
                    ? `Send code (${cooldownSeconds}s)`
                    : "Send code"}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="forgot-password-header forgot-password-header--reset">
              <button
                type="button"
                className="ghost-link"
                onClick={goBackToEmailStep}
                disabled={sendLoading || submitLoading}
              >
                <FiArrowLeft aria-hidden="true" focusable="false" />
                <span>Didn't receive any code?</span>
              </button>
              <h3 id="forgot-password-title" className="forgot-password-title">Reset password</h3>
            </div>

            <form className="forgot-password-form" onSubmit={handleResetPassword}>
              <label className="form-label">
                6-digit reset code
                <input
                  className="form-input"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, RESET_CODE_LENGTH))}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={RESET_CODE_LENGTH}
                  autoComplete="one-time-code"
                  required
                  disabled={sendLoading || submitLoading}
                />
              </label>

              <label className="form-label">
                New password
                <input
                  className="form-input"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  disabled={sendLoading || submitLoading}
                />
              </label>

              <label className="form-label">
                Confirm new password
                <input
                  className="form-input"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  disabled={sendLoading || submitLoading}
                />
              </label>

              {info && (
                <div className="alert alert--info" role="status">
                  {info}
                </div>
              )}

              {error && (
                <div className="alert alert--error" role="alert">
                  {error}
                </div>
              )}

              <button
                className="btn primary-btn btn--full"
                type="submit"
                disabled={sendLoading || submitLoading}
              >
                {submitLoading ? "Resetting..." : "Reset password"}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
