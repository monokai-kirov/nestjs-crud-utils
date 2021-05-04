import { applyDecorators } from '@nestjs/common';
import { IsIn, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export function OptionalIsInDecorator(values: any[]) {
	return applyDecorators(
		ApiPropertyOptional(),
		ApiProperty({ description: `@IsIn(${values.map(v => `'${v}'`).join(', ')})` }),
		IsOptional(),
		IsIn(values),
	);
}