import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export function ArrayOfUUIDsDecorator() {
	return applyDecorators(
		ApiProperty({ description: `@IsArray(), @ArrayNotEmpty(), @IsUUID('4', { each: true })` }),
		IsArray(),
		ArrayNotEmpty(),
		IsUUID('4', { each: true })
	);
}