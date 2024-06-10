## v1.0.0 Notes

```ts
-- getIncludeOptions() was removed - please use getListInclude() and getDetailInclude() instead
-- in @Finders@ methods default include now is [] (old value was getIncludeOptions())

-- width, height parameters in @UploadDecorator and @MultipleUploadDecorator were removed, please use resizeOptions instead
-- UploadModel { url, filesize } -> values: [
	{ url, filesize, resizeOptions? },
	{ url, filesize, resizeOptions? },
	...
],
-- dependencies for uploadService.handleVideo() and this method were removed (mac issues)
```

# Package features:

## GET:

```ts
- sequelize bug fixed @see https://github.com/sequelize/sequelize/issues/7344;
- correct unscope:
  -- CrudService { unscoped: true, unscopedInclude: true } - for admin routes
  -- PublicCrudService: { unscoped: false, unscopedInclude: false } - for public routes
- integration with query-parser:
  crudController.getAll() - ?search=test and other query params support from https://www.npmjs.com/package/sequelize-query
```

## POST/PUT + bulk POST/PUT:

```ts
- links auto-validation in methods: create/bulk create/put/bulk put
- single/multiple/advanced multiple/inheritance links auto-binding
- possibilities for validation/create/update/delete files with postgresql triggers (by default after onApplicationBootstrap hook postgresql triggers (
	AFTER DELETE for Upload entity) will be created (to delete file from the hard drive)
	If you want to persist Upload files in a different storage (not a local hd; for example if you use kubernetes and AWS, Yandex Bucket etc.) please override UploadService
	and use overridden class in all CrudService instances as a third parameter. Also override writeBufferToStorage() and remove() methods in that class.
)
- integration with sharp - https://www.npmjs.com/package/sharp
```

## DELETE + bulk DELETE:

```ts
- getConflictRelations for protect against accidental removing large amount of data
```

## Integration with redis-semaphore - https://www.npmjs.com/package/redis-semaphore:

```ts
- leader election (for preventing multiple invokes @Cron() decorators or nestjs' hooks if you're using multiple app instances behind reverse proxy like nginx)
- guards, interceptors and filters for auto route protection from race conditions with user linking
```

## decorators/guards/pipes/interceptors/filters:

```ts
- NormalizationPipe - trim() whitespaces + normalization email/phone recursively
- multiple decorators and pipes for validation and sequelize models
- TransactionInterceptor
```

## Config:

```ts
-- default configs for redis, postgresql, email, cache, throttler, sentry, sharp
```

## Others services in the package:

```ts
- EmailService
- CryptoService
```

# Installing:

## Requirements

```ts
--postgresql with uuid-ossp;
--redis;
--sequelize;
```

## PeerDependencies and pg

```bash
npm install @nestjs/sequelize sequelize@6 sequelize-typescript ioredis pg
```

## main.ts

```ts
// First line of main.ts
import 'src/app/config';
```

## src/app/config.ts

```ts
import { config } from '@monokai-kirov/nestjs-crud-utils';
// you can override or define here configuration functions if you want,
// default values at the end of the docs
// for example: config.defineFunction(
// 'isTestEnvironment',
// () => process.env.NODE_ENV === 'test'
// );
```

# Notes and crud example:

```ts
/**
 * Notes
 */
Updating files note:
if you want to:
-- persist a previous file - specify the uuid;
-- remove the file - don't specify the uuid;
-- remove the file and load new - specify a blob in your multipart/form-data content;

Example of multipart/form-data content for bulk/create with files:
bulk[0][title]
bulk[0][description]
bulk[0][direction]
image[0]

pgtune:
https://pgtune.leopard.in.ua/

nginx:
https://docs.nginx.com/nginx/admin-guide/web-server/serving-static-content/
https://nginx.org/en/docs/http/load_balancing.html
https://www.digitalocean.com/community/tutorials/how-to-secure-nginx-with-let-s-encrypt-on-ubuntu-20-04

docker-compose scale:
https://brianchristner.io/how-to-scale-a-docker-container-with-docker-compose/

Security:
helmet: https://helmetjs.github.io/
rate-limiting: https://docs.nestjs.com/security/rate-limiting
csrf: https://docs.nestjs.com/security/csrf
content-security-policy: https://content-security-policy.com/
ufw: https://www.digitalocean.com/community/tutorials/initial-server-setup-with-ubuntu-20-04
snort: https://linoxide.com/install-snort-on-ubuntu/

Swagger setup:
https://docs.nestjs.com/openapi/introduction

.env:
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=someuser
DB_PASSWORD=somepassword
DB_NAME=somedb

REDIS_HOST=localhost
REDIS_PORT=6379
```

