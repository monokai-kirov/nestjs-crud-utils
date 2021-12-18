import 'reflect-metadata';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsUUID } from 'class-validator';
import { addUploadToDtoMetadata } from './upload.decorator';
import { applyDecorators } from '@nestjs/common';
import { UploadType } from '../../upload/types';
import { utils } from '..';
import { ResizeOptions } from 'sharp';

export function MultipleUploadDecorator({
	type,
	resizeOptions,
	minCount,
	maxCount,
}: {
	type: UploadType.PICTURE;
	resizeOptions?: ResizeOptions[];
	minCount?: number;
	maxCount?: number;
}): any;

export function MultipleUploadDecorator({
	type,
	minCount,
	maxCount,
}: {
	type: Omit<UploadType, UploadType.PICTURE> | Array<Omit<UploadType, UploadType.PICTURE>>;
	minCount?: number;
	maxCount?: number;
}): any;

export function MultipleUploadDecorator({
	type,
	resizeOptions,
	minCount,
	maxCount,
}): ReturnType<typeof applyDecorators> {
	return function (target, propertyKey, descriptor?) {
		addUploadToDtoMetadata(target.constructor.prototype, {
			type,
			name: propertyKey,
			resizeOptions,
			minCount,
			maxCount,
		});

		const decorators = [
			ApiPropertyOptional(),
			ApiProperty({ description: `@IsOptional(), @IsArray(), @IsUUID('4', { each: true })` }),
			IsOptional(),
			IsArray(),
			IsUUID('4', { each: true }),
		];

		utils.decorate(decorators, target, propertyKey, descriptor);
	};
}
