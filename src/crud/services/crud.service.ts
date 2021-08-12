import { UploadService } from '../../upload/services/upload.service';
import { utils } from '../../utils';
import { EntityService, Include } from './entity.service';
import { UPLOAD_METADATA_KEY } from '../../decorators/upload.decorator';
import { Op } from 'sequelize';
import { Model } from 'sequelize-typescript';
import { ADVANCED_MULTIPLE_RELATON_METADATA_KEY } from '../../decorators/advanced.object.multiple.relation.decorator';
import { crudValidationService, CrudValidationService } from './crud.validation.service';
import { config } from '../../config';
import { plainToClass } from 'class-transformer';
import { Upload } from '../../upload/models/upload.model';
import { UploadParam } from '../../upload/services/upload.service';
import { Request } from 'express';

export type CrudOptions = {
	withDtoValidation?: boolean;
	withRelationValidation?: boolean;
	withUploadValidation?: boolean;
	withTriggersCreation?: boolean;
	withActiveUpdate?: false | ActiveUpdate;
	unscoped?: boolean;
	additionalScopes?: string[];
	childModels?: any[];
};

export interface ActiveUpdate {
	calcActive?: (dto) => boolean;
	childs: Array<Record<string, any> | ActiveUpdateOption>;
}
export interface ActiveUpdateOption {
	model: any;
	field: string;
	trueValue: boolean | string;
	falsyValue: boolean | string;
}

export type Files = { [key: string]: any } | any[];

export class CrudService<T> extends EntityService<T> {
	public static DEFAULT_CRUD_OPTIONS: CrudOptions = {
		withDtoValidation: true,
		withRelationValidation: true,
		withUploadValidation: true,
		withTriggersCreation: true,
		withActiveUpdate: false,
		unscoped: true,
		additionalScopes: [],
		childModels: [],
	};
	public readonly crudOptions: CrudOptions = {};
	public readonly upload: UploadService;
	protected readonly dtoType;
	protected readonly crudValidationService: CrudValidationService<T>;

	constructor(
		crudModel,
		dtoType: Record<string, any>,
		uploadService: UploadService,
		options: CrudOptions = {},
	) {
		super(crudModel, {
			unscoped:
				options.unscoped !== undefined
					? options.unscoped
					: CrudService.DEFAULT_CRUD_OPTIONS.unscoped,
			unscopedInclude:
				options.unscoped !== undefined
					? options.unscoped
					: CrudService.DEFAULT_CRUD_OPTIONS.unscoped,
			additionalScopes:
				options.additionalScopes !== undefined
					? options.additionalScopes
					: CrudService.DEFAULT_CRUD_OPTIONS.additionalScopes,
		});

		this.upload = uploadService;
		this.dtoType = dtoType;
		this.crudValidationService = crudValidationService;

		const crudOptions = { ...CrudService.DEFAULT_CRUD_OPTIONS, ...options };
		for (const prop in crudOptions) {
			if (Object.hasOwnProperty.call(crudOptions, prop)) {
				this.crudOptions[prop] = crudOptions[prop];
			}
		}

		this.checkConflictRelations();

		if (this.crudOptions.withTriggersCreation) {
			this.upload.createRemovingTriggers(crudModel);

			for (const childModel of this.crudOptions.childModels) {
				this.upload.createRemovingTriggers(childModel);
			}
		}
	}

	public getDtoType(dto: Record<string, any>): any {
		return this.dtoType?.constructor !== Object ? this.dtoType : dto.constructor;
	}

	public getChildModel(dto: Record<string, any>): any {
		return null;
	}

	public getChildModelKey(): string | null {
		return null;
	}

	public async findAfterCreateOrUpdate(id: string): Promise<T> {
		return this.findOneById(id);
	}

	protected async fillDto(
		id: string | null,
		dto: Record<string, any>,
		req: Request,
	): Promise<Record<string, any>> {
		return dto;
	}

	protected getIncludeOptions(): Include {
		return { all: true };
	}

