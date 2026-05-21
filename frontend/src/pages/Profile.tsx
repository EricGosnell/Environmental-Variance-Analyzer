import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Profile.css";
import "../styles/ManagePods.css";
import { getMe, getMyPodHistory, registerPod, updatePod, unregisterPod } from "../utils/api";
import { updateMyPhoneNumber, updateMyUsername, verifyAndUpdateEmail, requestEmailChange } from "../utils/api";
import { authForgotPassword, authResetPassword } from "../utils/api";
import type { PodActionHistoryEntry, User, UserPod } from "../utils/apiTypes";
import ProfileTabs from "../components/ProfileTabs";
import ProfileHeader from "../components/ProfileHeader";
import ManagePodsPanel from "../components/ManagePodsPanel";
import PodHistoryPanel from "../components/PodHistoryPanel";
import AccountSettingsPanel from "../components/AccountSettingsPanel";
import HistoryDetailsModal from "../components/HistoryDetailsModal";
import VerificationModal from "../components/VerificationModal";
import { PASSWORD_REQUIREMENTS_MESSAGE, PROFILE_TABS } from "../utils/profileConstants";
import { generateTraceId, isValidLat, isValidLong, isValidPassword, maskEmailForLog } from "../utils/profileUtils";
import type { PodDraftState, ProfileFormState, ProfileTabKey, VerificationModalState } from "../utils/profileTypes";

