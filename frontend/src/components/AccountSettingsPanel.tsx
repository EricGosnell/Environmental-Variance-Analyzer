import type React from "react";
import type { ProfileFormState } from "../utils/profileTypes";
import { PASSWORD_REQUIREMENTS_MESSAGE } from "../utils/profileConstants";
import { maskPhoneForDisplay } from "../utils/profileUtils";

type AccountSettingsPanelProps = {
	message: string;
	form: ProfileFormState;
	phoneEditMode: boolean;
	phoneUpdateInFlight: boolean;
	newPassword: string;
	confirmPassword: string;
	showPasswordForm: boolean;
	passwordRequestInFlight: boolean;
	passwordUpdateInFlight: boolean;
	onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	onPhoneFocus: () => void;
	onUsernameUpdate: (e: React.FormEvent) => Promise<void>;
	onEmailRequest: (e: React.FormEvent) => Promise<void>;
	onPhoneUpdate: (e: React.FormEvent) => Promise<void>;
	onPasswordResetRequest: () => Promise<void>;
	onPasswordSubmit: (e: React.FormEvent) => Promise<void>;
	onNewPasswordChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	onResetPasswordFlow: () => void;
};

const AccountSettingsPanel = ({
	message,
	form,
	phoneEditMode,
	phoneUpdateInFlight,
	newPassword,
	confirmPassword,
	showPasswordForm,
	passwordRequestInFlight,
	passwordUpdateInFlight,
	onChange,
	onPhoneFocus,
	onUsernameUpdate,
	onEmailRequest,
	onPhoneUpdate,
	onPasswordResetRequest,
	onPasswordSubmit,
	onNewPasswordChange,
	onResetPasswordFlow,
}: AccountSettingsPanelProps) => {
	return (
		<div className="profile-settings-panel">
			<h3 className="profile-section-title">Account Settings</h3>
			{message && <div className="profile-message">{message}</div>}
			<div className="profile-controls-container">
				<form className="profile-form profile-form-grid" onSubmit={onUsernameUpdate}>
					<label htmlFor="profile-username" className="profile-form-label-nowrap">Change Username:</label>
					<input
						id="profile-username"
						type="text"
						name="username"
						value={form.username}
						onChange={onChange}
						className="profile-form-input"
					/>
					<button className="btn profile-form-submit-btn" type="submit">Update Username</button>
				</form>
				<form className="profile-form profile-form-grid" onSubmit={onEmailRequest}>
					<label htmlFor="profile-email" className="profile-form-label-nowrap">Change Email:</label>
					<input
						id="profile-email"
						type="email"
						name="email"
						value={form.email}
						onChange={onChange}
						className="profile-form-input"
					/>
					<button className="btn profile-form-submit-btn" type="submit">Request Email Change</button>
				</form>
				<form className="profile-form profile-form-grid" onSubmit={onPhoneUpdate}>
					<label htmlFor="profile-phone" className="profile-form-label-nowrap">Change Phone Number:</label>
					<input
						id="profile-phone"
						type="text"
						name="phone_number"
						value={phoneEditMode ? form.phone_number : maskPhoneForDisplay(form.phone_number)}
						onChange={onChange}
						onFocus={onPhoneFocus}
						readOnly={!phoneEditMode || phoneUpdateInFlight}
						className="profile-form-input"
					/>
					<button className="btn profile-form-submit-btn" type="submit" disabled={phoneUpdateInFlight}>
						{phoneUpdateInFlight ? "Updating..." : "Update Phone Number"}
					</button>
				</form>
			</div>

			<div className="profile-controls-container">
				<button className="btn profile-change-password-btn" type="button" onClick={onPasswordResetRequest} disabled={passwordRequestInFlight || passwordUpdateInFlight}>
					{passwordRequestInFlight ? "Sending Code..." : "Change Password"}
				</button>
				{showPasswordForm && (
					<form className="profile-form profile-password-form" onSubmit={onPasswordSubmit}>
						<p>Enter your new password to complete the reset.</p>
						<label>New Password:
							<input
								type="password"
								name="newPassword"
								value={newPassword}
								onChange={onNewPasswordChange}
								autoFocus
								className="profile-password-input"
							/>
						</label>
						<label>Re-enter New Password:
							<input
								type="password"
								name="confirmPassword"
								value={confirmPassword}
								onChange={onNewPasswordChange}
								className="profile-password-input"
							/>
						</label>
						<p className="profile-password-requirements">{PASSWORD_REQUIREMENTS_MESSAGE}</p>
						<div className="profile-password-actions-row">
							<button className="btn profile-password-update-btn" type="submit" disabled={passwordUpdateInFlight || passwordRequestInFlight}>
								{passwordUpdateInFlight ? "Updating Password..." : "Update Password"}
							</button>
							<button className="btn profile-password-secondary-btn" type="button" onClick={onPasswordResetRequest} disabled={passwordUpdateInFlight || passwordRequestInFlight}>
								{passwordRequestInFlight ? "Sending Code..." : "Use New Code"}
							</button>
							<button className="btn profile-password-secondary-btn" type="button" onClick={onResetPasswordFlow} disabled={passwordUpdateInFlight || passwordRequestInFlight}>
								Cancel
							</button>
						</div>
					</form>
				)}
			</div>
		</div>
	);
};

export default AccountSettingsPanel;
