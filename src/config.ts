import Redis from 'ioredis';
import { ThrottlerStorageRedisService } from 'nestjs-throttler-storage-redis';
import * as redisStore from 'cache-manager-ioredis';
import { SequelizeOptions } from 'sequelize-typescript';
import { defaultScopeOptions } from './sequelize.options';

export class Config {
	protected redisClient = null;

	public isDevelopment() {
		return (process.env.NODE_ENV === 'development');
	}

	public isProduction() {
		return (process.env.NODE_ENV === 'production');
	}

	public getCorsOrigin() {
		return process.env.CORS_ORIGIN;
	}

	public getDatabaseOptions() {
		return ({
			dialect: 'postgres',
			host: process.env.DB_HOST,
			port: parseInt(process.env.DB_PORT),
			username: process.env.DB_USERNAME,
			password: process.env.DB_PASSWORD,
			database: process.env.DB_NAME,
			autoLoadModels: true,
			synchronize: true,
			sync: {
				alter: true,
			},
			logging: false,
			pool: {
				max: 100,
				min: 10,
			},
			define: {
				underscored: true,
				defaultScope: defaultScopeOptions,
			},
		} as unknown) as SequelizeOptions;
	}

	public getRedisClient() {
		if (!this.redisClient) {
			this.redisClient = new Redis(this.getRedisOptions());
		}
		return this.redisClient;
	}

	public getRedisOptions() {
		return {
			host: process.env.REDIS_HOST,
			port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
		};
	}

	public getCacheOptions(redefined = {}) {
		return {
			store: redisStore,
			...(this.getRedisOptions()),
			ttl: 60,
			max: 200,
			...redefined,
		};
	}

	public getWsOptions() {
		return {
			transports: ['websocket'],
			origins: process.env.WS_ORIGIN ?? '*:*',
			path: '/ws',
			serveClient: false,
			allowUpgrades: false,
		};
	}

	public getWsPort() {
		return process.env.WS_PORT ? parseInt(process.env.WS_PORT) : 3030;
	}

	public getThrottlerOptions() {
		return {
			ttl: 60,
			limit: 10,
			storage: new ThrottlerStorageRedisService(this.getRedisClient()),
		};
	}

	public getSentryOptions() {
		return {
			dsn: process.env.SENTRY_DSN,
			tracesSampleRate: 1.0,
		};
	}

	public getUploadOptions() {
		return {
			imageWidth: 1000,
			folders: ['upload'],
			ALLOWED_PICTURE_MIMETYPES: [
				'image/jpeg',
				'image/png',
				'image/svg+xml',
			],
			ALLOWED_AUDIO_MIMETYPES: [
				'audio/mpeg',
				'audio/ogg',
				'audio/aac',
			],
			ALLOWED_VIDEO_MIMETYPES: [
				'video/mpeg',
				'video/ogg',
				'video/mp4',
			],
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
}

export const config = new Config();