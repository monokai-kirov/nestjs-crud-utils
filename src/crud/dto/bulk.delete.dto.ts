import { ArrayOfStringsDecorator } from '../../utils/decorators/array.of.strings.decorator';

export class BulkDeleteDto {
	@ArrayOfStringsDecorator()
	ids: string[];
}
