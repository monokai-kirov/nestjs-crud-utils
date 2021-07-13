import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { utils } from '../utils';

/**
 * For authenticated user only
 */
@Injectable()
export class WsMutexGuard implements CanActivate {
	public async canActivate(context: ExecutionContext) {
		const ctx = context.switchToWs();
		await utils.acquireMutex(
			ctx.getClient().handshake,
			`${ctx.getClient().handshake['user']['id']}:${context.getHandler().name}`,
			ctx.getData(),
		);
		return true;
	}
}
