export interface MulterFile {
	mimetype: string;
	originalname: string;
	size: number;
	buffer: Buffer;
	path?: string;
}
