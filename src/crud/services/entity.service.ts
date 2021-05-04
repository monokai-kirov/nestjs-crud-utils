import { isEmpty } from "class-validator";
import { Op } from "sequelize";
import { Sequelize, Model } from "sequelize-typescript";
import { Upload } from "../../upload/models/upload.model";
import { correctionService, CorrectionService } from './correction.service';
import { validationService, ValidationService } from "./validation.service";

export type EntityOptions = {
	unscoped?: boolean,
	unscopedInclude?: boolean,
	additionalScopes?: string[],
}

export class EntityService<T> {
	public get crudModel() { return this.correctionService.unscopedHelper(this, this.entityOptions.unscoped, this.entityOptions.additionalScopes) }
	public get entityName() { return this.__crudModel__.prototype.constructor.name; }
	public get tableName() { return this.__crudModel__.getTableName() };
	public getEntityNameByModel(model?) { return model ? model.prototype.constructor.name : this.entityName; }
	public getMaxEntitiesPerPage() { return 30; }
	/**
	 * @Override
	 */
	protected getIncludeOptions(): any { return []; }
	protected getSearchingProps(): Array<string|{ property: string, relation?: string, transform?: Function }> { return ['id', 'title']; }


	public static readonly DEFAULT_ENTITY_OPTIONS: EntityOptions = {
		unscoped: false,
		unscopedInclude: false,
		additionalScopes: [],
	};
	public readonly entityOptions: EntityOptions = {};
	public readonly __crudModel__;
	public readonly correctionService: CorrectionService<T>;
	public readonly validationService: ValidationService<T>;

