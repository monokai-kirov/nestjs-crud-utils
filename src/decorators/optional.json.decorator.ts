import { applyDecorators } from '@nestjs/common';
import { IsJSON, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export function OptionalJSONDecorator(): ReturnType<typeof applyDecorators> {
	return applyDecorators(
		ApiPropertyOptional(),
		ApiProperty({ description: `@IsOptional(), @IsJSON()` }),
		IsOptional(),
		IsJSON(),
	);
}
