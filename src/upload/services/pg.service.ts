import createSubscriber from 'pg-listen';
import { PgListenHandler } from '..';
import { config } from '../../utils/config';

export class PgService {
	protected subscriber;

	public async subscribeToPgChannel() {
		const options = await config.getDatabaseOptionsWithLeaderChecking();
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

	public async listenTo(eventName: string, pgListenHandler: PgListenHandler): Promise<void> {
		this.subscriber.notifications.on(eventName, async (payload) => {
			await pgListenHandler(payload.row);
		});
		await this.subscriber.listenTo(eventName);
	}
}

export const pgService = new PgService();