## src/app/app.module.ts

```ts
import { config, Upload, UploadModule } from '@monokai-kirov/nestjs-crud-utils';
import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AdminModule } from './admin/admin.module';

@Module({
	imports: [
		SequelizeModule.forRootAsync({
			// Define underscored: true (you can use your own options but underscored: true
			// is necessary + leader checking prevents multiple db schema syncronization from
			// different app instances (if you're not using migrations in simple cases))
			useFactory: () => config.getDatabaseOptionsWithLeaderChecking(),
		}),
		// By default after onApplicationBootstrap hook postgresql triggers
		// (AFTER DELETE for Upload entity) will be created (to delete file from the hard drive)
		UploadModule.register([SequelizeModule.forFeature([Upload])]),
		AdminModule,
	],
})
export class AppModule {}
```

## src/admin/admin.module.ts

```ts
import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Category } from './models/category.model';
import { CategoryService } from './services/category.service';
import { CategoryController } from './controllers/category.controller';

@Module({
	imports: [SequelizeModule.forFeature([Category])],
	controllers: [CategoryController],
	providers: [CategoryService],
})
export class AdminModule {}
```

## src/admin/models/category.model.ts

```ts
import { Column, Model, Table, DataType } from 'sequelize-typescript';
import {
	primaryKeyOptions,
	Upload,
	UploadForeignKeyDecorator,
	UploadBelongsToDecorator,
} from '@monokai-kirov/nestjs-crud-utils';

@Table({
	indexes: [{ fields: ['image_id'] }],
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
/**
import { DateType, Model, Column, ForeignKey, Table } from 'sequelize-typescript';
import { Category } from 'src/admin/models/category.model';
import { Direction } from 'src/admin/models/direction.model';

@Table
export class CategoryDirection extends Model {
	@ForeignKey(() => Category)
	@Column({ type: DataType.UUID, allowNull: false, onDelete: 'CASCADE' })
	categoryId: string;

	@ForeignKey(() => Direction)
	@Column({ type: DataType.UUID, allowNull: false, onDelete: 'CASCADE' })
	directionId: string;
}
*/
```

## src/admin/dto/category.dto.ts

```ts
import {
	StringDecorator,
	OptionalTextDecorator,
	UploadDecorator,
	UploadType,
} from '@monokai-kirov/nestjs-crud-utils';

export class CategoryDto {
	@StringDecorator()
	title: string;

	@OptionalTextDecorator()
	description: string | null = null;

	// @see https://sharp.pixelplumbing.com/api-resize
	@UploadDecorator({ type: UploadType.PICTURE, resizeOptions: [{ width: 800 }, { width: 400 }] })
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
import { CrudService, UploadService } from '@monokai-kirov/nestjs-crud-utils';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CategoryDto } from '../dto/category.dto';
import { Category } from '../models/category.model';

@Injectable()
export class CategoryService extends CrudService<Category> {
	constructor(
		@InjectModel(Category)
		private model: typeof Category,
		private readonly uploadService: UploadService,
	) {
		super(model, CategoryDto, uploadService);
	}
}
```

## src/admin/controllers/category.controller.ts

```ts
import { CrudController } from '@monokai-kirov/nestjs-crud-utils';
import { Controller } from '@nestjs/common';
import { ApiExtraModels, ApiTags } from '@nestjs/swagger';
import { CategoryDto } from '../dto/category.dto';
import { CategoryService } from '../services/category.service';

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

## Constructor options

```ts
/**
 * CrudService
 * protected static DEFAULT_CRUD_OPTIONS: CrudOptions = {
 *	withDtoValidation: true,
 *	withRelationValidation: true,
 *	withUploadValidation: true,
 *	withTriggersCreation: true, // triggers for Upload removing (single|multiple no matter)
 *	withActiveUpdate: false, // use this for updating linked entities if parent entity was activated|deactivated
 *	unscoped: true,
 *	additionalScopes: [],
 *	childModels: [],
 * };
 */

