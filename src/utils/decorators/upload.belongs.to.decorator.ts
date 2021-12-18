import { applyDecorators } from '@nestjs/common';
import 'reflect-metadata';
import { BelongsTo } from 'sequelize-typescript';
import { Upload } from '../../upload/models/upload.model';
import { utils } from '../utils';

export function UploadBelongsToDecorator(
	modelFunc: () => Record<string, any> = () => Upload,
): ReturnType<typeof applyDecorators> {
	return function (target, propertyKey, descriptor?) {
		const decorators = [
			BelongsTo(modelFunc as any, {
				foreignKey: `${utils.camelToSnakeCase(propertyKey)}_id`,
				onDelete: 'SET NULL',
			}),
		];

		utils.decorate(decorators, target, propertyKey, descriptor);
	};
}
