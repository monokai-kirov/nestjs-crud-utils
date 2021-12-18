import {
	Body,
	Delete,
	Get,
	Param,
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
import { ApiResponseDecorator } from '../../utils/decorators/api.response.decorator';
import { OptionalBooleanQueryValidationPipe } from '../../utils';
import { BulkCreateUpdateDto } from '../dto/bulk.create.update.dto';
import { BulkDeleteDto } from '../dto/bulk.delete.dto';
import { CrudService } from '../services/crud.service';
import { Request } from 'express';
import { CrudResponse } from '../types';

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
	async getAll(
		@Query('offset') offset: number,
		@Query('limit') limit?: string | number,
		@Query('search') search?: string,
		...rest: any[]
	): Promise<CrudResponse> {
		return {
			statusCode: 200,
			...(await this.service.findWithPagination({
				search,
				searchingProps: this.service.getSearchingProps(),
				offset,
				limit,
				include: this.service.getListInclude(),
			})),
		};
	}

	@ApiResponseDecorator([400, { code: 200, description: 'entity: ${Entity}' }])
	@Get(':id')
	async getById(@Param('id') id: string, ...rest: any[]): Promise<CrudResponse> {
		return {
			statusCode: 200,
			entity: await this.service.validateMandatoryId(id, {
				include: this.service.getDetailInclude() as any,
			}),
		};
	}

	@ApiConsumes('multipart/form-data')
	@ApiResponseDecorator([400, { code: 201, description: 'entity: ${Entity[]}' }])
	@UseInterceptors(AnyFilesInterceptor())
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
			entity: await this.service.findOneById(entity.id, {
				include: this.service.getDetailInclude(),
			}),
		};
	}

	// TODO: files handling
	@ApiResponseDecorator([400, 201])
	@UseInterceptors(AnyFilesInterceptor())
	@Post('bulk/create')
	async bulkCreate(
		@Body() dto: BulkCreateUpdateDto,
		@Req() req: Request,
		...rest: any[]
	): Promise<CrudResponse> {
		const chunks = await this.service.validateBeforeBulkCreating(dto, {}, req);
		const entities = await this.service.bulkCreate(chunks, req);
		return {
			statusCode: 201,
			entities: await this.service.findAllByIds(
				entities.map((v) => v.id),
				{ include: this.service.getDetailInclude() },
			),
		};
	}

	// TODO: patchById(), handle class-validator { always: true } issues

	@ApiConsumes('multipart/form-data')
	@ApiResponseDecorator([400, { code: 200, description: 'entity: ${Entity[]}' }])
	@UseInterceptors(AnyFilesInterceptor())
	@Put(':id')
	async putById(
		@Param('id') id: string,
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
			entity: await this.service.findOneById(entity.id, {
				include: this.service.getDetailInclude(),
			}),
		};
	}

	@ApiImplicitQueries([{ name: 'force', required: false }])
	@ApiResponseDecorator([400, 200])
	@Delete(':id')
	async deleteById(
		@Param('id') id: string,
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

	@ApiImplicitQueries([{ name: 'force', required: false }])
	@ApiResponseDecorator([400, 200])
	@Delete('bulk/delete')
	async bulkDelete(
		@Body() dto: BulkDeleteDto,
		@Query('force', new OptionalBooleanQueryValidationPipe('force')) force?,
		@Req() req?: Request,
		...rest: any[]
	): Promise<CrudResponse> {
		const transformedDto = await this.service.validateDto(BulkDeleteDto, dto);
		for (const id of transformedDto.ids) {
			await this.service.validateBeforeRemoving(id, force, req);
			await this.service.removeById(id);
		}
		return {
			statusCode: 200,
		};
	}
}
