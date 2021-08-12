import { isEmpty } from 'class-validator';
import { Op } from 'sequelize';
import { Sequelize, Model } from 'sequelize-typescript';
import { Upload } from '../../upload/models/upload.model';
import { correctionService, CorrectionService } from './correction.service';
import { validationService, ValidationService } from './validation.service';

export type EntityOptions = {
	unscoped?: boolean;
	unscopedInclude?: boolean;
	additionalScopes?: string[];
};

export type Include = { all: boolean } | Record<string, any>[];

export class EntityService<T> {
	public static readonly DEFAULT_ENTITY_OPTIONS: EntityOptions = {
		unscoped: false,
		unscopedInclude: false,
		additionalScopes: [],
	};
	public readonly entityOptions: EntityOptions = {};
	public readonly correctionService: CorrectionService<T>;
	public readonly validationService: ValidationService<T>;
	public readonly __crudModel__;

	constructor(crudModel: Record<string, any>, options: EntityOptions = {}) {
		this.correctionService = correctionService;
		this.validationService = validationService as ValidationService<T>;
		this.__crudModel__ = crudModel;

		const entityOptions = { ...EntityService.DEFAULT_ENTITY_OPTIONS, ...options };
		for (const prop in entityOptions) {
			if (Object.hasOwnProperty.call(entityOptions, prop)) {
				this.entityOptions[prop] = entityOptions[prop];
			}
		}

		this.checkIncludeOptions();
	}

	public get crudModel(): Model {
		return this.correctionService.unscopedHelper(
			this,
			this.entityOptions.unscoped,
			this.entityOptions.additionalScopes,
		);
	}
	public get entityName(): string {
		return this.__crudModel__.prototype.constructor.name;
	}
	public get tableName(): string {
		return this.__crudModel__.getTableName();
	}
	public getEntityNameByModel(model?): string {
		return model ? model.prototype.constructor.name : this.entityName;
	}
	public getMaxEntitiesPerPage(): number {
		return 30;
	}

	protected getIncludeOptions(): Include {
		return [];
	}

	protected getSearchingProps(): Array<
		string | string[] | { property: string | string[]; transform: (value: any) => any }
	> {
		return ['id', 'title'];
	}

	/**
	 * Finders
	 */
	public async findWithPagination({
		search = '',
		where = {},
		include = this.getIncludeOptions(),
		offset = 0,
		limit = this.getMaxEntitiesPerPage(),
		page,
		order = [],
		unscoped = this.entityOptions.unscoped,
		unscopedInclude = this.entityOptions.unscopedInclude,
		additionalScopes = this.entityOptions.additionalScopes,
		...args
	}: {
		search?: string;
		where?: Record<string, any>;
		include?: Include;
		offset?: number;
		limit?: string | number;
		page?: number;
		order?: any[];
		unscoped?: boolean;
		unscopedInclude?: boolean;
		additionalScopes?: string[];
		[key: string]: any;
	} = {}): Promise<{ entities: T[]; totalCount: number }> {
		const findOptions = {
			where,
			include,
			unscoped,
			unscopedInclude,
			additionalScopes,
			...args,
		};

		if (search) {
			this.addSearchToFindOptions(search, findOptions);
		}

		const totalCount = await this.count(findOptions);

		let transformedOffset, transformedLimit;
		if (page) {
			transformedOffset = (page - 1) * (typeof limit === 'string' ? parseInt(limit) : limit);
			transformedLimit = limit;
		} else {
			({ offset: transformedOffset, limit: transformedLimit } =
				this.validationService.validateAndParseOffsetAndLimit(this, offset, limit, totalCount));
		}

		return {
			entities: await this.findAll({
				...findOptions,
				...(transformedOffset !== 0 ? { offset: transformedOffset } : {}),
				limit: transformedLimit,
				order,
			}),
			totalCount,
		};
	}

