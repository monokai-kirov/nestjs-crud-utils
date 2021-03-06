import { isInt, isString, isUUID, validateOrReject } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { BadRequestException } from '@nestjs/common';
import { Op } from 'sequelize';
import { ValidateAndParseJsonInput } from '../types';
import { EntityService } from './entity.service';

export class ValidationService<T> {
	public async validateDto(
		dtoType: any,
		dto: Record<string, any>,
		whitelist = true,
	): Promise<Record<string, any>> {
		try {
			const parsedDto = await plainToClass(dtoType, { ...dto });
			await validateOrReject(parsedDto as any, { whitelist });
			return parsedDto;
		} catch (errors) {
			throw new BadRequestException({
				statusCode: 400,
				errors,
			});
		}
	}

	public async validateMandatoryId(
		context: EntityService<T>,
		id: string,
		{
			where = {},
			include = [],
			model = null,
			unscoped = context.entityOptions.unscoped,
			unscopedInclude = context.entityOptions.unscopedInclude,
			additionalScopes = context.entityOptions.additionalScopes,
		} = {},
	): Promise<T> {
		return this.validateIdHelper(context, id, {
			where,
			include,
			model,
			unscoped,
			unscopedInclude,
			additionalScopes,
		});
	}

	public async validateOptionalId(
		context: EntityService<T>,
		id: string,
		{
			where = {},
			include = [],
			model = null,
			unscoped = context.entityOptions.unscoped,
			unscopedInclude = context.entityOptions.unscopedInclude,
			additionalScopes = context.entityOptions.additionalScopes,
		} = {},
	): Promise<T | void> {
		if (id) {
			return this.validateIdHelper(context, id, {
				where,
				model,
				include,
				unscoped,
				unscopedInclude,
				additionalScopes,
			});
		}
	}

	public async validateMandatoryIds(
		context: EntityService<T>,
		ids: string[],
		{
			where = {},
			include = [],
			model = null,
			unscoped = context.entityOptions.unscoped,
			unscopedInclude = context.entityOptions.unscopedInclude,
			additionalScopes = context.entityOptions.additionalScopes,
		} = {},
	): Promise<void> {
		if (!Array.isArray(ids) || !ids.length) {
			throw new BadRequestException(
				`Array.isArray(ids), ids.length !== 0 ${context.getEntityNameByModel(model)}`,
			);
		}
		await this.validateIdsHelper(context, ids, {
			where,
			model,
			include,
			unscoped,
			unscopedInclude,
			additionalScopes,
		});
	}

	public async validateOptionalIds(
		context: EntityService<T>,
		ids: string[],
		{
			where = {},
			include = [],
			model = null,
			unscoped = context.entityOptions.unscoped,
			unscopedInclude = context.entityOptions.unscopedInclude,
			additionalScopes = context.entityOptions.additionalScopes,
		} = {},
	): Promise<void> {
		if (ids) {
			if (!Array.isArray(ids)) {
				throw new BadRequestException(`Array.isArray(ids) ${context.getEntityNameByModel(model)}`);
			}
			if (ids.length) {
				await this.validateIdsHelper(context, ids, {
					where,
					include,
					model,
					unscoped,
					unscopedInclude,
					additionalScopes,
				});
			}
		}
	}

	public validatePage(page: any): number {
		if (page === undefined) {
			return 1;
		}

		const parsedPage = typeof page === 'string' ? parseInt(page) : page;
		if (!isInt(parsedPage)) {
			throw new BadRequestException('isInt(page)');
		}
		if (parsedPage < 1) {
			throw new BadRequestException('Page >= 1');
		}
		return parsedPage;
	}

	public validateAndParseOffsetAndLimit(
		context: EntityService<T>,
		offsetInRequest,
		limitInRequest,
		totalCount,
	): { offset: number; limit: number } {
		const offset = parseInt(offsetInRequest as any);
		const limit = parseInt(limitInRequest as any);

		if (!isInt(offset as any) || !isInt(limit)) {
			throw new BadRequestException('isInt(offset), isInt(limit)');
		}
		if (offset < 0 || limit < 1 || limit > context.getMaxEntitiesPerPage()) {
			throw new BadRequestException(
				`offset >= 0, limit => 1, limit <= ${context.getMaxEntitiesPerPage()}`,
			);
		}
		if (totalCount > 0 && offset >= totalCount) {
			throw new BadRequestException('Incorrect offset');
		}

		return {
			offset,
			limit,
		};
	}