	public getConflictRelations(): string[] {
		return Object.entries(this.__crudModel__.associations)
			.filter(
				([key, value]: any) =>
					['HasOne', 'HasMany', 'BelongsToMany'].includes(value.associationType) &&
					value.target.prototype.constructor !== Upload,
			)
			.map(([key, value]: any) => key);
	}

	public async validateRequest(
		id: string | null,
		dto: Record<string, any>,
		files: Files,
		req: Request,
	): Promise<{ dto: Record<string, any>; files: Files }> {
		return { dto, files };
	}

	public async validateCreateRequest(
		dto: Record<string, any>,
		files: Files,
		req: Request,
	): Promise<{ dto; files }> {
		return { dto, files };
	}

	public async validateUpdateRequest(
		id: string,
		dto: Record<string, any>,
		files: Files,
		req: Request,
	): Promise<{ dto: Record<string, any>; files: Files }> {
		return { dto, files };
	}

	public async validateDeleteRequest(id: string, force?: boolean, req?: Request): Promise<void> {}

	public async create(dto: Record<string, any>, files: Files, req: Request): Promise<T> {
		dto = await this.fillDto(null, dto, req);
		dto = this.getDtoType(dto) ? plainToClass(this.getDtoType(dto), dto) : dto;

		let entity = this.__crudModel__.build();
		entity = await this.updateProperties(entity, dto, req);
		await this.updateRelations(entity, dto, files, req);
		await this.updateUploads(entity, dto, files);

		if ((this.crudOptions.withActiveUpdate as ActiveUpdate)?.childs?.length) {
			await this.updateActive(entity, dto);
		}
		return entity;
	}

	public async bulkCreate(dto: Record<string, any>, req: Request): Promise<void> {
		for (let chunk of dto.bulk) {
			if (this.crudOptions.withDtoValidation) {
				chunk = await this.validateDto(this.getDtoType(chunk), chunk);
			}
			chunk = await this.fillDto(null, chunk, req);
			chunk = this.getDtoType(dto) ? plainToClass(this.getDtoType(dto), chunk) : chunk;

			let entity = this.__crudModel__.build();
			entity = await this.updateProperties(entity, chunk, req);
			await this.updateRelations(entity, chunk, {}, req);

			if ((this.crudOptions.withActiveUpdate as ActiveUpdate)?.childs?.length) {
				await this.updateActive(entity, chunk);
			}
		}
	}

	public async updateById(
		id: string,
		dto: Record<string, any>,
		files: Files,
		req: Request,
	): Promise<T> {
		dto = await this.fillDto(id, dto, req);
		dto = this.getDtoType(dto) ? plainToClass(this.getDtoType(dto), dto) : dto;

		let entity = await this.findOneById(id, { include: [] });
		entity = await this.updateProperties(entity, dto, req);
		await this.updateRelations(entity, dto, files, req);
		await this.updateUploads(entity, dto, files);

		if ((this.crudOptions.withActiveUpdate as ActiveUpdate)?.childs?.length) {
			await this.updateActive(entity, dto);
		}
		return entity;
	}

	protected async updateProperties(entity: T, dto: Record<string, any>, req: Request): Promise<T> {
		const parentSingleRelations = this.getSingleRelations().map((v) => v.name);
		const parentMultipleRelations = this.getMultipleRelations().map((v) => v.name);
		const uploads = this.getUploads(dto).map((v) => v.name);
		let childSingleRelations = [];
		let childMultipleRelations = [];

		const childModel = this.getChildModel(dto);
		if (childModel) {
			childSingleRelations = this.getSingleRelations(childModel).map((v) => v.name);
			childMultipleRelations = this.getMultipleRelations(childModel).map((v) => v.name);
		}

		for (const prop in dto) {
			if (Object.prototype.hasOwnProperty.call(dto, prop)) {
				if (
					parentMultipleRelations.includes(prop) ||
					uploads.includes(prop) ||
					childSingleRelations.includes(prop) ||
					childMultipleRelations.includes(prop)
				) {
					continue;
				}

				if (parentSingleRelations.includes(prop)) {
					entity[`${prop}Id`] = dto[prop] ?? null;
				} else {
					entity[prop] = dto[prop];
				}
			}
		}

		return (entity as any).save();
	}

