import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsJSON } from 'class-validator';

export function ArrayOfJSONsDecorator({
	minCount = 1,
	maxCount = Infinity,
}: {
	minCount?: number;
	maxCount?: number;
} = {}): ReturnType<typeof applyDecorators> {
	return applyDecorators(
		ApiProperty({
			description: `@IsArray(), @ArrayMinSize(${minCount}), @ArrayMaxSize(${maxCount}), @IsJSON({ each: true });`,
		}),
		IsArray(),
		ArrayMinSize(minCount),
		ArrayMaxSize(maxCount),
		IsJSON({ each: true }),
	);
}
