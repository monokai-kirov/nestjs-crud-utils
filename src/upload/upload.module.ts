import { Module, Global, DynamicModule } from '@nestjs/common';
import { UploadService } from './services/upload.service';

@Global()
@Module({})
export class UploadModule {
	public static async register(imports = []): Promise<DynamicModule> {
		return {
			module: UploadModule,
			imports,
			providers: [UploadService],
			exports: [UploadService],
		};
	}
}
