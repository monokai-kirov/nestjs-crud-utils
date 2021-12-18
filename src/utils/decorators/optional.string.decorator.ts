import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export function OptionalStringDecorator(
	minLength = 1,
	maxLength = 256,
): ReturnType<typeof applyDecorators> {
	return applyDecorators(
		ApiPropertyOptional(),
		ApiProperty({
			description: `@IsOptional(), @IsString(), @MinLength(${minLength}), @MaxLength(${maxLength})`,
		}),
		IsOptional(),
		IsString(),
		MinLength(minLength),
		MaxLength(maxLength),
	);
}
