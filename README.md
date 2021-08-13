# Requirements

```ts
--postgresql;
--redis;
--sequelize;
```

# Install

## PeerDependencies

```bash
npm install --save ioredis @nestjs/sequelize sequelize@~6.5.0 sequelize-typescript
```

## .env.example for docker environment

```
NODE_ENV=production

DB_HOST=db
DB_PORT=5432
DB_USERNAME=someuser
DB_PASSWORD=blablabla
DB_NAME=somedb

REDIS_HOST=redis
REDIS_PORT=6379

WS_PORT=3030
WS_ORIGIN=https://your_site.com:*
```

## main.ts

```ts
// First line of main.ts
import 'src/app/config';
```

## src/app/config.ts

```ts
import { config } from '@monokai-kirov/nestjs-crud-utils';
// you can override here config's functions if you want
```

### src/app/app.module.ts

```ts
import { config } from '@monokai-kirov/nestjs-crud-utils';

@Module({
	imports: [
		SequelizeModule.forRootAsync({
			useFactory: () => config.getDatabaseOptions() as any, // define underscored: true (you can use your own options but underscored: true is necessary)
		}),
	],
})
export class AppModule {}
```

# Crud example (please import UploadModule for this example)

## UploadModule

By default after onApplicationBootstrap hook postgresql triggers (AFTER DELETE for Upload entity) will be created (to delete file from the hard drive)

## src/app/app.module.ts

```ts
import { SequelizeModule } from '@nestjs/sequelize';
import { Upload, UploadModule } from '@monokai-kirov/nestjs-crud-utils';

@Module({
	imports: [UploadModule.register([SequelizeModule.forFeature([Upload])])],
})
export class AppModule {}
```

## src/admin/models/category.model.ts

```ts
import { Column, Model, Table, DataType /*BelongsToMany*/ } from 'sequelize-typescript';
import {
	primaryKeyOptions,
	Upload,
	UploadForeignKeyDecorator,
	UploadBelongsToDecorator /*ForeignKeyDecorator, BelongsToDecorator*/,
} from '@monokai-kirov/nestjs-crud-utils';
// import { Direction } from 'src/admin/models/direction.model';

@Table({
	indexes: [
		{ fields: ['image_id'] },
		// { fields: ['direction_id']},
	],
})
export class Category extends Model {
	@Column(primaryKeyOptions)
	id: string;

	@Column({ allowNull: false })
	title: string;

	@Column({ type: DataType.TEXT, allowNull: true })
	description: string | null;

	@UploadForeignKeyDecorator()
	imageId: string | null;

	@UploadBelongsToDecorator()
	image: Upload | null;

	/**
	 * Single linking example
	 */
	// Mandatory
	// @ForeignKeyDecorator(() => Direction)
	// directionId: string;

	// @BelongsToDecorator(() => Direction)
	// direction: Direction;

	// Optional
	// @ForeignKeyDecorator(() => Direction, true)
	// directionId: string|null;

	// @BelongsToDecorator(() => Direction, /*'SET NULL' if you want (by default onDelete: 'CASCADE')*/)
	// direction: Direction|null;

	/**
	 * Multiple linking example
	 */
	// @BelongsToMany(() => Direction, () => CategoryDirection)
	// directions: Direction[];
}
```

## src/admin/models/category.direction.model.ts

```ts
// import { DateType, Model, Column, ForeignKey, Table } from "sequelize-typescript";
// import { Category } from "src/admin/models/category.model";
// import { Direction } from "src/admin/models/direction.model";

// @Table({
// indexes: [
// { fields: ['category_id', 'direction_id']},
// ],
// })
// export class CategoryDirection extends Model {
// @ForeignKey(() => Category)
// @Column({ type: DataType.UUID, allowNull: false, onDelete: 'CASCADE' })
// categoryId: string;

// @ForeignKey(() => Direction)
// @Column({ type: DataType.UUID, allowNull: false, onDelete: 'CASCADE' })
// directionId: string;
// }
```

## src/admin/models/category.dto.ts

