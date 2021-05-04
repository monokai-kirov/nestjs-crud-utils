import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsJSON, IsOptional } from 'class-validator';

export function OptionalArrayOfJSONsDecorator(description = '') {
	return applyDecorators(
		ApiPropertyOptional(),
		ApiProperty({ description: `@IsOptional(), @IsArray(), @IsJSON({ each: true }); ${description}` }),
		IsOptional(),
		IsArray(),
		IsJSON({ each: true }),
	);
}