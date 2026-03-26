 import React, { useEffect, useState } from "react";
import "../styles/Profile.css";
import { getMe, registerPod, updatePod, unregisterPod } from "../utils/api";
import { updateMyUsername, verifyAndUpdateEmail, requestEmailChange } from "../utils/api";
import { authForgotPassword, authResetPassword } from "../utils/api";
import type { User, UserPod } from "../utils/apiTypes";
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

const Profile: React.FC = () => {
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
	const [emailChangeRequested, setEmailChangeRequested] = useState(false);
	const [message, setMessage] = useState("");
	const [showPasswordCodeForm, setShowPasswordCodeForm] = useState(false);
	const [showPasswordForm, setShowPasswordForm] = useState(false);
	const [passwordCode, setPasswordCode] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [passwordRequestInFlight, setPasswordRequestInFlight] = useState(false);
	const [passwordUpdateInFlight, setPasswordUpdateInFlight] = useState(false);

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
		}, []);

		const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
			setForm({ ...form, [e.target.name]: e.target.value });
		};

		const handlePasswordCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
			setPasswordCode(e.target.value);
		};

		const handleNewPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
			if (e.target.name === "newPassword") setNewPassword(e.target.value);
			else setConfirmPassword(e.target.value);
		};

		const resetPasswordFlow = () => {
			setShowPasswordCodeForm(false);
			setShowPasswordForm(false);
			setPasswordCode("");
			setNewPassword("");
			setConfirmPassword("");
		};

		const handlePasswordResetRequest = async () => {
			if (!user?.email) {
				setMessage("No email is available for this account.");
				return;
			}

			setMessage("");
			setPasswordRequestInFlight(true);
			setShowPasswordForm(false);
			setPasswordCode("");
			setNewPassword("");
			setConfirmPassword("");

			try {
				const response = await authForgotPassword({ email: user.email });
				setShowPasswordCodeForm(true);
				setMessage(response.message || "If the email exists, a password reset code was sent.");
			} catch (err: any) {
				setMessage(err?.message || "Failed to send password reset code.");
			} finally {
				setPasswordRequestInFlight(false);
			}
		};

		const handlePasswordCodeSubmit = (e: React.FormEvent) => {
			e.preventDefault();
			if (!/^\d{6}$/.test(passwordCode.trim())) {
				setMessage("Enter the 6-digit code sent to your email.");
				return;
			}

			setMessage("");
			setShowPasswordCodeForm(false);
			setShowPasswordForm(true);
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
				setShowPasswordCodeForm(true);
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

			try {
				const response = await authResetPassword({
					email: user.email,
					newPassword,
					token: passwordCode.trim(),
				});
				resetPasswordFlow();
				setMessage(response.message || "Password updated successfully.");
			} catch (err: any) {
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

		const handleEmailRequest = async (e: React.FormEvent) => {
			e.preventDefault();
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
				await requestEmailChange({ newEmail: form.email, traceId });
				console.log("[Profile][EmailChange] Step 3: Verification code request succeeded", {
					traceId,
					targetEmail: maskEmailForLog(form.email),
				});
				setEmailChangeRequested(true);
				setMessage("Verification code sent to new email.");
			} catch (err: any) {
				console.error("[Profile][EmailChange] Verification code request failed", {
					traceId,
					targetEmail: maskEmailForLog(form.email),
					error: err,
				});
				setMessage(err?.message || "Failed to request email change.");
			}
		};

		const handleEmailVerify = async (e: React.FormEvent) => {
			e.preventDefault();
			console.log("[Profile][EmailChange] Step 4: Verify code submit", {
				targetEmail: maskEmailForLog(form.email),
				hasVerificationCode: Boolean(form.verificationCode?.trim()),
			});
			setMessage("");
			try {
				console.log("[Profile][EmailChange] Step 5: Calling verify/update email API", {
					targetEmail: maskEmailForLog(form.email),
				});
				await verifyAndUpdateEmail({ newEmail: form.email, verificationCode: form.verificationCode });
				console.log("[Profile][EmailChange] Step 6: Email update succeeded", {
					targetEmail: maskEmailForLog(form.email),
				});
				setMessage("Email updated!");
				setUser(u => u ? { ...u, email: form.email } : u);
				setEmailChangeRequested(false);
			} catch (err: any) {
				console.error("[Profile][EmailChange] Email verify/update failed", {
					targetEmail: maskEmailForLog(form.email),
					error: err,
				});
				setMessage(err?.message || "Failed to verify email.");
			}
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
				podId: '', // not needed for new pod
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
		{ key: "Connections", label: "Connections" },
		{ key: "settings", label: "Settings" }
	];

	return (
		<div style={{ display: "flex", minHeight: "100vh", background: "#232a27" }}>
			{/* Sidebar Tabs */}
			<div style={{ minWidth: 220, background: "#204835", padding: "32px 0", borderRadius: 16, margin: 24 }}>
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
			<div style={{ display: "flex", flex: 1, margin: "24px 0 24px 0", maxWidth: 1400, width: "150%" }}>
				{/* Main Content - left justified */}
				<div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 900, maxWidth: 1100 }}>
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
							maxWidth: 600,
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
					<div style={{ width: "100%", maxWidth: 600 }}>
						{/* ...existing code... */}
						{/* ...existing code... */}
						{/* Manage Pods: show pod information */}
						{activeTab === "managePods" && (
							<div className="manage-pods-container" style={{ maxWidth: 600, background: "#204835", borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.08)", padding: "24px 16px", color: "#fff", marginLeft: 0 }}>
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
						{activeTab === "Connections" && (
							<div style={{ background: "#204835", borderRadius: 16, padding: "16px 20px", color: "#fff" }}>
								<h3>Tab for inviting collaborators or organizations/receiving invitations</h3>
							</div>
						)}
						{activeTab === "settings" && (
							<div style={{ background: "#204835", borderRadius: 16, padding: "32px 40px", color: "#fff", maxWidth: 900, minWidth: 600, marginLeft: 0 }}>
								<h3 style={{ marginBottom: 24 }}>Account Settings</h3>
								{message && <div className="profile-message">{message}</div>}
								<div className="profile-controls-container" style={{ maxWidth: 420, marginBottom: 16 }}>
									<form className="profile-form" onSubmit={handleUsernameUpdate} style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 24 }}>
										<div style={{ display: "flex", alignItems: "center", flex: 1 }}>
											<label style={{ marginRight: 8, minWidth: 120 }}>Change Username:</label>
											<input
												type="text"
												name="username"
												value={form.username}
												onChange={handleChange}
												className=""
												style={{ width: 220, minWidth: 180, marginRight: 0, marginTop: 6, padding: 8, border: '1px solid #30A46C', borderRadius: 16, fontSize: '1rem', background: '#204835', color: '#fff' }}
											/> 
										</div>
										<button className="btn" type="submit" style={{ width: 180, minWidth: 160, marginLeft: 24, marginRight: 24 }}>Update Username</button>
									</form>
									<form className="profile-form" onSubmit={handleEmailRequest} style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 24 }}>
										<div style={{ display: "flex", alignItems: "center", flex: 1 }}>
											<label style={{ marginRight: 8, minWidth: 120 }}>Change Email:</label>
											<input
												type="email"
												name="email"
												value={form.email}
												onChange={handleChange}
												className=""
												style={{ width: 220, minWidth: 180, marginRight: 0, marginTop: 6, padding: 8, border: '1px solid #30A46C', borderRadius: 16, fontSize: '1rem', background: '#204835', color: '#fff' }}
											/> 
										</div>
										<button className="btn" type="submit" style={{ width: 180, minWidth: 160, marginLeft: 24, marginRight: 24 }}>Request Email Change</button>
									</form>
									{emailChangeRequested && (
										<form className="profile-form" onSubmit={handleEmailVerify} style={{ marginBottom: 8 }}>
											<label>Verification Code:
												<input
													type="text"
													name="verificationCode"
													value={form.verificationCode}
													onChange={handleChange}
													className=""
													style={{ marginTop: 6, padding: 8, border: '1px solid #30A46C', borderRadius: 16, fontSize: '1rem', background: '#204835', color: '#fff' }}
												/> 
											</label>
											<button className="btn" type="submit">Verify & Update Email</button>
										</form>
									)}
									<form className="profile-form" onSubmit={handlePhoneUpdate} style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 24 }}>
										<div style={{ display: "flex", alignItems: "center", flex: 1 }}>
											<label style={{ marginRight: 8, minWidth: 120 }}>Change Phone Number:</label>
											<input
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
												style={{ width: 220, minWidth: 180, marginRight: 0, marginTop: 6, padding: 8, border: '1px solid #30A46C', borderRadius: 16, fontSize: '1rem', background: '#204835', color: '#fff' }}
											/> 
										</div>
										<button className="btn" type="submit" style={{ width: 180, minWidth: 160, marginLeft: 24, marginRight: 24 }}>Update Phone Number</button>
									</form>
								</div>

								{/* Change Password Container */}
								<div className="profile-controls-container" style={{ maxWidth: 420, marginBottom: 16 }}>
									<button className="btn" type="button" style={{ marginBottom: 8 }} onClick={handlePasswordResetRequest} disabled={passwordRequestInFlight || passwordUpdateInFlight}>
										{passwordRequestInFlight ? "Sending Code..." : "Change Password"}
									</button>
									{showPasswordCodeForm && (
										<form className="profile-form" onSubmit={handlePasswordCodeSubmit} style={{ marginBottom: 8 }}>
											<p>A 6-digit password reset code was sent to {user?.email}.</p>
											<label>Enter 6-digit code sent to your email:
												<input
													type="text"
													name="passwordCode"
													value={passwordCode}
													onChange={handlePasswordCodeChange}
													maxLength={6}
													pattern="\d{6}"
													autoFocus
													className=""
													style={{ marginTop: 6, padding: 8, border: '1px solid #30A46C', borderRadius: 16, fontSize: '1rem', background: '#204835', color: '#fff' }}
												/> 
											</label>
											<div style={{ display: "flex", gap: 12, marginTop: 12 }}>
												<button className="btn" type="submit">Continue</button>
												<button className="btn" type="button" onClick={handlePasswordResetRequest} disabled={passwordRequestInFlight || passwordUpdateInFlight}>
													{passwordRequestInFlight ? "Sending Code..." : "Resend Code"}
												</button>
												<button className="btn" type="button" onClick={resetPasswordFlow} disabled={passwordRequestInFlight || passwordUpdateInFlight}>
													Cancel
												</button>
											</div>
										</form>
									)}
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
											<div style={{ display: "flex", gap: 12, marginTop: 12 }}>
												<button className="btn" type="submit" disabled={passwordUpdateInFlight || passwordRequestInFlight}>
													{passwordUpdateInFlight ? "Updating Password..." : "Update Password"}
												</button>
												<button className="btn" type="button" onClick={() => {
													setShowPasswordForm(false);
													setShowPasswordCodeForm(true);
												}} disabled={passwordUpdateInFlight || passwordRequestInFlight}>
													Back
												</button>
												<button className="btn" type="button" onClick={resetPasswordFlow} disabled={passwordUpdateInFlight || passwordRequestInFlight}>
													Cancel
												</button>
											</div>
										</form>
									)}
								</div>
							</div>
						)}
					</div>
				</div>

				{/* New Right Container */}
				<div style={{ minWidth: 260, maxWidth: 320, marginLeft: 32, marginRight: 32,  background: "#204835", borderRadius: 16, padding: "32px 24px", color: "#fff", display: "flex", flexDirection: "column", alignItems: "flex-start", height: "100vh" }}>
					<h3 style={{ marginBottom: 16 }}>Possible room for Organizations/collaborators</h3>
					<p style={{ color: "#ccc", fontSize: "1rem" }}>Space that could be used for organizations, friends, or other additonal features in the future.</p>
				</div>
			</div>
		</div>
	);
};

export default Profile;
