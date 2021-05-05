import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsPhoneNumber } from 'class-validator';

export function PhoneDecorator() {
	return applyDecorators(
		ApiProperty({ description: `@IsPhoneNumber()` }),
		IsPhoneNumber(),
	);
}
