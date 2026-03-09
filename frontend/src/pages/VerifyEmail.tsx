import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import { ApiError, sendVerification, verifyEmail } from "../utils/api";
import "../styles/VerifyEmail.css";

const VERIFICATION_CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getSafeNextPath(rawNext: string | null): string {
  if (!rawNext) return "/";
  if (!rawNext.startsWith("/") || rawNext.startsWith("//")) return "/";
  return rawNext;
}

function getReasonMessage(reason: string | null): string {
  if (reason === "signup") {
    return "Enter the verification code to finish creating your account.";
  }
  return "Enter the verification code to continue.";
}

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const email = (searchParams.get("email") ?? "").trim();
  const next = getSafeNextPath(searchParams.get("next"));
  const reason = searchParams.get("reason");
  const sent = searchParams.get("sent");
  const hasValidEmail = EMAIL_PATTERN.test(email);

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(
    sent === "1"
      ? `A verification code was sent to ${email}.`
      : sent === "0"
        ? "Verification email could not be sent automatically. Use resend to try again."
        : null,
  );
  const [cooldownSeconds, setCooldownSeconds] = useState(sent === "1" ? RESEND_COOLDOWN_SECONDS : 0);
  const isCooldownActive = cooldownSeconds > 0;

  useEffect(() => {
    if (!isCooldownActive) return;

    const timerId = window.setInterval(() => {
      setCooldownSeconds((previous) => Math.max(0, previous - 1));
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [isCooldownActive]);

  async function handleVerifySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading || !hasValidEmail) return;

    const normalizedCode = code.trim();
    if (normalizedCode.length !== VERIFICATION_CODE_LENGTH) {
      setError("Please enter a valid 6-digit verification code.");
      return;
    }

    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      await verifyEmail({ email, code: normalizedCode });
      navigate(next, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Unable to verify email right now. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendLoading || cooldownSeconds > 0 || !hasValidEmail) return;

    setResendLoading(true);
    setError(null);
    setInfo(null);

    try {
      await sendVerification({ email });
      setInfo(`A new verification code was sent to ${email}.`);
      setCooldownSeconds(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Unable to resend verification email right now. Please try again.");
      }
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <div className="verify-email-page">
      <section className="verify-email-card" aria-labelledby="verify-email-title">
        <Link
          to="/"
          style={{
            alignSelf: "flex-start",
            color: "#fff",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            opacity: 0.9,
          }}
        >
          <FiArrowLeft aria-hidden="true" focusable="false" />
          <span>Back to home</span>
        </Link>
        <h1 id="verify-email-title">Verify your email</h1>

        {!hasValidEmail ? (
          <>
            <p className="verify-email-copy">
              This verification link is missing a valid email address. Start again from the previous step.
            </p>
            <Link className="btn primary-btn verify-email-home-link" to="/">
              Return home
            </Link>
          </>
        ) : (
          <>
            <p className="verify-email-copy">{getReasonMessage(reason)}</p>
            <p className="verify-email-address">{email}</p>

            {info && <div className="verify-email-info" role="status">{info}</div>}
            {error && <div className="verify-email-error" role="alert">{error}</div>}

            <form className="verify-email-form" onSubmit={handleVerifySubmit}>
              <label className="verify-email-label" htmlFor="verification-code">
                Verification code
              </label>
              <input
                id="verification-code"
                className="verify-email-input"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, VERIFICATION_CODE_LENGTH))}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={VERIFICATION_CODE_LENGTH}
                autoComplete="one-time-code"
                required
                disabled={loading}
              />

              <button className="btn primary-btn verify-email-submit" type="submit" disabled={loading}>
                {loading ? "Verifying..." : "Verify email"}
              </button>
            </form>

            <button
              className="btn secondary-btn verify-email-resend"
              type="button"
              disabled={resendLoading || cooldownSeconds > 0}
              onClick={handleResend}
            >
              {resendLoading
                ? "Resending..."
                : cooldownSeconds > 0
                  ? `Resend code (${cooldownSeconds}s)`
                  : "Resend code"}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
