import { BadRequestException } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Allow, isInt } from 'class-validator';

export function OptionalIntWithoutNullDecorator() {
	return function (target, propertyKey, descriptor?) {
		const decorators = [
			ApiPropertyOptional(),
			ApiProperty({ description: '@IsOptional(), @IsInt()' }),
			Allow(),
			Transform(({ value }) => {
				if (value === undefined) {
					return value;
				} else if (value === null) {
					throw new BadRequestException(`${propertyKey} !== null`);
				} else {
					value = parseInt(value);
					if (!isInt(value)) {
						throw new BadRequestException(`@IsInt(${propertyKey})`);
					}
					if (value < 0) {
						throw new BadRequestException(`${propertyKey} mustn't be negative`);
					}
					return value;
				}
			}),
		];

		for (const decorator of decorators as any[]) {
			if (target instanceof Function && !descriptor) {
				decorator(target);
				continue;
			}
			decorator(target, propertyKey, descriptor);
		}
	};
}
