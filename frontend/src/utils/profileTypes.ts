export type VerificationModalState = {
	mode: "email" | "password";
	targetEmail: string;
};

export type ProfileFormState = {
	username: string;
	email: string;
	phone_number: string;
	verificationCode: string;
};

export type PodDraftState = {
	nickname: string;
	visibility: "public" | "private";
	latitude: string;
	longitude: string;
};

export type ProfileTabKey = "managePods" | "history" | "settings";
