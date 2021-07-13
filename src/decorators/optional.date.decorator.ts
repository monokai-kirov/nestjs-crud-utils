import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';

export function OptionalDateDecorator() {
	return applyDecorators(
		ApiPropertyOptional(),
		ApiProperty({ description: `@IsOptional(), @IsISO8601()` }),
		IsOptional(),
		IsISO8601(),
	);
}
