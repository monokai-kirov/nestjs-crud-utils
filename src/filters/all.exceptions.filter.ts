import { Catch, ArgumentsHost } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { utils } from '../utils';

@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
	catch(exception: any, host: ArgumentsHost) {
		const ctx = host.switchToHttp();
		const response = ctx.getResponse();

		utils.releaseMutex(ctx.getRequest());

		const code = '40001';
		if (exception.parent?.code == code || exception.original?.code == code) {
			const message = 'Too many requests';
			response.statusMessage = message;
			response.setHeader('Retry-After', 5);
			return response.status(429).json({
				statusCode: 429,
				message,
			});
		}

		super.catch(exception, host);
	}
}
