import { ForbiddenException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Op } from "sequelize";
import { EntityService } from "../../crud/services/entity.service";
import { SmsRequest } from '../models/sms.request.model';
import { config } from "../../config";
import { utils } from "../../utils";
import { ConfigService } from "@nestjs/config";
const SMSru = require('sms_ru');

export interface SmsResponse {
	isSmsSent: boolean;
}

@Injectable()
export class SmsRequestService extends EntityService<SmsRequest> {
	static MAX_REQUESTS = 10;
	static MAX_REQUESTS_DESCRIPTION = `Maximum requests per day - ${SmsRequestService.MAX_REQUESTS}`;

	constructor(
		@InjectModel(SmsRequest)
		private smsRequestModel: typeof SmsRequest,
		private readonly configService: ConfigService,
	) {
		super(smsRequestModel);
	}

	public async send({
		req,
		from,
		phone,
		message,
	} : {
		req,
		from: string,
		phone: string,
		message: string,
	}): Promise<SmsResponse> {
		try {
			if (config.isProduction()) {
				await this.sendHelper(from, phone, message);
			}
			await this.createSmsRequestEntityAndRemoveUnnecessaryEntries(req);
			return {
				isSmsSent: true,
			};
		} catch (e) {
			return {
				isSmsSent: false,
			};
		}
	}

	private async sendHelper(from: string, phone: string, message: string) {
		const sms = new SMSru(this.configService.get('SMS_API_ID'));
		return new Promise((resolve, reject) => {
			sms.sms_send({
				to: utils.normalizePhone(phone),
				text: message,
				from,
			}, function(result, errorMessage) {
				if (result) {
					resolve(result);
				} else {
					reject(new Error(errorMessage));
				}
			});
		});
	}

	private async createSmsRequestEntityAndRemoveUnnecessaryEntries(req): Promise<void> {
		const todayMidnight = new Date();
		todayMidnight.setHours(0, 0, 0, 0);

		await this.smsRequestModel.destroy({
			where: {
				[Op.or]: [
					{ ipAddress: utils.getIpAddressFromRequest(req) },
					{ hash: this.getHash(req) },
				],
				createdAt: {
					[Op.lt]: todayMidnight,
				},
			},
		});

		const smsRequest = new SmsRequest();
		smsRequest.ipAddress = utils.getIpAddressFromRequest(req);
		smsRequest.hash = this.getHash(req);
		smsRequest.fingerprint = this.getFingerprint(req);
		await smsRequest.save();
	}


	public async validateRequest(req): Promise<void> {
		const todayMidnight = new Date();
		todayMidnight.setHours(0, 0, 0, 0);
		const tomorrowMidnight = new Date();
		tomorrowMidnight.setDate(tomorrowMidnight.getDate() + 1);

		const requestsCount = await this.count({
			where: {
				[Op.or]: [
					{ ipAddress: utils.getIpAddressFromRequest(req) },
					{ hash: this.getHash(req) },
				],
				createdAt: {
					[Op.between]: [todayMidnight, tomorrowMidnight],
				},
			},
		});

		if (requestsCount >= SmsRequestService.MAX_REQUESTS) {
			throw new ForbiddenException(`Maximum ${SmsRequestService.MAX_REQUESTS} requests per day`);
		}
	}

	private getFingerprint(req) {
		return req.fingerprint;
	}

	private getHash(req): string {
		return this.getFingerprint(req)?.hash;
	}
}