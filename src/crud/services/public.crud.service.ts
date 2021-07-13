import { UploadService } from '../../upload/services/upload.service';
import { CrudOptions, CrudService } from './crud.service';
import { Include } from './entity.service';

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

	protected getIncludeOptions(): Include {
		return [];
	}
}
