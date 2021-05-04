import { BadRequestException } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { isInt, IsNotEmpty } from 'class-validator';

export function IntDecorator() {
	return function(target, propertyKey, descriptor?) {
		const decorators = [
			ApiProperty({ description: '@IsInt()' }),
			IsNotEmpty(),
			Transform(({ value }) => {
				if (value === undefined || value === null) {
					return value;
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
			})
		];

		for (const decorator of decorators as any[]) {
			if (target instanceof Function && !descriptor) {
					decorator(target);
					continue;
			}
			decorator(target, propertyKey, descriptor);
		}
	}
}