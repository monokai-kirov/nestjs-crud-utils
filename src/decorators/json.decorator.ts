import { applyDecorators } from '@nestjs/common';
import { IsJSON } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export function JSONDecorator() {
	return applyDecorators(ApiProperty({ description: `@IsJSON()` }), IsJSON());
}
