import { ResizeOptions } from 'sharp';
import 'reflect-metadata';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { applyDecorators } from '@nestjs/common';
import { UploadType } from '../../upload/types';
import { utils } from '..';

export const UPLOAD_METADATA_KEY = '__uploads__';

export const addUploadToDtoMetadata = (
	dto: Record<string, any>,
	obj: Record<string, any>,
): void => {
	let uploads = Reflect.getMetadata(UPLOAD_METADATA_KEY, dto);

	if (!uploads) {
		uploads = [];
	}

	if (!uploads.find((v) => v.name === obj.name)) {
		uploads.push(obj);
		Reflect.defineMetadata(UPLOAD_METADATA_KEY, uploads, dto);
	}
};

export function UploadDecorator({
	type,
	required,
	resizeOptions,
}: {
	type: UploadType.PICTURE;
	required?: boolean;
	resizeOptions?: ResizeOptions[];
}): any;

export function UploadDecorator({
	type,
	required,
}: {
	type: Omit<UploadType, UploadType.PICTURE> | Array<Omit<UploadType, UploadType.PICTURE>>;
	required?: boolean;
}): any;

export function UploadDecorator({
	type,
	resizeOptions,
	required = false,
}: any): ReturnType<typeof applyDecorators> {
	return function (target, propertyKey, descriptor?) {
		addUploadToDtoMetadata(target.constructor.prototype, {
			type,
			name: propertyKey,
			resizeOptions,
			minCount: required ? 1 : 0,
			maxCount: 1,
		});

		const decorators = [
			ApiPropertyOptional(),
			ApiProperty({ description: `@IsOptional(), @IsUUID('4')` }),
			IsOptional(),
			IsUUID('4'),
		];

		utils.decorate(decorators, target, propertyKey, descriptor);
	};
}
