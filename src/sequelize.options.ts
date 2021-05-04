import { DataType, Sequelize } from "sequelize-typescript";

export const primaryKeyOptions: any = {
	primaryKey: true,
	allowNull: false,
	type: DataType.UUID,
	defaultValue: Sequelize.literal('uuid_generate_v4()'),
};

export const defaultScopeOptions: any = {
	order: [
		['createdAt', 'DESC'],
		['updatedAt', 'DESC'],
	],
};

