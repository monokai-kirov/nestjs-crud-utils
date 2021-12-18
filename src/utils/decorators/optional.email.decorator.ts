import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional } from 'class-validator';

export function OptionalEmailDecorator(): ReturnType<typeof applyDecorators> {
	return applyDecorators(
		ApiPropertyOptional(),
		ApiProperty({ description: `@IsOptional(), @IsEmail()` }),
		IsOptional(),
		IsEmail(),
	);
}
