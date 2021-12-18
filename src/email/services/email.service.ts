import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { config } from '../../utils/config';
import { EmailOptions, EmailSendingResponse } from '../types';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nodemailer = require('nodemailer');

@Injectable()
export class EmailService {
	protected transporter;

	constructor(private readonly configService: ConfigService) {
		this.transporter = nodemailer.createTransport(config.getEmailOptions());
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

	protected generateOptions({
		email,
		title,
		message,
		from = this.configService.get('EMAIL_LOGIN'),
	}: {
		email: string;
		title: string;
		message: string;
		from?: string;
	}): EmailOptions {
		return {
			from,
			to: email,
			subject: title,
			text: message,
			html: this.generateHtml(title, message),
		};
	}

	protected generateHtml(title: string, body: string): string {
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
