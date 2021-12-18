import { Module } from '@nestjs/common';
import { EmailService } from '../email/services/email.service';

@Module({
	providers: [EmailService],
	exports: [EmailService],
})
export class EmailModule {}
