import 'reflect-metadata';
import { BelongsTo } from 'sequelize-typescript';
import { utils } from '../utils';

export function UploadBelongsToDecorator(modelFunc: () => Object) {
	return function(target, propertyKey, descriptor?) {
		const decorators = [
			BelongsTo(modelFunc as any, { foreignKey: `${utils.camelToSnakeCase(propertyKey)}_id`, onDelete: 'SET NULL' })
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