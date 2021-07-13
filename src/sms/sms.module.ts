import { DynamicModule, Module } from '@nestjs/common';
import { SmsRequestService } from './services/sms.request.service';

@Module({})
export class SmsModule {
	static register(imports = []): DynamicModule {
		return {
			module: SmsModule,
			imports,
			providers: [SmsRequestService],
			exports: [SmsRequestService],
		};
	}
}
