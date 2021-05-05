import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsPhoneNumber } from 'class-validator';

export function OptionalPhoneDecorator() {
	return applyDecorators(
		ApiPropertyOptional(),
		ApiProperty({ description: `@IsPhoneNumber()` }),
		IsOptional(),
		IsPhoneNumber(),
	);
}
