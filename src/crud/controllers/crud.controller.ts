import {
	Body,
	DefaultValuePipe,
	Delete,
	Get,
	Param,
	ParseUUIDPipe,
	Post,
	Put,
	Query,
	Req,
	UploadedFiles,
	UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { ApiConsumes } from '@nestjs/swagger';
import { ApiImplicitQueries } from 'nestjs-swagger-api-implicit-queries-decorator';
import { ApiResponseDecorator } from '../../decorators/api.response.decorator';
import { OptionalBooleanQueryValidationPipe } from '../../pipes/optional.boolean.query.validation.pipe';
import { BulkDto } from '../dto/bulk.dto';
import { CrudService } from '../services/crud.service';
import { Request } from 'express';

type CrudResponse = {
	statusCode: number;
	[key: string]: any;
};

export class CrudController {
	protected readonly service: CrudService<any>;

	constructor(service: CrudService<any>) {
		this.service = service;
	}

	@ApiImplicitQueries([
		{ name: 'offset', required: false },
		{ name: 'limit', required: false },
		{ name: 'search', required: false },
	])
	@ApiResponseDecorator([
		{ code: 200, description: 'entities: ${Entity[]}, totalCount: ${totalCount}' },
	])
	@Get()
	async get(
		@Query('offset', new DefaultValuePipe(0)) offset: number,
		@Query('limit') limit?: string | number,
		@Query('search') search?: string,
		...rest: any[]
	): Promise<CrudResponse> {
		return {
			statusCode: 200,
			...(await this.service.findWithPagination({ search, offset, limit })),
		};
	}

	@ApiConsumes('multipart/form-data')
	@UseInterceptors(AnyFilesInterceptor())
	@ApiResponseDecorator([400, 201])
	@Post()
	async create(
		@Body() dto: Record<string, any>,
		@UploadedFiles() files = {},
		@Req() req: Request,
		...rest: any[]
	): Promise<CrudResponse> {
		const { dto: transformedDto, files: transformedFiles } =
			await this.service.validateBeforeCreating(dto, files, req);
		const entity = await this.service.create(transformedDto, transformedFiles, req);
		return {
			statusCode: 201,
			entity: await this.service.findAfterCreateOrUpdate(entity.id),
		};
	}

	@ApiResponseDecorator([400, 201])
	@Post('bulk')
	async bulkCreate(
		@Body() dto: BulkDto,
		@Req() req: Request,
		...rest: any[]
	): Promise<CrudResponse> {
		await this.service.validateBeforeBulkCreating(dto, req);
		await this.service.bulkCreate(dto, req);
		return {
			statusCode: 201,
		};
	}

	@ApiConsumes('multipart/form-data')
	@UseInterceptors(AnyFilesInterceptor())
	@ApiResponseDecorator([400, 200])
	@Put(':id')
	async update(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() dto: Record<string, any>,
		@UploadedFiles() files = {},
		@Req() req: Request,
		...rest: any[]
	): Promise<CrudResponse> {
		const { dto: transformedDto, files: transformedFiles } =
			await this.service.validateBeforeUpdating(id, dto, files, req);
		const entity = await this.service.updateById(id, transformedDto, transformedFiles, req);
		return {
			statusCode: 200,
			entity: await this.service.findAfterCreateOrUpdate(entity.id),
		};
	}

	@ApiImplicitQueries([{ name: 'force', required: false }])
	@ApiResponseDecorator([400, 200])
	@Delete(':id')
	async delete(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Query('force', new OptionalBooleanQueryValidationPipe('force')) force?,
		@Req() req?: Request,
		...rest: any[]
	): Promise<CrudResponse> {
		await this.service.validateBeforeRemoving(id, force, req);
		await this.service.removeById(id);
		return {
			statusCode: 200,
		};
	}
}