	constructor(crudModel, options: EntityOptions = {}) {
		this.__crudModel__ = crudModel;
		this.correctionService = correctionService;
		this.validationService = validationService as ValidationService<T>;

		const entityOptions = { ...EntityService.DEFAULT_ENTITY_OPTIONS, ...options };
		for (let prop in entityOptions) {
			if (Object.hasOwnProperty.call(entityOptions, prop)) {
				this.entityOptions[prop] = entityOptions[prop];
			}
		}

		this.checkIncludeOptions();
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
		order = [],
		countOptions = {},
		unscoped = this.entityOptions.unscoped,
		unscopedInclude = this.entityOptions.unscopedInclude,
		additionalScopes = this.entityOptions.additionalScopes,
		...args
	}: {
		search?: string,
		where?: Object,
		include?: Object[],
		offset?: number,
		limit?: number,
		order?: any[],
		countOptions?: Object,
		unscoped?: boolean,
		unscopedInclude?: boolean,
		additionalScopes?: string[],
		[key: string]: any,
	} = {}): Promise<{ entities: T[], totalCount: number }> {
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

		const totalCount = await this.count({ ...findOptions, include: [], ...countOptions });
		const { offset: transformedOffset, limit: transformedLimit } = this.validationService.validateAndParseOffsetAndLimit(this, offset, limit, totalCount);

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

	protected addSearchToFindOptions(search, findOptions) {
		const searchWhere = [];
		const relations = [...new Set([
			...this.getSingleRelations().map(v => v.name),
			...this.getMultipleRelations().map(v => v.name),
		])];

		for (let option of this.getSearchingProps()) {
			const isObject = (typeof option === 'object' && option !== null);
			let col;
			let value = search;

			if (isObject) {
				if (option['relation'] && relations.includes(option['relation'])) {
					col = `${option['relation']}.${option['property']}`;
				} else {
					col = `${this.__crudModel__.name}."${option['property']}"`;
				}

				if (option['transform']) {
					value = option['transform'](value);
				}
			} else if (relations.includes(option as string)) {
				col = `${option}."title"`;
			} else {
				col = `${this.__crudModel__.name}."${option}"`;
			}

			if (value) {
				searchWhere.push(
					Sequelize.where(
						Sequelize.cast(Sequelize.col(col), 'text'),
						{[Op.iLike]: `%${value}%`} as any
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

	public async findOne(
		{
			where = {},
			include = this.getIncludeOptions(),
			unscoped = this.entityOptions.unscoped,
			unscopedInclude = this.entityOptions.unscopedInclude,
			additionalScopes = this.entityOptions.additionalScopes,
			...args
		}: {
			where?: Object,
			include?: Object[],
			unscoped?: boolean,
			unscopedInclude?: boolean,
			additionalScopes?: string[],
			[key: string]: any,
		} = {}
	): Promise<T|null> {
		if (!Object.keys(where).length) {
			throw new Error('Укажите where');
		}

		return this.correctionService.unscopedHelper(this, unscoped, additionalScopes).findOne({
			where,
			include: this.correctionService.getCorrectInclude(this, unscopedInclude, include),
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
			where?: Object,
			include?: Object[],
			unscoped?: boolean,
			unscopedInclude?: boolean,
			additionalScopes?: string[],
			[key: string]: any,
		} = {}
	): Promise<T|null> {
		return this.correctionService.unscopedHelper(this, unscoped, additionalScopes).findOne({
			where: {
				id,
				...where,
			},
			include: this.correctionService.getCorrectInclude(this, unscopedInclude, include),
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
		where?: Object,
		include?: Object[],
		order?: any[],
		unscoped?: boolean,
		unscopedInclude?: boolean,
		additionalScopes?: string[],
		[key: string]: any,
	} = {}): Promise<T[]> {
		return this.correctionService.unscopedHelper(this, unscoped, additionalScopes).findAll({
			where,
			include: this.correctionService.getCorrectInclude(this, unscopedInclude, include),
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
			where?: Object,
			include?: Object[],
			order?: any[],
			unscoped?: boolean,
			unscopedInclude?: boolean,
			additionalScopes?: string[],
			[key: string]: any,
		} = {}
	): Promise<T[]> {
		return this.correctionService.unscopedHelper(this, unscoped, additionalScopes).findAll({
			where: {
				id: {
					[Op.in]: ids,
				},
				...where,
			},
			include: this.correctionService.getCorrectInclude(this, unscopedInclude, include),
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
		where?: Object,
		include?: Object[],
		unscoped?: boolean,
		unscopedInclude?: boolean,
		additionalScopes?: string[],
		[key: string]: any,
	} = {}): Promise<number> {
		return this.correctionService.unscopedHelper(this, unscoped, additionalScopes).count({
			where,
			include: this.correctionService.getCorrectInclude(this, unscopedInclude, include),
			distinct: true,
		...args,
		});
	}

	/**
	 * Validations
	 */
	public async validateDto(dtoType, dto, whitelist = true) {
		return this.validationService.validateDto(dtoType, dto, whitelist);
	}

	public async validateMandatoryId(id: string, {
		where = {},
		include = [],
		model = null,
		unscoped = this.entityOptions.unscoped,
		unscopedInclude = this.entityOptions.unscopedInclude,
		additionalScopes = this.entityOptions.additionalScopes,
	} = {}): Promise<T> {
		return this.validationService.validateMandatoryId(this, id, { where, include, model, unscoped, unscopedInclude, additionalScopes });
	}

	public async validateOptionalId(id: string, {
		where = {},
		include = [],
		model = null,
		unscoped = this.entityOptions.unscoped,
		unscopedInclude = this.entityOptions.unscopedInclude,
		additionalScopes = this.entityOptions.additionalScopes,
	} = {}): Promise<T|void> {
		return this.validationService.validateOptionalId(this, id, { where, include, model, unscoped, unscopedInclude, additionalScopes });
	}

	public async validateMandatoryIds(ids: string[], {
		where = {},
		include = [],
		model = null,
		unscoped = this.entityOptions.unscoped,
		unscopedInclude = this.entityOptions.unscopedInclude,
		additionalScopes = this.entityOptions.additionalScopes,
	} = {}) {
		return this.validationService.validateMandatoryIds(this, ids, { where, include, model, unscoped, unscopedInclude, additionalScopes });
	}

	public async validateOptionalIds(ids: string[], {
		where = {},
		include = [],
		model = null,
		unscoped = this.entityOptions.unscoped,
		unscopedInclude = this.entityOptions.unscopedInclude,
		additionalScopes = this.entityOptions.additionalScopes,
	} = {}) {
		return this.validationService.validateOptionalIds(this, ids, { where, include, model, unscoped, unscopedInclude, additionalScopes });
	}

	/**
	 * Relations
	 */
	public getSingleRelations(model?): Array<{ name: string, model: Model }> {
		return Object.entries((model ? model : this.__crudModel__).associations)
			.filter(([key, value]: any) => value.associationType === 'BelongsTo' && value.target.prototype.constructor !== Upload)
			.map(([key, value]: any) => {
				return {
					name: key,
					model: value.target,
				};
			});
	}

	public getMultipleRelations(model?): Array<{ name: string, model: Model }> {
		return Object.entries((model ? model : this.__crudModel__).associations)
			.filter(([key, value]: any) => value.associationType === 'BelongsToMany' && value.target.prototype.constructor !== Upload)
			.map(([key, value]: any) => {
				return {
					name: key,
					model: value.target,
				};
			});
	}

	public getUploadRelations(model?): string[] {
		return Object.entries((model ? model : this.__crudModel__).associations)
			.filter(([key, value]: any) =>
				['BelongsTo', 'BelongsToMany'].includes(value.associationType)
					&& value.target.prototype.constructor === Upload)
			.map(([key, value]: any) => key);
	}

	public getAllAssociations() {
		return Object.entries(this.__crudModel__.associations)
			.map(([key, value]: [any, any]) => {
				return value.target.prototype.constructor;
			});
	}

	public checkIncludeOptions() {
		const include = <any>this.getIncludeOptions();
		if (isEmpty(include.all)) {
			include.forEach(child => this.checkIncludeOptionsHelper(this.__crudModel__.prototype.constructor, child));
		}
	}

	private checkIncludeOptionsHelper(parent, child) {
		const childModel = child.model ?? child;
		const associations = Object.entries(parent.associations).map(([key, value]) => (value as any).target);

		const associationWithSameTableName = associations.find(v => v.getTableName() === childModel.getTableName());
		if (!associations.includes(childModel) && !associationWithSameTableName) {
			throw new Error(`Проверьте метод getIncludeOptions() у модели ${this.entityName}, линковки ${this.getEntityNameByModel(parent)} с ${this.getEntityNameByModel(childModel)} не существует`);
		}

		if (child.include) {
			child.include.forEach(subChild => this.checkIncludeOptionsHelper(childModel, subChild));
		}
	}
}