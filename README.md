# Requirements
```ts
-- postgresql
-- redis
-- sequelize
```

# Install

## PeerDependencies
```bash
npm install --save @nestjs/common @nestjs/core rxjs reflect-metadata dotenv @nestjs/config @nestjs/sequelize sequelize sequelize-typescript pg @nestjs/platform-express @nestjs/throttler ioredis @nestjs/swagger @nestjs/websockets
```

## Dependencies clarifying
```ts
// basic nestjs
@nestjs/common
@nestjs/core
rxjs
reflect-metadata

// config
dotenv
@nestjs/config

// database
@nestjs/sequelize
sequelize
sequelize-typescript
pg

// file upload
@nestjs/platform-express

// rate-limit and mutex
@nestjs/throttler
ioredis

// open api
@nestjs/swagger

// websockets
@nestjs/websockets
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
WS_ORIGIN=https://your_incredible_site.com:*
```

## main.ts
```ts
// First line of main.ts
import 'src/app/config';
import { config } from '@monokai-kirov/nestjs-crud-utils';
```

## src/app/config.ts
```ts
require('dotenv').config();
import { config } from '@monokai-kirov/nestjs-crud-utils';
```

### src/app/app.module.ts
```ts
import { config } from '@monokai-kirov/nestjs-crud-utils';

@Module({
	imports: [
		SequelizeModule.forRootAsync({
			useFactory: () => config.getDatabaseOptions() as any, // define defaultScope and underscored: true (you can use your own options but underscored: true is necessary)
		}),
	]
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
	imports: [
		UploadModule.register([
			SequelizeModule.forFeature([
				Upload,
			]),
		]),
	],
})
export class AppModule {}
```

## src/admin/models/category.model.ts
```ts
import { Column, Model, Table, DataType, /*BelongsToMany*/ } from 'sequelize-typescript';
import { primaryKeyOptions, Upload, UploadForeignKeyDecorator, UploadBelongsToDecorator, /*ForeignKeyDecorator, BelongsToDecorator*/ } from '@monokai-kirov/nestjs-crud-utils';
// import { Direction } from 'src/admin/models/direction.model';

@Table({
	indexes: [
		{ fields: ['image_id']},
		// { fields: ['direction_id']},
	],
})
export class Category extends Model {
	@Column(primaryKeyOptions)
	id: string;

	@Column({ allowNull: false })
	title: string;

	@Column({ type: DataType.TEXT, allowNull: true })
	description: string|null;

	@UploadForeignKeyDecorator()
	imageId: string|null;

	@UploadBelongsToDecorator()
	image: Upload|null;

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
import { StringDecorator, OptionalTextDecorator, UploadDecorator, UploadType, UUIDDecorator, ArrayOfUUIDsDecorator, OptionalArrayOfUUIDsDecorator } from "@monokai-kirov/nestjs-crud-utils";

export class CategoryDto {
	@StringDecorator()
	title: string;

	@OptionalTextDecorator()
	description: string|null = null;

	@UploadDecorator({ type: UploadType.PICTURE, width: 500 })
	image: string|null = null;

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
import { Controller, UseGuards } from "@nestjs/common";
import { ApiExtraModels, ApiTags } from "@nestjs/swagger";
import { ApiResponseDecorator } from "@monokai-kirov/nestjs-crud-utils";
import { CategoryDto } from "../dto/category.dto";
import { CategoryService } from "../services/category.service";
import { CrudController } from "@monokai-kirov/nestjs-crud-utils";

@ApiTags('Admin categories')
@ApiExtraModels(CategoryDto)
// @ApiResponseDecorator([401, 403])
// @RolesDecorator(UserRole.ADMIN)
// @UseGuards(JwtAuthGuard)
@Controller('api/admin/categories')
export class CategoryController extends CrudController {
	constructor(
		private readonly categoryService: CategoryService,
	) {
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
	controllers: [
		CategoryController,
	],
	providers: [
		CategoryService,
	],
})
export class AdminModule {}
```

## Inherited from CrudService and EntityService
```ts
/**
 * Default options for CrudService
 * export type CrudOptions = {
 *	withDtoValidation: true,
	*	withRelationValidation: true,
	*	withUploadValidation: true,
	*	withTriggersCreation: true, // triggers for Upload removing (single|multiple no matter)
	*	withActiveUpdate: false, // use this for updating linked entities if parent entity activated|deactivated
	*	unscoped: true,
	*	additionalScopes: ['admin'],
	*	childModels: [], // for automatically handle inheritance
	* };
	*/

/**
 * Default options for EntityService
 * {
 *	unscoped: false,
	*	unscopedInclude: false,
	*	additionalScopes: [],
	* };
	*/
```

```ts
/**
 * @Override this if you want@
 */
public getDtoType(dto) {
	return this.dtoType?.constructor !== Object ? this.dtoType : dto.constructor;
} // for class-validator
protected async fillDto(id: string|null, dto): Promise<Object> { return dto; } // if you want to add some new properties before saving
protected getIncludeOptions(): { all: boolean } | Object[] {
	return { all: true };
} // is used in all @Finders@ by default (in CrudService { all: true } and in EntityService [])
protected getSearchingProps(): Array<string|{ property: string, relation?: string, transform?: Function }> {
	return ['id', 'title'];
} // for findWithPagination method
public getConflictRelations(): string[] {
	return Object.entries((this.__crudModel__).associations)
		.filter(([key, value]: any) =>
			['HasOne', 'HasMany', 'BelongsToMany'].includes(value.associationType)
			&& value.target.prototype.constructor !== Upload)
		.map(([key, value]: any) => key);
}; // by default all links don't allow to delete the entity, you can override this behaviour
```

