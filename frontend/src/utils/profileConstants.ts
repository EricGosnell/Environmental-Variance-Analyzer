import type { ProfileTabKey } from "./types";

export const PASSWORD_REQUIREMENTS_MESSAGE = "Password must be 8-128 characters and include at least one lowercase letter, one uppercase letter, and one number.";

export const PROFILE_TABS: Array<{ key: ProfileTabKey; label: string }> = [
	{ key: "managePods", label: "Manage Pods" },
	{ key: "history", label: "History" },
	{ key: "settings", label: "Settings" },
];
