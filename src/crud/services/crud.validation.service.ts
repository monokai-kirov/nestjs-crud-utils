import { BadRequestException, ConflictException } from "@nestjs/common";
import { plainToClass } from "class-transformer";
import { isEmpty } from "class-validator";
import { Upload } from "../../upload/models/upload.model";
import { utils } from "../../utils";
import { CrudService } from "./crud.service";

export class CrudValidationService<T> {
	/**
	 * For controller
	 */
	public async validateBeforeCreating(context: CrudService<T>, dto, files, req) {
		if (context.crudOptions.withDtoValidation) {
			dto = await context.validateDto(context.getDtoType(dto), dto);
		}

		await this.validateSameCodeIfNecessary(context, null, dto);

		if (context.crudOptions.withRelationValidation) {
			await this.validateRelations(context, dto);
		}
		dto = await this.validateAdvancedMultipleRelations(context, null, dto);

		const normalizedFiles = context.normalizeFiles(files);
		if (context.crudOptions.withUploadValidation) {
			await this.validateUploadCreateRequest(context, dto, normalizedFiles);
		}

		let { dto: transformedDto, files: transformedFiles } = await context.validateRequest(null, dto, normalizedFiles, req);
		const result = await context.validateCreateRequest(transformedDto, transformedFiles, req);
		return {
			dto: context.getDtoType(dto) ? plainToClass(context.getDtoType(dto), result.dto) : result.dto,
			...result,
		};
	}

	public async validateBeforeBulkCreating(context: CrudService<T>, dto, req) {
		for (let chunk of dto.bulk) {
			if (context.crudOptions.withDtoValidation) {
				chunk = await context.validateDto(context.getDtoType(dto), chunk);
			}

			await this.validateSameCodeIfNecessary(context, null, chunk);

			if (context.crudOptions.withRelationValidation) {
				await this.validateRelations(context, chunk);
			}
			chunk = await this.validateAdvancedMultipleRelations(context, null, chunk);

			await context.validateRequest(null, chunk, {}, req);
			await context.validateCreateRequest(chunk, {}, req);
		}
	}

	public async validateBeforeUpdating(context: CrudService<T>, id: string, dto, files, req) {
		await context.validateMandatoryId(id);

		if (context.crudOptions.withDtoValidation) {
			dto = await context.validateDto(context.getDtoType(dto), dto);
		}

		await this.validateSameCodeIfNecessary(context, id, dto);

		if (context.crudOptions.withRelationValidation) {
			await this.validateRelations(context, dto);
		}
		dto = await this.validateAdvancedMultipleRelations(context, id, dto);

		const normalizedFiles = context.normalizeFiles(files);
		if (context.crudOptions.withUploadValidation) {
			await this.validateUploadUpdateRequest(context, id, dto, normalizedFiles);
		}

		let { dto: transformedDto, files: transformedFiles } = await context.validateRequest(id, dto, normalizedFiles, req);
		const result = await context.validateUpdateRequest(id, transformedDto, transformedFiles, req);
		return {
			dto: context.getDtoType(dto) ? plainToClass(context.getDtoType(dto), result.dto) : result.dto,
			...result,
		};
	}

	public async validateBeforeRemoving(context: CrudService<T>, id: string, force?: boolean) {
		await context.validateMandatoryId(id);
		if (!force) {
			await this.validateConflictRelations(context, id);
		}
		await context.validateDeleteRequest(id, force);
	}

	/**
	 * Relations
	 */
	public async validateRelations(context: CrudService<T>, dto) {
		await this.validateRelationsHelper(context, dto);

		const childModel = context.getChildModel(dto);
		if (childModel) {
			await this.validateRelationsHelper(context, dto, childModel);
		}
	}

	protected async validateRelationsHelper(context: CrudService<T>, dto, model?) {
		for (let singleRelation of context.getSingleRelations(model)) {
			await context.validateOptionalId(dto[singleRelation.name], {
				model: singleRelation.model,
			});
		}

		const advancedMultipleRelations = context.getAdvancedMultipleRelations(dto).map(v => v.name);

		for (let multipleRelation of context.getMultipleRelations(model)) {
			if (!advancedMultipleRelations.includes(multipleRelation.name)) {
				await context.validateOptionalIds(dto[multipleRelation.name], {
					model: multipleRelation.model,
				});
			}
		}
	}

