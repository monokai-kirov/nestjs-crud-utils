import 'reflect-metadata';
import { BelongsTo } from 'sequelize-typescript';
import { utils } from 'src/utils';

export function BelongsToDecorator(modelFunc: () => Object, onDelete: string = 'CASCADE') {
	return function(target, propertyKey, descriptor?) {
		const decorators = [
			BelongsTo(modelFunc as any, { foreignKey: `${utils.camelToSnakeCase(propertyKey)}_id`, onDelete })
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