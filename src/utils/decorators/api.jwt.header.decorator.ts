import { applyDecorators } from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';
import { ApiResponseDecorator } from './api.response.decorator';

export function ApiJwtHeaderDecorator(): ReturnType<typeof applyDecorators> {
	return applyDecorators(
		ApiHeader({
			name: 'Authorization',
			description: 'Bearer ${jwt-token}',
		}),
		ApiResponseDecorator([401, 403]),
	);
}
