import 'reflect-metadata';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsUUID } from 'class-validator';
import { UploadType } from '../upload/services/upload.service';
import { addUploadToDtoMetadata } from './upload.decorator';

export function MultipleUploadDecorator({
	type,
	width,
	height,
	minCount,
	maxCount,
}: {
	type: UploadType.PICTURE | UploadType.VIDEO;
	width?: number;
	height?: number;
	minCount?: number;
	maxCount?: number;
}): any;
export function MultipleUploadDecorator({
	type,
	handlePicture,
	minCount,
	maxCount,
}: {
	type: UploadType.PICTURE;
	handlePicture: (sharp) => any;
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
	width,
	height,
	handlePicture,
	minCount,
	maxCount,
}) {
	return function (target, propertyKey, descriptor?) {
		addUploadToDtoMetadata(target.constructor.prototype, {
			type,
			name: propertyKey,
			width,
			height,
			handlePicture,
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

		for (const decorator of decorators as any[]) {
			if (target instanceof Function && !descriptor) {
				decorator(target);
				continue;
			}
			decorator(target, propertyKey, descriptor);
		}
	};
}