/**
 * EntityService
 * protected static DEFAULT_ENTITY_OPTIONS: EntityOptions = {
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

	// for application/json
	@AdvancedObjectMultipleRelationDecorator({
		// for multipart/form-data
		// @AdvancedJSONMultipleRelationDecorator({
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
// + you must declare childModels in constructor (for example if User has roles, childModels prop is: [Admin, Support, ...etc])
// + declare in getDtoType() correct dtoType for class-validator (for example based on the role in dto)
```

## CrudService

```ts
/**
 * @Override this if you want@
 */
// Is used in getAll() in CrudController; default value - { all: true }
public getListInclude();

// Is used in getById(), create(), bulkCreate(), putById(), bulkPut() in CrudController; default value - { all: true }
public getDetailInclude();

// For getAll() method in CrudController; default value - ['id', 'title'],
// for example: ?search=test will be using ILIKE condition with id and title properties
public getSearchingProps();

// Don't allow to delete the entity - you can override this behaviour; default value - all links
public getConflictRelations();

// Default value - 30
public getMaxEntitiesPerPage();

// If you want to add some new properties before saving; default value - dto
protected async fillDto();

/**
 * Validations (by default all links are being validated automatically,
 * override these functions if you intend to validate other cases)
 */
public async validateRequest(); // is being used in create and update methods
public async validateCreateRequest();
public async validateUpdateRequest();
public async validateDeleteRequest();

/**
 * Some helpers
 */
crudModel();
tableName();
entityName();
getEntityNameByModel();
```

## EntityService

```ts
/**
 * Finders
 */
findWithPagination(); // by default with optimizedInclude
findOne();
findOneById());
findAll();
findAllByIds();
count(); // by default with optimizedInclude

/**
 * Validations
 */
validateDto();
validateMandatoryId();
validateOptionalId();
validateMandatoryIds();
validateOptionalIds();

/**
 * Other validations in entityService.validationService
 */
validatePage();
validateAndParseOffsetAndLimit();
validateAndParseJsonWithOneKey();
validateAndParseArrayOfJsonsWithOneKey();
validateAndParseArrayOfJsonsWithMultipleKeys();
```

# Decorators:

```ts
@StringDecorator()
@OptionalStringDecorator()
@TextDecorator()
@OptionalTextDecorator()
@ArrayOfStringsDecorator()
@OptionalArrayOfStringsDecorator()

@IntDecorator()
@OptionalIntDecorator()
@DecimalDecorator()
@OptionalDecimalDecorator()

@BooleanDecorator()
@OptionalBooleanDecorator()

@DateDecorator()
@OptionalDateDecorator()

@IsInDecorator()
@OptionalIsInDecorator()

@UUIDDecorator()
@OptionalUUIDDecorator()
@ArrayOfUUIDsDecorator()
@OptionalArrayOfUUIDsDecorator()

@JSONDecorator()
@OptionalJSONDecorator()
@ArrayOfJSONsDecorator()
@OptionalArrayOfJSONsDecorator()

@ObjectDecorator()
@OptionalObjectDecorator()
@ArrayOfObjectsDecorator()
@OptionalArrayOfObjectsDecorator()

@EmailDecorator()
@OptionalEmailDecorator()
@PhoneDecorator()
@OptionalPhoneDecorator()

@ForeignKeyDecorator()
@BelongsToDecorator()

@AdvancedJSONMultipleRelationDecorator()
@AdvancedObjectMultipleRelationDecorator()

@UploadDecorator()
@MultipleUploadDecorator()
@UploadForeignKeyDecorator()
@UploadBelongsToDecorator()

@CacheDecorator()
@RolesDecorator()
@ApiJwtHeaderDecorator()
@ApiResponseDecorator()
```

## Guards:

```ts
GatewayThrottlerGuard; // just an example from the docs
MutexGuard;
WsMutexGuard;
```

## Pipes:

```ts
NormalizeBeforeValidationPipe;
NormalizeAfterValidationPipe;
OptionalBooleanQueryValidationPipe;
ValidatePagePipe;

