import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsPhoneNumber } from 'class-validator';

export function OptionalPhoneDecorator(): ReturnType<typeof applyDecorators> {
	return applyDecorators(
		ApiPropertyOptional(),
		ApiProperty({ description: `@IsOptional(), @IsPhoneNumber()` }),
		IsOptional(),
		IsPhoneNumber(),
	);
}
