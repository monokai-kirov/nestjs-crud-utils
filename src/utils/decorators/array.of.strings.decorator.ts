import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import {
	IsString,
	MaxLength,
	MinLength,
	IsArray,
	ArrayMaxSize,
	ArrayMinSize,
} from 'class-validator';

export function ArrayOfStringsDecorator({
	minCount = 1,
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
		ApiProperty({
			description: `@IsArray(), @ArrayMinSize(${minCount}), @ArrayMaxSize(${maxCount}), @IsString({ each: true }), @MinLength(${minItemLength}, { each: true }), @MaxLength(${maxItemLength}, { each: true })`,
		}),
		IsArray(),
		ArrayMinSize(minCount),
		ArrayMaxSize(maxCount),
		IsString({ each: true }),
		MinLength(minItemLength, { each: true }),
		MaxLength(maxItemLength, { each: true }),
	);
}
