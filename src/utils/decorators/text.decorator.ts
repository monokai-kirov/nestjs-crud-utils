import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export function TextDecorator(minLength = 1, maxLength = 1200): ReturnType<typeof applyDecorators> {
	return applyDecorators(
		ApiProperty({ description: `@IsString(), @MinLength(${minLength}), @MaxLength(${maxLength})` }),
		IsString(),
		MinLength(minLength),
		MaxLength(maxLength),
	);
}
