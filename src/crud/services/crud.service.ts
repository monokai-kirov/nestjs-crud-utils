import { Op } from 'sequelize';
import { Model } from 'sequelize-typescript';
import { Request } from 'express';
import { isEmpty } from 'class-validator';
import { plainToClass } from 'class-transformer';
import {
	ActiveUpdate,
	ActiveUpdateOption,
	CrudOptions,
	Files,
	Include,
	SearchingProps,
	ValidateResult,
} from '../types';
import { utils } from '../../utils/utils';
import { config } from '../../utils/config';
import { EntityService } from './entity.service';
import { crudValidationService, CrudValidationService } from './crud.validation.service';
import { Upload } from '../../upload/models/upload.model';
import { UploadParam } from '../../upload/types';
import { UPLOAD_METADATA_KEY } from '../../utils/decorators/upload.decorator';
import { UploadService } from '../../upload/services/upload.service';
import { ADVANCED_MULTIPLE_RELATON_METADATA_KEY } from '../../utils/decorators/advanced.object.multiple.relation.decorator';

export class CrudService<T> extends EntityService<T> {
	public readonly crudOptions: CrudOptions = {};
	public readonly upload: UploadService;
	protected readonly dtoType;
	protected readonly crudValidationService: CrudValidationService<T>;
	protected static readonly DEFAULT_CRUD_OPTIONS: CrudOptions = {
		withDtoValidation: true,
		withRelationValidation: true,
		withUploadValidation: true,
		withTriggersCreation: true,
		withActiveUpdate: false,
		unscoped: true,
		additionalScopes: [],
		childModels: [],
	};

	constructor(
		crudModel,
		dtoType: Record<string, any>,
		uploadService: UploadService,
		options: CrudOptions = {},
	) {
		super(crudModel, {
			unscoped: options.unscoped ?? CrudService.DEFAULT_CRUD_OPTIONS.unscoped,
			unscopedInclude: options.unscoped ?? CrudService.DEFAULT_CRUD_OPTIONS.unscoped,
			additionalScopes:
				options.additionalScopes ?? CrudService.DEFAULT_CRUD_OPTIONS.additionalScopes,
		});

		this.crudOptions = { ...CrudService.DEFAULT_CRUD_OPTIONS, ...options };
		this.upload = uploadService;
		this.dtoType = dtoType;
		this.crudValidationService = crudValidationService;

		this.checkInclude(this.getListInclude(), 'list');
		this.checkInclude(this.getDetailInclude(), 'detail');
		this.checkConflictRelations();
		this.createTriggersIfNecessary(crudModel);
	}

	public getDtoType(dto: Record<string, any>): any {
		return this.dtoType?.constructor !== Object ? this.dtoType : dto.constructor;
	}

	/**
	 * Is used in getAll() in CrudController
	 */
	public getListInclude(): Include {
		return { all: true };
	}

	/**
	 * Is used in getById(), create(), bulkCreate(), putById() in CrudController
	 */
	public getDetailInclude(): Include {
		return { all: true };
	}

	/**
	 * For getAll() method in CrudController
	 */
	public getSearchingProps(): SearchingProps {
		return ['id', 'title'];
	}

	/**
	 * By default all links don't allow to delete the entity, you can override this behaviour
	 */
	public getConflictRelations(): string[] {
		return Object.entries(this.__crudModel__.associations)
			.filter(
				([key, value]: any) =>
					['HasOne', 'HasMany', 'BelongsToMany'].includes(value.associationType) &&
					value.target.prototype.constructor !== Upload,
			)
			.map(([key, value]: any) => key);
	}

	public getChildModel(dto: Record<string, any>): Model {
		return null;
	}

	public getChildModelKey(): string | null {
		return null;
	}

	/**
	 * If you want to add some new properties before saving
	 */
	protected async fillDto(
		id: string | null,
		dto: Record<string, any>,
		req: Request,
	): Promise<Record<string, any>> {
		return dto;
	}

	/**
	 * You can override this functions if you intend to handle custom cases of validation
	 */
	public async validateRequest(
		id: string | null,
		dto: Record<string, any>,
		files: Files,
		req: Request,
	): Promise<ValidateResult> {
		return { dto, files };
	}

