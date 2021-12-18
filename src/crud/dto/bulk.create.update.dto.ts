import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsObject } from 'class-validator';

export class BulkCreateUpdateDto {
	@ApiProperty({ description: `@IsArray(), @IsObject({ each: true })` })
	@IsArray()
	@IsObject({ each: true })
	bulk: Record<string, any>[];
}
