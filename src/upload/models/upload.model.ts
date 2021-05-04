import { Column, Model, Table } from 'sequelize-typescript';
import { primaryKeyOptions } from '../../sequelize.options';

export enum UploadStatus {
	WAIT_FOR_LINKING = 'WAIT_FOR_LINKING',
	LINKED = 'LINKED',
};
export const uploadStatuses = Object.keys(UploadStatus).map(k => UploadStatus[k as any]);

@Table
export class Upload extends Model {
	@Column(primaryKeyOptions)
	id: string;

	@Column({ allowNull: false, defaultValue: UploadStatus.LINKED })
	status: string;

	@Column({ allowNull: false })
	url: string;

	@Column({ allowNull: false })
	type: string;

	@Column({ allowNull: true })
	originalName: string|null;

	@Column({ allowNull: true })
	filesize: number|null;

	@Column({ allowNull: true })
	preview: string|null;
}
