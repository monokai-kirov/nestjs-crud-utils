import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsObject } from 'class-validator';

export class BulkDto {
	@ApiProperty({ description: `@IsArray(), @IsJSON({ each: true })` })
	@IsArray()
	@IsObject({ each: true })
	bulk: Record<string, any>[];
}
