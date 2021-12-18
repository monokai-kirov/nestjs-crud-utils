import { CrudOptions, Include } from '../types';
import { CrudService } from './crud.service';
import { UploadService } from '../../upload/services/upload.service';

export class PublicCrudService<T> extends CrudService<T> {
	constructor(
		crudModel: Record<string, any>,
		dtoType: Record<string, any>,
		uploadService: UploadService,
		options: CrudOptions = {},
	) {
		super(crudModel, dtoType, uploadService, {
			unscoped: false,
			...options,
		});
	}

	public getIncludeOptions(): Include {
		return [];
	}
}
