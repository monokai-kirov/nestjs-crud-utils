import { Column, Model, Table, DataType } from 'sequelize-typescript';
import { primaryKeyOptions } from '../../sequelize.options';

@Table({
	indexes: [{ fields: ['ip_address'] }, { fields: ['hash'] }],
})
export class SmsRequest extends Model {
	@Column(primaryKeyOptions)
	id: string;

	@Column({ allowNull: false })
	ipAddress: string;

	@Column({ allowNull: false })
	hash: string;

	@Column({ type: DataType.JSONB, allowNull: false })
	fingerprint: Object;
}
