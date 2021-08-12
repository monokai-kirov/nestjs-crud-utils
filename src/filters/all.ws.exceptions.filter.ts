import { Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { utils } from '../utils';

@Catch()
export class AllWsExceptionsFilter extends BaseWsExceptionFilter {
	catch(exception: any, host: ArgumentsHost): void {
		let err = exception;

		const ctx = host.switchToWs();
		utils.releaseMutex(ctx.getClient().handshake, ctx.getData());

		const code = '40001';
		if (exception.parent?.code == code || exception.original?.code == code) {
			err = new HttpException('Too many requests', 429);
		}

		if (!(exception instanceof WsException)) {
			let content;

			if (typeof (exception as any).getResponse === 'function') {
				content = exception.getResponse();
			} else {
				content = 'Internal server error';
			}
			err = new WsException(content);
		}
		super.catch(err, host);
	}
}
