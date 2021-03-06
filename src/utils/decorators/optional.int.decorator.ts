import { applyDecorators, BadRequestException } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Allow, isInt } from 'class-validator';
import { utils } from '..';

export function OptionalIntDecorator(): ReturnType<typeof applyDecorators> {
	return function (target, propertyKey, descriptor?) {
		const decorators = [
			ApiPropertyOptional(),
			ApiProperty({ description: '@IsOptional(), @IsInt()' }),
			Allow(),
			Transform(({ value }) => {
				if (value === undefined) {
					return value;
				} else if (value === null) {
					throw new BadRequestException(`${String(propertyKey)} !== null`);
				} else {
					value = parseInt(value);
					if (!isInt(value)) {
						throw new BadRequestException(`@IsInt(${String(propertyKey)})`);
					}
					if (value < 0) {
						throw new BadRequestException(`${String(propertyKey)} mustn't be negative`);
					}
					return value;
				}
			}),
		];

		utils.decorate(decorators, target, propertyKey, descriptor);
	};
}
