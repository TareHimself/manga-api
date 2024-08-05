import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { XXHash64 } from 'xxhash-addon';

class Cache {
	cachePath: string;
	ext: string;
	hashCache: Map<string, string> = new Map();

	constructor(cachePath: string, ext: string = 'cache') {
		this.cachePath = path.resolve(cachePath);
		this.ext = ext;
		fs.mkdirSync(this.cachePath, {
			recursive: true,
		});
	}

	hash(data: string) {
		if (this.hashCache.has(data)) {
			return this.hashCache.get(data)!;
		}

		const newHash = XXHash64.hash(Buffer.from(data)).toString('hex');

		this.hashCache.set(data, newHash);

		return newHash;
	}

	async cache(
		key: string,
		data: Buffer | NodeJS.ReadableStream,
		hashKey = true
	) {
		const cacheKey = hashKey ? this.hash(key) : key;

		const filePath = path.join(this.cachePath, `${cacheKey}.${this.ext}`);

		if (data instanceof Buffer) {
			await fsPromises.writeFile(filePath, data);
		} else {
			const tempFilePath = path.join(
				this.cachePath,
				`${uuidv4().replaceAll('-', '')}.${this.ext}`
			);

			const writeStream = fs.createWriteStream(tempFilePath);

			await new Promise<void>((res) => {
				writeStream.on('close', () => {
					console.log('Done saving', cacheKey);
					res();
				});
				console.log('Starting to save', cacheKey);
				data.pipe(writeStream);
			});

			await fsPromises.rename(tempFilePath, filePath);
		}

		return cacheKey;
	}

	async get(key: string, ttl: number = Infinity, hashKey = true) {
		const cacheKey = hashKey ? this.hash(key) : key;

		try {
			const filePath = path.join(
				this.cachePath,
				`${cacheKey}.${this.ext}`
			);

			const stats = await fsPromises.stat(filePath);
			if (stats.mtime.getTime() + ttl > Date.now()) {
				return filePath;
			}
		} catch (error) {
			if (error instanceof Error && (error as any).code === 'ENOENT') {
				return undefined;
			}

			throw error;
		}

		return undefined;
	}
}

export const pageCache = new Cache(path.join('caches', 'pages'), 'png');

export const requestCache = new Cache(path.join('caches', 'requests'), 'json');

export const proxyCache = new Cache(path.join('caches', 'proxies'), 'proxy');