```ts
import {
	StringDecorator,
	OptionalTextDecorator,
	UploadDecorator,
	UploadType,
	UUIDDecorator,
	ArrayOfUUIDsDecorator,
	OptionalArrayOfUUIDsDecorator,
} from '@monokai-kirov/nestjs-crud-utils';

export class CategoryDto {
	@StringDecorator()
	title: string;

	@OptionalTextDecorator()
	description: string | null = null;

	@UploadDecorator({ type: UploadType.PICTURE, width: 500 })
	image: string | null = null;

	/**
	 * Single linking example
	 */
	// Mandatory
	// @UUIDDecorator()
	// direction: string;

	// Optional
	// @OptionalUUIDDecorator()
	// direction: string|null = null;

	/**
	 * Multiple linking example
	 */
	// Mandatory
	// @ArrayOfUUIDsDecorator()
	// directions: string[];

	// Optional
	// @OptionalArrayOfUUIDsDecorator()
	// directions: string[] = [];
}
```

## src/admin/services/category.service.ts

```ts
import { CrudService, Upload, UploadService } from "@monokai-kirov/nestjs-crud-utils";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { CategoryDto } from "../dto/category.dto";
import { Category } from "../models/category.model";

@Injectable()
export class CategoryService extends CrudService<Category> {
	constructor(
		@InjectModel(Category)
		private model: typeof Category,
		private readonly uploadService: UploadService,
	) {
		super(model, CategoryDto, uploadService);
	}
```

## src/admin/controllers/category.controller.ts

```ts
import { Controller, UseGuards } from '@nestjs/common';
import { ApiExtraModels, ApiTags } from '@nestjs/swagger';
import { ApiResponseDecorator } from '@monokai-kirov/nestjs-crud-utils';
import { CategoryDto } from '../dto/category.dto';
import { CategoryService } from '../services/category.service';
import { CrudController } from '@monokai-kirov/nestjs-crud-utils';

@ApiTags('Admin categories')
@ApiExtraModels(CategoryDto)
// @ApiResponseDecorator([401, 403])
// @RolesDecorator(UserRole.ADMIN)
// @UseGuards(JwtAuthGuard)
@Controller('api/admin/categories')
export class CategoryController extends CrudController {
	constructor(private readonly categoryService: CategoryService) {
		super(categoryService);
	}
}
```

## src/admin/admin.module.ts

```ts
import { Category } from './models/category.model';
import { CategoryService } from './services/category.service';
import { CategoryController } from './controllers/category.controller';
// import { Direction } from './models/direction.model';
// import { CategoryDirection } from './models/category.direction.model';

@Module({
	imports: [
		SequelizeModule.forFeature([
			Category,
			// Direction,
			// CategoryDirection,
		]),
	],
	controllers: [CategoryController],
	providers: [CategoryService],
})
export class AdminModule {}
```

## Constructor options

```ts
/**
 * CrudService
 * export type CrudOptions = {
 *	withDtoValidation: true,
 *	withRelationValidation: true,
 *	withUploadValidation: true,
 *	withTriggersCreation: true, // triggers for Upload removing (single|multiple no matter)
 *	withActiveUpdate: false, // use this for updating linked entities if parent entity activated|deactivated
 *	unscoped: true,
 *	additionalScopes: [],
 *	childModels: [], // for automatically handling inheritance
 * };
 */

/**
 * EntityService
 * {
 *	unscoped: false,
 *	unscopedInclude: false,
 *	additionalScopes: [],
 * };
 */
```

## Handling advanced multiple relations