```ts
/**
 * Crud validations (by default all links are validated automatically, override this functions if you intend to validate other cases)
 */
public async validateRequest(id: string|null, dto, files, req): Promise<{ dto, files }> { return { dto, files }; }
public async validateCreateRequest(dto, files, req): Promise<{ dto, files }> { return { dto, files }; }
public async validateUpdateRequest(id: string, dto, files, req): Promise<{ dto, files }> { return { dto, files }; }
public async validateDeleteRequest(id: string, force?: boolean): Promise<void> {}
```

```ts
/**
 * Some helpers
 */
public readonly correctionService: CorrectionService<T>; // by default used in @Finders@ for preventing some sequelize bugs
// like include limitations and order with include + helper for recursively add attributes: [] in include for @sql group by query@
public readonly validationService: ValidationService<T>; (validateAndParseJsonWithOneKey(), validateAndParseArrayOfJsonsWithOneKey(), validateAndParseArrayOfJsonsWithMultipleKeys() etc.)
public get crudModel(): Model {
	return this.correctionService.unscopedHelper(this, this.entityOptions.unscoped, this.entityOptions.additionalScopes)
}
public get entityName() : string { return this.__crudModel__.prototype.constructor.name; }
public get tableName() : string { return this.__crudModel__.getTableName() };
public getEntityNameByModel(model?) : string { return model ? model.prototype.constructor.name : this.entityName; }
public getMaxEntitiesPerPage() : number { return 30; }
```

```ts
/**
 * @Finders@
 */
// by default with optimizedInclude in count method
findWithPagination({ search, where, include, offset, limit, order, unscoped, unscopedInclude, additionalScopes, ...args }?: {
	search?: string;
	where?: Object;
	include?: Include;
	offset?: number;
	limit?: number;
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
	where?: Object;
	include?: Include;
	unscoped?: boolean;
	unscopedInclude?: boolean;
	additionalScopes?: string[];
	[key: string]: any;
}): Promise<T | null>;
findOneById(id: string, { where, include, unscoped, unscopedInclude, additionalScopes, ...args }?: {
	where?: Object;
	include?: Include;
	unscoped?: boolean;
	unscopedInclude?: boolean;
	additionalScopes?: string[];
	[key: string]: any;
}): Promise<T | null>;
findAll({ where, include, order, unscoped, unscopedInclude, additionalScopes, ...args }?: {
	where?: Object;
	include?: Include;
	order?: any[];
	unscoped?: boolean;
	unscopedInclude?: boolean;
	additionalScopes?: string[];
	[key: string]: any;
}): Promise<T[]>;
findAllByIds(ids: string[], { where, include, order, unscoped, unscopedInclude, additionalScopes, ...args }?: {
	where?: Object;
	include?: Include;
	order?: any[];
	unscoped?: boolean;
	unscopedInclude?: boolean;
	additionalScopes?: string[];
	[key: string]: any;
}): Promise<T[]>;
count({ where, include, unscoped, unscopedInclude, additionalScopes, ...args }?: { // by default with optimizedInclude
	where?: Object;
	include?: Include;
	unscoped?: boolean;
	unscopedInclude?: boolean;
	additionalScopes?: string[];
	[key: string]: any;
}): Promise<number>;
```

```ts
/**
 * Validations
 */
validateDto(dtoType: any, dto: any, whitelist?: boolean): Promise<unknown[]>;
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

```ts
/**
 * Relations
 */
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

# Decorators list
```ts
@StringDecorator()
@OptionalStringDecorator()
@TextDecorator()
@OptionalTextDecorator()

@BooleanDecorator()
@OptionalBooleanDecorator()

@IntDecorator()
@OptionalIntDecorator()
@OptionalIntWithoutNullDecorator()
@DecimalDecorator()
@OptionalDecimalDecorator()
@OptionalDecimalWithoutNullDecorator()

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

# Guards
```ts
GatewayThrottlerGuard // just an example from the docs
MutexGuard // TODO: example
WsMutexGuard // TODO: example
```

# Pipes
```ts
NormalizeBeforeValidationPipe
NormalizeAfterValidationPipe
OptionalBooleanQueryValidationPipe
ValidatePagePipe
```

## Normalize example
```ts
// in main.ts
import { ValidationPipe } from '@nestjs/common';
import { NormalizeBeforeValidationPipe, NormalizeAfterValidationPipe } from '@monokai-kirov/nestjs-crud-utils';

app.useGlobalPipes(
	new NormalizeBeforeValidationPipe(), // trim whitespaces recursively, email normalization
	new ValidationPipe({ transform: true, whitelist: true }),
	new NormalizeAfterValidationPipe(), // phone normalization
);
```

# Interceptors
```ts
ReleaseMutexInterceptor // TODO: example
ReleaseWsMutexInterceptor // TODO: example
TransactionInterceptor (description below)
```

## Transactions and websocket gateway example
```bash
npm install cls-hooked
```

```ts
// in main.ts
import { createNamespace } from "cls-hooked";
import { Sequelize } from "sequelize-typescript"
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

# Filters
```ts
AllExceptionsFilter
AllWsExceptionsFilter (fixes nestjs + class-validator 500 internal server error bug)
```

## CryptoModule, EmailModule, config, utils, sequelize-options etc.

#TODO: examples