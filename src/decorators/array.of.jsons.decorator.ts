import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsJSON } from 'class-validator';

export function ArrayOfJSONsDecorator(description = '') {
	return applyDecorators(
		ApiProperty({
			description: `@IsArray(), @ArrayNotEmpty(), @IsJSON({ each: true }); ${description}`,
		}),
		IsArray(),
		ArrayNotEmpty(),
		IsJSON({ each: true }),
	);
}
