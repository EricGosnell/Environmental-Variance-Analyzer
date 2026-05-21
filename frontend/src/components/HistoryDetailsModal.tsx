import type { PodActionHistoryEntry } from "../utils/apiTypes";
import { formatActionTypeLabel, formatHistoryFieldLabel, formatHistoryValue } from "../utils/profileUtils";

type HistoryDetailsModalProps = {
	entry: PodActionHistoryEntry;
	onClose: () => void;
};

const HistoryDetailsModal = ({ entry, onClose }: HistoryDetailsModalProps) => {
	const selectedHistoryChanges = entry.actionDetails?.changes ?? [];
	const selectedHistoryFlatDetails = entry.actionDetails
		? [
			{ label: "Nickname", value: entry.actionDetails.nickname },
			{ label: "Visibility", value: entry.actionDetails.visibility },
			{ label: "Latitude", value: entry.actionDetails.latitude },
			{ label: "Longitude", value: entry.actionDetails.longitude },
		]
		: [];

	return (
		<div className="modal">
			<div className="pod-form profile-history-modal">
				<h3 className="profile-history-modal-title">{formatActionTypeLabel(entry.action)}</h3>
				{entry.action === "edited" ? (
					selectedHistoryChanges.length > 0 ? (
						<table className="pods-table profile-history-table">
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
						<p className="profile-history-empty-note">No detailed edit changes were recorded for this event.</p>
					)
				) : (
					<table className="pods-table profile-history-table">
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
				)}
				<div className="form-actions">
					<button type="button" className="primary-btn" onClick={onClose}>Close</button>
				</div>
			</div>
		</div>
	);
};

export default HistoryDetailsModal;
