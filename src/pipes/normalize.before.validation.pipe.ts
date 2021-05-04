import { PipeTransform, Injectable } from '@nestjs/common';
import { utils } from '../utils';

@Injectable()
export class NormalizeBeforeValidationPipe implements PipeTransform<any> {
	async transform(value: any): Promise<any> {
		return utils.normalizeBeforeValidation(value);
	}
}
