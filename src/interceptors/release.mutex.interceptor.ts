import {
	Injectable,
	NestInterceptor,
	ExecutionContext,
	CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { utils } from '../utils';

@Injectable()
export class ReleaseMutexInterceptor implements NestInterceptor {
	intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		const request = context.switchToHttp().getRequest();
		return next
			.handle()
			.pipe(
				(tap as any)(() => utils.releaseMutex(request))
			);
	}
}
