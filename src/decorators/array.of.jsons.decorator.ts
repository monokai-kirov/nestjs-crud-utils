import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsJSON } from 'class-validator';

export function ArrayOfJSONsDecorator(description = '') {
	return applyDecorators(
		ApiProperty({ description: `@IsArray(), @IsJSON({ each: true }); ${description}` }),
		IsArray(),
		IsJSON({ each: true }),
	);
}