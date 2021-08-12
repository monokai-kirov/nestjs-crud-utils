import { Injectable } from '@nestjs/common';
import { config } from '../../config';
import createSubscriber from 'pg-listen';

@Injectable()
export class PgService {
	private subscriber;

	constructor() {
		const options = config.getDatabaseOptions();
		this.subscriber = createSubscriber({
			connectionString: `postgres://${options.username}:${options.password}@${options.host}:${options.port}/${options.database}`,
		});
		this.subscriber.events.on('error', () => {
			process.exit(1);
		});
		process.on('exit', () => {
			this.subscriber.close();
		});
		this.subscriber.connect();
	}

	public async addEventListener(event: string, listener: (payload) => void): Promise<void> {
		this.subscriber.notifications.on(event, listener);
		await this.subscriber.listenTo(event);
	}
}
