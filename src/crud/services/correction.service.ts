import { isNotEmpty } from 'class-validator';
import { Sequelize } from 'sequelize-typescript';
import { EntityService, Include } from './entity.service';
import { Op } from 'sequelize';

export class CorrectionService<T> {
	public getCorrectInclude(
		context: EntityService<T>,
		unscopedInclude: boolean,
		include: Include,
		where: Record<string, any>,
		optimizeInclude = false,
	) {
		if (!include) {
			return [];
		}

		const outerWhere = this.getSequelizeOuterWhere(context, where);
		return unscopedInclude
			? this.addUnscopedAttributes(
					context,
					this.addCorrectRequiredAttributes(context, include, outerWhere, optimizeInclude),
			  )
			: this.addCorrectRequiredAttributes(context, include, outerWhere, optimizeInclude);
	}

	public addCorrectOrder(
		context: EntityService<T>,
		order: any[] = [],
		group: any,
		include,
		unscoped: boolean,
		withLeafs = true,
	) {
		const parent = context.__crudModel__.prototype.constructor;
		let result = [];

		if (order.length || group) {
			return order;
		}

		if (unscoped && parent._scope?.order) {
			result = [...parent._scope.order];
		}

		if (include.all === true) {
			context
				.getAllAssociations()
				.map((child) => this.addCorrectOrderHelper(parent, child, result, [], withLeafs));
		} else {
			include.map((child) => this.addCorrectOrderHelper(parent, child, result, [], withLeafs));
		}
		return result;
	}

	/**
	 * Fix sequeilize outer where clause
	 */
	public addCorrectRequiredAttributes(
		context: EntityService<T>,
		include,
		outerWhere: string[],
		optimizeInclude = false,
	) {
		const parent = context.__crudModel__.prototype.constructor;
		return include.all === true
			? context
					.getAllAssociations()
					.map((child) =>
						this.addCorrectRequiredAttributesHelper(parent, child, outerWhere, [], optimizeInclude),
					)
					.filter((v) => v)
			: include
					.map((child) =>
						this.addCorrectRequiredAttributesHelper(parent, child, outerWhere, [], optimizeInclude),
					)
					.filter((v) => v);
	}

	/**
	 * For grouping (prevent errors like '[column must appear in the GROUP BY clause or be used in an aggregate function]')
	 */
	public addEmptyAttributes(context: EntityService<T>, include) {
		const parent = context.__crudModel__.prototype.constructor;
		return include.all === true
			? context.getAllAssociations().map((child) => this.addEmptyAttributesHelper(parent, child))
			: include.map((child) => this.addEmptyAttributesHelper(parent, child));
	}

	/**
	 * For admin crud (default unscoped: true)
	 */
	public addUnscopedAttributes(context: EntityService<T>, include) {
		return include.all === true
			? context.getAllAssociations().map((child) => this.addUnscopedAttributesHelper(child))
			: include.map((child) => this.addUnscopedAttributesHelper(child));
	}