	public async validateCreateRequest(
		dto: Record<string, any>,
		files: Files,
		req: Request,
	): Promise<ValidateResult> {
		return { dto, files };
	}

	public async validateUpdateRequest(
		id: string,
		dto: Record<string, any>,
		files: Files,
		req: Request,
	): Promise<ValidateResult> {
		return { dto, files };
	}

	public async validateDeleteRequest(id: string, force?: boolean, req?: Request): Promise<void> {}
	//---------------------------------------------

	public async validateBeforeCreating(
		dto: Record<string, any>,
		files: Files,
		req: Request,
	): Promise<ValidateResult> {
		return this.crudValidationService.validateBeforeCreating(this, dto, files, req);
	}

	public async validateBeforeBulkCreating(
		dto: Record<string, any>,
		files: Files,
		req: Request,
	): Promise<ValidateResult[]> {
		return this.crudValidationService.validateBeforeBulkCreating(this, dto, files, req);
	}

	public async validateBeforeUpdating(
		id: string,
		dto: Record<string, any>,
		files: Files,
		req: Request,
	): Promise<ValidateResult> {
		return this.crudValidationService.validateBeforeUpdating(this, id, dto, files, req);
	}

	public async validateBeforeRemoving(id: string, force?: boolean, req?: Request): Promise<void> {
		return this.crudValidationService.validateBeforeRemoving(this, id, force, req);
	}

	public async create(dto: Record<string, any>, files: Files, req: Request): Promise<T> {
		return this.updateHelper(this.__crudModel__.build(), dto, files, req);
	}

	public async bulkCreate(chunks: Record<string, any>[], req: Request): Promise<T[]> {
		const entities = [];
		for (const chunk of chunks) {
			entities.push(
				await this.updateHelper(this.__crudModel__.build(), chunk.dto, chunk.files, req),
			);
		}
		return entities;
	}

	public async updateById(
		id: string,
		dto: Record<string, any>,
		files: Files,
		req: Request,
	): Promise<T> {
		return this.updateHelper(await this.findOneById(id), dto, files, req);
	}

	public async removeById(id: string): Promise<void> {
		await this.__crudModel__.destroy({ where: { id } } as any);
	}

	public getUploads(dto?: Record<string, any>): Array<UploadParam> {
		return this.getMetadataHelper(UPLOAD_METADATA_KEY, dto);
	}

	public getAdvancedMultipleRelations(dto: Record<string, any>) {
		return this.getMetadataHelper(ADVANCED_MULTIPLE_RELATON_METADATA_KEY, dto);
	}

	public transformDto(dto: Record<string, any>): any {
		return this.getDtoType(dto) ? plainToClass(this.getDtoType(dto), dto) : dto;
	}

	public getIndividualFiles(dto: Record<string, any>, files: Files, index: number): Files {
		const uploadProps = this.getUploads(dto).map((v) => v.name);

		return files
			.filter((v) => uploadProps.map((v) => `${v}[${index}]`).includes(v.fieldname))
			.map((v) => ({
				...v,
				fieldname: v.fieldname.split('[')[0],
			}));
	}

	protected getMetadataHelper(key: string, dto?) {
		if (!this.getDtoType(dto)?.prototype) {
			return [];
		}
		return Reflect.getMetadata(key, this.getDtoType(dto).prototype) ?? [];
	}

	protected async updateHelper(
		entity: T,
		dto: Record<string, any>,
		files: Files,
		req: Request,
	): Promise<T> {
		const transformedDto = this.transformDto(
			await this.fillDto(entity['isNewRecord'] ? null : entity['id'], dto, req),
		);
		entity = await this.updateProperties(entity, transformedDto, req, 'parent');
		await this.updateRelations(entity, transformedDto, files, req);
		await this.updateUploads(entity, transformedDto, files);

		if ((this.crudOptions.withActiveUpdate as ActiveUpdate)?.childs?.length) {
			await this.updateActive(entity, transformedDto);
		}
		return entity;
	}

