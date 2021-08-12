import { applyDecorators } from '@nestjs/common';
import 'reflect-metadata';
import { Column, DataType, ForeignKey } from 'sequelize-typescript';

export function ForeignKeyDecorator(
	modelFunc: () => Record<string, any>,
	allowNull = false,
): ReturnType<typeof applyDecorators> {
	return function (target, propertyKey, descriptor?) {
		const decorators = [ForeignKey(modelFunc as any), Column({ type: DataType.UUID, allowNull })];

		for (const decorator of decorators as any[]) {
			if (target instanceof Function && !descriptor) {
				decorator(target);
				continue;
			}
			decorator(target, propertyKey, descriptor);
		}
	};
}
