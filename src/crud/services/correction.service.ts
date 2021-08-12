import { isNotEmpty } from 'class-validator';
import { Sequelize } from 'sequelize-typescript';
import { EntityService, Include } from './entity.service';
import { Op } from 'sequelize';
import { defaultScopeOptions } from '../../sequelize.options';

export class CorrectionService<T> {
	public getCorrectInclude(
		context: EntityService<T>,
		unscopedInclude: boolean,
		include: Include,
		where: Record<string, any>,
		optimizeInclude = false,
	): Include {
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
		include: Include,
		unscoped: boolean,
		withLeafs = true,
	): any[] {
		const parent = context.__crudModel__.prototype.constructor;
		let result = [];

		if (order.length || group) {
			return order;
		}

		if (parent._scope?.order) {
			result = [...parent._scope.order];
		} else {
			result = [...defaultScopeOptions.order];
		}

		if (include['all'] === true) {
			context
				.getAllAssociations()
				.map((child) => this.addCorrectOrderHelper(parent, child, result, [], withLeafs));
		} else {
			(include as any[]).map((child) =>
				this.addCorrectOrderHelper(parent, child, result, [], withLeafs),
			);
		}
		return result;
	}

	/**
	 * Fix sequeilize outer where clause
	 */
	public addCorrectRequiredAttributes(
		context: EntityService<T>,
		include: Include,
		outerWhere: string[],
		optimizeInclude = false,
	): Include {
		const parent = context.__crudModel__.prototype.constructor;
		return include['all'] === true
			? context
					.getAllAssociations()
					.map((child) =>
						this.addCorrectRequiredAttributesHelper(parent, child, outerWhere, [], optimizeInclude),
					)
					.filter((v) => v)
			: (include as any[])
					.map((child) =>
						this.addCorrectRequiredAttributesHelper(parent, child, outerWhere, [], optimizeInclude),
					)
					.filter((v) => v);
	}

	/**
	 * For grouping (prevent errors like '[column must appear in the GROUP BY clause or be used in an aggregate function]')
	 */
	public addEmptyAttributes(context: EntityService<T>, include: Include): Include {
		const parent = context.__crudModel__.prototype.constructor;
		return include['all'] === true
			? context.getAllAssociations().map((child) => this.addEmptyAttributesHelper(parent, child))
			: (include as any[]).map((child) => this.addEmptyAttributesHelper(parent, child));
	}

	/**
	 * For admin crud (default unscoped: true)
	 */
	public addUnscopedAttributes(context: EntityService<T>, include: Include): Include {
		return include['all'] === true
			? context.getAllAssociations().map((child) => this.addUnscopedAttributesHelper(child))
			: (include as any[]).map((child) => this.addUnscopedAttributesHelper(child));
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
		parent: Record<string, any>,
		child: Record<string, any>,
		outerWhere: string[],
		levels: string[],
		optimizeInclude: boolean,
	): Record<string, any> {
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
	): void {
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

	protected addEmptyAttributesHelper(
		parent: Record<string, any>,
		child: Record<string, any>,
	): Record<string, any> {
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

	protected addUnscopedAttributesHelper(child: any): Record<string, any> {
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
