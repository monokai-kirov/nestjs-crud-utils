import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsString,
	MaxLength,
	MinLength,
	IsArray,
	IsOptional,
	ArrayMinSize,
	ArrayMaxSize,
} from 'class-validator';

export function OptionalArrayOfStringsDecorator({
	minCount = 0,
	maxCount = Infinity,
	minItemLength = 1,
	maxItemLength = 256,
}: {
	minCount?: number;
	maxCount?: number;
	minItemLength?: number;
	maxItemLength?: number;
} = {}): ReturnType<typeof applyDecorators> {
	return applyDecorators(
		ApiPropertyOptional(),
		ApiProperty({
			description: `@IsOptional(), @IsArray(), @ArrayMinSize(${minCount}), @ArrayMaxSize(${maxCount}), @IsString({ each: true }), @MinLength(${minItemLength}, { each: true}), @MaxLength(${maxItemLength}, { each: true })`,
		}),
		IsOptional(),
		IsArray(),
		ArrayMinSize(minCount),
		ArrayMaxSize(maxCount),
		IsString({ each: true }),
		MinLength(minItemLength, { each: true }),
		MaxLength(maxItemLength, { each: true }),
	);
}
