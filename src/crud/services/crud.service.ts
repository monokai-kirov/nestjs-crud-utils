import { UploadService } from "../../upload/services/upload.service";
import { utils } from "../../utils";
import { EntityService, Include } from "./entity.service";
import { UPLOAD_METADATA_KEY } from "../../decorators/upload.decorator";
import { Op } from "sequelize";
import { Model } from 'sequelize-typescript';
import { ADVANCED_MULTIPLE_RELATON_METADATA_KEY } from "../../decorators/advanced.object.multiple.relation.decorator";
import { crudValidationService, CrudValidationService } from './crud.validation.service';
import { config } from "../../config";
import { plainToClass } from "class-transformer";
import { Upload } from "../../upload/models/upload.model";
import { UploadParam } from '../../upload/services/upload.service';

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
	calcActive?: (dto) => {};
	childs: Array<Object | ActiveUpdateOption>;
}
export interface ActiveUpdateOption {
	model: any;
	field: string;
	trueValue: boolean|string;
	falsyValue: boolean|string;
}

export class CrudService<T> extends EntityService<T> {
	/**
	 * @Override
	 */
	public getDtoType(dto) { return this.dtoType?.constructor !== Object ? this.dtoType : dto.constructor; }
	protected async fillDto(id: string|null, dto): Promise<Object> { return dto; }
	protected getIncludeOptions(): Include { return { all: true }; }
	public getConflictRelations(): string[] {
		return Object.entries((this.__crudModel__).associations)
			.filter(([key, value]: any) =>
				['HasOne', 'HasMany', 'BelongsToMany'].includes(value.associationType)
				&& value.target.prototype.constructor !== Upload)
			.map(([key, value]: any) => key);
	};
	public async validateRequest(id: string|null, dto, files, req): Promise<{ dto, files }> { return { dto, files }; }
	public async validateCreateRequest(dto, files, req): Promise<{ dto, files }> { return { dto, files }; }
	public async validateUpdateRequest(id: string, dto, files, req): Promise<{ dto, files }> { return { dto, files }; }
	public async validateDeleteRequest(id: string, force?: boolean): Promise<void> {}
	public getChildModel(dto) { return null; }
	public getChildModelKey(): string { return null; }
	public findAfterCreateOrUpdate(id: string) { return this.findOneById(id); }


	public static DEFAULT_CRUD_OPTIONS: CrudOptions = {
		withDtoValidation: true,
		withRelationValidation: true,
		withUploadValidation: true,
		withTriggersCreation: true,
		withActiveUpdate: false,
		unscoped: true,
		additionalScopes: ['admin'],
		childModels: [],
	};
	public readonly crudOptions: CrudOptions = {};
	public readonly upload: UploadService;
	protected readonly dtoType;
	protected readonly crudValidationService: CrudValidationService<T>;

	constructor(crudModel, dtoType: Object, uploadService: UploadService, options: CrudOptions = {}) {
		super(crudModel, {
			unscoped: options.unscoped !== undefined ? options.unscoped : CrudService.DEFAULT_CRUD_OPTIONS.unscoped,
			unscopedInclude: options.unscoped !== undefined ? options.unscoped : CrudService.DEFAULT_CRUD_OPTIONS.unscoped,
			additionalScopes: options.additionalScopes !== undefined ? options.additionalScopes : CrudService.DEFAULT_CRUD_OPTIONS.additionalScopes,
		});

		if (this.__crudModel__.scope.order) {
			this.__crudModel__.addScope('admin', { order: this.__crudModel__._scope.order }, { override: true });
		}

		this.upload = uploadService;
		this.dtoType = dtoType;
		this.crudValidationService = crudValidationService;

		const crudOptions = { ...CrudService.DEFAULT_CRUD_OPTIONS, ...options };
		for (let prop in crudOptions) {
			if (Object.hasOwnProperty.call(crudOptions, prop)) {
				this.crudOptions[prop] = crudOptions[prop];
			}
		}

		this.checkConflictRelations();

		if (this.crudOptions.withTriggersCreation) {
			this.upload.createRemovingTriggers(crudModel);

			for (let childModel of this.crudOptions.childModels) {
				this.upload.createRemovingTriggers(childModel);
			}
		}
	}

	public async create(dto, files): Promise<T> {
		dto = await this.fillDto(null, dto);
		dto = this.getDtoType(dto) ? plainToClass(this.getDtoType(dto), dto) : dto;
		let entity = this.__crudModel__.build();
		entity = await this.updateProperties(entity, dto);
		await this.updateRelations(entity, dto, files);
		await this.updateUploads(entity, dto, files);
		if ((this.crudOptions.withActiveUpdate as ActiveUpdate)?.childs?.length) {
			await this.updateActive(entity, dto);
		}
		return entity;
	}

