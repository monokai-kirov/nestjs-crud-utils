import { applyDecorators, BadRequestException } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { isDecimal, IsNotEmpty } from 'class-validator';
import { utils } from '..';

export function DecimalDecorator(): ReturnType<typeof applyDecorators> {
	return function (target, propertyKey, descriptor?) {
		const decorators = [
			ApiProperty({ description: '@IsNotEmpty(), @IsDecimal()' }),
			IsNotEmpty(),
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
