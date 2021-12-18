import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { config } from '../../utils/config';
import { PgListenHandler } from '../types';
import { Upload } from '../models/upload.model';
import { PgService, pgService } from './pg.service';

export class TriggerService {
	protected readonly sequelize: Sequelize;
	protected readonly pgService: PgService;
	protected readonly uploadTriggerModels: Record<string, any>[] = [];

	constructor(sequelize: Sequelize) {
		this.sequelize = sequelize;
		this.pgService = pgService;
	}

	public createRemovingTriggers(crudModel): void {
		this.uploadTriggerModels.push(crudModel);
	}

	public async initialize(removingHandler: PgListenHandler): Promise<void> {
		const tableName = String(Upload.getTableName());
		const eventName = `${tableName}_removing_event`;
		await this.pgService.subscribeToPgChannel();
		this.pgService.listenTo(eventName, removingHandler);

		const isLeader = await config.isLeader();
		if (!isLeader) {
			return;
		}

		await this.removeTriggersAndFunctions();
		await this.createRemovingTriggersForUploadModel(tableName, eventName);
		for (const crudModel of this.uploadTriggerModels) {
			await this.createRemovingTriggersForCrudModel(crudModel);
		}
	}

	protected async removeTriggersAndFunctions(): Promise<void> {
		const triggers = await this.sequelize.query(
			`
			SELECT
				event_object_schema as table_schema,
				event_object_table as table_name,
				trigger_name
			FROM information_schema.triggers
			WHERE trigger_name like '%_removing_trigger'
			GROUP BY 1,2,3
			ORDER BY table_schema, table_name;
		`.trim(),
			{ type: QueryTypes.SELECT },
		);

		let dropTriggerQuery = '';
		triggers.forEach(
			(v: any) =>
				(dropTriggerQuery += `DROP TRIGGER IF EXISTS ${v.trigger_name} on "${v.table_schema}"."${v.table_name}";`),
		);
		await this.sequelize.query(dropTriggerQuery);

		const functions = await this.sequelize.query(
			`
			SELECT p.proname AS function_name
			FROM pg_proc p
				LEFT JOIN pg_namespace n ON p.pronamespace = n.oid
			WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') and p.proname like '%_before_delete'
			ORDER BY function_name;
		`.trim(),
			{ type: QueryTypes.SELECT },
		);

		let dropFunctionQuery = '';
		functions.forEach(
			(v: any) => (dropFunctionQuery += `DROP FUNCTION IF EXISTS ${v.function_name} CASCADE;`),
		);
		await this.sequelize.query(dropFunctionQuery);
	}

	protected async createRemovingTriggersForUploadModel(
		tableName: string,
		eventName: string,
	): Promise<void> {
		await this.createTrigger(
			String(tableName),
			`
			PERFORM pg_notify('${eventName}', '{
				"table": "' || TG_TABLE_NAME || '",
				"action": "delete",
				"row":' || row_to_json(OLD)::text ||
			'}');
			RETURN OLD;
		`.trim(),
		);
	}

	protected async createRemovingTriggersForCrudModel(crudModel): Promise<void> {
		await this.createRemovingTriggersForHasOneRelations(crudModel);
		await this.createRemovingTriggersForManyToManyRelations(crudModel);
	}

	protected async createRemovingTriggersForHasOneRelations(crudModel): Promise<void> {
		const tableName = crudModel.getTableName();
		const uploadKeys: Set<string> = new Set();

		Object.entries(crudModel.rawAttributes)
			.filter(
				([key, value]: any) => value.references && value.references.model === Upload.getTableName(),
			)
			.forEach(([key, value]: any) => {
				uploadKeys.add(value.field);
			});

		if (uploadKeys.size) {
			await this.createTrigger(
				tableName,
				`${[...uploadKeys]
					.map(
						(key) => `EXECUTE 'DELETE FROM ${Upload.getTableName()} WHERE id=$1' USING OLD.${key};`,
					)
					.join(' ')}
			RETURN OLD;`,
			);
		}
	}

	protected async createRemovingTriggersForManyToManyRelations(crudModel): Promise<void> {
		const tables: Array<{ tableName: string; uploadKeys: string[] }> = [];

		Object.entries(crudModel.associations)
			.filter(
				([key, value]: any) =>
					value.associationType === 'BelongsToMany' &&
					value.target.prototype.constructor === Upload,
			)
			.forEach(([key, value]: any) => {
				const keys: Set<string> = new Set();

				Object.entries(value.throughModel.rawAttributes).map(([subKey, subValue]: any) => {
					if (subValue.references?.model === Upload.getTableName()) {
						keys.add(subValue.field);
					}
				});

				if (keys.size) {
					tables.push({
						tableName: value.throughModel.getTableName(),
						uploadKeys: [...keys],
					});
				}
			});

		if (tables.length) {
			for (const { tableName, uploadKeys } of tables) {
				await this.createTrigger(
					tableName,
					`${uploadKeys
						.map(
							(key) =>
								`EXECUTE 'DELETE FROM ${Upload.getTableName()} WHERE id=$1' USING OLD.${key};`,
						)
						.join(' ')}
				RETURN OLD;`,
				);
			}
		}
	}

	protected async createTrigger(
		tableName: string,
		functionBody: string,
		when = 'AFTER',
	): Promise<void> {
		const functionName = `public.${tableName}_before_delete`;
		const triggerName = `${tableName}_removing_trigger`;

		await this.sequelize.query(`
			CREATE OR REPLACE FUNCTION ${functionName}()
			RETURNS trigger
			LANGUAGE plpgsql
				AS $function$BEGIN
					${functionBody}
				END;$function$;
		`);

		await this.sequelize.query(`DROP TRIGGER IF EXISTS ${triggerName} on public."${tableName}";`);
		await this.sequelize.query(`
			CREATE TRIGGER ${triggerName}
			${when} DELETE ON public."${tableName}"
			FOR EACH ROW EXECUTE PROCEDURE ${functionName}();
		`);
	}
}
