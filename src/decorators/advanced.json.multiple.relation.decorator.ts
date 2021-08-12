import { applyDecorators } from '@nestjs/common';
import { addAdvancedMultipleRelationToDtoMetadata } from './advanced.object.multiple.relation.decorator';
import { OptionalArrayOfJSONsDecorator } from './optional.array.of.jsons.decorator';

export function AdvancedJSONMultipleRelationDecorator({
	schema = {},
	unique = [],
	minCount = 0,
	maxCount = Infinity,
}: {
	schema?: Record<string, any>;
	unique?: string[];
	minCount?: number;
	maxCount?: number;
} = {}): ReturnType<typeof applyDecorators> {
	return function (target, propertyKey, descriptor?) {
		addAdvancedMultipleRelationToDtoMetadata(target.constructor.prototype, {
			name: propertyKey,
			schema,
			unique,
			minCount,
			maxCount,
		});

		const decorators = [OptionalArrayOfJSONsDecorator()];

		for (const decorator of decorators as any[]) {
			if (target instanceof Function && !descriptor) {
				decorator(target);
				continue;
			}
			decorator(target, propertyKey, descriptor);
		}
	};
}
