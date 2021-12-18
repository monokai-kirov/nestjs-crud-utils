import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsJSON, IsOptional } from 'class-validator';

export function OptionalArrayOfJSONsDecorator({
	minCount = 0,
	maxCount = Infinity,
}: {
	minCount?: number;
	maxCount?: number;
} = {}): ReturnType<typeof applyDecorators> {
	return applyDecorators(
		ApiPropertyOptional(),
		ApiProperty({
			description: `@IsOptional(), @IsArray(), @ArrayMinSize(${minCount}), @ArrayMaxSize(${maxCount}), @IsJSON({ each: true });`,
		}),
		IsOptional(),
		IsArray(),
		ArrayMinSize(minCount),
		ArrayMaxSize(maxCount),
		IsJSON({ each: true }),
	);
}
