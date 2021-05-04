import { PipeTransform, Injectable } from '@nestjs/common';
import { utils } from '../utils';

@Injectable()
export class NormalizeAfterValidationPipe implements PipeTransform<any> {
	async transform(value: any): Promise<any> {
		return utils.normalizeAfterValidation(value);
	}
}
