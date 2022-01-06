import { Op } from 'sequelize';
import { Sequelize, Model } from 'sequelize-typescript';
import { EntityOptions, Include, SearchingProps } from '../types';
import { correctionService, CorrectionService } from './correction.service';
import { validationService, ValidationService } from './validation.service';
import { Upload } from '../../upload/models/upload.model';

export class EntityService<T> {
	public readonly __crudModel__;
	public readonly entityOptions: EntityOptions = {};
	public readonly correctionService: CorrectionService<T>;
	public readonly validationService: ValidationService<T>;
	protected static readonly DEFAULT_ENTITY_OPTIONS: EntityOptions = {
		unscoped: false,
		unscopedInclude: false,
		additionalScopes: [],
	};

	constructor(crudModel: Record<string, any>, options: EntityOptions = {}) {
		this.__crudModel__ = crudModel;
		this.entityOptions = { ...EntityService.DEFAULT_ENTITY_OPTIONS, ...options };
		this.correctionService = correctionService;
		this.validationService = validationService as ValidationService<T>;
	}

	public getMaxEntitiesPerPage(): number {
		return 30;
	}

	public get crudModel(): Model {
		return this.unscoped(this.entityOptions.unscoped, this.entityOptions.additionalScopes);
	}

	public get tableName(): string {
		return this.__crudModel__.getTableName();
	}

	public get entityName(): string {
		return this.__crudModel__.prototype.constructor.name;
	}

	public getEntityNameByModel(model?): string {
		return model ? model.prototype.constructor.name : this.entityName;
	}

	public async findWithPagination({
		where = {},
		search = '',
		searchingProps = [],
		include = [],
		offset = 0,
		limit = this.getMaxEntitiesPerPage(),
		page,
		order = [],
		group,
		unscoped = this.entityOptions.unscoped,
		unscopedInclude = this.entityOptions.unscopedInclude,
		additionalScopes = this.entityOptions.additionalScopes,
		...args
	}: {
		where?: Record<string, any>;
		search?: string;
		searchingProps?: SearchingProps;
		include?: Include;
		offset?: number;
		limit?: string | number;
		page?: number;
		order?: any[];
		group?: any;
		unscoped?: boolean;
		unscopedInclude?: boolean;
		additionalScopes?: string[];
		[key: string]: any;
	} = {}): Promise<{ entities: T[]; totalCount: number }> {
		const findOptions: Record<string, any> = {
			where,
			include,
			unscoped,
			unscopedInclude,
			additionalScopes,
			...args,
		};

		if (search) {
			this.addSearchToFindOptions(search, findOptions, searchingProps);
		}

		const { attributes, ...countOptions } = findOptions;
		const totalCount = await this.count(countOptions);

		let transformedOffset, transformedLimit;
		if (page) {
			const transformedPage = this.validationService.validatePage(page);
			transformedOffset =
				(transformedPage - 1) * (typeof limit === 'string' ? parseInt(limit) : limit);
			transformedLimit = limit;
		} else {
			({ offset: transformedOffset, limit: transformedLimit } =
				this.validationService.validateAndParseOffsetAndLimit(this, offset, limit, totalCount));
		}

		return {
			entities: await this.findAll({
				...findOptions,
				...(findOptions.attributes?.length
					? { attributes: [...findOptions.attributes, 'created_at', 'updated_at'] }
					: {}),
				...(transformedOffset !== 0 ? { offset: transformedOffset } : {}),
				limit: transformedLimit,
				order,
			}),
			totalCount,
		};
	}

	public async findOne({
		where = {},
		include = [],
		group,
		unscoped = this.entityOptions.unscoped,
		unscopedInclude = this.entityOptions.unscopedInclude,
		additionalScopes = this.entityOptions.additionalScopes,
		...args
	}: {
		where?: Record<string, any>;
		include?: Include;
		group?: any;
		unscoped?: boolean;
		unscopedInclude?: boolean;
		additionalScopes?: string[];
		[key: string]: any;
	} = {}): Promise<T | null> {
		return this.unscoped(unscoped, additionalScopes).findOne({
			where,
			include: this.correctionService.getCorrectInclude(
				this,
				unscopedInclude,
				include,
				where,
				group,
			),
			...args,
		});
	}

