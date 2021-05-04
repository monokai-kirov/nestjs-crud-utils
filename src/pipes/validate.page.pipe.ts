import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { isInt } from 'class-validator';

@Injectable()
export class ValidatePagePipe implements PipeTransform<any> {
	async transform(page): Promise<any> {
		if (page === undefined) {
			return 1;
		}
		const parsedPage = parseInt(page);
		if (!isInt(parsedPage)) {
			throw new BadRequestException('isInt(page)');
		}
		if (parsedPage < 1) {
			throw new BadRequestException('Page >= 1');
		}
		return parsedPage;
	}
}
