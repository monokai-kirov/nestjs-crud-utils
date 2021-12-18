import { applyDecorators } from '@nestjs/common';
import 'reflect-metadata';
import { Column, DataType, ForeignKey } from 'sequelize-typescript';
import { utils } from '..';
import { Upload } from '../../upload/models/upload.model';

export function UploadForeignKeyDecorator(
	modelFunc: () => Record<string, any> = () => Upload,
): ReturnType<typeof applyDecorators> {
	return function (target, propertyKey, descriptor?) {
		const decorators = [
			ForeignKey(modelFunc as any),
			Column({ type: DataType.UUID, allowNull: true }),
		];

		utils.decorate(decorators, target, propertyKey, descriptor);
	};
}
