import Redis from 'ioredis';
import { createSafeRedisLeader } from 'safe-redis-leader';
import * as redisStore from 'cache-manager-ioredis';
import { ThrottlerStorageRedisService } from 'nestjs-throttler-storage-redis';
import { SequelizeOptions } from 'sequelize-typescript';
import { CacheModuleOptions } from '@nestjs/common';
import { ThrottlerModuleOptions } from '@nestjs/throttler';
import { ResizeOptions } from 'sharp';
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();

export class Config {
	protected redisClient = null;
	protected resolveSafeLeader;
	protected safeLeader = new Promise<any>((resolve) => {
		this.resolveSafeLeader = (result) => resolve(result);
	});

	constructor() {
		this.elect();
	}

	public defineFunction(name: string, func: (...args) => any): void {
		this[name] = func;
	}

	public isDevelopment(): boolean {
		return process.env.NODE_ENV === 'development';
	}

	public isProduction(): boolean {
		return process.env.NODE_ENV === 'production';
	}

	public async getDatabaseOptionsWithLeaderChecking(
		options: SequelizeOptions = {},
	): Promise<SequelizeOptions> {
		const isLeader = await this.isLeader();
		return {
			dialect: 'postgres',
			host: process.env.DB_HOST,
			port: parseInt(process.env.DB_PORT),
			username: process.env.DB_USERNAME,
			password: process.env.DB_PASSWORD,
			database: process.env.DB_NAME,
			define: {
				underscored: true,
			},
			autoLoadModels: true,
			...(isLeader
				? {
						synchronize: true,
						sync: {
							alter: true,
						},
				  }
				: {}),
			pool: {
				min: 10,
				max: 100,
			},
			logging: false,
			...options,
		} as unknown as SequelizeOptions;
	}

	public getRedisOptions(): { host: string; port: number } {
		return {
			host: process.env.REDIS_HOST,
			port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
		};
	}

	public getRedisClient(): Redis {
		if (!this.redisClient) {
			this.redisClient = new Redis(this.getRedisOptions());
		}
		return this.redisClient;
	}

	public async isLeader(): Promise<boolean> {
		const safeLeader = await this.safeLeader;
		return safeLeader.isLeader();
	}

	public getDefaultResizeOptions(): ResizeOptions[] {
		return [
			{
				width: this.getUploadOptions().imageWidth,
			},
		];
	}

	public getUploadOptions(): {
		imageWidth: number;
		folders: string[];
		ALLOWED_PICTURE_MIMETYPES: string[];
		ALLOWED_AUDIO_MIMETYPES: string[];
		ALLOWED_VIDEO_MIMETYPES: string[];
		ALLOWED_DOCUMENT_MIMETYPES: string[];
		SUMMARY_SIZE_LIMIT: number;
	} {
		return {
			imageWidth: 1000,
			folders: ['upload'],
			ALLOWED_PICTURE_MIMETYPES: ['image/jpeg', 'image/png', 'image/svg+xml'],
			ALLOWED_AUDIO_MIMETYPES: ['audio/mpeg', 'audio/ogg', 'audio/aac'],
			ALLOWED_VIDEO_MIMETYPES: ['video/mpeg', 'video/ogg', 'video/mp4'],
			ALLOWED_DOCUMENT_MIMETYPES: [
				'text/plain',
				'application/pdf',
				'application/vnd.ms-excel',
				'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
				'application/msword',
				'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			],
			SUMMARY_SIZE_LIMIT: 100_000_000, // 100 Mb
		};
	}

	public getEmailOptions(): {
		host: string;
		port: number;
		secure: boolean;
		auth: {
			user: string;
			pass: string;
			[key: string]: any;
		};
		[key: string]: any;
	} {
		return {
			host: 'smtp.yandex.ru',
			port: 465,
			secure: true,
			auth: {
				user: process.env.EMAIL_LOGIN,
				pass: process.env.EMAIL_PASSWORD,
			},
		};
	}

	public getCorsOrigin(): string {
		return process.env.CORS_ORIGIN;
	}

	public getThrottlerOptions(): ThrottlerModuleOptions {
		return {
			ttl: 60,
			limit: 20,
			storage: new ThrottlerStorageRedisService(this.getRedisClient()),
		};
	}

	public getCacheOptions(redefined = {}): CacheModuleOptions {
		return {
			store: redisStore,
			...this.getRedisOptions(),
			ttl: 300,
			max: 500,
			...redefined,
		};
	}

	public getWsPort(): number {
		return process.env.WS_PORT ? parseInt(process.env.WS_PORT) : 3030;
	}

	public getWsOptions(): Record<string, any> {
		return {
			transports: ['websocket'],
			origins: process.env.WS_ORIGIN ?? '*:*',
			path: '/ws',
			serveClient: false,
			allowUpgrades: false,
		};
	}

	public getSentryOptions(): { dsn: string; tracesSampleRate: number } {
		return {
			dsn: process.env.SENTRY_DSN,
			tracesSampleRate: 1.0,
		};
	}

	protected async elect(): Promise<void> {
		await createSafeRedisLeader({
			asyncRedis: this.getRedisClient(),
			ttl: 1500,
			wait: 3000,
			key: 'the-election',
		})
			.then(async (safeLeader) => {
				await safeLeader.elect();
				this.resolveSafeLeader(safeLeader);
			})
			.catch(() => {
				process.exit(1);
			});
	}
}

export const config = new Config();