	public async findOneById(
		id: string,
		{
			where = {},
			include = [],
			unscoped = this.entityOptions.unscoped,
			unscopedInclude = this.entityOptions.unscopedInclude,
			additionalScopes = this.entityOptions.additionalScopes,
			...args
		}: {
			where?: Record<string, any>;
			include?: Include;
			unscoped?: boolean;
			unscopedInclude?: boolean;
			additionalScopes?: string[];
			[key: string]: any;
		} = {},
	): Promise<T | null> {
		return this.unscoped(unscoped, additionalScopes).findOne({
			where: {
				id,
				...where,
			},
			include: this.correctionService.getCorrectInclude(this, unscopedInclude, include, where),
			...args,
		});
	}

	public async findAll({
		where = {},
		include = [],
		order = [],
		group,
		unscoped = this.entityOptions.unscoped,
		unscopedInclude = this.entityOptions.unscopedInclude,
		additionalScopes = this.entityOptions.additionalScopes,
		...args
	}: {
		where?: Record<string, any>;
		include?: Include;
		order?: any[];
		group?: any;
		unscoped?: boolean;
		unscopedInclude?: boolean;
		additionalScopes?: string[];
		[key: string]: any;
	} = {}): Promise<T[]> {
		return this.unscoped(unscoped, additionalScopes).findAll({
			where,
			include: this.correctionService.getCorrectInclude(
				this,
				unscopedInclude,
				include,
				where,
				group,
			),
			order: this.correctionService.addCorrectOrderIfNecessary(this, order, group),
			...args,
		});
	}

	public async findAllByIds(
		ids: string[],
		{
			where = {},
			include = [],
			order = [],
			group,
			unscoped = this.entityOptions.unscoped,
			unscopedInclude = this.entityOptions.unscopedInclude,
			additionalScopes = this.entityOptions.additionalScopes,
			...args
		}: {
			where?: Record<string, any>;
			include?: Include;
			order?: any[];
			group?: any;
			unscoped?: boolean;
			unscopedInclude?: boolean;
			additionalScopes?: string[];
			[key: string]: any;
		} = {},
	): Promise<T[]> {
		return this.unscoped(unscoped, additionalScopes).findAll({
			where: {
				id: {
					[Op.in]: ids,
				},
				...where,
			},
			include: this.correctionService.getCorrectInclude(
				this,
				unscopedInclude,
				include,
				where,
				group,
			),
			order: this.correctionService.addCorrectOrderIfNecessary(this, order, group),
			...args,
		});
	}

	public async count({
		where = {},
		include = [],
		group,
		unscoped = this.entityOptions.unscoped,
		unscopedInclude = this.entityOptions.unscopedInclude,
		additionalScopes = this.entityOptions.additionalScopes,
		...args
	}: {
		where?: Record<string, any>;
		include?: Include;
		group?: any;
		unscoped?: boolean;
		unscopedInclude?: boolean;
		additionalScopes?: string[];
		[key: string]: any;
	} = {}): Promise<number> {
		return this.unscoped(unscoped, additionalScopes).count({
			where,
			include: this.correctionService.getCorrectInclude(
				this,
				unscopedInclude,
				include,
				where,
				group,
				true,
			),
			distinct: true,
			...args,
		});
	}

	public async validateDto(
		dtoType: any,
		dto: Record<string, any>,
		whitelist = true,
	): Promise<Record<string, any>> {
		return this.validationService.validateDto(dtoType, dto, whitelist);
	}

	public async validateMandatoryId(
		id: string,
		{
			where = {},
			include = [],
			model = null,
			unscoped = this.entityOptions.unscoped,
			unscopedInclude = this.entityOptions.unscopedInclude,
			additionalScopes = this.entityOptions.additionalScopes,
		} = {},
	): Promise<T> {
		return this.validationService.validateMandatoryId(this, id, {
			where,
			include,
			model,
			unscoped,
			unscopedInclude,
			additionalScopes,
		});
	}

	public async validateOptionalId(
		id: string,
		{
			where = {},
			include = [],
			model = null,
			unscoped = this.entityOptions.unscoped,
			unscopedInclude = this.entityOptions.unscopedInclude,
			additionalScopes = this.entityOptions.additionalScopes,
		} = {},
	): Promise<T | void> {
		return this.validationService.validateOptionalId(this, id, {
			where,
			include,
			model,
			unscoped,
			unscopedInclude,
			additionalScopes,
		});
	}

