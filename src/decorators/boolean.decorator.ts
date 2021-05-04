import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export function BooleanDecorator() {
	return applyDecorators(
		ApiProperty({ description: '@IsBoolean()' }),
		IsBoolean(),
		Transform(({ value }) => {
			if (typeof value !== 'string') {
				return value;
			}

			if (value === 'true') {
				return true;
			} else if (value === 'false') {
				return false;
			} else {
				return value;
			}
		}),
	);
}