import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601 } from 'class-validator';

export function DateDecorator() {
	return applyDecorators(
		ApiProperty({ description: `@IsISO8601()` }),
		IsISO8601(),
	);
}