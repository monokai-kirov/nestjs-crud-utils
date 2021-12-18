import { applyDecorators } from '@nestjs/common';
import 'reflect-metadata';
import { Column, DataType, ForeignKey } from 'sequelize-typescript';
import { utils } from '..';

export function ForeignKeyDecorator(
	modelFunc: () => Record<string, any>,
	allowNull = false,
): ReturnType<typeof applyDecorators> {
	return function (target, propertyKey, descriptor?) {
		const decorators = [ForeignKey(modelFunc as any), Column({ type: DataType.UUID, allowNull })];

		utils.decorate(decorators, target, propertyKey, descriptor);
	};
}
