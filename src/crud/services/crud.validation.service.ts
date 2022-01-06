import { isEmpty } from 'class-validator';
import { Request } from 'express';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Files, ValidateResult } from '../types';
import { utils } from '../../utils/utils';
import { CrudService } from './crud.service';
import { Upload } from '../../upload/models/upload.model';
import { BulkCreateUpdateDto } from '../dto/bulk.create.update.dto';

export class CrudValidationService<T> {
	public async validateBeforeCreating(
		context: CrudService<T>,
		dto: Record<string, any>,
		files: Files,
		req: Request,
	): Promise<ValidateResult> {
		return this.validateSingle(context, null, dto, files, req);
	}

	public async validateBeforeBulkCreating(
		context: CrudService<T>,
		dto: Record<string, any>,
		files: Files,
		req: Request,
	): Promise<ValidateResult[]> {
		return this.validateMultiple(context, dto, files, req);
	}

	public async validateBeforePutting(
		context: CrudService<T>,
		id: string,
		dto: Record<string, any>,
		files: Files,
		req: Request,
	): Promise<ValidateResult> {
		await context.validateMandatoryId(id);
		return this.validateSingle(context, id, dto, files, req);
	}

	public async validateBeforeBulkPutting(
		context: CrudService<T>,
		dto: Record<string, any>,
		files: Files,
		req: Request,
	): Promise<ValidateResult[]> {
		return this.validateMultiple(context, dto, files, req, true);
	}

	public async validateBeforeRemoving(
		context: CrudService<T>,
		id: string,
		force?: boolean,
		req?: Request,
	): Promise<void> {
		await context.validateMandatoryId(id);
		if (!force) {
			await this.validateConflictRelations(context, id);
		}
		await context.validateDeleteRequest(id, force, req);
	}

	public async validateRelations(context: CrudService<T>, dto: Record<string, any>): Promise<void> {
		await this.validateRelationsHelper(context, dto);

		const childModel = context.getChildModel(dto);
		if (childModel) {
			await this.validateRelationsHelper(context, dto, childModel);
		}
	}