/**
 * Normalize example
 */
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

## Interceptors:

```ts
ReleaseMutexInterceptor;
ReleaseWsMutexInterceptor;
TransactionInterceptor;

/**
 * Setup for transactions support
 */
npm install cls-hooked

// in main.ts
import { createNamespace } from 'cls-hooked';
import { Sequelize } from 'sequelize-typescript';
const namespace = createNamespace('sequelize-cls-namespace');
(Sequelize as any).__proto__.useCLS(namespace);

// in bootstrap function() for http context
const { httpAdapter } = app.get(HttpAdapterHost);
app.useGlobalFilters(new AllExceptionsFilter(httpAdapter));
```

## Filters:

```ts
AllExceptionsFilter
AllWsExceptionsFilter (fix ws errors and catch postgresql 40001 thrown by SERIALIZABLE isolation level if TransactionInterceptor is used)
```

## Leader election (for preventing multiple invokes @Cron() decorators or nestjs' hooks if you're using multiple app instances behind reverse proxy like nginx):

```ts
// package safe-redis-leader is being used

/**
 * Example
 */
import { EntityService, config } from '@monokai-kirov/nestjs-crud-utils';
import { HttpService, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Options, OptionsType } from '../models/options.model';

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
		// logic of updating
	}
}
```

## Config:

```ts
/**
 * Functions is being used in this package
 */
-- getDatabaseOptionsWithLeaderChecking(); // for pg-listen
-- getRedisOptions(); // for safe-redis-leader and redis-semaphore
-- getDefaultResizeOptions() // for UploadService
-- getUploadOptions(); // for UploadService
-- getEmailOptions(); // for EmailService

/**
 * List
 */
isDevelopment();
isProduction();

getDatabaseOptionsWithLeaderChecking() {
	dialect: 'postgres',
	host: process.env.DB_HOST,
	port: parseInt(process.env.DB_PORT),
	username: process.env.DB_USERNAME,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_NAME,
	define: {
		underscored: true,
	},
	autoLoadModels: true,
	...(isLeader
		? {
				synchronize: true,
				sync: {
					alter: true,
				},
			}
		: {}),
	pool: {
		min: 10,
		max: 100,
	},
	logging: false,
};

getRedisOptions() {
	host: process.env.REDIS_HOST,
	port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
};

getDefaultResizeOptions() {
	[
		{
			width: this.getUploadOptions().imageWidth,
		},
	];
};

public getUploadOptions() {
	imageWidth: 1000,
	folders: ['upload'],
	ALLOWED_PICTURE_MIMETYPES: ['image/jpeg', 'image/png', 'image/svg+xml'],
	ALLOWED_AUDIO_MIMETYPES: ['audio/mpeg', 'audio/ogg', 'audio/aac'],
	ALLOWED_VIDEO_MIMETYPES: ['video/mpeg', 'video/ogg', 'video/mp4'],
	ALLOWED_DOCUMENT_MIMETYPES: [
		'text/plain',
		'application/pdf',
		'application/vnd.ms-excel',
		'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		'application/msword',
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	],
	SUMMARY_SIZE_LIMIT: 100_000_000, // 100 Mb
}

public getEmailOptions() {
	host: 'smtp.yandex.ru',
	port: 465,
	secure: true,
	auth: {
		user: process.env.EMAIL_LOGIN,
		pass: process.env.EMAIL_PASSWORD,
	};
}

public getCorsOrigin() {
	process.env.CORS_ORIGIN;
}

public getThrottlerOptions() {
	ttl: 60,
	limit: 20,
	storage: new ThrottlerStorageRedisService(this.getRedisClient()),
}

public getCacheOptions() {
	store: redisStore,
	...this.getRedisOptions(),
	ttl: 300,
	max: 500,
}

public getWsPort() {
	process.env.WS_PORT ? parseInt(process.env.WS_PORT) : 3030;
}

public getWsOptions() {
	transports: ['websocket'],
	origins: process.env.WS_ORIGIN ?? '*:*',
	path: '/ws',
	serveClient: false,
	allowUpgrades: false,
}

public getSentryOptions() {
	dsn: process.env.SENTRY_DSN,
	tracesSampleRate: 1.0;
}
```
