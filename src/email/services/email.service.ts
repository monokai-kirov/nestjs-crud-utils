import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nodemailer = require('nodemailer');

type EmailOptions = {
	from: string;
	to: string;
	subject: string;
	text: string;
	html: string;
};

export interface EmailSendingResponse {
	isEmailSent: boolean;
}

@Injectable()
export class EmailService {
	private transporter;

	constructor(private readonly configService: ConfigService) {
		this.transporter = nodemailer.createTransport({
			host: 'smtp.yandex.ru',
			port: 465,
			secure: true,
			auth: {
				user: configService.get('EMAIL_LOGIN'),
				pass: configService.get('EMAIL_PASSWORD'),
			},
		});
	}

	public async send({
		email,
		title,
		message,
	}: {
		email: string;
		title: string;
		message: string;
	}): Promise<EmailSendingResponse> {
		try {
			await this.transporter.sendMail(this.generateOptions({ email, title, message }));
			return {
				isEmailSent: true,
			};
		} catch (e) {
			return {
				isEmailSent: false,
			};
		}
	}

	private generateOptions({
		email,
		title,
		message,
	}: {
		email: string;
		title: string;
		message: string;
	}): EmailOptions {
		return {
			from: this.configService.get('EMAIL_LOGIN'),
			to: email,
			subject: title,
			text: message,
			html: this.generateHtml(title, message),
		};
	}

	private generateHtml(title: string, body: string): string {
		return `<!DOCTYPE html>
			<html lang="ru">
			<head>
				<meta charset="UTF-8">
				<title>${title}</title>
			</head>
			<body>
				<h1>${title}</h1>
				<p>${body}</p>
			</body>
			</html>`;
	}
}
