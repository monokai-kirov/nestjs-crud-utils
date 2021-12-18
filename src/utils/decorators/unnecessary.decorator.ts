import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export function UnnecessaryDecorator(): ReturnType<typeof applyDecorators> {
	return applyDecorators(
		ApiProperty({ description: `Don't specify this property` }),
		ApiPropertyOptional(),
	);
}
