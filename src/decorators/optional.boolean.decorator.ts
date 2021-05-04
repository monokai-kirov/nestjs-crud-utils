import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export function OptionalBooleanDecorator() {
	return applyDecorators(
		ApiPropertyOptional(),
		ApiProperty({ description: '@IsBoolean()' }),
		IsOptional(),
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