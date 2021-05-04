import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export function ObjectDecorator() {
	return applyDecorators(
		ApiProperty({ description: `@IsObject()` }),
		IsObject(),
	);
}