	public async validateMandatoryIds(
		ids: string[],
		{
			where = {},
			include = [],
			model = null,
			unscoped = this.entityOptions.unscoped,
			unscopedInclude = this.entityOptions.unscopedInclude,
			additionalScopes = this.entityOptions.additionalScopes,
		} = {},
	): Promise<void> {
		await this.validationService.validateMandatoryIds(this, ids, {
			where,
			include,
			model,
			unscoped,
			unscopedInclude,
			additionalScopes,
		});
	}

	public async validateOptionalIds(
		ids: string[],
		{
			where = {},
			include = [],
			model = null,
			unscoped = this.entityOptions.unscoped,
			unscopedInclude = this.entityOptions.unscopedInclude,
			additionalScopes = this.entityOptions.additionalScopes,
		} = {},
	): Promise<void> {
		await this.validationService.validateOptionalIds(this, ids, {
			where,
			include,
			model,
			unscoped,
			unscopedInclude,
			additionalScopes,
		});
	}

	public unscoped(unscoped: boolean, additionalScopes: string[] = [], model = null) {
		let usedModel = model ?? this.__crudModel__;
		usedModel = unscoped ? usedModel.unscoped() : usedModel;

		for (const additionalScope of additionalScopes) {
			if (usedModel._scopeNames.includes(additionalScope)) {
				usedModel = usedModel.scope(additionalScope);
			}
		}
		return usedModel;
	}

	public getSingleRelations(model?): Array<{ name: string; model: Model }> {
		return Object.entries((model ? model : this.__crudModel__).associations)
			.filter(
				([key, value]: any) =>
					value.associationType === 'BelongsTo' && value.target.prototype.constructor !== Upload,
			)
			.map(([key, value]: any) => {
				return {
					name: key,
					model: value.target,
				};
			});
	}

	public getMultipleRelations(model?): Array<{ name: string; model: Model }> {
		return Object.entries((model ? model : this.__crudModel__).associations)
			.filter(
				([key, value]: any) =>
					['BelongsToMany', 'HasMany'].includes(value.associationType) &&
					value.target.prototype.constructor !== Upload,
			)
			.map(([key, value]: any) => {
				return {
					name: key,
					model: value.target,
				};
			});
	}

	public getUploadRelations(model?): string[] {
		return Object.entries((model ? model : this.__crudModel__).associations)
			.filter(
				([key, value]: any) =>
					['BelongsTo', 'BelongsToMany'].includes(value.associationType) &&
					value.target.prototype.constructor === Upload,
			)
			.map(([key, value]: any) => key);
	}

	public getAllRelations(): any {
		return Object.entries(this.__crudModel__.associations).map(([key, value]: [any, any]) => {
			return value.target.prototype.constructor;
		});
	}

	protected addSearchToFindOptions(
		search: string,
		findOptions: Record<string, any>,
		searchingProps: SearchingProps,
	): void {
		const searchWhere = [];

		for (const option of searchingProps) {
			let property = option;
			let value = search;

			if (typeof option === 'object' && option !== null) {
				if (option['property']) {
					property = option['property'];
				}
				if (option['transform']) {
					value = option['transform'](value);
				}
			}

			const getFinalProperty = (property) => {
				if (property.includes('.')) {
					return property
						.split('.')
						.map((v) => `"${v}"`)
						.join('.');
				} else {
					return `"${this.__crudModel__.name}"."${property}"`;
				}
			};
			const cast = (v) => Sequelize.cast(Sequelize.col(getFinalProperty(v)), 'text');

			if (value) {
				searchWhere.push(
					Sequelize.where(
						Array.isArray(property)
							? Sequelize.fn(
									'concat',
									...property.map((v) => cast(v)).reduce((acc, v) => acc.concat(v, ' '), []),
							  )
							: cast(property),
						{ [Op.iLike]: `%${value}%` } as any,
					),
				);
			}
		}

		if (searchWhere.length) {
			if (findOptions.where[Op.or]) {
				findOptions.where[Op.or] = [...findOptions.where[Op.or], ...searchWhere];
			} else {
				findOptions.where[Op.or] = searchWhere;
			}
		}
	}
}