	public validateAndParseJsonWithOneKey({
		input,
		errorMessage,
		keyConstraint = (key) => isUUID(key),
		keyTransform = (key) => key,
		valueConstraint = (value) => isString(value),
		valueTransform = (value) => value,
	}: ValidateAndParseJsonInput): Record<string, any> {
		return this.validateAndParseJsonHelper({
			input,
			errorMessage,
			keyConstraint,
			keyTransform,
			valueConstraint,
			valueTransform,
		});
	}

	public validateAndParseArrayOfJsonsWithOneKey({
		input,
		errorMessage,
		keyConstraint = (key) => isUUID(key),
		keyTransform = (key) => key,
		valueConstraint = (value) => isString(value),
		valueTransform = (value) => value,
	}: ValidateAndParseJsonInput): Record<string, any> {
		return input.map((item) =>
			this.validateAndParseJsonHelper({
				input: item,
				errorMessage,
				keyConstraint,
				keyTransform,
				valueConstraint,
				valueTransform,
			}),
		);
	}

	public validateAndParseArrayOfJsonsWithMultipleKeys({
		input,
		errorMessage,
		uuids = [],
		restKeys = [],
	}: {
		input;
		errorMessage: string;
		uuids?: string[];
		restKeys?: string[];
	}): Record<string, any> {
		const allKeys = [...uuids, ...restKeys];

		return input.map((item) => {
			try {
				const parsedJson = typeof item === 'object' && item !== null ? item : JSON.parse(item);

				if (
					Array.isArray(parsedJson) ||
					Object.keys(parsedJson).length !== allKeys.length ||
					Object.keys(parsedJson).some((item) => !allKeys.includes(item))
				) {
					throw new BadRequestException(errorMessage);
				}

				for (const key of uuids) {
					if (!isUUID(parsedJson[key])) {
						throw new BadRequestException(errorMessage);
					}
				}
				return parsedJson;
			} catch (e) {
				throw new BadRequestException(errorMessage);
			}
		});
	}

	protected async validateIdHelper(
		context: EntityService<T>,
		id: string,
		{ where, include, model, unscoped, unscopedInclude, additionalScopes },
	): Promise<T> {
		if (!isUUID(id, '4')) {
			throw new BadRequestException(`isUUID(id, '4') ${context.getEntityNameByModel(model)}`);
		}

		const entity = await context.unscoped(unscoped, additionalScopes, model).findOne({
			where: { id, ...where },
			include: context.correctionService.getCorrectInclude(
				context,
				unscopedInclude,
				include,
				where,
				undefined,
			),
		});
		if (!entity) {
			throw new BadRequestException(`Incorrect id ${context.getEntityNameByModel(model)}`);
		}
		return entity;
	}

	protected async validateIdsHelper(
		context: EntityService<T>,
		ids: string[],
		{ where, include, model, unscoped, unscopedInclude, additionalScopes },
	): Promise<void> {
		if (ids.some((id) => !isUUID(id, '4'))) {
			throw new BadRequestException(`isUUID(id, '4') ${context.getEntityNameByModel(model)}`);
		}

		const entitiesCount = await context.unscoped(unscoped, additionalScopes, model).count({
			where: {
				id: {
					[Op.in]: ids,
				},
				...where,
			},
			include: context.correctionService.getCorrectInclude(
				context,
				unscopedInclude,
				include,
				where,
				undefined,
			),
		});

		if (ids.length !== entitiesCount) {
			throw new BadRequestException(`Incorrect ids ${context.getEntityNameByModel(model)}`);
		}
	}

	protected validateAndParseJsonHelper({
		input,
		errorMessage,
		keyConstraint,
		valueConstraint,
		keyTransform,
		valueTransform,
	}: ValidateAndParseJsonInput): Record<string, any> {
		try {
			const parsedJson = typeof input === 'object' && input !== null ? input : JSON.parse(input);

			if (
				Array.isArray(parsedJson) ||
				Object.keys(parsedJson).length !== 1 ||
				!keyConstraint(Object.keys(parsedJson).shift()) ||
				!valueConstraint(Object.values(parsedJson).shift())
			) {
				throw new BadRequestException(errorMessage);
			}

			return {
				[keyTransform(Object.keys(parsedJson).shift())]: valueTransform(
					Object.values(parsedJson).shift(),
				),
			};
		} catch (e) {
			throw new BadRequestException(errorMessage);
		}
	}
}

export const validationService = new ValidationService();