	protected async updateRelations(
		entity: T,
		dto: Record<string, any>,
		files: Files,
		req: Request,
	): Promise<void> {
		const advancedMultipleRelations = this.getAdvancedMultipleRelations(dto).map((v) => v.name);

		for (const relation of this.getMultipleRelations()) {
			if (dto[relation.name] && !advancedMultipleRelations.includes(relation.name)) {
				await (entity as any)[`set${utils.ucFirst(relation.name)}`](dto[relation.name]);
			}
		}

		const childModel = this.getChildModel(dto);
		if (childModel) {
			await this.updateChildRelations(childModel, entity, dto, req);
		}

		await this.updateAdvancedMultipleRelations(entity, dto, req);
	}

	protected async updateChildRelations(
		childModel,
		entity: Record<string, any>,
		dto: Record<string, any>,
		req: Request,
	): Promise<void> {
		let childEntity = await childModel.findOne({
			where: { [this.getChildModelKey()]: entity.id },
		});

		if (!childEntity) {
			childEntity = childModel.build();
			childEntity[this.getChildModelKey()] = entity.id;
		}

		const parentSingleRelations = this.getSingleRelations().map((v) => v.name);
		const parentMultipleRelations = this.getMultipleRelations().map((v) => v.name);
		const uploads = this.getUploads(dto).map((v) => v.name);
		const childSingleRelations = this.getSingleRelations(childModel).map((v) => v.name);
		const childMultipleRelations = this.getMultipleRelations(childModel).map((v) => v.name);

		for (const prop in dto) {
			if (
				parentSingleRelations.includes(prop) ||
				parentMultipleRelations.includes(prop) ||
				uploads.includes(prop) ||
				childMultipleRelations.includes(prop)
			) {
				continue;
			}

			if (childSingleRelations.includes(prop)) {
				childEntity[`${prop}Id`] = dto[prop] ?? null;
			} else {
				childEntity[prop] = dto[prop];
			}
		}

		childEntity = await childEntity.save();

		for (const childRelation of this.getMultipleRelations(childModel)) {
			if (dto[childRelation.name]) {
				await (childEntity as any)[`set${utils.ucFirst(childRelation.name)}`](
					dto[childRelation.name],
				);
			}
		}
	}

	protected async updateAdvancedMultipleRelations(
		entity: T,
		dto: Record<string, any>,
		req: Request,
	): Promise<void> {
		for (const relation of this.getAdvancedMultipleRelations(dto)) {
			const input = dto[relation.name];

			if (!input?.length) {
				continue;
			}

			const association = this.__crudModel__.associations[relation.name];
			if (association.associationType !== 'HasMany') {
				continue;
			}

			const existingEntities = entity ? await entity[`get${utils.ucFirst(relation.name)}`]() : [];
			const ids = input.filter((v) => v.id).map((v) => v.id);
			const entitiesToRemove = existingEntities.filter((v) => !ids.includes(v.id));

			for (const entityToRemove of entitiesToRemove) {
				await entityToRemove.destroy();
			}

			await Promise.all(
				input
					.filter((v) => v.id)
					.map(async (values) => {
						let link: Model = existingEntities.find((v) => v.id === values.id);
						for (const [key, value] of Object.entries(values)) {
							if (key !== 'id') {
								link[key] = value;
							}
						}
						link = await link.save();

						for (const linkRelation of this.getMultipleRelations(association.target)) {
							if (values[linkRelation.name]) {
								await (link as any)[`set${utils.ucFirst(linkRelation.name)}`](
									values[linkRelation.name] ?? [],
								);
							}
						}
					}),
			);

			await Promise.all(
				input
					.filter((v) => !v.id)
					.map(async (values) => {
						const link: Model = await association.target.create({
							[utils.snakeCaseToCamel(association.foreignKey)]: entity['id'],
							...values,
						});

						for (const linkRelation of this.getMultipleRelations(association.target)) {
							if (values[linkRelation.name]) {
								await (link as any)[`set${utils.ucFirst(linkRelation.name)}`](
									values[linkRelation.name],
								);
							}
						}
					}),
			);
		}
	}

