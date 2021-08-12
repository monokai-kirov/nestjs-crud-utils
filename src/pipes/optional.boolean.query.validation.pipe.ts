import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class OptionalBooleanQueryValidationPipe implements PipeTransform<any> {
	constructor(private readonly label: string) {}

	async transform(value?: string | boolean): Promise<undefined | boolean> {
		if (typeof value === 'undefined' || typeof value === 'boolean') {
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
