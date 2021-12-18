import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export function ArrayOfUUIDsDecorator({
	minCount = 1,
	maxCount = Infinity,
}: {
	minCount?: number;
	maxCount?: number;
} = {}): ReturnType<typeof applyDecorators> {
	return applyDecorators(
		ApiProperty({
			description: `@IsArray(), @ArrayMinSize(${minCount}), @ArrayMaxSize(${maxCount}), @IsUUID('4', { each: true })`,
		}),
		IsArray(),
		ArrayMinSize(minCount),
		ArrayMaxSize(maxCount),
		IsUUID('4', { each: true }),
	);
}