	protected async updateUploads(entity: T, dto: Record<string, any>, files: Files): Promise<void> {
		const parentUploads = this.getUploads(dto).filter((v) =>
			this.getUploadRelations().includes(v.name),
		);
		await this.updateUploadsHelper(parentUploads, files, dto, entity);

		const childModel = this.getChildModel(dto);
		if (childModel) {
			const childEntity = await childModel.findOne({
				where: { [this.getChildModelKey()]: entity['id'] },
			});

			const childUploads = this.getUploads(dto).filter((v) =>
				this.getUploadRelations(childModel).includes(v.name),
			);
			await this.updateUploadsHelper(childUploads, files, dto, childEntity);
		}
	}

	protected async updateUploadsHelper(
		uploads,
		files: Files,
		dto: Record<string, any>,
		entity: T,
	): Promise<void> {
		for (const upload of uploads) {
			await this.upload.createOrUpdate({
				propName: upload.name,
				files,
				dto,
				entity,
				width: upload.width,
				height: upload.height,
				handlePicture: upload.handlePicture,
				uploadFolder: `${config.getUploadOptions().folders[0]}/${this.tableName}`,
			});
		}
	}

	protected async updateActive(entity: T, dto: Record<string, any>): Promise<void> {
		await this.updateActiveHelper(this.__crudModel__, entity['id'], dto, []);
	}

	protected async updateActiveHelper(
		model,
		linkedIds: string | string[],
		dto: Record<string, any>,
		processedManyToMany: any[],
	): Promise<void> {
		const associationTypes = ['HasOne', 'HasMany', 'BelongsToMany'];
		const options = <ActiveUpdate>this.crudOptions.withActiveUpdate;
		const isActive = options.calcActive ? options.calcActive(dto) : ((dto) => dto.isActive)(dto);

		if (!options.childs?.length) {
			return;
		}

		const childs = options.childs.map((v: any) => (v.model ? v.model : v));

		await Promise.all(
			Object.entries(model.associations)
				.map(([key, value]: any) => value)
				.filter((association) => associationTypes.includes(association.associationType))
				.map(async (association) => {
					const option = <ActiveUpdateOption>(
						options.childs.find(
							(v: any) => v === association.target || v.model == association.target,
						)
					);
					let entities = [];
					let entitiesToUpdate = [];

					if (option) {
						const ids = Array.isArray(linkedIds) ? linkedIds : [linkedIds];
						const field = option.field ?? 'isActive';
						const trueValue = option.trueValue ?? true;
						const falsyValue = option.falsyValue ?? false;

						if (association.associationType === 'BelongsToMany') {
							if (processedManyToMany.includes(association.source)) {
								return;
							}

							entitiesToUpdate = await association.target.unscoped().findAll({
								include: [
									{
										model: association.source,
										where: {
											id: {
												[Op.in]: ids,
											},
										},
										required: true,
									},
								],
							});

							if (entitiesToUpdate.length) {
								const [_, updateResult] = await association.target.unscoped().update(
									{ [field]: isActive ? trueValue : falsyValue },
									{
										where: { id: { [Op.in]: entitiesToUpdate.map((v) => v.id) } },
										returning: true,
									},
								);
								entities = updateResult;
							}

							processedManyToMany.push(association.target);
						} else {
							entitiesToUpdate = await association.target.unscoped().findAll({
								where: {
									[utils.snakeCaseToCamel(association.foreignKey)]: {
										[Op.in]: ids,
									},
								},
							});

							const [_, updateResult] = await association.target.unscoped().update(
								{ [field]: isActive ? trueValue : falsyValue },
								{
									where: {
										[utils.snakeCaseToCamel(association.foreignKey)]: {
											[Op.in]: ids,
										},
									},
									returning: true,
								},
							);
							entities = updateResult;
						}
					}

					if (entities?.length || this.isAssociationLinked(childs, association.target, [])) {
						await this.updateActiveHelper(
							association.target,
							entitiesToUpdate.map((v) => v.id),
							dto,
							processedManyToMany,
						);
					}
				}),
		);
	}

