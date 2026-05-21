import type { PodActionHistoryEntry } from "../utils/apiTypes";

type PodHistoryPanelProps = {
	historyLoading: boolean;
	historyError: string;
	podHistory: PodActionHistoryEntry[];
	onViewDetails: (entry: PodActionHistoryEntry) => void;
};

const PodHistoryPanel = ({ historyLoading, historyError, podHistory, onViewDetails }: PodHistoryPanelProps) => {
	return (
		<div className="manage-pods-container profile-panel-container">
			<h3 className="profile-section-title">Pod Action History</h3>
			{historyLoading ? (
				<div>Loading history...</div>
			) : historyError ? (
				<div className="error">{historyError}</div>
			) : (
				<table className="pods-table profile-pods-table">
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
									<td>{entry.podName}</td>
									<td>
										<button type="button" className="btn profile-history-details-btn" onClick={() => onViewDetails(entry)}>
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
	);
};

export default PodHistoryPanel;