	public async validateAdvancedMultipleRelations(context: CrudService<T>, entityId: string|null, dto) {
		for (let relation of context.getAdvancedMultipleRelations(dto)) {
			let input = dto[relation.name];
			const count = input?.length ?? 0;

			if (count < relation.minCount || count > relation.maxCount) {
				throw new BadRequestException(`Property ${relation.name} minCount: ${relation.minCount}, maxCount: ${relation.maxCount}`);
			}

			if (!count) {
				return dto;
			}

			input = input.map(chunk => {
				try {
					return (typeof chunk === 'object' && chunk !== null) ? chunk : JSON.parse(chunk);
				} catch (e) {
					throw new BadRequestException(`Incorrect property ${relation.name}`);
				}
			});

			const association = context.__crudModel__.associations[relation.name];
			const relationsToValidate = Object.entries(association.target.associations)
				.filter(([key, value]: any) => value.associationType === 'BelongsTo')
				.map(([key, value]: any) => {
					return {
						model: value.target,
						identifier: utils.snakeCaseToCamel(value.identifier),
					};
				});

			for (let chunk of input) {
				if (chunk.id) {
					if (!entityId) {
						throw new BadRequestException(`Incorrect property ${relation.name}`);
					}
					await context.validateMandatoryId(chunk.id, {
						where: { [utils.snakeCaseToCamel(association.foreignKey)]: entityId },
						model: association.target,
					});
					const { id, ...dtoWithoutId } = chunk;
					await context.validateDto(relation.schema, dtoWithoutId);
				} else {
					await context.validateDto(relation.schema, chunk);
				}

				for (let relationToValidate of relationsToValidate) {
					if (!relation.unique.includes(relationToValidate.identifier)) {
						await context.validateOptionalId(chunk[relationToValidate.identifier], { model: relationToValidate.model });
					}
				}
			}

			for (let relationToValidate of relationsToValidate) {
				if (relation.unique.includes(relationToValidate.identifier)) {
					const ids = input.map(v => v[relationToValidate.identifier]).filter(v => v);
					await context.validateOptionalIds(ids, { model: relationToValidate.model });
				}
			}

			dto[relation.name] = input;
		}
		return dto;
	}

	protected async validateConflictRelations(context: CrudService<T>, id: string) {
		const associations = Object.entries(context.__crudModel__.associations)
			.filter(([key, value]: any) =>
				['HasOne', 'HasMany', 'BelongsToMany'].includes(value.associationType)
				&& value.target.prototype.constructor !== Upload)
			.map(([key, value]: any) => {
				return {
					key,
					model: value.target,
					associationType: value.associationType,
					foreignKey: value.foreignKey,
				};
			});

		for (let relationName of context.getConflictRelations()) {
			const hit = associations.find(v => v.key === relationName);
			if (!hit) {
				continue;
			}

			if (hit.associationType === 'BelongsToMany') {
				const entities = await (hit.model.unscoped()).findAll({
					attributes: ['id'],
					include: [
						{
							model: context.__crudModel__,
							where: { id },
							required: true,
						},
					],
				});

				if (entities?.length) {
					throw new ConflictException(`Can't remove ${context.entityName}. There are some links existing ${relationName}: ${entities.map(v => v.id).join(', ')}`);
				}
			} else {
				const entities = await (hit.model.unscoped()).findAll({
					attributes: ['id'],
					where: {
						[utils.snakeCaseToCamel(hit.foreignKey)]: id,
					},
				});

				if (entities?.length) {
					throw new ConflictException(`Can't remove ${context.entityName}. There are some links existing ${relationName}: ${entities.map(v => v.id).join(', ')}`);
				}
			}
		}
	}

	/**
	 * Uploads
	 */
	public async validateUploadCreateRequest(context: CrudService<T>, dto, files) {
		for (let upload of context.getUploads(dto)) {
			await context.upload.validateRequest({
				propName: upload.name,
				type: upload.type,
				files,
				minCount: upload.minCount,
				maxCount: upload.maxCount,
			});
		}
	}

	public async validateUploadUpdateRequest(context: CrudService<T>, id: string, dto, files) {
		const entity = await context.findOneById(id);
		const parentUploads = context.getUploads(dto).filter(v => context.getUploadRelations().includes(v.name));
		await this.validateUploadUpdateRequestHelper(context, parentUploads, files, dto, entity);

		const childModel = context.getChildModel(dto);
		if (childModel) {
			const childEntity = await childModel.findOne({
				where: { [context.getChildModelKey()]: id },
			});

			const childUploads = context.getUploads(dto).filter(v => context.getUploadRelations(childModel).includes(v.name));
			await this.validateUploadUpdateRequestHelper(context, childUploads, files, dto, childEntity);
		}
	}

	protected async validateUploadUpdateRequestHelper(context: CrudService<T>, uploads, files, dto, entity) {
		for (let upload of uploads) {
			await context.upload.validateRequest({
				propName: upload.name,
				type: upload.type,
				files,
				dto,
				entity,
				minCount: upload.minCount,
				maxCount: upload.maxCount,
			});
		}
	}

	/**
	 * Others
	 */
	 protected async validateSameCodeIfNecessary(context: CrudService<T>, id: string|null, dto) {
		if (!isEmpty(dto.code)) {
			const entityWithSameCode = await context.findOne({ where: { code: dto.code }, include: [] });
			if (entityWithSameCode && entityWithSameCode['id'] !== id) {
				throw new ConflictException(`Сущность с code ${dto.code} уже существует`);
			}
		}
	}
}

export const crudValidationService = new CrudValidationService();