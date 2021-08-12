import { isPhoneNumber } from 'class-validator';
import { config } from './config';
import { Mutex } from 'redis-semaphore';
import { HttpException } from '@nestjs/common';
import { plainToClass } from 'class-transformer';

class Utils {
	public normalizeBeforeValidation(obj) {
		return this.normalizeHelper(obj, (key, value) => {
			let result = value.trim();

			if (key === 'email') {
				result = result.toLowerCase();
			}
			return result;
		});
	}

	public normalizeAfterValidation(obj) {
		const result = this.normalizeHelper(obj, (key, value) => {
			if (key === 'phone') {
				return this.normalizePhone(value);
			}
			return value;
		});

		if (
			obj !== null &&
			typeof obj === 'object' &&
			!Array.isArray(obj) &&
			obj?.constructor?.prototype
		) {
			return plainToClass(obj.constructor, result);
		}
		return result;
	}

	private normalizeHelper(obj, callback: (key: string, value: any) => any) {
		if (obj === null || (!Array.isArray(obj) && typeof obj !== 'object') || obj instanceof Buffer)
			return obj;

		return Object.keys(obj).reduce(
			(accumulator, key) => {
				const value = obj[key];
				let result;

				if (typeof value === 'string') {
					result = callback(key.trim(), value);
				} else {
					result = this.normalizeHelper(value, callback);
				}
				accumulator[key.trim()] = result;
				return accumulator;
			},
			Array.isArray(obj) ? [] : {},
		);
	}

	public normalizePhone(phone: string): string {
		let result = (phone.match(/\d/g) ?? []).join('');
		if (isPhoneNumber(phone)) {
			if (isPhoneNumber(phone, 'RU') && result[0] === '8') {
				result = `7${result.slice(1)}`;
			}
			return `+${result}`;
		}
		return result;
	}

	public ucFirst(str) {
		if (!str) return str;
		return str[0].toUpperCase() + str.slice(1);
	}

	public isNumeric(n) {
		return !isNaN(parseFloat(n)) && isFinite(n);
	}

	public getEnumValues(inputEnum) {
		return Object.keys(inputEnum).map((k) => inputEnum[k as any]);
	}

	public getIpAddressFromRequest(req) {
		return (
			(Array.isArray(req.headers['x-forwarded-for'])
				? req.headers['x-forwarded-for'][0]
				: req.headers['x-forwarded-for']) || req.connection.remoteAddress
		);
	}

	public async acquireMutex(mutexStore, key: string, keyStore = mutexStore) {
		if (!mutexStore[key]) {
			mutexStore[key] = new Mutex(config.getRedisClient(), key);
		}

		keyStore['__mutexKey__'] = key;

		try {
			await mutexStore[key].acquire();
		} catch (e) {
			await this.releaseMutex(mutexStore, keyStore);
			throw new HttpException('Too many requests', 429);
		}
	}

	public async releaseMutex(mutexStore, keyStore = mutexStore) {
		const key = keyStore['__mutexKey__'];

		if (key && mutexStore[key]) {
			await mutexStore[key].release();
		}
	}

	public async acquireMutexWithoutStore(key: string) {
		const mutex = new Mutex(config.getRedisClient(), key);
		try {
			await mutex.acquire();
		} catch (e) {
			await mutex.release();
		}
		return mutex;
	}

	public camelToSnakeCase(str) {
		return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
	}

	public camelToSnakeCaseWithUpper(str) {
		return this.camelToSnakeCase(str).toUpperCase();
	}

	public snakeCaseToCamel(str) {
		return str.includes('_')
			? str
					.toLowerCase()
					.replace(/([-_][a-z])/g, (group) => group.toUpperCase().replace('-', '').replace('_', ''))
			: str;
	}
}

export const utils = new Utils();
