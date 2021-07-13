import 'reflect-metadata';
import { Column, DataType, ForeignKey } from 'sequelize-typescript';
import { Upload } from '../upload/models/upload.model';

export function UploadForeignKeyDecorator(modelFunc: () => Record<string, any> = () => Upload) {
	return function (target, propertyKey, descriptor?) {
		const decorators = [
			ForeignKey(modelFunc as any),
			Column({ type: DataType.UUID, allowNull: true }),
		];

		for (const decorator of decorators as any[]) {
			if (target instanceof Function && !descriptor) {
				decorator(target);
				continue;
			}
			decorator(target, propertyKey, descriptor);
		}
	};
}