	protected addSearchToFindOptions(search: string, findOptions: Record<string, any>): void {
		const searchWhere = [];

		for (const option of this.getSearchingProps()) {
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

			if (value) {
				searchWhere.push(
					Sequelize.where(
						Array.isArray(property)
							? Sequelize.fn(
									'concat',
									...property
										.map((v) => Sequelize.cast(Sequelize.col(getFinalProperty(v)), 'text'))
										.reduce((acc, v) => acc.concat(v, ' '), []),
							  )
							: Sequelize.cast(Sequelize.col(getFinalProperty(property)), 'text'),
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

	public async findOne({
		where = {},
		include = this.getIncludeOptions(),
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
	} = {}): Promise<T | null> {
		return this.correctionService.unscopedHelper(this, unscoped, additionalScopes).findOne({
			where,
			include: this.correctionService.getCorrectInclude(this, unscopedInclude, include, where),
			...args,
		});
	}

	public async findOneById(
		id: string,
		{
			where = {},
			include = this.getIncludeOptions(),
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
		return this.correctionService.unscopedHelper(this, unscoped, additionalScopes).findOne({
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
		include = this.getIncludeOptions(),
		order = [],
		unscoped = this.entityOptions.unscoped,
		unscopedInclude = this.entityOptions.unscopedInclude,
		additionalScopes = this.entityOptions.additionalScopes,
		...args
	}: {
		where?: Record<string, any>;
		include?: Include;
		order?: any[];
		unscoped?: boolean;
		unscopedInclude?: boolean;
		additionalScopes?: string[];
		[key: string]: any;
	} = {}): Promise<T[]> {
		return this.correctionService.unscopedHelper(this, unscoped, additionalScopes).findAll({
			where,
			include: this.correctionService.getCorrectInclude(this, unscopedInclude, include, where),
			order: this.correctionService.addCorrectOrder(this, order, args.group, include, unscoped),
			...args,
		});
	}

	public async findAllByIds(
		ids: string[],
		{
			where = {},
			include = this.getIncludeOptions(),
			order = [],
			unscoped = this.entityOptions.unscoped,
			unscopedInclude = this.entityOptions.unscopedInclude,
			additionalScopes = this.entityOptions.additionalScopes,
			...args
		}: {
			where?: Record<string, any>;
			include?: Include;
			order?: any[];
			unscoped?: boolean;
			unscopedInclude?: boolean;
			additionalScopes?: string[];
			[key: string]: any;
		} = {},
	): Promise<T[]> {
		return this.correctionService.unscopedHelper(this, unscoped, additionalScopes).findAll({
			where: {
				id: {
					[Op.in]: ids,
				},
				...where,
			},
			include: this.correctionService.getCorrectInclude(this, unscopedInclude, include, where),
			order: this.correctionService.addCorrectOrder(this, order, args.group, include, unscoped),
			...args,
		});
	}

	public async count({
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
	} = {}): Promise<number> {
		return this.correctionService.unscopedHelper(this, unscoped, additionalScopes).count({
			where,
			include: this.correctionService.getCorrectInclude(
				this,
				unscopedInclude,
				include,
				where,
				true,
			),
			distinct: true,
			...args,
		});
	}

	/**
	 * Validations
	 */
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

	/**
	 * Relations
	 */
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

	public getAllAssociations(): any {
		return Object.entries(this.__crudModel__.associations).map(([key, value]: [any, any]) => {
			return value.target.prototype.constructor;
		});
	}

	public checkIncludeOptions(): void {
		const include = <any>this.getIncludeOptions();
		if (isEmpty(include.all)) {
			include.forEach((child) =>
				this.checkIncludeOptionsHelper(this.__crudModel__.prototype.constructor, child),
			);
		}
	}

	private checkIncludeOptionsHelper(parent, child) {
		const childModel = child.model ?? child;
		const associations = Object.entries(parent.associations).map(
			([key, value]) => (value as any).target,
		);

		const associationWithSameTableName = associations.find(
			(v) => v.getTableName() === childModel.getTableName(),
		);
		if (!associations.includes(childModel) && !associationWithSameTableName) {
			throw new Error(
				`Please check method getIncludeOptions() on model ${
					this.entityName
				}, link ${this.getEntityNameByModel(parent)} with ${this.getEntityNameByModel(
					childModel,
				)} doesn't exist`,
			);
		}

		if (child.include) {
			child.include.forEach((subChild) => this.checkIncludeOptionsHelper(childModel, subChild));
		}
	}
}
