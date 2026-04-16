import type React from "react";
import type { VerificationModalState } from "../utils/profileTypes";

type VerificationModalProps = {
	verificationModal: VerificationModalState;
	verificationCodeInput: string;
	verificationModalError: string;
	verificationSubmitInFlight: boolean;
	passwordRequestInFlight: boolean;
	onSubmit: (e: React.FormEvent) => Promise<void>;
	onCodeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	onResend: () => Promise<void>;
	onClose: () => void;
};

const VerificationModal = ({
	verificationModal,
	verificationCodeInput,
	verificationModalError,
	verificationSubmitInFlight,
	passwordRequestInFlight,
	onSubmit,
	onCodeChange,
	onResend,
	onClose,
}: VerificationModalProps) => {
	return (
		<div className="modal">
			<form className="pod-form profile-verification-modal" onSubmit={onSubmit}>
				<h3>{verificationModal.mode === "email" ? "Verify Email Change" : "Verify Password Reset"}</h3>
				<p className="profile-verification-copy">
					Enter the 6-digit code sent to
					<span className="profile-verification-address"> {verificationModal.targetEmail}</span>.
				</p>
				<label htmlFor="profile-verification-code">
					Verification Code
					<input
						id="profile-verification-code"
						type="text"
						name="verificationCode"
						value={verificationCodeInput}
						onChange={onCodeChange}
						maxLength={6}
						pattern="\d{6}"
						autoFocus
						inputMode="numeric"
					/>
				</label>
				{verificationModalError && <div className="error profile-verification-error">{verificationModalError}</div>}
				<div className="form-actions profile-verification-actions">
					<button type="submit" className="primary-btn" disabled={verificationSubmitInFlight || passwordRequestInFlight}>
						{verificationSubmitInFlight ? "Verifying..." : "Verify Code"}
					</button>
					<button type="button" onClick={onResend} disabled={passwordRequestInFlight || verificationSubmitInFlight}>
						{passwordRequestInFlight ? "Sending Code..." : "Send New Code"}
					</button>
					<button type="button" onClick={onClose} disabled={verificationSubmitInFlight}>Cancel</button>
				</div>
			</form>
		</div>
	);
};

export default VerificationModal;
