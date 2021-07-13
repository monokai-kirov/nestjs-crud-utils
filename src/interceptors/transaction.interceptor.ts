import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { of } from 'rxjs';
import { Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';

@Injectable()
export class TransactionInterceptor implements NestInterceptor {
	constructor(
		@InjectConnection()
		private readonly sequelize: Sequelize,
	) {}

	async intercept(context: ExecutionContext, next: CallHandler) {
		const result = await this.sequelize.transaction(
			{
				isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE,
			},
			async (t) => {
				return next.handle().toPromise();
			},
		);

		return of(result);
	}
}
