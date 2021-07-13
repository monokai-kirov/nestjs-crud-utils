import { applyDecorators } from '@nestjs/common';
import {
	ApiBadRequestResponse,
	ApiConflictResponse,
	ApiCreatedResponse,
	ApiForbiddenResponse,
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiTooManyRequestsResponse,
	ApiUnauthorizedResponse,
} from '@nestjs/swagger';

export function ApiResponseDecorator(statuses: (number | { code: number; description: string })[]) {
	return applyDecorators(
		...statuses.map((input) => {
			const statusCode = input['code'] ?? input;
			const description = input['description'] ? `, ${input['description']}` : '';

			switch (statusCode) {
				case 200:
					return ApiOkResponse({ description: `{ statusCode: 200${description} }` });
				case 201:
					return ApiCreatedResponse({ description: `{ statusCode: 201${description} }` });
				case 400:
					return ApiBadRequestResponse({ description: `{ statusCode: 400${description} }` });
				case 401:
					return ApiUnauthorizedResponse({ description: `{ statusCode: 401${description} }` });
				case 403:
					return ApiForbiddenResponse({ description: `{ statusCode: 403${description} }` });
				case 404:
					return ApiNotFoundResponse({ description: `{ statusCode: 404${description} }` });
				case 409:
					return ApiConflictResponse({ description: `{ statusCode: 409${description} }` });
				case 429:
					return ApiTooManyRequestsResponse({ description: `{ statusCode: 409${description} }` });
				default:
					throw new Error('@ApiResponseDecorator() некорректный code');
			}
		}),
	);
}
