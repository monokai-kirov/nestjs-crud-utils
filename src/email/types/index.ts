export type EmailOptions = {
	from: string;
	to: string;
	subject: string;
	text: string;
	html: string;
};

export interface EmailSendingResponse {
	isEmailSent: boolean;
}
