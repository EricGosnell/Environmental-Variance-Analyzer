import type { ProfileTabKey } from "../utils/profileTypes";

type ProfileTabsProps = {
	activeTab: ProfileTabKey;
	onTabChange: (tab: ProfileTabKey) => void;
	tabs: Array<{ key: ProfileTabKey; label: string }>;
};

const ProfileTabs = ({ activeTab, onTabChange, tabs }: ProfileTabsProps) => {
	return (
		<div className="profile-page-sidebar-shell">
			<div className="profile-page-tabs">
				{tabs.map((tab) => (
					<button
						key={tab.key}
						className={`btn profile-tab-btn${activeTab === tab.key ? " active" : ""}`}
						onClick={() => onTabChange(tab.key)}
					>
						{tab.label}
					</button>
				))}
			</div>
		</div>
	);
};

export default ProfileTabs;