	protected async updateProperties(
		entity: T,
		dto: Record<string, any>,
		req: Request,
		context: 'parent' | 'child',
	): Promise<T> {
		const parentSingleRelations = this.getSingleRelations().map((v) => v.name);
		const parentMultipleRelations = this.getMultipleRelations().map((v) => v.name);
		const uploads = this.getUploads(dto).map((v) => v.name);
		const childModel = this.getChildModel(dto);
		const childSingleRelations = childModel
			? this.getSingleRelations(childModel).map((v) => v.name)
			: [];
		const childMultipleRelations = childModel
			? this.getMultipleRelations(childModel).map((v) => v.name)
			: [];

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

				const relations = context === 'parent' ? parentSingleRelations : childSingleRelations;
				if (relations.includes(prop)) {
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
		childEntity = await this.updateProperties(childEntity, dto, req, 'child');

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

			await this.createAdvancedMultipleRelationsHelper(input, association, entity);
			await this.updateAdvancedMultipleRelationsHelper(input, association, existingEntities);
		}
	}

	protected async createAdvancedMultipleRelationsHelper(
		input: any,
		association: any,
		entity: T,
	): Promise<void> {
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

	protected async updateAdvancedMultipleRelationsHelper(
		input: any,
		association: any,
		existingEntities: any[],
	): Promise<void> {
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
	}

	protected async updateUploads(entity: T, dto: Record<string, any>, files: Files): Promise<void> {
		await this.updateUploadsHelper(files, dto, entity);

		const childModel = this.getChildModel(dto);
		if (childModel) {
			const childEntity = await (childModel as any).findOne({
				where: { [this.getChildModelKey()]: entity['id'] },
			});
			await this.updateUploadsHelper(files, dto, childEntity, childModel);
		}
	}

	protected async updateUploadsHelper(
		files: Files,
		dto: Record<string, any>,
		entity: T,
		childModel?: any,
	): Promise<void> {
		const uploads = this.getUploads(dto).filter((v) =>
			(childModel ? this.getUploadRelations(childModel) : this.getUploadRelations()).includes(
				v.name,
			),
		);

		for (const upload of uploads) {
			await this.upload.createOrUpdate({
				propName: upload.name,
				files,
				dto,
				entity,
				resizeOptions: upload.resizeOptions,
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

	protected isAssociationLinked(
		comparisonModels: Record<string, any>[],
		model: Record<string, any>,
		processedManyToMany: any[],
	): boolean {
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

	protected checkInclude(include: Include, method: string): void {
		if (isEmpty((include as Record<string, any>)?.all)) {
			(include as Record<string, any>[]).forEach((child) =>
				this.checkIncludeHelper(this.__crudModel__.prototype.constructor, child, method),
			);
		}
	}

	protected checkIncludeHelper(parent: any, child: any, method: string): void {
		const childModel = child.model ?? child;
		const throwError = () => {
			throw new Error(
				`Please check method get${utils.ucFirst(method)}Include() on model ${
					this.entityName
				}, link ${this.getEntityNameByModel(parent)} with ${this.getEntityNameByModel(
					childModel,
				)} doesn't exist`,
			);
		};

		if (typeof childModel.getTableName !== 'function') {
			throwError();
		}

		const associations = Object.entries(parent.associations).map(
			([key, value]) => (value as any).target,
		);
		const associationWithSameTableName = associations.find(
			(v) => v.getTableName() === childModel.getTableName(),
		);
		if (!associations.includes(childModel) && !associationWithSameTableName) {
			throwError();
		}

		if (child.include) {
			child.include.forEach((subChild) => this.checkIncludeHelper(childModel, subChild, method));
		}
	}

	protected checkConflictRelations(): void {
		const associations = Object.keys(this.__crudModel__.associations);
		this.getConflictRelations().forEach((relation) => {
			if (!associations.includes(relation)) {
				throw new Error(
					`Please check method getConflictRelations() on model ${this.entityName}, link '${relation}' doesn't exist`,
				);
			}
		});
	}

	protected createTriggersIfNecessary(crudModel: any): void {
		if (this.crudOptions.withTriggersCreation) {
			this.upload.createRemovingTriggers(crudModel);

			for (const childModel of this.crudOptions.childModels) {
				this.upload.createRemovingTriggers(childModel);
			}
		}
	}
}
