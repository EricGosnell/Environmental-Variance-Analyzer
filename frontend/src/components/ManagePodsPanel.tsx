import type { User, UserPod } from "../utils/apiTypes";
import type { PodDraftState } from "../utils/profileTypes";

type ManagePodsPanelProps = {
	user: User | null;
	error: string | null;
	showAddModal: boolean;
	newPod: PodDraftState;
	editPodId: number | null;
	editPod: PodDraftState;
	showEditConfirm: boolean;
	showDeleteConfirm: number | null;
	onOpenAddModal: () => void;
	onSetNewPod: (updater: (previous: PodDraftState) => PodDraftState) => void;
	onAddPod: () => void;
	onCloseAddModal: () => void;
	onViewPodData: (podId: number) => void;
	onEditPod: (pod: UserPod) => void;
	onDeletePod: (podId: number) => void;
	onSetEditPod: (updater: (previous: PodDraftState) => PodDraftState) => void;
	onOpenEditConfirm: () => void;
	onConfirmEditPod: () => void;
	onCancelEditPod: () => void;
	onCancelEditConfirm: () => void;
	onConfirmDeletePod: () => void;
	onCancelDeletePod: () => void;
};

const ManagePodsPanel = ({
	user,
	error,
	showAddModal,
	newPod,
	editPodId,
	editPod,
	showEditConfirm,
	showDeleteConfirm,
	onOpenAddModal,
	onSetNewPod,
	onAddPod,
	onCloseAddModal,
	onViewPodData,
	onEditPod,
	onDeletePod,
	onSetEditPod,
	onOpenEditConfirm,
	onConfirmEditPod,
	onCancelEditPod,
	onCancelEditConfirm,
	onConfirmDeletePod,
	onCancelDeletePod,
}: ManagePodsPanelProps) => {
	return (
		<div className="manage-pods-container profile-panel-container">
			<h3 className="profile-section-title">Your Pods</h3>
			<button className="add-pod-btn" onClick={onOpenAddModal}>Add New Pod</button>
			<table className="pods-table profile-pods-table">
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
					{user?.pods && user.pods.length > 0 ? (
						user.pods.map((pod) => (
							<tr key={pod.id}>
								<td>{pod.id}</td>
								<td>{pod.name}</td>
								<td>{pod.visibility ? "public" : "private"}</td>
								<td>{pod.lat}</td>
								<td>{pod.long}</td>
								<td>
									<button className="btn profile-inline-action-btn" onClick={() => onViewPodData(pod.id)}>View Full Data</button>
									<button className="btn profile-inline-action-btn" onClick={() => onEditPod(pod)}>Edit</button>
									<button className="btn" onClick={() => onDeletePod(pod.id)}>Delete</button>
								</td>
							</tr>
						))
					) : (
						<tr><td colSpan={6}>No pods found.</td></tr>
					)}
				</tbody>
			</table>

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
								onChange={(e) => onSetNewPod((previous) => ({ ...previous, nickname: e.target.value }))}
							/>
						</label>
						<label>
							Visibility
							<select
								value={newPod.visibility}
								onChange={(e) => onSetNewPod((previous) => ({ ...previous, visibility: e.target.value as "public" | "private" }))}
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
								onChange={(e) => onSetNewPod((previous) => ({ ...previous, latitude: e.target.value }))}
							/>
						</label>
						<label>
							Longitude
							<input
								type="text"
								placeholder="Longitude"
								value={newPod.longitude}
								onChange={(e) => onSetNewPod((previous) => ({ ...previous, longitude: e.target.value }))}
							/>
						</label>
						<div className="form-actions">
							<button type="button" className="primary-btn" onClick={onAddPod}>Add Pod</button>
							<button type="button" onClick={onCloseAddModal}>Cancel</button>
						</div>
					</form>
				</div>
			)}

			{showEditConfirm && editPodId !== null && (
				<div className="modal">
					<div className="pod-form">
						<h3>Confirm Edit</h3>
						{error && <div className="error">{error}</div>}
						<p>Are you sure you want to update this pod's information?</p>
						<div className="form-actions">
							<button type="button" className="primary-btn" onClick={onConfirmEditPod}>Yes, Update</button>
							<button type="button" onClick={onCancelEditConfirm}>Cancel</button>
						</div>
					</div>
				</div>
			)}

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
								onChange={(e) => onSetEditPod((previous) => ({ ...previous, nickname: e.target.value }))}
							/>
						</label>
						<label>
							Visibility
							<select
								value={editPod.visibility}
								onChange={(e) => onSetEditPod((previous) => ({ ...previous, visibility: e.target.value as "public" | "private" }))}
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
								onChange={(e) => onSetEditPod((previous) => ({ ...previous, latitude: e.target.value }))}
							/>
						</label>
						<label>
							Longitude
							<input
								type="text"
								placeholder="Longitude"
								value={editPod.longitude}
								onChange={(e) => onSetEditPod((previous) => ({ ...previous, longitude: e.target.value }))}
							/>
						</label>
						<div className="form-actions">
							<button type="button" className="primary-btn" onClick={onOpenEditConfirm}>Update Pod</button>
							<button type="button" onClick={onCancelEditPod}>Cancel</button>
						</div>
					</form>
				</div>
			)}

			{showDeleteConfirm !== null && (
				<div className="modal">
					<div className="pod-form">
						<h3>Confirm Delete</h3>
						{error && <div className="error">{error}</div>}
						<p>Are you sure you want to delete this pod? This action cannot be undone.</p>
						<div className="form-actions">
							<button type="button" className="primary-btn" onClick={onConfirmDeletePod}>Yes, Delete</button>
							<button type="button" onClick={onCancelDeletePod}>Cancel</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default ManagePodsPanel;
