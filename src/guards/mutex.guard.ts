import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { utils } from '../utils';

/**
 * For authenticated user only
 */
@Injectable()
export class MutexGuard implements CanActivate {
	public async canActivate(context: ExecutionContext) {
		const request = context.switchToHttp().getRequest();
		await utils.acquireMutex(request, `${request['user']['id']}:${context.getHandler().name}`);
		return true;
	}
}
