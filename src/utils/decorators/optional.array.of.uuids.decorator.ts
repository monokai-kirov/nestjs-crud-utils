import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsUUID } from 'class-validator';

export function OptionalArrayOfUUIDsDecorator({
	minCount = 0,
	maxCount = Infinity,
}: {
	minCount?: number;
	maxCount?: number;
} = {}): ReturnType<typeof applyDecorators> {
	return applyDecorators(
		ApiPropertyOptional(),
		ApiProperty({
			description: `@IsOptional(), @IsArray(), @ArrayMinSize(${minCount}), @ArrayMaxSize(${maxCount}), @IsUUID('4', { each: true })`,
		}),
		IsOptional(),
		IsArray(),
		ArrayMinSize(minCount),
		ArrayMaxSize(maxCount),
		IsUUID('4', { each: true }),
	);
}
