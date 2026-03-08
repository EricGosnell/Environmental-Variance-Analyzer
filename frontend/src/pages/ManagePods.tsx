import React, { useEffect, useState } from 'react';
import '../styles/ManagePods.css';
import { getMe, registerPod, updatePod, unregisterPod } from '../utils/api';

// Types
import type { UserPod } from '../utils/apiTypes';

const ManagePods: React.FC = () => {
	const [pods, setPods] = useState<UserPod[]>([]);
	const [loading, setLoading] = useState<boolean>(true);
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

	useEffect(() => {
		fetchPods();
	}, []);

	const fetchPods = async () => {
		setLoading(true);
		setError(null);
		try {
			const me = await getMe();
			setPods(me.user.pods || []);
		} catch (err: any) {
			if (err?.response && err.response?.error) {
				setError(`Failed to load pods: ${err.response.error}`);
			} else if (err?.message) {
				setError(`Failed to load pods: ${err.message}`);
			} else {
				setError('Failed to load pods. Please check your connection or try again later.');
			}
		} finally {
			setLoading(false);
		}
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
				nickname: newPod.nickname,
				visibility: newPod.visibility as 'public' | 'private',
				latitude: Number(newPod.latitude),
				longitude: Number(newPod.longitude),
			});
			setShowAddModal(false);
			setNewPod({ nickname: '', visibility: 'public', latitude: '', longitude: '' });
			fetchPods();
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
			fetchPods();
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
			setEditPodId(null);
			setEditPod({ nickname: '', visibility: 'public', latitude: '', longitude: '' });
			setShowEditConfirm(false);
			fetchPods();
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

	return (
		<div className="manage-pods-container">
			<h2>Manage Your Pods</h2>
			{loading ? (
				<div>Loading...</div>
			) : (
				<>
					<button className="add-pod-btn" onClick={() => setShowAddModal(true)}>Add New Pod</button>
					<table className="pods-table">
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
							{pods.map((pod) => (
								<tr key={pod.id}>
									<td>{pod.id}</td>
									<td>{pod.name}</td>
									<td>{pod.visibility ? 'public' : 'private'}</td>
									<td>{pod.lat}</td>
									<td>{pod.long}</td>
									<td>
										<button onClick={() => handleEditPod(pod)}>Edit</button>
										<button onClick={() => handleDeletePod(pod.id)}>Delete</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</>
			)}

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
	);
};

export default ManagePods;
