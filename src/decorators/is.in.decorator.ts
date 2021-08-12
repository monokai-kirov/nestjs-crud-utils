import { applyDecorators } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export function IsInDecorator(values: any[]): ReturnType<typeof applyDecorators> {
	return applyDecorators(
		ApiProperty({ description: `@IsIn(${values.map((v) => `'${v}'`).join(', ')})` }),
		IsIn(values),
	);
}
