import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsObject, IsOptional } from 'class-validator';

export function OptionalArrayOfObjectsDecorator(
	description = '',
): ReturnType<typeof applyDecorators> {
	return applyDecorators(
		ApiPropertyOptional(),
		ApiProperty({
			description: `@IsOptional(), @IsArray(), @IsObject({ each: true }); ${description}`,
		}),
		IsOptional(),
		IsArray(),
		IsObject({ each: true }),
	);
}
