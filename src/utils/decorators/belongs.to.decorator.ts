import { applyDecorators } from '@nestjs/common';
import 'reflect-metadata';
import { BelongsTo } from 'sequelize-typescript';
import { utils } from '../utils';

export function BelongsToDecorator(
	modelFunc: () => Record<string, any>,
	onDelete = 'CASCADE',
): ReturnType<typeof applyDecorators> {
	return function (target, propertyKey, descriptor?) {
		const decorators = [
			BelongsTo(modelFunc as any, {
				foreignKey: `${utils.camelToSnakeCase(propertyKey)}_id`,
				onDelete,
			}),
		];

		utils.decorate(decorators, target, propertyKey, descriptor);
	};
}
