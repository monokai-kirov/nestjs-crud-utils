import { OptionalArrayOfObjectsDecorator } from './optional.array.of.objects.decorator';

export const ADVANCED_MULTIPLE_RELATON_METADATA_KEY = '__advanced_multiple_relations__';

export const addAdvancedMultipleRelationToDtoMetadata = (dto, obj) => {
	let relations = Reflect.getMetadata(ADVANCED_MULTIPLE_RELATON_METADATA_KEY, dto);

	if (!relations) {
		relations = [];
	}

	if (!relations.find(v => v.name === obj.name)) {
		relations.push(obj);
		Reflect.defineMetadata(ADVANCED_MULTIPLE_RELATON_METADATA_KEY, relations, dto);
	}
};

export function AdvancedObjectMultipleRelationDecorator({
	schema = {},
	unique = [],
	minCount = 0,
	maxCount = Infinity,
}: {
	schema?: object,
	unique?: string[],
	minCount?: number,
	maxCount?: number,
} = {}) {
	return function(target, propertyKey, descriptor?) {
		addAdvancedMultipleRelationToDtoMetadata(target.constructor.prototype, { name: propertyKey, schema, unique, minCount, maxCount });

		const decorators = [
			OptionalArrayOfObjectsDecorator(),
		];

		for (const decorator of decorators as any[]) {
			if (target instanceof Function && !descriptor) {
					decorator(target);
					continue;
			}
			decorator(target, propertyKey, descriptor);
		}
	}
}