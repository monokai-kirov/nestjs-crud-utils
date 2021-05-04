import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export function UUIDDecorator() {
	return applyDecorators(
		ApiProperty({ description: `@IsUUID('4')` }),
		IsUUID('4')
	);
}