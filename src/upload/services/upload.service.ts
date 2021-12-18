// eslint-disable-next-line @typescript-eslint/no-var-requires
const crypto = require('crypto');
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
import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { MulterFile, UploadType } from '../types';
import { utils } from '../../utils/utils';
import { config } from '../../utils/config';
import { Upload, UploadStatus } from '../models/upload.model';
import { TriggerService } from '.';
import { ResizeOptions } from 'sharp';

@Injectable()
export class UploadService {
	protected triggerService: TriggerService;

	constructor(
		private sequelize: Sequelize,
		@InjectModel(Upload)
		private uploadModel: typeof Upload,
	) {
		this.triggerService = new TriggerService(sequelize);
	}

	public async onApplicationBootstrap(): Promise<void> {
		await this.triggerService.initialize(this.remove.bind(this));
	}

	public createRemovingTriggers(crudModel): void {
		this.triggerService.createRemovingTriggers(crudModel);
	}

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
	}): Promise<void> {
		const filesToValidate: MulterFile[] = files[propName] ?? [];
		this.validateFiles(type, filesToValidate);

		const { handledRemainingFilesIds, handledWaitingForLinkingIds } =
			await this.getExistingAndRemaining({ entity, propName, remainingFilesIds: dto[propName] });
		let waitingForLinkingEntities = [];

		if (handledWaitingForLinkingIds.length) {
			waitingForLinkingEntities = await this.uploadModel.findAll({
				where: {
					id: { [Op.in]: handledWaitingForLinkingIds },
					status: UploadStatus.WAIT_FOR_LINKING,
				},
			});

			if (handledWaitingForLinkingIds.length !== waitingForLinkingEntities.length) {
				throw new BadRequestException('Incorrect files ids');
			}
		}

		const count =
			handledRemainingFilesIds.length + waitingForLinkingEntities.length + filesToValidate.length;
		if (count < minCount) {
			throw new ForbiddenException(`Min files for ${propName} - ${minCount}`);
		}
		if (count > maxCount) {
			throw new ForbiddenException(`Max files limit exceeded ${propName} - ${maxCount}`);
		}

		const summarySize = filesToValidate.reduce((acc, file) => acc + file.size, 0);
		if (summarySize > config.getUploadOptions().SUMMARY_SIZE_LIMIT) {
			throw new ForbiddenException(
				`Max size limit exceeded ${config.getUploadOptions().SUMMARY_SIZE_LIMIT / 1_000_000} Mb`,
			);
		}
	}

	protected validateFiles(type: UploadType | UploadType[], files: MulterFile[] = []) {
		const options = config.getUploadOptions();
		const allowedFormats = Array.isArray(type)
			? type
					.map((type) => options[`ALLOWED_${type}_MIMETYPES`])
					.reduce((acc, item) => [...acc, ...item], [])
			: options[`ALLOWED_${type}_MIMETYPES`];

		files.map((file) => {
			if (!allowedFormats.includes(file.mimetype)) {
				throw new BadRequestException(
					`Incorrect file format. Available formats: ${allowedFormats.join(', ')}`,
				);
			}
		});
	}

	public async createOrUpdate({
		propName,
		files = {},
		dto = {},
		entity,
		resizeOptions,
		uploadFolder,
		withoutLinking = false,
	}: {
		propName: string;
		files;
		dto?;
		entity;
		resizeOptions?: ResizeOptions[];
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
					this.createOrUpdateHelper({ uploadFolder, file: newFile, resizeOptions }),
				),
			)),
		];

		return withoutLinking
			? isMultiple
				? filesForSave
				: filesForSave[0]
			: await entity[`set${utils.ucFirst(propName)}`](isMultiple ? filesForSave : filesForSave[0]);
	}

	public async createDetachedFiles(files: MulterFile[] = []): Promise<void> {
		await Promise.all(
			files.map(async (newFile) =>
				this.createOrUpdateHelper({
					uploadFolder: 'upload/detached',
					file: newFile,
					status: UploadStatus.WAIT_FOR_LINKING,
				}),
			),
		);
	}

	public async getExistingAndRemaining({
		entity,
		propName,
		remainingFilesIds,
	}: {
		entity: any | null;
		propName: string;
		remainingFilesIds: string | string[] | null | undefined;
	}): Promise<{
		existingFiles: Record<string, any>;
		isMultiple: boolean;
		handledRemainingFilesIds: string[];
		handledWaitingForLinkingIds: string[];
	}> {
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

	protected async removeUnnecessaryFilesAndGetRemaining(
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

	protected async createOrUpdateHelper({
		uploadFolder = config.getUploadOptions().folders[0],
		file,
		resizeOptions = config.getDefaultResizeOptions(),
		status = UploadStatus.LINKED,
	}: {
		uploadFolder?: string;
		file: MulterFile;
		resizeOptions?: ResizeOptions[];
		status?;
	}): Promise<Upload> {
		const getRelativeFilePath = () => {
			const hash = crypto.randomBytes(15).toString('hex');
			return path.normalize(`${uploadFolder}/${hash}${path.extname(file.originalname)}`);
		};

		const values = [];
		if (config.getUploadOptions().ALLOWED_PICTURE_MIMETYPES.includes(file.mimetype)) {
			for (const resizeOption of resizeOptions) {
				const buffer = await this.handlePicture(file, resizeOption);
				const relativeFilePath = getRelativeFilePath();
				await this.writeBufferToStorage(
					buffer,
					path.resolve(relativeFilePath),
					path.resolve(uploadFolder),
				);
				values.push({
					url: `/${relativeFilePath}`,
					filesize: Buffer.byteLength(buffer),
					resizeOptions: resizeOption,
				});
			}
		} else {
			const relativeFilePath = getRelativeFilePath();
			await this.writeBufferToStorage(
				file.buffer,
				path.resolve(relativeFilePath),
				path.resolve(uploadFolder),
			);
			values.push({
				url: `/${relativeFilePath}`,
				filesize: file.size,
			});
		}

		const uploadEntity = new Upload();
		uploadEntity.status = status;
		uploadEntity.type = file.mimetype;
		uploadEntity.originalName = file.originalname;
		uploadEntity.values = values;
		return uploadEntity.save();
	}

	protected async handlePicture(file: MulterFile, resizeOptions: ResizeOptions): Promise<Buffer> {
		if (file.mimetype === 'image/svg+xml') {
			return file.buffer;
		}

		const param = file.buffer ?? file.path;
		return sharp(param).resize(resizeOptions).toBuffer();
	}

	protected async writeBufferToStorage(
		buffer: Buffer,
		uploadPath: string,
		uploadFolderPath: string,
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

	protected async remove(dbRowInsideTrigger: Record<string, any>): Promise<void> {
		if (dbRowInsideTrigger.values?.length) {
			for (const value of dbRowInsideTrigger.values) {
				const relativeFilePath = value.url
					.split(path.sep)
					.filter((chunk) => chunk.trim())
					.join(path.sep);
				const absoluteFilePath = path.resolve(relativeFilePath);
				const absoluteFolderPath = path.resolve(path.dirname(relativeFilePath));

				if (this.isRemoveAllowed(absoluteFilePath)) {
					try {
						await fsExtra.remove(absoluteFilePath);

						if (await this.isEmptyDirectory(absoluteFolderPath)) {
							await fsExtra.remove(absoluteFolderPath);
						}
					} catch (e) {}
				}
			}
		}
	}

	protected isRemoveAllowed(absolutePath: string): boolean {
		return config.getUploadOptions().folders.some((folder) => {
			const uploadPath = path.resolve(folder);
			return absolutePath.startsWith(uploadPath) && fs.existsSync(absolutePath);
		});
	}

	protected isEmptyDirectory(path: string): Promise<boolean> {
		return new Promise((resolve) => {
			extFs.isEmpty(path, function (empty) {
				resolve(empty);
			});
		});
	}
}
