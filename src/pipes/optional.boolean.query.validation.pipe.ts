import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class OptionalBooleanQueryValidationPipe implements PipeTransform<any> {
	constructor(
		private readonly label: string,
	) {}

	async transform(value) {
		if (typeof value === 'undefined'){
			return value;
		}

		if (value === 'true') {
			return true;
		} else if (value === 'false') {
			return false;
		} else {
			throw new BadRequestException(`isBoolean(${this.label})`);
		}
	}
}
