import type { PodActionHistoryChange, PodActionHistoryEntry } from "./apiTypes";

export function isValidPassword(password: string): boolean {
	return password.length >= 8 && password.length <= 128 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);
}

export function maskEmailForLog(email: string): string {
	const trimmed = email.trim();
	const atIndex = trimmed.indexOf("@");
	if (atIndex <= 1) return "***";
	return `${trimmed[0]}***${trimmed.slice(atIndex)}`;
}

export function generateTraceId(prefix = "email-change"): string {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isValidLat(lat: string | number): boolean {
	const latStr = typeof lat === "number" ? lat.toFixed(6) : lat;
	const num = Number(latStr);
	if (Number.isNaN(num)) return false;
	if (num < -90 || num > 90) return false;
	const decimals = latStr.includes(".") ? latStr.split(".")[1] : "";
	return !!decimals && decimals.length >= 3;
}

export function isValidLong(long: string | number): boolean {
	const longStr = typeof long === "number" ? long.toFixed(6) : long;
	const num = Number(longStr);
	if (Number.isNaN(num)) return false;
	if (num < -180 || num > 180) return false;
	const decimals = longStr.includes(".") ? longStr.split(".")[1] : "";
	return !!decimals && decimals.length >= 3;
}

export function formatHistoryValue(value: string | number | null | undefined): string {
	if (value === null || value === undefined) return "none";
	if (typeof value === "number") return String(value);
	if (!String(value).trim()) return "none";
	return String(value);
}

export function formatHistoryFieldLabel(field: PodActionHistoryChange["field"]): string {
	if (field === "nickname") return "Nickname";
	if (field === "visibility") return "Visibility";
	if (field === "latitude") return "Latitude";
	return "Longitude";
}

export function formatActionTypeLabel(action: PodActionHistoryEntry["action"]): string {
	if (action === "added") return "Added";
	if (action === "deleted") return "Deleted";
	return "Edited";
}

export function maskPhoneForDisplay(phone: string): string {
	const digits = (phone || "").replace(/\D/g, "");
	if (digits.length === 10) return `***-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
	if (digits.length === 7) return `***-${digits.slice(0, 3)}-${digits.slice(3, 7)}`;
	return `***-${phone || ""}`;
}