	/**
	 * Helpers
	 */
	protected getSequelizeOuterWhere(context: EntityService<T>, where): string[] {
		const result: Set<string> = new Set();
		if (!where) {
			return [];
		}

		const processChunk = (v) => {
			let chunk = v
				.replace(/\$/g, '')
				.split('.')
				.map((v) => v.replace(/'|"/g, ''));

			if (chunk[0] === context.entityName) {
				chunk.shift();
			}
			chunk.pop();
			chunk = chunk.join('.');
			return chunk;
		};

		Object.keys(where).forEach((key) => {
			if (typeof key === 'string' && key.startsWith('$') && key.endsWith('$')) {
				const chunk = processChunk(key);
				if (chunk) {
					result.add(chunk);
				}
			}
		});

		Object.getOwnPropertySymbols(where).forEach((keySymbol) => {
			if (String(keySymbol) === String(Op.or) || String(keySymbol) === String(Op.and)) {
				Object.values(where[keySymbol]).forEach((value: any) => {
					let chunk = value;

					if (typeof chunk !== 'string') {
						if (chunk.attribute?.val?.col) {
							chunk = processChunk(chunk.attribute.val.col);
							if (chunk) {
								result.add(chunk);
							}
						} else if (typeof chunk === 'object' && chunk !== null) {
							const key = Object.keys(chunk)[0];
							if (key) {
								const chunk = processChunk(key);
								if (chunk) {
									result.add(chunk);
								}
							}
						}
					}
				});
			}
		});

		return [...result];
	}

	protected addCorrectRequiredAttributesHelper(
		parent: any,
		child: any,
		outerWhere: string[],
		levels: string[],
		optimizeInclude: boolean,
	) {
		const getLinkName = (parent, childModel) =>
			parent?.associations
				? Object.entries(parent.associations)
						.filter(([key, value]) => (value as any).target === childModel)
						.map(([key, value]) => key)
						.shift()
				: null;

		const checkOuterWhere = (outerWhere, levelChunks: string[]) => {
			const chunk = levelChunks.join('.');
			return outerWhere.includes(chunk) || outerWhere.some((v) => v.startsWith(chunk));
		};

		if (!child.model) {
			const linkName = getLinkName(parent, child);
			const levelChunks = linkName ? [...levels, linkName] : levels;

			if (optimizeInclude && !checkOuterWhere(outerWhere, levelChunks)) {
				return null;
			}

			return {
				model: child,
				...(checkOuterWhere(outerWhere, levelChunks) ? { required: true } : { required: false }),
			};
		} else {
			let ops: { required?: boolean } = {};
			const linkName = getLinkName(parent, child.model);
			const levelChunks = linkName ? [...levels, linkName] : levels;

			if (isNotEmpty(child.required)) {
				ops = { required: child.required };
			} else if (isNotEmpty(child.where)) {
				ops = { required: true };
			} else if (checkOuterWhere(outerWhere, levelChunks)) {
				ops = { required: true };
			} else {
				ops = { required: false };
			}

			if (optimizeInclude && !ops.required) {
				return null;
			}

			return {
				...child,
				...ops,
				include: child.include
					? child.include
							.map((subchild) =>
								this.addCorrectRequiredAttributesHelper(
									child.model,
									subchild,
									outerWhere,
									levelChunks,
									optimizeInclude,
								),
							)
							.filter((v) => v)
					: [],
			};
		}
	}

	protected addCorrectOrderHelper(
		parent: any,
		child: any,
		order: any[],
		levels: any[] = [],
		withLeafs = true,
	) {
		const childModel = child.model ?? child;
		const [key, value] = Object.entries(parent.associations).find(
			([key, value]: any) => value.target === childModel,
		);

		if (
			value &&
			value['target'] &&
			value['target']['_scope'] &&
			value['target']['_scope']['order']
		) {
			for (const chunk of value['target']['_scope']['order']) {
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
			child.include.map((subchild) =>
				this.addCorrectOrderHelper(childModel, subchild, order, [...levels, key], withLeafs),
			);
		}
	}

	protected addEmptyAttributesHelper(parent: any, child: any) {
		const getManyToManyAssociations = (prop) =>
			prop?.associations
				? Object.entries(prop.associations)
						.filter(([key, value]) => (value as any).associationType === 'BelongsToMany')
						.map(([key, value]) => (value as any).target)
				: [];

		if (!child.model) {
			return {
				model: child,
				attributes: [],
				include: [],
				...(getManyToManyAssociations(parent).includes(child)
					? { through: { attributes: [] } }
					: {}),
			};
		} else {
			let props = {};
			if (getManyToManyAssociations(parent).includes(child.model) && !child.foreignKey) {
				if (child.through) {
					props = { through: { model: child.through, attributes: [] } };
				} else {
					props = { through: { attributes: [] } };
				}
			}

			return {
				...child,
				attributes: [],
				include: child.include
					? child.include.map((subchild) => this.addEmptyAttributesHelper(child.model, subchild))
					: [],
				...props,
			};
		}
	}

	protected addUnscopedAttributesHelper(child: any) {
		if (!child.model) {
			return {
				model: child.unscoped(),
			};
		} else {
			return {
				...child,
				model: child.model.unscoped(),
				include: child.include
					? child.include.map((subchild) => this.addUnscopedAttributesHelper(subchild))
					: [],
			};
		}
	}

	public unscopedHelper(
		context: EntityService<T>,
		unscoped: boolean,
		additionalScopes: string[] = [],
		model = null,
	) {
		let usedModel = model ?? context.__crudModel__;
		usedModel = unscoped ? usedModel.unscoped() : usedModel;

		for (const additionalScope of additionalScopes) {
			if (usedModel._scopeNames.includes(additionalScope)) {
				usedModel = usedModel.scope(additionalScope);
			}
		}
		return usedModel;
	}
}

export const correctionService = new CorrectionService();
