import { isNotEmpty } from 'class-validator';
import { Op } from 'sequelize';
import { Include } from '../types';
import { defaultScopeOptions } from '../../utils/sequelize.options';
import { EntityService } from './entity.service';

export class CorrectionService<T> {
	/**
	 * @see https://github.com/sequelize/sequelize/issues/7344
	 */
	public getCorrectInclude(
		context: EntityService<T>,
		unscopedInclude: boolean,
		include: Include,
		where: Record<string, any>,
		group?: any,
		optimizeInclude = false,
	): Include {
		const outerWhere = this.getSequelizeOuterWhere(context, where);
		const result = unscopedInclude
			? this.addUnscopedAttributes(
					context,
					this.addCorrectRequiredAttributes(context, include, outerWhere, optimizeInclude),
			  )
			: this.addCorrectRequiredAttributes(context, include, outerWhere, optimizeInclude);

		if (!group) {
			return result;
		}

		/**
		 * For grouping (prevent errors like '[column must appear in the GROUP BY clause or be used in an aggregate function]')
		 */
		const parent = context.__crudModel__.prototype.constructor;
		return result['all'] === true
			? context.getAllRelations().map((child) => this.addEmptyAttributes(parent, child))
			: (result as any[]).map((child) => this.addEmptyAttributes(parent, child));
	}

	public addCorrectOrderIfNecessary(
		context: EntityService<T>,
		order: any[] = [],
		group: any,
	): any[] {
		if (order.length || group) {
			return order;
		}

		const parent = context.__crudModel__.prototype.constructor;
		let result = [];

		if (parent._scope?.order) {
			result = [...parent._scope.order];
		} else {
			result = [...defaultScopeOptions.order];
		}
		return result;
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

	protected addUnscopedAttributes(context: EntityService<T>, include: Include): Include {
		return include['all'] === true
			? context.getAllRelations().map((child) => this.addUnscopedAttributesHelper(child))
			: (include as any[]).map((child) => this.addUnscopedAttributesHelper(child));
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

	protected addCorrectRequiredAttributes(
		context: EntityService<T>,
		include: Include,
		outerWhere: string[],
		optimizeInclude = false,
	): Include {
		const parent = context.__crudModel__.prototype.constructor;
		return include['all'] === true
			? context
					.getAllRelations()
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

	protected addEmptyAttributes(
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
					? child.include.map((subchild) => this.addEmptyAttributes(child.model, subchild))
					: [],
				...props,
			};
		}
	}
}

export const correctionService = new CorrectionService();
