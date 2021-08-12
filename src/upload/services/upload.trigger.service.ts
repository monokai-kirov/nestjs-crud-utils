import { Injectable } from '@nestjs/common';
import { Upload } from '../models/upload.model';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { PgService } from './pg.service';
import { config } from '../../config';
import { QueryTypes } from 'sequelize';
import { UploadService, uploadTriggerModels } from './upload.service';

@Injectable()
export class UploadTriggerService {
	constructor(
		@InjectConnection()
		private sequelize: Sequelize,
		private readonly pgService: PgService,
		private readonly uploadService: UploadService,
	) {}

	public async onApplicationBootstrap(): Promise<void> {
		const isLeader = await config.isLeader();
		if (!isLeader) {
			return;
		}

		await this.removeTriggersAndFunctions();
		await this.createUploadRemovingTriggerAndEventListener();

		for (const crudModel of uploadTriggerModels) {
			await this.createRemovingTriggers(crudModel);
		}
	}

	private async removeTriggersAndFunctions() {
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

	private async createUploadRemovingTriggerAndEventListener() {
		const tableName = Upload.getTableName();
		const eventName = `${tableName}_removing_event`;

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

		this.pgService.addEventListener(eventName, async (payload) => {
			await this.removeUpload(payload.row);
		});
	}

	public async createRemovingTriggers(crudModel): Promise<void> {
		await this.createRemovingTriggersForHasOneRelations(crudModel);
		await this.createRemovingTriggersForManyToManyTables(crudModel);
	}

	private async createRemovingTriggersForHasOneRelations(crudModel) {
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

	private async createRemovingTriggersForManyToManyTables(crudModel) {
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

	private async createTrigger(tableName: string, functionBody: string, when = 'AFTER') {
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

	private async removeUpload(row) {
		await this.uploadService.remove(row);
	}
}
