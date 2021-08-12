import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsJSON, IsOptional } from 'class-validator';

export function OptionalArrayOfJSONsDecorator(
	description = '',
): ReturnType<typeof applyDecorators> {
	return applyDecorators(
		ApiPropertyOptional(),
		ApiProperty({
			description: `@IsOptional(), @IsArray(), @IsJSON({ each: true }); ${description}`,
		}),
		IsOptional(),
		IsArray(),
		IsJSON({ each: true }),
	);
}
