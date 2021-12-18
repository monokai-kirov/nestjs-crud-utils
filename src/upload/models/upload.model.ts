import { Column, DataType, Model, Table } from 'sequelize-typescript';
import { primaryKeyOptions } from '../../utils/sequelize.options';

export enum UploadStatus {
	WAIT_FOR_LINKING = 'WAIT_FOR_LINKING',
	LINKED = 'LINKED',
}

@Table
export class Upload extends Model {
	@Column(primaryKeyOptions)
	id: string;

	@Column({ allowNull: false, defaultValue: UploadStatus.LINKED })
	status: string;

	@Column({ allowNull: false })
	type: string;

	@Column({ allowNull: true })
	originalName: string | null;

	@Column({ type: DataType.JSONB, allowNull: false, defaultValue: [] })
	values: Record<string, any>[];
}
