import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export function ArrayOfUUIDsDecorator() {
	return applyDecorators(
		ApiProperty({ description: `@IsArray(), @IsUUID('4', { each: true })` }),
		IsArray(),
		IsUUID('4', { each: true })
	);
}