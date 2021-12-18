import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export function EmailDecorator(): ReturnType<typeof applyDecorators> {
	return applyDecorators(ApiProperty({ description: `@IsEmail()` }), IsEmail());
}