```ts
/**
 * For example User has Language with Skill
 */
// src/user/models/user.model.ts
@Table
export class User extends Model {
	@Column(primaryKeyOptions)
	id: string;

	@Column({ allowNull: false, defaultValue: false })
	isActive: boolean;

	@Column({ allowNull: false, defaultValue: UserRole.CUSTOMER })
	role: string;

	// ...etc

	@HasMany(() => UserLanguageWithSkill)
	languages: UserLanguageWithSkill[];
}

// src/user/models/language.with.skill.model.ts
@Table({
	indexes: [{ fields: ['user_id'] }, { fields: ['language_id'] }, { fields: ['skill_id'] }],
})
export class UserLanguageWithSkill extends Model {
	@Column(primaryKeyOptions)
	id: string;

	@ForeignKeyDecorator(() => User)
	userId: string;

	@BelongsToDecorator(() => User)
	user: User;

	@ForeignKeyDecorator(() => Language)
	languageId: string;

	@BelongsToDecorator(() => Language)
	language: Language;

	@ForeignKeyDecorator(() => LanguageSkill)
	skillId: string;

	@BelongsToDecorator(() => LanguageSkill)
	skill: LanguageSkill;
}

// src/user/dto/user.dto.ts
export class UserDto {
	// email, phone, ...etc

	@AdvancedObjectMultipleRelationDecorator({
		// for application/json
		// @AdvancedJSONMultipleRelationDecorator({ // for multipart/form-data
		schema: UserLanguageWithSkillDto,
		unique: ['languageId'], // unique prop so that user can't use one language with different skills
		minCount: 1, // is optional
	})
	languages: string[];
}

// src/user/dto/user.language.with.skill.dto.ts
export class UserLanguageWithSkillDto {
	@UUIDDecorator()
	languageId: string;

	@UUIDDecorator()
	skillId: string;
}
```

## Handling inheritance

```ts
public getChildModel(dto: Record<string, any>): Model {
	return null;
}
public getChildModelKey(): string | null {
	return null;
}
// + you must declare childModels in constructor (for example if User has roles, childModels prop is: [Admin, Specialist, ...etc])
// + declare in getDtoType() correct dtoType for class-validator (for example based on the role in dto)
```

## @Override this if you want@

```ts
public getDtoType(dto: Record<string, any>): any {
	return this.dtoType?.constructor !== Object ? this.dtoType : dto.constructor;
} // for class-validator

protected getIncludeOptions(): Include {
	return { all: true };
} // is used in all @Finders@ by default (in CrudService { all: true } and in EntityService [])

protected getSearchingProps(): Array<
	string | string[] | { property: string | string[]; transform: (value: any) => any }
> {
	return ['id', 'title'];
} // for findWithPagination method

public getConflictRelations(): string[] {
	return Object.entries(this.__crudModel__.associations)
		.filter(
			([key, value]: any) =>
				['HasOne', 'HasMany', 'BelongsToMany'].includes(value.associationType) &&
				value.target.prototype.constructor !== Upload,
		)
		.map(([key, value]: any) => key);
} // by default all links don't allow to delete the entity, you can override this behaviour

protected async fillDto(
	id: string | null,
	dto: Record<string, any>,
	req: Request,
): Promise<Record<string, any>> {
	return dto;
} // if you want to add some new properties before saving

public async findAfterCreateOrUpdate(id: string): Promise<T> {
	return this.findOneById(id);
}
```

```ts
/**
 * Some helpers
 */
public readonly correctionService: CorrectionService<T>; // by default used in @Finders@ for preventing some sequelize bugs
// like include limitations and order with include + helper for recursively add attributes: [] for @sql group by query@
public readonly validationService: ValidationService<T>; (validateAndParseJsonWithOneKey(), validateAndParseArrayOfJsonsWithOneKey(), validateAndParseArrayOfJsonsWithMultipleKeys() etc.)

public get crudModel(): Model {
	return this.correctionService.unscopedHelper(this, this.entityOptions.unscoped, this.entityOptions.additionalScopes)
}
public get tableName() : string { return this.__crudModel__.getTableName() };
public get entityName() : string { return this.__crudModel__.prototype.constructor.name; }
public getEntityNameByModel(model?) : string { return model ? model.prototype.constructor.name : this.entityName; }
public getMaxEntitiesPerPage() : number { return 30; }

getSingleRelations(model?: any): Array<{
	name: string;
	model: Model;
}>;
getMultipleRelations(model?: any): Array<{
	name: string;
	model: Model;
}>;
getUploadRelations(model?: any): string[];
getAllAssociations(): any[];
```

## Validations

