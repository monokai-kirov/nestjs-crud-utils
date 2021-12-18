import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsObject } from 'class-validator';

export function ArrayOfObjectsDecorator({
	minCount = 1,
	maxCount = Infinity,
}: {
	minCount?: number;
	maxCount?: number;
} = {}): ReturnType<typeof applyDecorators> {
	return applyDecorators(
		ApiProperty({
			description: `@IsArray(), @ArrayMinSize(${minCount}), @ArrayMaxSize(${maxCount}), @IsObject({ each: true });`,
		}),
		IsArray(),
		ArrayMinSize(minCount),
		ArrayMaxSize(maxCount),
		IsObject({ each: true }),
	);
}