const Profile: React.FC = () => {
	const navigate = useNavigate();
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);
	const [form, setForm] = useState<ProfileFormState>({
		username: "",
		email: "",
		phone_number: "",
		verificationCode: "",
	});
	const [phoneEditMode, setPhoneEditMode] = useState(false);
	const [phoneUpdateInFlight, setPhoneUpdateInFlight] = useState(false);
	const [message, setMessage] = useState("");
	const [showPasswordForm, setShowPasswordForm] = useState(false);
	const [passwordCode, setPasswordCode] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [passwordResetTraceId, setPasswordResetTraceId] = useState("");
	const [passwordRequestInFlight, setPasswordRequestInFlight] = useState(false);
	const [passwordUpdateInFlight, setPasswordUpdateInFlight] = useState(false);
	const [verificationModal, setVerificationModal] = useState<VerificationModalState | null>(null);
	const [verificationCodeInput, setVerificationCodeInput] = useState("");
	const [verificationModalError, setVerificationModalError] = useState("");
	const [verificationSubmitInFlight, setVerificationSubmitInFlight] = useState(false);

	const [error, setError] = useState<string | null>(null);
	const [showAddModal, setShowAddModal] = useState<boolean>(false);
	const [newPod, setNewPod] = useState<PodDraftState>({
		nickname: "",
		visibility: "public",
		latitude: "",
		longitude: "",
	});
	const [editPodId, setEditPodId] = useState<number | null>(null);
	const [editPod, setEditPod] = useState<PodDraftState>({
		nickname: "",
		visibility: "public",
		latitude: "",
		longitude: "",
	});
	const [showEditConfirm, setShowEditConfirm] = useState<boolean>(false);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
	const [activeTab, setActiveTab] = useState<ProfileTabKey>("managePods");
	const [podHistory, setPodHistory] = useState<PodActionHistoryEntry[]>([]);
	const [historyLoading, setHistoryLoading] = useState(false);
	const [historyError, setHistoryError] = useState("");
	const [selectedHistoryEntry, setSelectedHistoryEntry] = useState<PodActionHistoryEntry | null>(null);

	async function loadPodHistory() {
		setHistoryLoading(true);
		setHistoryError("");
		try {
			const response = await getMyPodHistory();
			const orderedHistory = [...(response.history || [])].sort((a, b) => {
				const aTime = new Date(a.atTime).getTime();
				const bTime = new Date(b.atTime).getTime();
				return bTime - aTime;
			});
			setPodHistory(orderedHistory);
		} catch (err: any) {
			setHistoryError(err?.message || "Failed to load pod history.");
		} finally {
			setHistoryLoading(false);
		}
	}

	useEffect(() => {
		getMe()
			.then((res) => {
				setUser(res.user);
				setForm({
					username: res.user.username || "",
					email: res.user.email || "",
					phone_number: res.user.phone_number || "",
					verificationCode: "",
				});
			})
			.catch(() => setMessage("Failed to load user info."))
			.finally(() => setLoading(false));
		void loadPodHistory();
	}, []);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setForm({ ...form, [e.target.name]: e.target.value });
	};

	const handleNewPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.name === "newPassword") setNewPassword(e.target.value);
		else setConfirmPassword(e.target.value);
	};

	const closeVerificationModal = () => {
		setVerificationModal(null);
		setVerificationCodeInput("");
		setVerificationModalError("");
		setVerificationSubmitInFlight(false);
	};

	const openVerificationModal = (mode: VerificationModalState["mode"], targetEmail: string) => {
		setVerificationModal({ mode, targetEmail });
		setVerificationCodeInput("");
		setVerificationModalError("");
	};

	const resetPasswordFlow = () => {
		setShowPasswordForm(false);
		setPasswordCode("");
		setNewPassword("");
		setConfirmPassword("");
		setPasswordResetTraceId("");
		closeVerificationModal();
	};

	const requestPasswordResetCode = async () => {
		if (!user?.email) {
			setMessage("No email is available for this account.");
			return;
		}

		const traceId = passwordResetTraceId || generateTraceId("password-reset");
		setPasswordResetTraceId(traceId);
		console.log("[Profile][PasswordReset] Step 1: Request reset submit", {
			traceId,
			targetEmail: maskEmailForLog(user.email),
		});

		setMessage("");
		setPasswordRequestInFlight(true);
		setShowPasswordForm(false);
		setPasswordCode("");
		setNewPassword("");
		setConfirmPassword("");

		try {
			console.log("[Profile][PasswordReset] Step 2: Sending reset code", {
				traceId,
				targetEmail: maskEmailForLog(user.email),
			});
			const response = await authForgotPassword({ email: user.email, traceId });
			console.log("[Profile][PasswordReset] Step 3: Reset code request succeeded", {
				traceId,
				targetEmail: maskEmailForLog(user.email),
				responseMessage: response?.message,
			});
			openVerificationModal("password", user.email);
			setMessage(response.message || "A password reset code was sent.");
		} catch (err: any) {
			console.error("[Profile][PasswordReset] Reset code request failed", {
				traceId,
				targetEmail: maskEmailForLog(user.email),
				error: err,
			});
			setMessage(err?.message || "Failed to send password reset code.");
		} finally {
			setPasswordRequestInFlight(false);
		}
	};

	const handlePasswordResetRequest = async () => {
		await requestPasswordResetCode();
	};

	const handlePasswordSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!user?.email) {
			setMessage("No email is available for this account.");
			return;
		}
		if (!/^\d{6}$/.test(passwordCode.trim())) {
			setMessage("Your verification code is invalid. Request a new code and try again.");
			setShowPasswordForm(false);
			return;
		}
		if (newPassword !== confirmPassword) {
			setMessage("New password and confirmation do not match.");
			return;
		}
		if (!isValidPassword(newPassword)) {
			setMessage(PASSWORD_REQUIREMENTS_MESSAGE);
			return;
		}

		setMessage("");
		setPasswordUpdateInFlight(true);
		console.log("[Profile][PasswordReset] Step 5: Submit new password", {
			traceId: passwordResetTraceId,
			targetEmail: maskEmailForLog(user.email),
			hasCode: Boolean(passwordCode.trim()),
		});

		try {
			const response = await authResetPassword({
				email: user.email,
				newPassword,
				token: passwordCode.trim(),
				traceId: passwordResetTraceId,
			});
			console.log("[Profile][PasswordReset] Step 6: Password reset succeeded", {
				traceId: passwordResetTraceId,
				targetEmail: maskEmailForLog(user.email),
				responseMessage: response?.message,
			});
			resetPasswordFlow();
			setMessage(response.message || "Password updated successfully.");
		} catch (err: any) {
			console.error("[Profile][PasswordReset] Password reset failed", {
				traceId: passwordResetTraceId,
				targetEmail: maskEmailForLog(user.email),
				error: err,
			});
			setMessage(err?.message || "Failed to update password.");
		} finally {
			setPasswordUpdateInFlight(false);
		}
	};

	const handleUsernameUpdate = async (e: React.FormEvent) => {
		e.preventDefault();
		setMessage("");
		try {
			await updateMyUsername({ username: form.username });
			setMessage("Username updated!");
			setUser((u) => (u ? { ...u, username: form.username } : u));
		} catch (err: any) {
			setMessage(err?.message || "Failed to update username.");
		}
	};

	const requestEmailChangeCode = async () => {
		const traceId = generateTraceId();
		console.log("[Profile][EmailChange] Step 1: Request change submit", {
			traceId,
			targetEmail: maskEmailForLog(form.email),
		});
		setMessage("");
		try {
			console.log("[Profile][EmailChange] Step 2: Sending verification code", {
				traceId,
				targetEmail: maskEmailForLog(form.email),
			});
			const response = await requestEmailChange({ newEmail: form.email, traceId });
			console.log("[Profile][EmailChange] Step 3: Verification code request succeeded", {
				traceId,
				targetEmail: maskEmailForLog(form.email),
				responseMessage: response?.message,
			});
			openVerificationModal("email", form.email);
			setMessage(response?.message || "Verification code sent to new email.");
		} catch (err: any) {
			console.error("[Profile][EmailChange] Verification code request failed", {
				traceId,
				targetEmail: maskEmailForLog(form.email),
				error: err,
			});
			setMessage(err?.message || "Failed to request email change.");
		}
	};

	const handleEmailRequest = async (e: React.FormEvent) => {
		e.preventDefault();
		await requestEmailChangeCode();
	};

	const handleVerificationCodeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setVerificationCodeInput(e.target.value);
		if (verificationModalError) setVerificationModalError("");
	};

	const handleVerificationModalSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!verificationModal) return;

		const trimmedCode = verificationCodeInput.trim();
		if (!/^\d{6}$/.test(trimmedCode)) {
			setVerificationModalError("Enter the 6-digit code sent to your email.");
			return;
		}

		setVerificationSubmitInFlight(true);
		setVerificationModalError("");
		setMessage("");

		try {
			if (verificationModal.mode === "email") {
				console.log("[Profile][EmailChange] Step 4: Verifying code from modal", {
					targetEmail: maskEmailForLog(verificationModal.targetEmail),
					hasVerificationCode: true,
				});
				await verifyAndUpdateEmail({ newEmail: verificationModal.targetEmail, verificationCode: trimmedCode });
				console.log("[Profile][EmailChange] Step 5: Email update succeeded", {
					targetEmail: maskEmailForLog(verificationModal.targetEmail),
				});
				setForm((currentForm) => ({ ...currentForm, verificationCode: trimmedCode }));
				setUser((u) => (u ? { ...u, email: verificationModal.targetEmail } : u));
				closeVerificationModal();
				setMessage("Email updated!");
				return;
			}

			console.log("[Profile][PasswordReset] Step 4: Code submit", {
				traceId: passwordResetTraceId,
				hasCode: true,
			});
			setPasswordCode(trimmedCode);
			closeVerificationModal();
			setShowPasswordForm(true);
			setMessage("Verification code accepted. Enter your new password below.");
		} catch (err: any) {
			if (verificationModal.mode === "email") {
				console.error("[Profile][EmailChange] Email verify/update failed", {
					targetEmail: maskEmailForLog(verificationModal.targetEmail),
					error: err,
				});
				setVerificationModalError(err?.message || "Failed to verify email.");
			} else {
				setVerificationModalError(err?.message || "Failed to accept verification code.");
			}
		} finally {
			setVerificationSubmitInFlight(false);
		}
	};

	const handleVerificationModalResend = async () => {
		if (!verificationModal) return;
		if (verificationModal.mode === "email") {
			await requestEmailChangeCode();
			return;
		}
		await requestPasswordResetCode();
	};

	const handlePhoneFocus = () => {
		setPhoneEditMode(true);
	};

	const handlePhoneUpdate = async (e: React.FormEvent) => {
		e.preventDefault();
		const trimmedPhone = form.phone_number.trim();

		if (!trimmedPhone) {
			setMessage("Phone number is required.");
			return;
		}

		if (trimmedPhone.length > 20 || !/^[+]?[0-9\s\-()]+$/.test(trimmedPhone)) {
			setMessage("Please enter a valid phone number.");
			return;
		}

		setMessage("");
		setPhoneUpdateInFlight(true);
		try {
			const response = await updateMyPhoneNumber({ phone_number: trimmedPhone });
			setForm((current) => ({ ...current, phone_number: trimmedPhone }));
			setUser((u) => (u ? { ...u, phone_number: trimmedPhone } : u));
			setPhoneEditMode(false);
			setMessage(response.message || "Phone number updated successfully.");
		} catch (err: any) {
			setMessage(err?.message || "Failed to update phone number.");
		} finally {
			setPhoneUpdateInFlight(false);
		}
	};

	const handleAddPod = async () => {
		setError(null);
		if (!isValidLat(newPod.latitude)) {
			setError("Latitude must be a real number between -90 and 90 with at least 3 decimal places.");
			return;
		}
		if (!isValidLong(newPod.longitude)) {
			setError("Longitude must be a real number between -180 and 180 with at least 3 decimal places.");
			return;
		}
		try {
			await registerPod({
				nickname: newPod.nickname,
				visibility: newPod.visibility,
				latitude: Number(newPod.latitude),
				longitude: Number(newPod.longitude),
			});
			setError(null);
			setShowAddModal(false);
			setNewPod({ nickname: "", visibility: "public", latitude: "", longitude: "" });
			getMe().then((res) => setUser(res.user));
			void loadPodHistory();
		} catch (err: any) {
			if (err?.response && err.response?.error) {
				setError(`Failed to add pod: ${err.response.error}`);
			} else if (err?.message) {
				setError(`Failed to add pod: ${err.message}`);
			} else {
				setError("Failed to add pod. Please check your connection or try again later.");
			}
		}
	};

	const handleViewPodData = (podId: number) => {
		navigate(`/pod/${podId}`);
	};

	const handleDeletePod = (podId: number) => {
		setError(null);
		setShowDeleteConfirm(podId);
	};

	const confirmDeletePod = async () => {
		if (showDeleteConfirm === null) return;
		try {
			await unregisterPod({ podId: String(showDeleteConfirm) });
			setError(null);
			setShowDeleteConfirm(null);
			setUser((u) => (u && u.pods ? {
				...u,
				pods: u.pods.filter((pod) => pod.id !== showDeleteConfirm),
			} : u));
			getMe().then((res) => setUser(res.user));
			void loadPodHistory();
		} catch (err: any) {
			if (err?.response && err.response?.error) {
				setError(`Failed to delete pod: ${err.response.error}`);
			} else if (err?.message) {
				setError(`Failed to delete pod: ${err.message}`);
			} else {
				setError("Failed to delete pod. Please check your connection or try again later.");
			}
		}
	};

	const handleEditPod = (pod: UserPod) => {
		setError(null);
		setEditPodId(pod.id);
		setEditPod({
			nickname: pod.name,
			visibility: pod.visibility ? "public" : "private",
			latitude: pod.lat,
			longitude: pod.long,
		});
		setShowEditConfirm(false);
	};

	const openEditConfirm = () => {
		if (!isValidLat(editPod.latitude)) {
			setError("Latitude must be a real number between -90 and 90 with at least 3 decimal places.");
			return;
		}
		if (!isValidLong(editPod.longitude)) {
			setError("Longitude must be a real number between -180 and 180 with at least 3 decimal places.");
			return;
		}
		setError(null);
		setShowEditConfirm(true);
	};

	const confirmEditPod = async () => {
		if (!isValidLat(editPod.latitude)) {
			setError("Latitude must be a real number between -90 and 90 with at least 3 decimal places.");
			setShowEditConfirm(false);
			return;
		}
		if (!isValidLong(editPod.longitude)) {
			setError("Longitude must be a real number between -180 and 180 with at least 3 decimal places.");
			setShowEditConfirm(false);
			return;
		}
		if (editPodId === null) return;

		try {
			await updatePod({
				podId: String(editPodId),
				nickname: editPod.nickname,
				visibility: editPod.visibility,
				latitude: Number(editPod.latitude),
				longitude: Number(editPod.longitude),
			});
			setError(null);
			setUser((u) => (u && u.pods ? {
				...u,
				pods: u.pods.map((pod) => (
					pod.id === editPodId
						? {
							...pod,
							name: editPod.nickname,
							visibility: editPod.visibility === "public",
							lat: editPod.latitude,
							long: editPod.longitude,
						}
						: pod
				)),
			} : u));
			setEditPodId(null);
			setEditPod({ nickname: "", visibility: "public", latitude: "", longitude: "" });
			setShowEditConfirm(false);
			getMe().then((res) => setUser(res.user));
			void loadPodHistory();
		} catch (err: any) {
			if (err?.response && err.response?.error) {
				setError(`Failed to update pod: ${err.response.error}`);
			} else if (err?.message) {
				setError(`Failed to update pod: ${err.message}`);
			} else {
				setError("Failed to update pod. Please check your connection or try again later.");
			}
			setShowEditConfirm(false);
			setEditPodId(null);
		}
	};

	return (
		<div className="profile-page-layout">
			<ProfileTabs activeTab={activeTab} onTabChange={setActiveTab} tabs={PROFILE_TABS} />
			<div className="profile-page-content-wrap">
				<div className="profile-page-main-column">
					<ProfileHeader loading={loading} user={user} />
					<div className="profile-tab-content-shell">
						{activeTab === "managePods" && (
							<ManagePodsPanel
								user={user}
								error={error}
								showAddModal={showAddModal}
								newPod={newPod}
								editPodId={editPodId}
								editPod={editPod}
								showEditConfirm={showEditConfirm}
								showDeleteConfirm={showDeleteConfirm}
								onOpenAddModal={() => {
									setError(null);
									setShowAddModal(true);
								}}
								onSetNewPod={(updater) => setNewPod((previous) => updater(previous))}
								onAddPod={handleAddPod}
								onCloseAddModal={() => {
									setError(null);
									setShowAddModal(false);
								}}
								onViewPodData={handleViewPodData}
								onEditPod={handleEditPod}
								onDeletePod={handleDeletePod}
								onSetEditPod={(updater) => setEditPod((previous) => updater(previous))}
								onOpenEditConfirm={openEditConfirm}
								onConfirmEditPod={confirmEditPod}
								onCancelEditPod={() => {
									setError(null);
									setEditPodId(null);
								}}
								onCancelEditConfirm={() => {
									setError(null);
									setShowEditConfirm(false);
									setEditPodId(null);
								}}
								onConfirmDeletePod={confirmDeletePod}
								onCancelDeletePod={() => {
									setError(null);
									setShowDeleteConfirm(null);
								}}
							/>
						)}
						{activeTab === "history" && (
							<PodHistoryPanel
								historyLoading={historyLoading}
								historyError={historyError}
								podHistory={podHistory}
								onViewDetails={setSelectedHistoryEntry}
							/>
						)}
						{activeTab === "settings" && (
							<AccountSettingsPanel
								message={message}
								form={form}
								phoneEditMode={phoneEditMode}
								phoneUpdateInFlight={phoneUpdateInFlight}
								newPassword={newPassword}
								confirmPassword={confirmPassword}
								showPasswordForm={showPasswordForm}
								passwordRequestInFlight={passwordRequestInFlight}
								passwordUpdateInFlight={passwordUpdateInFlight}
								onChange={handleChange}
								onPhoneFocus={handlePhoneFocus}
								onUsernameUpdate={handleUsernameUpdate}
								onEmailRequest={handleEmailRequest}
								onPhoneUpdate={handlePhoneUpdate}
								onPasswordResetRequest={handlePasswordResetRequest}
								onPasswordSubmit={handlePasswordSubmit}
								onNewPasswordChange={handleNewPasswordChange}
								onResetPasswordFlow={resetPasswordFlow}
							/>
						)}
						{selectedHistoryEntry && (
							<HistoryDetailsModal
								entry={selectedHistoryEntry}
								onClose={() => setSelectedHistoryEntry(null)}
							/>
						)}
						{verificationModal && (
							<VerificationModal
								verificationModal={verificationModal}
								verificationCodeInput={verificationCodeInput}
								verificationModalError={verificationModalError}
								verificationSubmitInFlight={verificationSubmitInFlight}
								passwordRequestInFlight={passwordRequestInFlight}
								onSubmit={handleVerificationModalSubmit}
								onCodeChange={handleVerificationCodeInputChange}
								onResend={handleVerificationModalResend}
								onClose={closeVerificationModal}
							/>
						)}
					</div>
				</div>
				<div className="profile-right-aside">
					<h3 className="profile-right-title">Organizations/collaborators</h3>
					<p className="profile-right-copy">Coming Soon! </p>
				</div>
			</div>
		</div>
	);
};

export default Profile;
