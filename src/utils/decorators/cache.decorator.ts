import { applyDecorators, CacheInterceptor, UseInterceptors } from '@nestjs/common';
import { config } from '../config';

export function CacheDecorator(): ReturnType<typeof applyDecorators> {
	return applyDecorators(UseInterceptors(...(config.isProduction() ? [CacheInterceptor] : [])));
}
