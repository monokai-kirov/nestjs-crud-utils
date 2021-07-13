import { Module, Global } from '@nestjs/common';
import { CryptoService } from './services/crypto.service';

@Global()
@Module({
	providers: [CryptoService],
	exports: [CryptoService],
})
export class CryptoModule {}