	public async validateAdvancedMultipleRelations(
		context: CrudService<T>,
		entityId: string | null,
		dto: Record<string, any>,
	): Promise<any> {
		for (const relation of context.getAdvancedMultipleRelations(dto)) {
			let input = dto[relation.name];
			const count = input?.length ?? 0;

			if (count < relation.minCount || count > relation.maxCount) {
				throw new BadRequestException(
					`Property ${relation.name} minCount: ${relation.minCount}, maxCount: ${relation.maxCount}`,
				);
			}

			if (!count) {
				continue;
			}

			input = input.map((chunk) => {
				try {
					return typeof chunk === 'object' && chunk !== null ? chunk : JSON.parse(chunk);
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
					chunk = await context.validateDto(relation.schema, dtoWithoutId);
				} else {
					chunk = await context.validateDto(relation.schema, chunk);
				}

				for (const relationToValidate of relationsToValidate) {
					if (!relation.unique.includes(relationToValidate.identifier)) {
						await context.validateOptionalId(chunk[relationToValidate.identifier], {
							model: relationToValidate.model,
						});
					}
				}
			}

			for (const relationToValidate of relationsToValidate) {
				if (relation.unique.includes(relationToValidate.identifier)) {
					const ids = input.map((v) => v[relationToValidate.identifier]).filter((v) => v);
					await context.validateOptionalIds(ids, { model: relationToValidate.model });
				}
			}

			dto[relation.name] = input;
		}
		return dto;
	}

	public async validateUploadCreateRequest(
		context: CrudService<T>,
		dto: Record<string, any>,
		files: Files,
	): Promise<void> {
		await this.validateUploadRequest(context, null, dto, files);
	}

	public async validateUploadUpdateRequest(
		context: CrudService<T>,
		id: string,
		dto: Record<string, any>,
		files: Files,
	): Promise<void> {
		await this.validateUploadRequest(context, id, dto, files);
	}

	protected async validateSingle(
		context: CrudService<T>,
		id: string | null,
		dto: Record<string, any>,
		files: Files,
		req: Request,
	): Promise<ValidateResult> {
		let parsedDto = dto;
		if (context.crudOptions.withDtoValidation) {
			parsedDto = await context.validateDto(context.getDtoType(parsedDto), parsedDto);
		}

		await this.validateSameCodeIfNecessary(context, id, parsedDto);

		if (context.crudOptions.withRelationValidation) {
			await this.validateRelations(context, parsedDto);
		}
		parsedDto = await this.validateAdvancedMultipleRelations(context, id, parsedDto);

		const normalizedFiles = utils.normalizeFiles(files);
		if (context.crudOptions.withUploadValidation) {
			if (!id) {
				await this.validateUploadCreateRequest(context, parsedDto, normalizedFiles);
			} else {
				await this.validateUploadUpdateRequest(context, id, parsedDto, normalizedFiles);
			}
		}

		const { dto: transformedDto, files: transformedFiles } = await context.validateRequest(
			id,
			parsedDto,
			normalizedFiles,
			req,
		);

		let result: ValidateResult;
		if (!id) {
			result = await context.validateCreateRequest(
				context.transformDto(transformedDto),
				transformedFiles,
				req,
			);
		} else {
			result = await context.validateUpdateRequest(
				id,
				context.transformDto(transformedDto),
				transformedFiles,
				req,
			);
		}

		return {
			dto: context.transformDto(result.dto),
			...result,
		};
	}

	protected async validateMultiple(
		context: CrudService<T>,
		dto: Record<string, any>,
		files: Files,
		req: Request,
		isUpdating = false,
	): Promise<ValidateResult[]> {
		const parsedDto = await context.validateDto(BulkCreateUpdateDto, dto);
		const chunks = [];

		if (isUpdating) {
			await context.validateMandatoryIds(parsedDto.bulk.map((v) => v.id));
		}

		for (const [index, chunk] of parsedDto.bulk.entries()) {
			const parsedChunk = await this.validateSingle(
				context,
				chunk.id ?? null,
				chunk,
				context.getIndividualFiles(parsedDto, files, index),
				req,
			);

			if (isUpdating) {
				parsedChunk.dto.id = chunk.id;
			}
			chunks.push(parsedChunk);
		}
		return chunks;
	}

	protected async validateSameCodeIfNecessary(
		context: CrudService<T>,
		id: string | null,
		dto: Record<string, any>,
	): Promise<void> {
		if (!isEmpty(dto.code)) {
			const entityWithSameCode = await context.findOne({ where: { code: dto.code } });
			if (entityWithSameCode && entityWithSameCode['id'] !== id) {
				throw new ConflictException(`Entity with same code '${dto.code}' already exists`);
			}
		}
	}

	protected async validateRelationsHelper(
		context: CrudService<T>,
		dto: Record<string, any>,
		model?,
	): Promise<void> {
		for (const singleRelation of context.getSingleRelations(model)) {
			await context.validateOptionalId(dto[singleRelation.name], {
				model: singleRelation.model,
			});
		}

		const advancedMultipleRelations = context.getAdvancedMultipleRelations(dto).map((v) => v.name);

		for (const multipleRelation of context.getMultipleRelations(model)) {
			if (!advancedMultipleRelations.includes(multipleRelation.name)) {
				await context.validateOptionalIds(dto[multipleRelation.name], {
					model: multipleRelation.model,
				});
			}
		}
	}

	protected async validateUploadRequest(
		context: CrudService<T>,
		id: string | null,
		dto: Record<string, any>,
		files: Files,
	): Promise<void> {
		const parentUploads = context
			.getUploads(dto)
			.filter((v) => context.getUploadRelations().includes(v.name));

		let entity;
		if (id) {
			entity = await context.findOneById(id);
		}

		await this.validateUploadRequestHelper({
			context,
			uploads: parentUploads,
			files,
			dto,
			...(entity ? { entity } : {}),
		});

		const childModel = context.getChildModel(dto);
		if (childModel) {
			const childUploads = context
				.getUploads(dto)
				.filter((v) => context.getUploadRelations(childModel).includes(v.name));

			const childEntity = await (childModel as any).findOne({
				where: { [context.getChildModelKey()]: id },
			});

			await this.validateUploadRequestHelper({
				context,
				uploads: childUploads,
				files,
				dto,
				...(childEntity ? { entity: childEntity } : {}),
			});
		}
	}

	protected async validateUploadRequestHelper({
		context,
		uploads,
		files,
		dto,
		entity,
	}: {
		context: CrudService<T>;
		uploads;
		files: Files;
		dto: Record<string, any>;
		entity?: Record<string, any>;
	}): Promise<void> {
		for (const upload of uploads) {
			await context.upload.validateRequest({
				propName: upload.name,
				type: upload.type,
				files,
				dto,
				...(entity ? { entity } : {}),
				minCount: upload.minCount,
				maxCount: upload.maxCount,
			});
		}
	}

	protected async validateConflictRelations(context: CrudService<T>, id: string): Promise<void> {
		const associations = Object.entries(context.__crudModel__.associations)
			.filter(
				([key, value]: any) =>
					['HasOne', 'HasMany', 'BelongsToMany'].includes(value.associationType) &&
					value.target.prototype.constructor !== Upload,
			)
			.map(([key, value]: any) => {
				return {
					key,
					model: value.target,
					associationType: value.associationType,
					foreignKey: utils.snakeCaseToCamel(value.foreignKey),
				};
			});

		for (const relationName of context.getConflictRelations()) {
			const hit = associations.find((v) => v.key === relationName);
			if (!hit) {
				continue;
			}

			const throwError = (entities) => {
				throw new ConflictException(
					`Can't remove ${
						context.entityName
					}. There are some links existing (${relationName}): ${entities
						.map((v) => v.id)
						.join(', ')}`,
				);
			};

			if (hit.associationType === 'BelongsToMany') {
				const entities = await hit.model.unscoped().findAll({
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
					throwError(entities);
				}
			} else {
				const entities = await hit.model.unscoped().findAll({
					attributes: ['id'],
					where: {
						[hit.foreignKey]: id,
					},
				});

				if (entities?.length) {
					throwError(entities);
				}
			}
		}
	}
}

export const crudValidationService = new CrudValidationService();