```ts
/**
 * Crud validations (by default all links are validated automatically, override this functions if you intend to validate other cases)
 */
public async validateRequest( // is used in create and update methods
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

/**
 * Other validations (inherited from EntityService)
 */
validateDto(dtoType: any, dto: Record<string, any>, whitelist?: boolean): Promise<Record<string, any>>;

validateMandatoryId(id: string, { where, include, model, unscoped, unscopedInclude, additionalScopes, }?: {
	where?: {};
	include?: any[];
	model?: any;
	unscoped?: boolean;
	unscopedInclude?: boolean;
	additionalScopes?: string[];
}): Promise<T>;

validateOptionalId(id: string, { where, include, model, unscoped, unscopedInclude, additionalScopes, }?: {
	where?: {};
	include?: any[];
	model?: any;
	unscoped?: boolean;
	unscopedInclude?: boolean;
	additionalScopes?: string[];
}): Promise<T | void>;

validateMandatoryIds(ids: string[], { where, include, model, unscoped, unscopedInclude, additionalScopes, }?: {
	where?: {};
	include?: any[];
	model?: any;
	unscoped?: boolean;
	unscopedInclude?: boolean;
	additionalScopes?: string[];
}): Promise<void>;

validateOptionalIds(ids: string[], { where, include, model, unscoped, unscopedInclude, additionalScopes, }?: {
	where?: {};
	include?: any[];
	model?: any;
	unscoped?: boolean;
	unscopedInclude?: boolean;
	additionalScopes?: string[];
}): Promise<void>;
```

## Finders

```ts
// by default with optimizedInclude in count method
findWithPagination({ search, where, include, offset, limit, page, order, unscoped, unscopedInclude, additionalScopes, ...args }?: {
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
}): Promise<{
		entities: T[];
		totalCount: number;
}>;

findOne({ where, include, unscoped, unscopedInclude, additionalScopes, ...args }?: {
	where?: Record<string, any>;
	include?: Include;
	unscoped?: boolean;
	unscopedInclude?: boolean;
	additionalScopes?: string[];
	[key: string]: any;
}): Promise<T | null>;

findOneById(id: string, { where, include, unscoped, unscopedInclude, additionalScopes, ...args }?: {
	where?: Record<string, any>;
	include?: Include;
	unscoped?: boolean;
	unscopedInclude?: boolean;
	additionalScopes?: string[];
	[key: string]: any;
}): Promise<T | null>;

findAll({ where, include, order, unscoped, unscopedInclude, additionalScopes, ...args }?: {
	where?: Record<string, any>;
	include?: Include;
	order?: any[];
	unscoped?: boolean;
	unscopedInclude?: boolean;
	additionalScopes?: string[];
	[key: string]: any;
}): Promise<T[]>;

findAllByIds(ids: string[], { where, include, order, unscoped, unscopedInclude, additionalScopes, ...args }?: {
	where?: Record<string, any>;
	include?: Include;
	order?: any[];
	unscoped?: boolean;
	unscopedInclude?: boolean;
	additionalScopes?: string[];
	[key: string]: any;
}): Promise<T[]>;

count({ where, include, unscoped, unscopedInclude, additionalScopes, ...args }?: {
	where?: Record<string, any>;
	include?: Include;
	unscoped?: boolean;
	unscopedInclude?: boolean;
	additionalScopes?: string[];
	[key: string]: any;
}): Promise<number>;
```

# Decorators list

```ts
@StringDecorator()
@OptionalStringDecorator()
@TextDecorator()
@OptionalTextDecorator()
@ArrayOfStringsDecorator()
@OptionalArrayOfStringsDecorator()

@IntDecorator()
@OptionalIntDecorator()
@OptionalIntWithoutNullDecorator()
@DecimalDecorator()
@OptionalDecimalDecorator()
@OptionalDecimalWithoutNullDecorator()

@BooleanDecorator()
@OptionalBooleanDecorator()

@DateDecorator()
@OptionalDateDecorator()

@IsInDecorator()
@OptionalIsInDecorator()

@UUIDDecorator()
@OptionalUUIDDecorator()
@JsonDecorator()
@OptionalJsonDecorator()
@ObjectDecorator()
@OptionalObjectDecorator()
@ArrayOfUUIDsDecorator()
@OptionalArrayOfUUIDsDecorator()
@ArrayOfJSONsDecorator()
@OptionalArrayOfJSONsDecorator()
@ArrayOfObjectsDecorator()
@OptionalArrayOfObjectsDecorator()

@EmailDecorator()
@OptionalEmailDecorator()
@PhoneDecorator()
@OptionalPhoneDecorator()

@ForeignKeyDecorator()
@BelongsToDecorator()
@UploadForeignKeyDecorator()
@UploadBelongsToDecorator()

@UploadDecorator()
@MultipleUploadDecorator()

@AdvancedJSONMultipleRelationDecorator()
@AdvancedObjectMultipleRelationDecorator()

@ApiJwtHeaderDecorator()
@ApiResponseDecorator()
@RolesDecorator()
```

