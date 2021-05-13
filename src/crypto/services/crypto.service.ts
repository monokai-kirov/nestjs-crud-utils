import { Injectable } from "@nestjs/common";
const bcrypt = require('bcrypt');
const crypto = require('crypto');

@Injectable()
export class CryptoService {
	public async checkPassword(password: string, dbPasswordHash: string): Promise<boolean> {
		return await new Promise((resolve, reject) => {
			bcrypt.compare(password, dbPasswordHash, function(err, result) {
				if (err) reject(err);
				resolve(<boolean>result);
			});
		});
	}

	public async hashPassword(password: string): Promise<string> {
		const saltRounds = 10;
		return <string>await new Promise((resolve, reject) => {
			bcrypt.hash(password, saltRounds, function(err, hash) {
				if (err) reject(err);
				resolve(hash);
			});
		});
	}

	public md5(input: string): string {
		return crypto.createHash('md5').update(input).digest('hex');
	}

	public getRandomInRange(min: number, max: number): number {
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}

	public generateHash(length: number = 40): string {
		return crypto.randomBytes(length).toString('hex');
	}
}
