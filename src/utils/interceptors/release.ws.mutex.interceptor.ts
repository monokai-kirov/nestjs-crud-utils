import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { utils } from '../utils';

@Injectable()
export class ReleaseWsMutexInterceptor implements NestInterceptor {
	intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		const ctx = context.switchToWs();
		return next
			.handle()
			.pipe((tap as any)(() => utils.releaseMutex(ctx.getClient().handshake, ctx.getData())));
	}
}
