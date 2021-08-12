import 'reflect-metadata';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { UploadType } from '../upload/services/upload.service';
import { applyDecorators } from '@nestjs/common';

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
	width,
	height,
	required,
}: {
	type: UploadType.PICTURE | UploadType.VIDEO;
	width?: number;
	height?: number;
	required?: boolean;
}): any;
export function UploadDecorator({
	type,
	handlePicture,
	required,
}: {
	type: UploadType.PICTURE;
	handlePicture: (sharp) => any;
	required?: boolean;
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
	width,
	height,
	handlePicture,
	required = false,
}: any): ReturnType<typeof applyDecorators> {
	return function (target, propertyKey, descriptor?) {
		addUploadToDtoMetadata(target.constructor.prototype, {
			type,
			name: propertyKey,
			width,
			height,
			handlePicture,
			minCount: required ? 1 : 0,
			maxCount: 1,
		});

		const decorators = [
			ApiPropertyOptional(),
			ApiProperty({ description: `@IsOptional(), @IsUUID('4')` }),
			IsOptional(),
			IsUUID('4'),
		];

		for (const decorator of decorators as any[]) {
			if (target instanceof Function && !descriptor) {
				decorator(target);
				continue;
			}
			decorator(target, propertyKey, descriptor);
		}
	};
}
