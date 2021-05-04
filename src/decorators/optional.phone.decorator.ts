import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsPhoneNumber } from 'class-validator';

export function OptionalPhoneDecorator() {
	return applyDecorators(
		ApiPropertyOptional(),
		ApiProperty({ description: `@IsPhoneNumber(), телефон должен быть указан в международном формате; examples: +7999999999, 7(999)999-99-99 - при парсинге все НЕцифры исключаться из строки и первым символом добавится +` }),
		IsOptional(),
		IsPhoneNumber(),
	);
}
