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


# Crud example
## src/admin/models/category.model.ts
```ts
import { Column, Model, Table, DataType, ForeignKey, /*BelongsTo, BelongsToMany*/ } from 'sequelize-typescript';
import { primaryKeyOptions, Upload } from '@monokai-kirov/nestjs-crud-utils';
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

	@ForeignKey(() => Upload)
	@Column({ type: DataType.UUID, allowNull: true })
	imageId: string|null;

	@BelongsTo(() => Upload, { foreignKey: 'image_id', onDelete: 'SET NULL' })
	image: Upload|null;

	/**
	 * Single linking example
	 */
	// Mandatory
	// @ForeignKey(() => Direction)
	// @Column({ type: DataType.UUID, allowNull: false })
	// directionId: string;

	// @BelongsTo(() => Direction, { foreignKey: 'direction_id', onDelete: 'CASCADE' })
	// direction: Direction;

	// Optional
	// @ForeignKey(() => Direction)
	// @Column({ type: DataType.UUID, allowNull: true })
	// directionId: string|null;

	// @BelongsTo(() => Direction, { foreignKey: 'direction_id', onDelete: 'CASCADE' /*or 'SET NULL' if you want*/ })
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

	// By default getIncludeOptions in CrudService returns { all: true }
	protected getIncludeOptions() {
		return [
			Upload,
		];
	}

	/**
	 * Inherited from CrudService
	 */
	// public getDtoType(dto) { return this.dtoType?.constructor !== Object ? this.dtoType : dto.constructor; }
	// protected async fillDto(id: string|null, dto): Promise<Object> { return dto; }
	// protected getIncludeOptions(): { all: boolean } | Object[] { return { all: true }; }
	// public getConflictRelations(): string[] {
		// return Object.entries((this.__crudModel__).associations)
			// .filter(([key, value]: any) =>
				// ['HasOne', 'HasMany', 'BelongsToMany'].includes(value.associationType)
				// && value.target.prototype.constructor !== Upload)
			// .map(([key, value]: any) => key);
	// };
	// public async validateRequest(id: string|null, dto, files, req): Promise<{ dto, files }> { return { dto, files }; }
	// public async validateCreateRequest(dto, files, req): Promise<{ dto, files }> { return { dto, files }; }
	// public async validateUpdateRequest(id: string, dto, files, req): Promise<{ dto, files }> { return { dto, files }; }
	// public async validateDeleteRequest(id: string, force?: boolean): Promise<void> {}
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
// import { CategoryDirection } from './models/category.direction.model';

@Module({
	imports: [
		SequelizeModule.forFeature([
			Category,
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
GatewayThrottlerGuard
MutexGuard
WsMutexGuard
```

# Pipes
```ts
NormalizeBeforeValidationPipe
NormalizeAfterValidationPipe
OptionalBooleanQueryValidationPipe
ValidatePagePipe
```

# Interceptors
```ts
ReleaseMutexInterceptor
ReleaseWsMutexInterceptor
TransactionInterceptor
```

# Filters
```ts
AllExceptionsFilter
AllWsExceptionsFilter
```

# UploadModule

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

# SmsModule
## src/app/app.module.ts
```ts
import { SequelizeModule } from '@nestjs/sequelize';
import { Upload, UploadModule } from '@monokai-kirov/nestjs-crud-utils';

@Module({
	imports: [
		SmsModule.register([
			SequelizeModule.forFeature([
				SmsRequest,
			]),
		]),
	],
})
export class AppModule {}
```

#TODO: examples