import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Profile.css";
import { getMe, getMyPodHistory, registerPod, updatePod, unregisterPod } from "../utils/api";
import { updateMyUsername, verifyAndUpdateEmail, requestEmailChange } from "../utils/api";
import { authForgotPassword, authResetPassword } from "../utils/api";
import type { PodActionHistoryEntry, User, UserPod } from "../utils/apiTypes";
import "../styles/ManagePods.css";

const PASSWORD_REQUIREMENTS_MESSAGE = "Password must be 8-128 characters and include at least one lowercase letter, one uppercase letter, and one number.";

function isValidPassword(password: string): boolean {
	return password.length >= 8 && password.length <= 128 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);
}

function maskEmailForLog(email: string): string {
	const trimmed = email.trim();
	const atIndex = trimmed.indexOf("@");
	if (atIndex <= 1) return "***";
	return `${trimmed[0]}***${trimmed.slice(atIndex)}`;
}

function generateTraceId(prefix = "email-change"): string {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatHistoryValue(value: string | number | null | undefined): string {
	if (value === null || value === undefined) return "none";
	if (typeof value === "number") return String(value);
	if (!String(value).trim()) return "none";
	return String(value);
}

function formatHistoryFieldLabel(field: "nickname" | "visibility" | "latitude" | "longitude"): string {
	if (field === "nickname") return "Nickname";
	if (field === "visibility") return "Visibility";
	if (field === "latitude") return "Latitude";
	return "Longitude";
}

function formatActionTypeLabel(action: "added" | "edited" | "deleted"): string {
	if (action === "added") return "Added";
	if (action === "deleted") return "Deleted";
	return "Edited";
}

type VerificationModalState = {
	mode: "email" | "password";
	targetEmail: string;
};

const Profile: React.FC = () => {
	const navigate = useNavigate();
	// Profile controls state (same order/format as Profile1)
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);
	const [form, setForm] = useState({
		username: "",
		email: "",
		phone_number: "",
		verificationCode: ""
	});
	const [phoneEditMode, setPhoneEditMode] = useState(false);
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

	// ManagePods state
	// Remove unused pods state, use user.pods directly
	const [error, setError] = useState<string | null>(null);
	const [showAddModal, setShowAddModal] = useState<boolean>(false);
	const [newPod, setNewPod] = useState({
		nickname: '',
		visibility: 'public',
		latitude: '',
		longitude: '',
	});
	const [editPodId, setEditPodId] = useState<number | null>(null);
	const [editPod, setEditPod] = useState({
		nickname: '',
		visibility: 'public',
		latitude: '',
		longitude: '',
	});
	const [showEditConfirm, setShowEditConfirm] = useState<boolean>(false);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
	const [activeTab, setActiveTab] = useState("managePods");
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
				.then(res => {
					setUser(res.user);
					setForm({
						username: res.user.username || "",
						email: res.user.email || "",
						phone_number: "", // phone_number not in User type
						verificationCode: ""
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
				setUser(u => u ? { ...u, username: form.username } : u);
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
						targetEmail: maskEmailForLog(form.email),
						hasVerificationCode: true,
					});
					await verifyAndUpdateEmail({ newEmail: form.email, verificationCode: trimmedCode });
					console.log("[Profile][EmailChange] Step 5: Email update succeeded", {
						targetEmail: maskEmailForLog(form.email),
					});
					setForm(currentForm => ({ ...currentForm, verificationCode: trimmedCode }));
					setUser(u => u ? { ...u, email: form.email } : u);
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
						targetEmail: maskEmailForLog(form.email),
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
			setMessage("");
			// Here you would call an API endpoint to update phone number, e.g. updateMyPhoneNumber
			// For now, just update local state
			setUser(u => u ? { ...u, phone_number: form.phone_number } : u);
			setMessage("Phone number updated!");
			setPhoneEditMode(false);
		};

	function isValidLat(lat: string | number): boolean {
		const latStr = typeof lat === 'number' ? lat.toFixed(6) : lat;
		const num = Number(latStr);
		if (isNaN(num)) return false;
		if (num < -90 || num > 90) return false;
		const decimals = latStr.includes('.') ? latStr.split('.')[1] : '';
		return !!decimals && decimals.length >= 3;
	}

	function isValidLong(long: string | number): boolean {
		const longStr = typeof long === 'number' ? long.toFixed(6) : long;
		const num = Number(longStr);
		if (isNaN(num)) return false;
		if (num < -180 || num > 180) return false;
		const decimals = longStr.includes('.') ? longStr.split('.')[1] : '';
		return !!decimals && decimals.length >= 3;
	}

	const handleAddPod = async () => {
		if (!isValidLat(newPod.latitude)) {
			setError('Latitude must be a real number between -90 and 90 with at least 3 decimal places.');
			return;
		}
		if (!isValidLong(newPod.longitude)) {
			setError('Longitude must be a real number between -180 and 180 with at least 3 decimal places.');
			return;
		}
		try {
			await registerPod({
				//podId: '', // no longer needed for new pod
				nickname: newPod.nickname,
				visibility: newPod.visibility as 'public' | 'private',
				latitude: Number(newPod.latitude),
				longitude: Number(newPod.longitude),
			});
			setShowAddModal(false);
			setNewPod({ nickname: '', visibility: 'public', latitude: '', longitude: '' });
			// Optimistically update user.pods for immediate UI update
			setUser(u => u && u.pods ? {
				...u,
				pods: [
					...u.pods,
					{
						id: Math.floor(Math.random() * 1000000),
						name: newPod.nickname,
						visibility: newPod.visibility === 'public',
						lat: newPod.latitude,
						long: newPod.longitude
					}
				]
			} : u);
			// Optionally, refresh from server in background
			getMe().then(res => setUser(res.user));
			void loadPodHistory();
		} catch (err: any) {
			if (err?.response && err.response?.error) {
				setError(`Failed to add pod: ${err.response.error}`);
			} else if (err?.message) {
				setError(`Failed to add pod: ${err.message}`);
			} else {
				setError('Failed to add pod. Please check your connection or try again later.');
			}
		}
	};

	const handleViewPodData = (podId: number) => {
		navigate(`/pod/${podId}`);
	};

	const handleDeletePod = (podId: number) => {
		setShowDeleteConfirm(podId);
	};

	const confirmDeletePod = async () => {
		if (showDeleteConfirm === null) return;
		try {
			await unregisterPod({ podId: String(showDeleteConfirm) });
			setShowDeleteConfirm(null);
			// Optimistically update user.pods for immediate UI update
			setUser(u => u && u.pods ? {
				...u,
				pods: u.pods.filter(pod => pod.id !== showDeleteConfirm)
			} : u);
			// Optionally, refresh from server in background
			getMe().then(res => setUser(res.user));
			void loadPodHistory();
		} catch (err: any) {
			if (err?.response && err.response?.error) {
				setError(`Failed to delete pod: ${err.response.error}`);
			} else if (err?.message) {
				setError(`Failed to delete pod: ${err.message}`);
			} else {
				setError('Failed to delete pod. Please check your connection or try again later.');
			}
		}
	};

	const handleEditPod = (pod: UserPod) => {
		setEditPodId(pod.id);
		setEditPod({
			nickname: pod.name,
			visibility: pod.visibility ? 'public' : 'private',
			latitude: pod.lat,
			longitude: pod.long,
		});
		setShowEditConfirm(false); // Always show edit form first
	};

	const openEditConfirm = () => {
		// Validate before showing confirmation
		if (!isValidLat(editPod.latitude)) {
			setError('Latitude must be a real number between -90 and 90 with at least 3 decimal places.');
			return;
		}
		if (!isValidLong(editPod.longitude)) {
			setError('Longitude must be a real number between -180 and 180 with at least 3 decimal places.');
			return;
		}
		setError(null);
		setShowEditConfirm(true);
	};

	const confirmEditPod = async () => {
		if (!isValidLat(editPod.latitude)) {
			setError('Latitude must be a real number between -90 and 90 with at least 3 decimal places.');
			setShowEditConfirm(false);
			return;
		}
		if (!isValidLong(editPod.longitude)) {
			setError('Longitude must be a real number between -180 and 180 with at least 3 decimal places.');
			setShowEditConfirm(false);
			return;
		}
		if (editPodId === null) return;
		try {
			await updatePod({
				podId: String(editPodId),
				nickname: editPod.nickname,
				visibility: editPod.visibility as 'public' | 'private',
				latitude: Number(editPod.latitude),
				longitude: Number(editPod.longitude),
			});
			// Optimistically update user.pods for immediate UI update
			setUser(u => u && u.pods ? {
				...u,
				pods: u.pods.map(pod =>
					pod.id === editPodId
						? {
							...pod,
							name: editPod.nickname,
							visibility: editPod.visibility === 'public',
							lat: editPod.latitude,
							long: editPod.longitude
						}
						: pod
				)
			} : u);
			setEditPodId(null);
			setEditPod({ nickname: '', visibility: 'public', latitude: '', longitude: '' });
			setShowEditConfirm(false);
			// Optionally, refresh from server in background
			getMe().then(res => setUser(res.user));
			void loadPodHistory();
		} catch (err: any) {
			if (err?.response && err.response?.error) {
				setError(`Failed to update pod: ${err.response.error}`);
			} else if (err?.message) {
				setError(`Failed to update pod: ${err.message}`);
			} else {
				setError('Failed to update pod. Please check your connection or try again later.');
			}
			setShowEditConfirm(false);
			setEditPodId(null);
		}
	};

	// Sidebar tab definitions
	const tabs = [
		{ key: "managePods", label: "Manage Pods" },
		{ key: "history", label: "History" },
		// { key: "Connections", label: "Connections" },
		{ key: "settings", label: "Settings" }
	];

	const selectedHistoryChanges = selectedHistoryEntry?.actionDetails?.changes ?? [];
	const selectedHistoryFlatDetails = selectedHistoryEntry?.actionDetails
		? [
			{ label: "Nickname", value: selectedHistoryEntry.actionDetails.nickname },
			{ label: "Visibility", value: selectedHistoryEntry.actionDetails.visibility },
			{ label: "Latitude", value: selectedHistoryEntry.actionDetails.latitude },
			{ label: "Longitude", value: selectedHistoryEntry.actionDetails.longitude },
		]
		: [];

	return (
		<div
			style={{
				display: "flex",
				minHeight: "100vh",
				background: "#232a27",
				padding: 24,
				gap: 24,
				boxSizing: "border-box"
			}}
		>
			{/* Sidebar Tabs */}
			<div style={{ width: 220, background: "#204835", padding: "32px 0", borderRadius: 16, flexShrink: 0 }}>
				<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
					{tabs.map(tab => (
						<button
							key={tab.key}
							className="btn"
							style={{
								background: activeTab === tab.key ? "#30A46C" : "#204835",
								color: "#fff",
								border: "none",
								borderRadius: 8,
								padding: "12px 0",
								fontWeight: 600,
								fontSize: "1.1rem",
								margin: "4px 16px",
								cursor: "pointer"
							}}
							onClick={() => setActiveTab(tab.key)}
						>
							{tab.label}
						</button>
					))}
				</div>
			</div>

			{/* Main Content and Right Container */}
			<div style={{ display: "flex", flex: 1, minWidth: 0, gap: 24 }}>
				{/* Main Content - left justified */}
				<div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "stretch", minWidth: 0 }}>
					{/* ...existing code... */}
					{/* User Info Container */}
					<div
						className="profile-header"
						style={{
							flexDirection: "column",
							alignItems: "flex-start",
							marginBottom: 16,
							background: "var(--secondary-green)",
							borderRadius: 16,
							padding: "16px 20px",
							width: "100%",
							color: "#fff"
						}}
					>
						{loading ? (
							<div>Loading...</div>
						) : user ? (
							<>
								<h2 style={{ fontSize: "2rem", marginBottom: 4, textAlign: "left" }}>Hello, {user.username}</h2>
								<div style={{ fontSize: "1.1rem", color: "#fff", marginBottom: 2, textAlign: "left" }}>Organization: University of Colorado Boulder</div>
								<div style={{ fontSize: "1.1rem", color: "#fff", marginBottom: 2, textAlign: "left" }}> {user.email}</div>
								<div style={{ fontSize: "1rem", color: "#ccc", marginBottom: 0, textAlign: "left" }}>Standard Account</div>
							</>
						) : (
							<div>Failed to load user info.</div>
						)}
					</div>

					{/* Main Tab Content */}
					<div style={{ width: "100%", minWidth: 0 }}>
						{/* ...existing code... */}
						{/* ...existing code... */}
						{/* Manage Pods: show pod information */}
						{activeTab === "managePods" && (
							<div className="manage-pods-container" style={{ width: "100%", background: "#204835", borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.08)", padding: "24px 16px", color: "#fff", marginLeft: 0, boxSizing: "border-box" }}>
								<h3 style={{ marginBottom: 24 }}>Your Pods</h3>
								<button className="add-pod-btn" style={{ marginBottom: 18 }} onClick={() => setShowAddModal(true)}>Add New Pod</button>
								<table className="pods-table" style={{ width: "100%", borderCollapse: "collapse" }}>
									<thead>
										<tr>
											<th>ID</th>
											<th>Name</th>
											<th>Visibility</th>
											<th>Latitude</th>
											<th>Longitude</th>
											<th>Actions</th>
										</tr>
									</thead>
									<tbody>
										{user && user.pods && user.pods.length > 0 ? (
											user.pods.map((pod) => (
												<tr key={pod.id}>
													<td>{pod.id}</td>
													<td>{pod.name}</td>
													<td>{pod.visibility ? 'public' : 'private'}</td>
													<td>{pod.lat}</td>
													<td>{pod.long}</td>
													<td>
														<button className="btn" style={{ marginRight: 8 }} onClick={() => handleViewPodData(pod.id)}>View Full Data</button>
														<button className="btn" style={{ marginRight: 8 }} onClick={() => handleEditPod(pod)}>Edit</button>
														<button className="btn" onClick={() => handleDeletePod(pod.id)}>Delete</button>
													</td>
												</tr>
											))
										) : (
											<tr><td colSpan={6}>No pods found.</td></tr>
										)}
									</tbody>
								</table>
								{/* Add Pod Modal */}
								{showAddModal && (
									<div className="modal">
										<form className="pod-form">
											<h3>Add New Pod</h3>
											{error && <div className="error">{error}</div>}
											<label>
												Name
												<input
													type="text"
													placeholder="Name"
													value={newPod.nickname}
													onChange={e => setNewPod({ ...newPod, nickname: e.target.value })}
												/>
											</label>
											<label>
												Visibility
												<select
													value={newPod.visibility}
													onChange={e => setNewPod({ ...newPod, visibility: e.target.value })}
												>
													<option value="public">Public</option>
													<option value="private">Private</option>
												</select>
											</label>
											<label>
												Latitude
												<input
													type="text"
													placeholder="Latitude"
													value={newPod.latitude}
													onChange={e => setNewPod({ ...newPod, latitude: e.target.value })}
												/>
											</label>
											<label>
												Longitude
												<input
													type="text"
													placeholder="Longitude"
													value={newPod.longitude}
													onChange={e => setNewPod({ ...newPod, longitude: e.target.value })}
												/>
											</label>
											<div className="form-actions">
												<button type="button" className="primary-btn" onClick={handleAddPod}>Add Pod</button>
												<button type="button" onClick={() => setShowAddModal(false)}>Cancel</button>
											</div>
										</form>
									</div>
								)}
								{/* Edit Pod Confirmation Modal */}
								{showEditConfirm && editPodId !== null && (
									<div className="modal">
										<div className="pod-form">
											<h3>Confirm Edit</h3>
											{error && <div className="error">{error}</div>}
											<p>Are you sure you want to update this pod's information?</p>
											<div className="form-actions">
												<button type="button" className="primary-btn" onClick={confirmEditPod}>Yes, Update</button>
												<button type="button" onClick={() => { setShowEditConfirm(false); setEditPodId(null); }}>Cancel</button>
											</div>
										</div>
									</div>
								)}
								{/* Edit Pod Modal */}
								{editPodId !== null && !showEditConfirm && (
									<div className="modal">
										<form className="pod-form">
											<h3>Edit Pod</h3>
											{error && <div className="error">{error}</div>}
											<label>
												Nickname
												<input
													type="text"
													placeholder="Nickname"
													value={editPod.nickname}
													onChange={e => setEditPod({ ...editPod, nickname: e.target.value })}
												/>
											</label>
											<label>
												Visibility
												<select
													value={editPod.visibility}
													onChange={e => setEditPod({ ...editPod, visibility: e.target.value })}
												>
													<option value="public">Public</option>
													<option value="private">Private</option>
												</select>
											</label>
											<label>
												Latitude
												<input
													type="text"
													placeholder="Latitude"
													value={editPod.latitude}
													onChange={e => setEditPod({ ...editPod, latitude: e.target.value })}
												/>
											</label>
											<label>
												Longitude
												<input
													type="text"
													placeholder="Longitude"
													value={editPod.longitude}
													onChange={e => setEditPod({ ...editPod, longitude: e.target.value })}
												/>
											</label>
											<div className="form-actions">
												<button type="button" className="primary-btn" onClick={openEditConfirm}>Update Pod</button>
												<button type="button" onClick={() => setEditPodId(null)}>Cancel</button>
											</div>
										</form>
									</div>
								)}
								{/* Delete Pod Confirmation Modal */}
								{showDeleteConfirm !== null && (
									<div className="modal">
										<div className="pod-form">
											<h3>Confirm Delete</h3>
											{error && <div className="error">{error}</div>}
											<p>Are you sure you want to delete this pod? This action cannot be undone.</p>
											<div className="form-actions">
												<button type="button" className="primary-btn" onClick={confirmDeletePod}>Yes, Delete</button>
												<button type="button" onClick={() => setShowDeleteConfirm(null)}>Cancel</button>
											</div>
										</div>
									</div>
								)}
							</div>
						)}
						{activeTab === "history" && (
							<div className="manage-pods-container" style={{ width: "100%", background: "#204835", borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.08)", padding: "24px 16px", color: "#fff", marginLeft: 0, boxSizing: "border-box" }}>
								<h3 style={{ marginBottom: 24 }}>Pod Action History</h3>
								{historyLoading ? (
									<div>Loading history...</div>
								) : historyError ? (
									<div className="error">{historyError}</div>
								) : (
									<table className="pods-table" style={{ width: "100%", borderCollapse: "collapse" }}>
										<thead>
											<tr>
												<th>POD</th>
												<th>ACTION</th>
												<th>by USER</th>
												<th>TIME</th>
											</tr>
										</thead>
										<tbody>
											{podHistory.length > 0 ? (
												podHistory.map((entry) => (
													<tr key={entry.id}>
														<td>{entry.podName} ({entry.podId})</td>
														<td>
															<button
																type="button"
																className="btn"
																style={{ padding: "6px 12px", fontSize: "0.9rem" }}
																onClick={() => setSelectedHistoryEntry(entry)}
															>
																View Details
															</button>
														</td>
														<td>{entry.byUser.username}</td>
														<td>{new Date(entry.atTime).toLocaleString()}</td>
													</tr>
												))
											) : (
												<tr><td colSpan={4}>No pod actions recorded yet.</td></tr>
											)}
										</tbody>
									</table>
								)}
							</div>
						)}
						{/* Connections tab commented out - To be added later... hopefully */}
						{/* activeTab === "Connections" && (
							<div style={{ width: "100%", background: "#204835", borderRadius: 16, padding: "16px 20px", color: "#fff", boxSizing: "border-box" }}>
								<h3>Tab for inviting collaborators or organizations/receiving invitations</h3>
							</div>
						) */}
						{activeTab === "settings" && (
							<div style={{ width: "100%", background: "#204835", borderRadius: 16, padding: "32px 40px", color: "#fff", minWidth: 0, marginLeft: 0, boxSizing: "border-box" }}>
								<h3 style={{ marginBottom: 24 }}>Account Settings</h3>
								{message && <div className="profile-message">{message}</div>}
								<div className="profile-controls-container" style={{ width: "100%", maxWidth: 760, marginBottom: 16 }}>
									<form className="profile-form" onSubmit={handleUsernameUpdate} style={{ marginBottom: 12, display: "grid", gridTemplateColumns: "220px minmax(0, 1fr) minmax(220px, 1fr)", columnGap: 24, alignItems: "center", width: "100%", background: "var(--primary-green)", borderRadius: 16, padding: "14px 16px", boxSizing: "border-box" }}>
										<label htmlFor="profile-username" style={{ whiteSpace: "nowrap" }}>Change Username:</label>
										<input
											id="profile-username"
											type="text"
											name="username"
											value={form.username}
											onChange={handleChange}
											className=""
											style={{ width: "100%", marginTop: 0, padding: "12px 14px", border: '1px solid #30A46C', borderRadius: 16, fontSize: '1rem', background: '#204835', color: '#fff', boxSizing: "border-box" }}
										/>
										<button className="btn" type="submit" style={{ width: "100%", minWidth: 0, marginLeft: 0, marginRight: 0, padding: "12px 24px" }}>Update Username</button>
									</form>
									<form className="profile-form" onSubmit={handleEmailRequest} style={{ marginBottom: 12, display: "grid", gridTemplateColumns: "220px minmax(0, 1fr) minmax(220px, 1fr)", columnGap: 24, alignItems: "center", width: "100%", background: "var(--primary-green)", borderRadius: 16, padding: "14px 16px", boxSizing: "border-box" }}>
										<label htmlFor="profile-email" style={{ whiteSpace: "nowrap" }}>Change Email:</label>
										<input
											id="profile-email"
											type="email"
											name="email"
											value={form.email}
											onChange={handleChange}
											className=""
											style={{ width: "100%", marginTop: 0, padding: "12px 14px", border: '1px solid #30A46C', borderRadius: 16, fontSize: '1rem', background: '#204835', color: '#fff', boxSizing: "border-box" }}
										/>
										<button className="btn" type="submit" style={{ width: "100%", minWidth: 0, marginLeft: 0, marginRight: 0, padding: "12px 24px" }}>Request Email Change</button>
									</form>
									<form className="profile-form" onSubmit={handlePhoneUpdate} style={{ marginBottom: 12, display: "grid", gridTemplateColumns: "220px minmax(0, 1fr) minmax(220px, 1fr)", columnGap: 24, alignItems: "center", width: "100%", background: "var(--primary-green)", borderRadius: 16, padding: "14px 16px", boxSizing: "border-box" }}>
										<label htmlFor="profile-phone" style={{ whiteSpace: "nowrap" }}>Change Phone Number:</label>
										<input
											id="profile-phone"
												type="text"
												name="phone_number"
												value={phoneEditMode ? form.phone_number : (() => {
													const phone = form.phone_number || "";
													const digits = phone.replace(/\D/g, "");
													if (digits.length === 10) {
														return `***-${digits.slice(3,6)}-${digits.slice(6,10)}`;
													} else if (digits.length === 7) {
														return `***-${digits.slice(0,3)}-${digits.slice(3,7)}`;
													} else {
														return "***-" + phone;
													}
												})()}
												onChange={handleChange}
												onFocus={handlePhoneFocus}
												disabled={!phoneEditMode ? false : undefined}
												className=""
												style={{ width: "100%", marginRight: 0, marginTop: 0, padding: "12px 14px", border: '1px solid #30A46C', borderRadius: 16, fontSize: '1rem', background: '#204835', color: '#fff', boxSizing: "border-box" }}
											/> 
										<button className="btn" type="submit" style={{ width: "100%", minWidth: 0, marginLeft: 0, marginRight: 0, padding: "12px 24px" }}>Update Phone Number</button>
									</form>
								</div>

								{/* Change Password Container */}
								<div className="profile-controls-container" style={{ width: "100%", maxWidth: 760, marginBottom: 16 }}>
									<button className="btn" type="button" style={{ marginBottom: 12, width: 280, minWidth: 240, padding: "12px 24px" }} onClick={handlePasswordResetRequest} disabled={passwordRequestInFlight || passwordUpdateInFlight}>
										{passwordRequestInFlight ? "Sending Code..." : "Change Password"}
									</button>
									{showPasswordForm && (
										<form className="profile-form" onSubmit={handlePasswordSubmit} style={{ marginBottom: 8 }}>
											<p>Enter your new password to complete the reset.</p>
											<label>New Password:
												<input
													type="password"
													name="newPassword"
													value={newPassword}
													onChange={handleNewPasswordChange}
													autoFocus
													className=""
													style={{ marginTop: 6, padding: 8, border: '1px solid #30A46C', borderRadius: 16, fontSize: '1rem', background: '#204835', color: '#fff' }}
												/> 
											</label>
											<label>Re-enter New Password:
												<input
													type="password"
													name="confirmPassword"
													value={confirmPassword}
													onChange={handleNewPasswordChange}
													className=""
													style={{ marginTop: 6, padding: 8, border: '1px solid #30A46C', borderRadius: 16, fontSize: '1rem', background: '#204835', color: '#fff' }}
												/> 
											</label>
											<p style={{ color: "#ccc", fontSize: "0.95rem", marginTop: 4 }}>{PASSWORD_REQUIREMENTS_MESSAGE}</p>
											<div style={{ display: "flex", gap: 20, marginTop: 16 }}>
												<button className="btn" type="submit" style={{ minWidth: 200, padding: "12px 24px" }} disabled={passwordUpdateInFlight || passwordRequestInFlight}>
													{passwordUpdateInFlight ? "Updating Password..." : "Update Password"}
												</button>
												<button className="btn" type="button" style={{ minWidth: 160, padding: "12px 24px" }} onClick={handlePasswordResetRequest} disabled={passwordUpdateInFlight || passwordRequestInFlight}>
													{passwordRequestInFlight ? "Sending Code..." : "Use New Code"}
												</button>
												<button className="btn" type="button" style={{ minWidth: 160, padding: "12px 24px" }} onClick={resetPasswordFlow} disabled={passwordUpdateInFlight || passwordRequestInFlight}>
													Cancel
												</button>
											</div>
										</form>
									)}
								</div>
							</div>
						)}
						{selectedHistoryEntry && (
							<div className="modal">
								<div className="pod-form" style={{ maxWidth: 700, width: "100%" }}>
									<h3 style={{ marginBottom: 14 }}>{formatActionTypeLabel(selectedHistoryEntry.action)}</h3>
									{selectedHistoryEntry.action === "edited" ? (
										selectedHistoryChanges.length > 0 ? (
										<table className="pods-table" style={{ width: "100%", borderCollapse: "collapse", marginBottom: 14 }}>
											<thead>
												<tr>
													<th>FIELD</th>
													<th>FROM</th>
													<th>TO</th>
												</tr>
											</thead>
											<tbody>
												{selectedHistoryChanges.map((change, index) => (
													<tr key={`${change.field}-${index}`}>
														<td>{formatHistoryFieldLabel(change.field)}</td>
														<td>{formatHistoryValue(change.from)}</td>
														<td>{formatHistoryValue(change.to)}</td>
													</tr>
												))}
											</tbody>
										</table>
										) : (
										<p style={{ marginBottom: 14 }}>No detailed edit changes were recorded for this event.</p>
										)
									) : selectedHistoryEntry.action === "added" ? (
										<>
											<table className="pods-table" style={{ width: "100%", borderCollapse: "collapse", marginBottom: 14 }}>
												<thead>
													<tr>
														<th>FIELD</th>
														<th>VALUE</th>
													</tr>
												</thead>
												<tbody>
													{selectedHistoryFlatDetails.map((detail) => (
														<tr key={detail.label}>
															<td>{detail.label}</td>
															<td>{formatHistoryValue(detail.value as string | number | null | undefined)}</td>
														</tr>
													))}
												</tbody>
											</table>
										</>
									) : (
										<>
											<table className="pods-table" style={{ width: "100%", borderCollapse: "collapse", marginBottom: 14 }}>
												<thead>
													<tr>
														<th>FIELD</th>
														<th>VALUE</th>
													</tr>
												</thead>
												<tbody>
													{selectedHistoryFlatDetails.map((detail) => (
														<tr key={detail.label}>
															<td>{detail.label}</td>
															<td>{formatHistoryValue(detail.value as string | number | null | undefined)}</td>
														</tr>
													))}
												</tbody>
											</table>
										</>
									)}
									<div className="form-actions">
										<button type="button" className="primary-btn" onClick={() => setSelectedHistoryEntry(null)}>
											Close
										</button>
									</div>
								</div>
							</div>
						)}
						{verificationModal && (
							<div className="modal">
								<form className="pod-form profile-verification-modal" onSubmit={handleVerificationModalSubmit}>
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
											onChange={handleVerificationCodeInputChange}
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
										<button type="button" onClick={handleVerificationModalResend} disabled={passwordRequestInFlight || verificationSubmitInFlight}>
											{passwordRequestInFlight ? "Sending Code..." : "Send New Code"}
										</button>
										<button type="button" onClick={closeVerificationModal} disabled={verificationSubmitInFlight}>
											Cancel
										</button>
									</div>
								</form>
							</div>
						)}
					</div>
				</div>

				{/* New Right Container */}
				<div style={{ width: 280, background: "#204835", borderRadius: 16, padding: "32px 24px", color: "#fff", display: "flex", flexDirection: "column", alignItems: "flex-start", flexShrink: 0, boxSizing: "border-box" }}>
					<h3 style={{ marginBottom: 16 }}>Organizations/collaborators</h3>
					<p style={{ color: "#ccc", fontSize: "1rem" }}>Coming Soon! </p>
				</div>
			</div>
		</div>
	);
};

export default Profile;
