import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsObject } from 'class-validator';

export function ArrayOfObjectsDecorator(description = '') {
	return applyDecorators(
		ApiProperty({ description: `@IsArray(), @ArrayNotEmpty(), @IsObject({ each: true }); ${description}` }),
		IsArray(),
		ArrayNotEmpty(),
		IsObject({ each: true }),
	);
}