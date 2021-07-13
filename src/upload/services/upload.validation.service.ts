import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { config } from '../../config';
import { Upload, UploadStatus } from '../models/upload.model';
import { MulterFile } from '../types/multer.file.type';
import { UploadService } from './upload.service';
import { UploadType } from './upload.service';

@Injectable()
export class UploadValidationService {
	constructor(
		@InjectModel(Upload)
		private uploadModel: typeof Upload,
	) {}

	public async validateRequest({
		context,
		propName,
		type,
		files = {},
		dto = {},
		entity = null,
		minCount = 0,
		maxCount = Infinity,
	}: {
		context: UploadService;
		propName: string;
		type: UploadType | UploadType[];
		files;
		dto?;
		entity?: any | null;
		minCount?: number;
		maxCount?: number;
	}) {
		const filesToValidate: MulterFile[] = files[propName] ?? [];
		const { handledRemainingFilesIds, handledWaitingForLinkingIds } =
			await context.getExistingAndRemaining({ entity, propName, remainingFilesIds: dto[propName] });

		this.validateFiles(type, filesToValidate);

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

	private validateFiles(type: UploadType | UploadType[], files: MulterFile[] = []) {
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
}
