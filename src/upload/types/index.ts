import { ResizeOptions, Sharp } from 'sharp';

export type UploadParam = {
	name: string;
	type: UploadType | UploadType[];
	minCount?: number;
	maxCount?: number;
	resizeOptions?: ResizeOptions[];
};

export enum UploadType {
	PICTURE = 'PICTURE',
	AUDIO = 'AUDIO',
	VIDEO = 'VIDEO',
	DOCUMENT = 'DOCUMENT',
}

export interface MulterFile {
	mimetype: string;
	originalname: string;
	size: number;
	buffer: Buffer;
	path?: string;
}

export type PgListenHandler = (row: Record<string, any>) => Promise<any>;
