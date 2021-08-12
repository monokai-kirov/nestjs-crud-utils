import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export function OptionalTextDecorator(
	minLength = 1,
	maxLength = 1200,
): ReturnType<typeof applyDecorators> {
	return applyDecorators(
		ApiPropertyOptional(),
		ApiProperty({
			description: `@IsOptional(), @IsString(), @MinLength(${minLength}), @MaxLength(${maxLength})`,
		}),
		IsOptional(),
		MinLength(minLength),
		MaxLength(maxLength),
		IsString(),
	);
}
