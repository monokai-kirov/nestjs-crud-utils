import { applyDecorators } from '@nestjs/common';
import { IsJSON } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export function JSONDecorator(): ReturnType<typeof applyDecorators> {
	return applyDecorators(ApiProperty({ description: `@IsJSON()` }), IsJSON());
}
