import { Module, Global, DynamicModule } from '@nestjs/common';
import { PgService } from './services/pg.service';
import { UploadTriggerService } from './services/upload.trigger.service';
import { UploadService } from './services/upload.service';
import { UploadValidationService } from './services/upload.validation.service';

@Global()
@Module({})
export class UploadModule {
	static register(imports = []): DynamicModule {
		return {
			module: UploadModule,
			imports,
			providers: [UploadService, UploadValidationService, PgService, UploadTriggerService],
			exports: [UploadService, UploadValidationService, PgService, UploadTriggerService],
		};
	}
}
