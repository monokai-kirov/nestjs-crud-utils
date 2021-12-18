import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

export function OptionalObjectDecorator(): ReturnType<typeof applyDecorators> {
	return applyDecorators(
		ApiPropertyOptional(),
		ApiProperty({ description: `@IsOptional(), @IsObject()` }),
		IsOptional(),
		IsObject(),
	);
}
