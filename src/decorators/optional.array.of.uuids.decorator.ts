import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsUUID } from 'class-validator';

export function OptionalArrayOfUUIDsDecorator() {
	return applyDecorators(
		ApiPropertyOptional(),
		ApiProperty({ description: `@IsOptional(), @IsArray(), @IsUUID('4', { each: true })` }),
		IsOptional(),
		IsArray(),
		IsUUID('4', { each: true })
	);
}