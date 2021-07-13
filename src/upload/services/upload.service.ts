import { Injectable } from '@nestjs/common';
import { MulterFile } from '../types/multer.file.type';
import { CryptoService } from '../../crypto/services/crypto.service';
import { UploadValidationService } from './upload.validation.service';
import { Upload, UploadStatus } from '../models/upload.model';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { utils } from '../../utils';
import { config } from '../../config';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fsExtra = require('fs-extra');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const extFs = require('extfs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mkdirp = require('mkdirp');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sharp = require('sharp');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpeg = require('fluent-ffmpeg');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpeg_static = require('ffmpeg-static');

export type UploadParam = {
	name: string;
	type: UploadType | UploadType[];
	minCount?: number;
	maxCount?: number;
	width?: number;
	height?: number;
	handlePicture: (sharp) => any;
};

export enum UploadType {
	PICTURE = 'PICTURE',
	AUDIO = 'AUDIO',
	VIDEO = 'VIDEO',
	DOCUMENT = 'DOCUMENT',
}

export const uploadTriggerModels = [];

@Injectable()
export class UploadService {
	constructor(
		@InjectModel(Upload)
		private uploadModel: typeof Upload,
		private readonly cryptoService: CryptoService,
		private readonly uploadValidationService: UploadValidationService,
	) {}

	public async validateRequest({
		propName,
		type,
		files = {},
		dto = {},
		entity = null,
		minCount = 0,
		maxCount = Infinity,
	}: {
		propName: string;
		type: UploadType | UploadType[];
		files;
		dto?;
		entity?: any | null;
		minCount?: number;
		maxCount?: number;
	}) {
		await this.uploadValidationService.validateRequest({
			context: this,
			propName,
			type,
			files,
			dto,
			entity,
			minCount,
			maxCount,
		});
	}

	public async createOrUpdate({
		propName,
		files = {},
		dto = {},
		entity,
		width = config.getUploadOptions().imageWidth,
		height,
		handlePicture,
		uploadFolder = config.getUploadOptions().folders[0],
		withoutLinking = false,
	}: {
		propName: string;
		files;
		dto?;
		entity;
		width?: number;
		height?: number;
		handlePicture?: (sharp) => any;
		uploadFolder?: string;
		withoutLinking?: boolean;
	}) {
		const { existingFiles, isMultiple, handledRemainingFilesIds, handledWaitingForLinkingIds } =
			await this.getExistingAndRemaining({ entity, propName, remainingFilesIds: dto[propName] });

		let handledWaitingForLinkingEntities = [];
		if (handledWaitingForLinkingIds.length) {
			const [_, handledWaitingForLinkingEntitiesResponse] = await this.uploadModel.update(
				{ status: UploadStatus.LINKED },
				{
					where: {
						id: { [Op.in]: handledWaitingForLinkingIds },
						status: UploadStatus.WAIT_FOR_LINKING,
					},
					returning: true,
				},
			);
			handledWaitingForLinkingEntities = handledWaitingForLinkingEntitiesResponse;
		}

		const filesForSave = [
			...(await this.removeUnnecessaryFilesAndGetRemaining(
				existingFiles,
				handledRemainingFilesIds,
			)),
			...handledWaitingForLinkingEntities,
			...(await Promise.all(
				(files[propName] ?? []).map(async (newFile) =>
					this.createOrUpdateHelper({ uploadFolder, file: newFile, width, height, handlePicture }),
				),
			)),
		];

		return withoutLinking
			? isMultiple
				? filesForSave
				: filesForSave[0]
			: await entity[`set${utils.ucFirst(propName)}`](isMultiple ? filesForSave : filesForSave[0]);
	}

	public async getExistingAndRemaining({
		entity,
		propName,
		remainingFilesIds,
	}: {
		entity: any | null;
		propName: string;
		remainingFilesIds: string | string[] | null | undefined;
	}) {
		let existingFiles = entity ? await entity[`get${utils.ucFirst(propName)}`]() : [];
		const isMultiple = Array.isArray(existingFiles);
		existingFiles = existingFiles
			? Array.isArray(existingFiles)
				? existingFiles
				: [existingFiles]
			: [];
		const handledRemainingFilesIds = remainingFilesIds
			? Array.isArray(remainingFilesIds)
				? remainingFilesIds
				: [remainingFilesIds]
			: [];

		const existingFilesIds = existingFiles.map((item) => item.id);
		return {
			existingFiles,
			isMultiple,
			handledRemainingFilesIds: handledRemainingFilesIds.filter((item) =>
				existingFilesIds.includes(item),
			),
			handledWaitingForLinkingIds: handledRemainingFilesIds.filter(
				(item) => !existingFilesIds.includes(item),
			),
		};
	}

	private async removeUnnecessaryFilesAndGetRemaining(
		entityFiles,
		remainingFilesIds: string[],
	): Promise<Upload[]> {
		if (!entityFiles.length) {
			return [];
		}

		await Promise.all(
			entityFiles
				.filter((uploadEntity) => !remainingFilesIds.includes(uploadEntity.id))
				.map(async (uploadEntity) => {
					await uploadEntity.destroy();
				}),
		);
		return entityFiles.filter((uploadEntity) => remainingFilesIds.includes(uploadEntity.id));
	}

	private async createOrUpdateHelper({
		uploadFolder,
		file,
		width,
		height,
		handlePicture,
		status = UploadStatus.LINKED,
	}: {
		uploadFolder: string;
		file: MulterFile;
		width: number;
		height?: number;
		handlePicture?: (sharp) => any;
		status?;
	}): Promise<Upload> {
		const hash = this.cryptoService.generateHash();
		const relativeFilePath = path.normalize(
			`${uploadFolder}/${hash}${path.extname(file.originalname)}`,
		);
		const absoluteFilePath = path.resolve(relativeFilePath);
		const absoluteFolderPath = path.resolve(uploadFolder);

		let buffer;
		if (config.getUploadOptions().ALLOWED_PICTURE_MIMETYPES.includes(file.mimetype)) {
			buffer = await this.handlePicture(file, width, height, handlePicture);
		} else {
			buffer = file.buffer ?? file.path;
		}

		await this.writeBufferToStorage(buffer, absoluteFilePath, absoluteFolderPath);

		let preview = null;
		if (config.getUploadOptions().ALLOWED_VIDEO_MIMETYPES.includes(file.mimetype)) {
			preview = await this.handleVideo({
				hash,
				uploadFolder,
				absoluteFilePath,
				absoluteFolderPath,
				width,
				height,
			});
		}

		const uploadEntity = new Upload();
		uploadEntity.status = status;
		uploadEntity.url = `/${relativeFilePath}`;
		uploadEntity.type = file.mimetype;
		uploadEntity.originalName = file.originalname;
		uploadEntity.filesize = file.size;
		uploadEntity.preview = preview;

		return uploadEntity.save();
	}

	protected async handlePicture(
		file: MulterFile,
		width: number,
		height?: number,
		handlePicture?: (sharp) => any,
	): Promise<Buffer> {
		if (file.mimetype === 'image/svg+xml') {
			return file.buffer;
		}

		const param = file.buffer ?? file.path;
		return handlePicture
			? handlePicture(sharp(param)).toBuffer()
			: sharp(param).resize(width, height).toBuffer();
	}

	protected async handleVideo({
		hash,
		uploadFolder,
		absoluteFilePath,
		absoluteFolderPath,
		width,
		height,
	}: {
		hash: string;
		uploadFolder: string;
		absoluteFilePath: string;
		absoluteFolderPath: string;
		width: number;
		height?: number;
	}): Promise<string> {
		const previewFileName = `${hash}_preview.png`;

		let size;
		if (width && height) {
			size = `${width}x${height}`;
		} else if (width) {
			size = `${width}x?`;
		} else if (height) {
			size = `?x${height}`;
		}

		return new Promise<string>((resolve, reject) => {
			ffmpeg(absoluteFilePath)
				.setFfmpegPath(ffmpeg_static)
				.screenshots({
					timestamps: ['00:00:01.000'],
					folder: absoluteFolderPath,
					filename: previewFileName,
					size,
				})
				.on('end', function () {
					resolve(`/${uploadFolder}/${previewFileName}`);
				})
				.on('error', function (err) {
					reject(err);
				});
		});
	}

	protected async writeBufferToStorage(
		buffer: Buffer,
		uploadPath,
		uploadFolderPath,
	): Promise<void> {
		await mkdirp(uploadFolderPath);

		const write = (resolve, reject) => {
			fs.writeFile(uploadPath, buffer, 'binary', function (err) {
				if (err) reject(err);
				resolve();
			});
		};

		try {
			await new Promise(write);
		} catch (e) {
			if (e.code === 'ENOENT') {
				await mkdirp(uploadFolderPath); // if trigger has removed the folder
				await new Promise(write);
			} else {
				throw e;
			}
		}
	}

	public async createRemovingTriggers(crudModel) {
		uploadTriggerModels.push(crudModel);
	}

	public async remove(dbRowInsideTrigger) {
		if (dbRowInsideTrigger.url) {
			const relativeFilePath = dbRowInsideTrigger.url
				.split(path.sep)
				.filter((chunk) => chunk.trim())
				.join(path.sep);
			const absoluteFilePath = path.resolve(relativeFilePath);
			const absoluteFolderPath = path.resolve(path.dirname(relativeFilePath));

			if (this.isRemoveAllowed(absoluteFilePath)) {
				try {
					if (dbRowInsideTrigger.preview) {
						const absoluteFilePreviewPath = path.resolve(
							dbRowInsideTrigger.preview
								.split(path.sep)
								.filter((chunk) => chunk.trim())
								.join(path.sep),
						);
						await fsExtra.remove(absoluteFilePreviewPath);
					}
					await fsExtra.remove(absoluteFilePath);

					if (await this.isEmptyDirectory(absoluteFolderPath)) {
						await fsExtra.remove(absoluteFolderPath);
					}
				} catch (e) {}
			}
		}
	}

	private isRemoveAllowed(absolutePath: string): boolean {
		return config.getUploadOptions().folders.some((folder) => {
			const uploadPath = path.resolve(folder);
			return absolutePath.startsWith(uploadPath) && fs.existsSync(absolutePath);
		});
	}

	private isEmptyDirectory(path: string): Promise<boolean> {
		return new Promise((resolve) => {
			extFs.isEmpty(path, function (empty) {
				resolve(empty);
			});
		});
	}

	public async createDetachedFiles(files: MulterFile[] = []) {
		return Promise.all(
			files.map(async (newFile) =>
				this.createOrUpdateHelper({
					uploadFolder: 'upload/detached',
					file: newFile,
					width: config.getUploadOptions().imageWidth,
					status: UploadStatus.WAIT_FOR_LINKING,
				}),
			),
		);
	}
}