	public async bulkCreate(dto) {
		for (let chunk of dto.bulk) {
			if (this.crudOptions.withDtoValidation) {
				chunk = await this.validateDto(this.getDtoType(chunk), chunk);
			}
			chunk = await this.fillDto(null, chunk);
			chunk = this.getDtoType(dto) ? plainToClass(this.getDtoType(dto), chunk) : chunk;
			let entity = this.__crudModel__.build();
			entity = await this.updateProperties(entity, chunk);
			await this.updateRelations(entity, chunk, {});
			if ((this.crudOptions.withActiveUpdate as ActiveUpdate)?.childs?.length) {
				await this.updateActive(entity, chunk);
			}
		}
	}

	public async updateById(id: string, dto, files): Promise<T> {
		dto = await this.fillDto(id, dto);
		dto = this.getDtoType(dto) ? plainToClass(this.getDtoType(dto), dto) : dto;
		let entity = await this.findOneById(id, { include: [] });
		entity = await this.updateProperties(entity, dto);
		await this.updateRelations(entity, dto, files);
		await this.updateUploads(entity, dto, files);
		if ((this.crudOptions.withActiveUpdate as ActiveUpdate)?.childs?.length) {
			await this.updateActive(entity, dto);
		}
		return entity;
	}

	protected async updateProperties(entity: T, dto): Promise<T> {
		const parentSingleRelations = this.getSingleRelations().map(v => v.name);
		const parentMultipleRelations = this.getMultipleRelations().map(v => v.name);
		const uploads = this.getUploads(dto).map(v => v.name);
		let childSingleRelations = [];
		let childMultipleRelations = [];

		const childModel = this.getChildModel(dto);
		if (childModel) {
			childSingleRelations = this.getSingleRelations(childModel).map(v => v.name);
			childMultipleRelations = this.getMultipleRelations(childModel).map(v => v.name);
		}

		for (let prop in dto) {
			if (Object.prototype.hasOwnProperty.call(dto, prop)) {
				if (parentMultipleRelations.includes(prop)
					|| uploads.includes(prop)
					|| childSingleRelations.includes(prop)
					|| childMultipleRelations.includes(prop)
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

	protected async updateRelations(entity: T, dto, files) {
		const advancedMultipleRelations = this.getAdvancedMultipleRelations(dto).map(v => v.name);

		for (let relation of this.getMultipleRelations()) {
			if (dto[relation.name] && !advancedMultipleRelations.includes(relation.name)) {
				await (entity as any)[`set${utils.ucFirst(relation.name)}`](dto[relation.name]);
			}
		}

		const childModel = this.getChildModel(dto);
		if (childModel) {
			await this.updateChildRelations(childModel, entity, dto);
		}

		await this.updateAdvancedMultipleRelations(entity, dto);
	}

	protected async updateChildRelations(childModel, entity, dto) {
		let childEntity = await childModel.findOne({
			where: { [this.getChildModelKey()]: entity.id },
		});

		if (!childEntity) {
			childEntity = childModel.build();
			childEntity[this.getChildModelKey()] = entity.id;
		}

		const parentSingleRelations = this.getSingleRelations().map(v => v.name);
		const parentMultipleRelations = this.getMultipleRelations().map(v => v.name);
		const uploads = this.getUploads(dto).map(v => v.name);
		const childSingleRelations = this.getSingleRelations(childModel).map(v => v.name);
		const childMultipleRelations = this.getMultipleRelations(childModel).map(v => v.name);

		for (let prop in dto) {
			if (parentSingleRelations.includes(prop)
				|| parentMultipleRelations.includes(prop)
				|| uploads.includes(prop)
				|| childMultipleRelations.includes(prop)
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

		for (let childRelation of this.getMultipleRelations(childModel)) {
			if (dto[childRelation.name]) {
				await (childEntity as any)[`set${utils.ucFirst(childRelation.name)}`](dto[childRelation.name]);
			}
		}
	}

	protected async updateAdvancedMultipleRelations(entity: T, dto) {
		for (let relation of this.getAdvancedMultipleRelations(dto)) {
			let input = dto[relation.name];

			if (!input?.length) {
				return;
			}

			const association = this.__crudModel__.associations[relation.name];
			if (association.associationType !== 'HasMany') {
				continue;
			}

			let existingEntities = entity ? await entity[`get${utils.ucFirst(relation.name)}`]() : [];
			const ids = input.filter(v => v.id).map(v => v.id);
			const entitiesToRemove = existingEntities.filter(v => !ids.includes(v.id));

			for (let entityToRemove of entitiesToRemove) {
				await entityToRemove.destroy();
			}

			await Promise.all(
				input
					.filter(v => v.id)
					.map(async (values) => {
						let link: Model = existingEntities.find(v => v.id === values.id);
						for (let [key, value] of Object.entries(values)) {
							if (key !== 'id') {
								link[key] = value;
							}
						}
						link = await link.save();

						for (let linkRelation of this.getMultipleRelations(association.target)) {
							if (values[linkRelation.name]) {
								await (link as any)[`set${utils.ucFirst(linkRelation.name)}`](values[linkRelation.name] ?? []);
							}
						}
					})
			)

			await Promise.all(
				input
					.filter(v => !v.id)
					.map(async (values) => {

						let link: Model = await association.target.create({
							[utils.snakeCaseToCamel(association.foreignKey)]: entity['id'],
							...values,
						});

						for (let linkRelation of this.getMultipleRelations(association.target)) {
							if (values[linkRelation.name]) {
								await (link as any)[`set${utils.ucFirst(linkRelation.name)}`](values[linkRelation.name]);
							}
						}
					})
			);
		}
	}

	protected async updateUploads(entity: T, dto, files) {
		const parentUploads = this.getUploads(dto).filter(v => this.getUploadRelations().includes(v.name));
		await this.updateUploadsHelper(parentUploads, files, dto, entity);

		const childModel = this.getChildModel(dto);
		if (childModel) {
			const childEntity = await childModel.findOne({
				where: { [this.getChildModelKey()]: entity['id'] },
			});

			const childUploads = this.getUploads(dto).filter(v => this.getUploadRelations(childModel).includes(v.name));
			await this.updateUploadsHelper(childUploads, files, dto, childEntity);
		}
	}

	protected async updateUploadsHelper(uploads, files, dto, entity) {
		for (let upload of uploads) {
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

	protected async updateActive(entity: T, dto) {
		const processedManyToMany = [];
		await this.updateActiveHelper(this.__crudModel__, entity['id'], dto, processedManyToMany);
	}

	protected async updateActiveHelper(model, linkedIds: string|string[], dto, processedManyToMany: any[]) {
		const associationTypes = ['HasOne', 'HasMany', 'BelongsToMany'];
		const options = <ActiveUpdate>this.crudOptions.withActiveUpdate;
		const isActive = options.calcActive ?? ((dto) => dto.isActive)(dto);

		if (!options.childs?.length) {
			return;
		}

		return Promise.all(Object.entries(model.associations)
				.map(([key, value]: any) => value)
				.filter(association => associationTypes.includes(association.associationType))
				.map(async (association) => {
					const option = <ActiveUpdateOption>options.childs.find((v: any) => v === association.target || v.model == association.target);
					if (!option) {
						return;
					}

					const ids = Array.isArray(linkedIds) ? linkedIds : [linkedIds];
					let entities = [];
					const field = option.field ?? 'isActive';
					const trueValue = option.trueValue ?? true;
					const falsyValue = option.falsyValue ?? false;

					if (association.associationType === 'BelongsToMany') {
						if (processedManyToMany.includes(association.source)) {
							return;
						}

						const entitiesToUpdate = await (association.target.unscoped()).findAll({
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
							const [_, updateResult] = await (association.target.unscoped()).update(
								{ [field]: isActive ? trueValue : falsyValue },
								{ where: { id: { [Op.in]: entitiesToUpdate.map(v => v.id) }},
									returning: true,
								},
							);
							entities = updateResult;
						}

						processedManyToMany.push(association.target);
					} else {
						const [_, updateResult] = await (association.target.unscoped()).update(
							{ [field]: isActive ? trueValue : falsyValue },
							{
								where: {
									[utils.snakeCaseToCamel(association.foreignKey)]: {
										[Op.in]: ids,
									},
								},
								returning: true
							},
						);
						entities = updateResult;
					}

					if (entities.length) {
						await this.updateActiveHelper(association.target, entities.map(v => v.id), dto, processedManyToMany);
					}
				})
		);
	}

	public async removeById(id: string) {
		await this.crudModel.destroy({ where: { id }} as any);
	}

	public async validateBeforeCreating(dto, files, req) {
		return this.crudValidationService.validateBeforeCreating(this, dto, files, req);
	}
	public async validateBeforeBulkCreating(dto, req) {
		return this.crudValidationService.validateBeforeBulkCreating(this, dto, req);
	}
	public async validateBeforeUpdating(id: string, dto, files, req) {
		return this.crudValidationService.validateBeforeUpdating(this, id, dto, files, req);
	}
	public async validateBeforeRemoving(id: string, force?: boolean) {
		return this.crudValidationService.validateBeforeRemoving(this, id, force);
	}

	public getUploads(dto?): Array<UploadParam> {
		return this.getMetadataHelper(UPLOAD_METADATA_KEY, dto);
	}

	public getAdvancedMultipleRelations(dto) {
		return this.getMetadataHelper(ADVANCED_MULTIPLE_RELATON_METADATA_KEY, dto);
	}

	private getMetadataHelper(key: string, dto?) {
		if (!this.getDtoType(dto)?.prototype) {
			return [];
		}
		return Reflect.getMetadata(key, this.getDtoType(dto).prototype) ?? [];
	}

	public normalizeFiles(requestedFiles: { [key: string]: string }|any[] = []) {
		if (!Array.isArray(requestedFiles)) {
			return requestedFiles;
		}

		const files = {};
		for (let requestedFile of requestedFiles) {
			if (!files[requestedFile.fieldname]) {
				files[requestedFile.fieldname] = [];
			}
			files[requestedFile.fieldname].push(requestedFile);
		}
		return files;
	}

	public checkConflictRelations() {
		const associations = Object.keys(this.__crudModel__.associations);
		this.getConflictRelations().forEach(relation => {
			if (!associations.includes(relation)) {
				throw new Error(`Please check method getConflictRelations() on model ${this.entityName}, link ${relation} doesn't exist`);
			}
		});
	}
}