## Leader election (for preventing multiple invokes @Cron() decorators or nestjs' hooks)

```ts
// package safe-redis-leader is used

/**
 * Example
 */
import { HttpService, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { EntityService, config } from '@monokai-kirov/nestjs-crud-utils';
import { Options, OptionsType } from '../models/options.model';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class OptionsService extends EntityService<Options> {
	constructor(
		@InjectModel(Options)
		private model: typeof Options,
		private readonly httpService: HttpService,
	) {
		super(model);
	}

	public async onApplicationBootstrap() {
		await this.updateExchangeRate();
	}

	@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
	public async updateExchangeRate() {
		const isLeader = await config.isLeader(); // here
		if (!isLeader) {
			return;
		}

		let options = await this.findOne({
			where: {
				type: OptionsType.BASE,
			},
		});

		try {
			if (!options) {
				options = new Options();
				options.type = OptionsType.BASE;
			}

			options.values = {};
			const USD = await this.fetchCurrency('USD');
			if (USD) {
				options.values['USD'] = USD;
			}
			const EUR = await this.fetchCurrency('EUR');
			if (EUR) {
				options.values['EUR'] = EUR;
			}
			await options.save();
		} catch (e) {}
	}

	private async fetchCurrency(from: string, to = 'RUB', amount = 1) {
		const host = 'https://api.frankfurter.app';
		const response = await this.httpService
			.get(`${host}/latest?from=${from}&to=${to}&amount=${amount}`)
			.toPromise();
		const value = response.data?.rates?.[to];
		return value ?? null;
	}
}
```

## Guards

```ts
GatewayThrottlerGuard; // just an example from the docs
MutexGuard; // TODO: example
WsMutexGuard; // TODO: example
```

## Pipes

```ts
NormalizeBeforeValidationPipe;
NormalizeAfterValidationPipe;
OptionalBooleanQueryValidationPipe;
ValidatePagePipe;
```

## Normalize example

```ts
// in main.ts
import { ValidationPipe } from '@nestjs/common';
import {
	NormalizeBeforeValidationPipe,
	NormalizeAfterValidationPipe,
} from '@monokai-kirov/nestjs-crud-utils';

app.useGlobalPipes(
	new NormalizeBeforeValidationPipe(), // trim whitespaces recursively, email normalization
	new ValidationPipe({ transform: true, whitelist: true }),
	new NormalizeAfterValidationPipe(), // phone normalization
);
```

## Interceptors

```ts
ReleaseMutexInterceptor // TODO: example
ReleaseWsMutexInterceptor // TODO: example
TransactionInterceptor (description below)
```

## Filters

```ts
AllExceptionsFilter
AllWsExceptionsFilter (fixes nestjs + class-validator 500 internal server error bug)
```

## Transactions and websocket gateway example

```bash
npm install cls-hooked
```

```ts
// in main.ts
import { createNamespace } from 'cls-hooked';
import { Sequelize } from 'sequelize-typescript';
const namespace = createNamespace('sequelize-cls-namespace');
(Sequelize as any).__proto__.useCLS(namespace);

// in bootstrap function() for http context
const { httpAdapter } = app.get(HttpAdapterHost);
app.useGlobalFilters(new AllExceptionsFilter(httpAdapter));
```

```ts
// Websocket gateway example (fix ws errors and catch postgresql 40001 throwed by SERIALIZABLE isolation level if TransactionInterceptor is used)
import {
	GatewayThrottlerGuard,
	AllWsExceptionsFilter
	config,
} from '@monokai-kirov/nestjs-crud-utils';
import { UseGuards, UsePipes, UseFilters, ValidationPipe } from '@nestjs/common';

@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@UseFilters(AllWsExceptionsFilter)
@WebSocketGateway(config.getWsPort(), config.getWsOptions())
export class EventsGateway {}
```
