import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsObject } from 'class-validator';

export function ArrayOfObjectsDecorator(description = '') {
	return applyDecorators(
		ApiProperty({ description: `@IsArray(), @IsObject({ each: true }); ${description}` }),
		IsArray(),
		IsObject({ each: true }),
	);
}