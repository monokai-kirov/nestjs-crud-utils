import { applyDecorators, BadRequestException } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Allow, isDecimal } from 'class-validator';
import { utils } from '..';

export function OptionalDecimalDecorator(): ReturnType<typeof applyDecorators> {
	return function (target, propertyKey, descriptor?) {
		const decorators = [
			ApiPropertyOptional(),
			ApiProperty({ description: '@IsOptional(), @IsDecimal()' }),
			Allow(),
			Transform(({ value }) => {
				if (value === undefined) {
					return value;
				} else if (value === null) {
					throw new BadRequestException(`${String(propertyKey)} !== null`);
				} else {
					value = parseFloat(String(value).replace(',', '.')).toFixed(2);
					if (!isDecimal(value)) {
						throw new BadRequestException(`@IsDecimal(${String(propertyKey)})`);
					}
					return value;
				}
			}),
		];

		utils.decorate(decorators, target, propertyKey, descriptor);
	};
}
