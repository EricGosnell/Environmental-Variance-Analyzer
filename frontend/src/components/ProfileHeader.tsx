import type { User } from "../utils/apiTypes";

type ProfileHeaderProps = {
	loading: boolean;
	user: User | null;
};

const ProfileHeader = ({ loading, user }: ProfileHeaderProps) => {
	return (
		<div className="profile-header">
			{loading ? (
				<div>Loading...</div>
			) : user ? (
				<>
					<h2>Hello, {user.username}</h2>
					<div className="org">Organization: University of Colorado Boulder</div>
					<div className="org"> {user.email}</div>
					<div className="profile-account-type">Standard Account</div>
				</>
			) : (
				<div>Failed to load user info.</div>
			)}
		</div>
	);
};

export default ProfileHeader;