	private isAssociationLinked(
		comparisonModels: Record<string, any>[],
		model: Record<string, any>,
		processedManyToMany: any[],
	) {
		const associationTypes = ['HasOne', 'HasMany', 'BelongsToMany'];
		let isLinked = false;

		const associations = Object.entries(model.associations)
			.map(([key, value]: any) => value)
			.filter((association) => associationTypes.includes(association.associationType));

		for (const association of associations) {
			if (association.associationType === 'BelongsToMany') {
				if (processedManyToMany.includes(association.source)) {
					return;
				}
				processedManyToMany.push(association.target);
			}

			if (comparisonModels.find((v) => v.getTableName() === association.target.getTableName())) {
				isLinked = true;
				break;
			}

			if (association.target.associations?.length) {
				this.isAssociationLinked(comparisonModels, association.target, processedManyToMany);
			}
		}

		return isLinked;
	}

	public async removeById(id: string): Promise<void> {
		await this.crudModel.destroy({ where: { id } } as any);
	}

	public async validateBeforeCreating(
		dto: Record<string, any>,
		files: Files,
		req: Request,
	): Promise<{ dto: Record<string, any>; files: Files; [key: string]: any }> {
		return this.crudValidationService.validateBeforeCreating(this, dto, files, req);
	}
	public async validateBeforeBulkCreating(dto: Record<string, any>, req: Request): Promise<void> {
		return this.crudValidationService.validateBeforeBulkCreating(this, dto, req);
	}
	public async validateBeforeUpdating(
		id: string,
		dto: Record<string, any>,
		files: Files,
		req: Request,
	): Promise<{ dto: Record<string, any>; files: Files; [key: string]: any }> {
		return this.crudValidationService.validateBeforeUpdating(this, id, dto, files, req);
	}
	public async validateBeforeRemoving(id: string, force?: boolean, req?: Request): Promise<void> {
		return this.crudValidationService.validateBeforeRemoving(this, id, force, req);
	}

	public getUploads(dto?: Record<string, any>): Array<UploadParam> {
		return this.getMetadataHelper(UPLOAD_METADATA_KEY, dto);
	}

	public getAdvancedMultipleRelations(dto: Record<string, any>) {
		return this.getMetadataHelper(ADVANCED_MULTIPLE_RELATON_METADATA_KEY, dto);
	}

	private getMetadataHelper(key: string, dto?) {
		if (!this.getDtoType(dto)?.prototype) {
			return [];
		}
		return Reflect.getMetadata(key, this.getDtoType(dto).prototype) ?? [];
	}

	public normalizeFiles(requestedFiles: Files = []): {
		[key: string]: any;
	} {
		if (!Array.isArray(requestedFiles)) {
			return requestedFiles;
		}

		const files = {};
		for (const requestedFile of requestedFiles) {
			if (!files[requestedFile.fieldname]) {
				files[requestedFile.fieldname] = [];
			}
			files[requestedFile.fieldname].push(requestedFile);
		}
		return files;
	}

	public checkConflictRelations(): void {
		const associations = Object.keys(this.__crudModel__.associations);
		this.getConflictRelations().forEach((relation) => {
			if (!associations.includes(relation)) {
				throw new Error(
					`Please check method getConflictRelations() on model ${this.entityName}, link ${relation} doesn't exist`,
				);
			}
		});
	}
}
