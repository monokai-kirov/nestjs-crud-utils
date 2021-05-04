import { isNotEmpty } from "class-validator";
import { Sequelize } from "sequelize-typescript";
import { EntityService } from "./entity.service";

export class CorrectionService<T> {
	public getCorrectInclude(context: EntityService<T>, unscopedInclude: boolean, include: any[], topFunc: Function = (include) => include) {
		if (!include) {
			return [];
		}
		return unscopedInclude
			? this.addUnscopedAttributes(context, this.addFalsyRequiredAttributes(context, topFunc(include)))
			: this.addFalsyRequiredAttributes(context, topFunc(include));
	}

	public addCorrectOrder(context: EntityService<T>, order: any[] = [], group: any, include, unscoped: boolean, withLeafs = true) {
		const parent = context.__crudModel__.prototype.constructor;
		let result = [];

		if (order.length || group) {
			return result;
		}

		if (unscoped && parent._scope?.order) {
			result = [...parent._scope.order];
		}

		if (include.all === true) {
			context.getAllAssociations().map(child => this.addCorrectOrderHelper(parent, child, result, [], withLeafs));
		} else {
			include.map(child => this.addCorrectOrderHelper(parent, child, result, [], withLeafs));
		}
		return result;
	}

	/**
	 * If parent has a child and the child isn't active, the parent anyway will be selected. Otherwise without using this function - won't
	 */
	public addFalsyRequiredAttributes(context: EntityService<T>, include) {
		return (include.all === true)
			? context.getAllAssociations().map(child => this.addFalsyRequiredAttributesHelper(child))
			: include.map(child => this.addFalsyRequiredAttributesHelper(child));
	}

	/**
	 * For grouping (prevent errors like '[column must appear in the GROUP BY clause or be used in an aggregate function]')
	 */
	public addEmptyAttributes(context: EntityService<T>, include) {
		const parent = context.__crudModel__.prototype.constructor;
		return (include.all === true)
			? context.getAllAssociations().map(child => this.addEmptyAttributesHelper(parent, child))
			: include.map(child => this.addEmptyAttributesHelper(parent, child));
	}

	/**
	 * For admin crud (default unscoped: true)
	 */
	 public addUnscopedAttributes(context: EntityService<T>, include) {
		return (include.all === true)
			? context.getAllAssociations().map(child => this.addUnscopedAttributesHelper(child))
			: include.map(child => this.addUnscopedAttributesHelper(child));
	}

	/**
	 * Helpers
	 */
	 protected addCorrectOrderHelper(parent: any, child: any, order: any[], levels: any[] = [], withLeafs = true) {
		const childModel = child.model ?? child;
		const [key, value] = Object.entries(parent.associations).find(([key, value]: any) => value.target === childModel);

		if (value && value['target'] && value['target']['_scope'] && value['target']['_scope']['order']) {
			for (let chunk of value['target']['_scope']['order']) {
				if (chunk[0] === 'createdAt' || chunk[0] === 'updatedAt') {
					continue;
				}

				const levelChunks = [...levels, key];
				// @see https://github.com/sequelize/sequelize/issues/6513
				const literal = Sequelize.literal(`"${levelChunks.join('.')}.${chunk[0]}"`);
				literal['model'] = childModel;
				order.push(levelChunks.length ? [literal, chunk[1]] : chunk);
			}
		}

		if (withLeafs && child.include) {
			child.include.map(subchild => this.addCorrectOrderHelper(
				childModel,
				subchild,
				order,
				[...levels, key],
				withLeafs
			));
		}
	}

	protected addFalsyRequiredAttributesHelper(child: any) {
		if (!child.model) {
			return {
				model: child,
				required: false,
			};
		} else {
			let ops = {};

			if (isNotEmpty(child.required)) {
				ops = { required: child.required };
			} else if (isNotEmpty(child.where)) {
				ops = { required: true };
			} else {
				ops = { required: false };
			}

			return {
				...child,
				...ops,
				include: child.include ? child.include.map(subchild => this.addFalsyRequiredAttributesHelper(subchild)) : [],
			};
		}
	};

	protected addEmptyAttributesHelper(parent: any, child: any) {
		const getManyToManyAssociations = (prop) => prop.associations
			? Object.entries(prop.associations)
				.filter(([key, value]) => (value as any).associationType === 'BelongsToMany')
				.map(([key, value]) => (value as any).target)
			: [];

		if (!child.model) {
			return {
				model: child,
				attributes: [],
				include: [],
				...(getManyToManyAssociations(parent).includes(child) ? { through: { attributes: [] }} : {}),
			};
		} else {
			let props = {};
			if (getManyToManyAssociations(parent).includes(child.model) && !child.foreignKey) {
				if (child.through) {
					props = { through: { model: child.through, attributes: [] }};
				} else {
					props = { through: { attributes: [] } };
				}
			}

			return {
				...child,
				attributes: [],
				include: child.include ? child.include.map(subchild => this.addEmptyAttributesHelper(child.model, subchild)) : [],
				...props,
			};
		}
	};

	protected addUnscopedAttributesHelper(child: any) {
		if (!child.model) {
			return {
				model: child.unscoped(),
			};
		} else {
			return {
				...child,
				model: child.model.unscoped(),
				include: child.include ? child.include.map(subchild => this.addUnscopedAttributesHelper(subchild)) : [],
			};
		}
	};

	public unscopedHelper(context: EntityService<T>, unscoped: boolean, additionalScopes: string[] = [], model = null) {
		let usedModel = (model ?? context.__crudModel__);
		usedModel = unscoped ? usedModel.unscoped() : usedModel;

		for (let additionalScope of additionalScopes) {
			if (usedModel._scopeNames.includes(additionalScope)) {
				usedModel = usedModel.scope(additionalScope);
			}
		}
		return usedModel;
	}
}

export const correctionService = new CorrectionService();