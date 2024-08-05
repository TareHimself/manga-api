import {
	IChapterResponse,
	IChaptersResponse,
	IFileToUpload,
	IMangaResponse,
	IPageProxy,
	ISearchResponse,
} from './types';
import * as fsPromises from 'fs/promises';
import path from 'path';
import { importFetch } from './utils';
import { CgasApi } from './cgas';
import { withBrowserPage } from './browser';
import { pageCache } from './cache';

export default class SourceBase {
	get id(): string {
		throw new Error('Id not implemented for source');
	}

	get name(): string {
		throw new Error('Name not implemented for source');
	}

	get nsfw(): boolean {
		throw new Error('NSFW not implemented for source');
	}

	constructor() {}

	async proxyPages(pages: IPageProxy[]) {
		const fetch = (await importFetch()).default;

		const streams: IFileToUpload[] = await Promise.all(
			pages.map((page) => {
				return fetch(page.url, {
					headers: {
						'User-Agent':
							'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
						...page.headers,
					},
				}).then((a) => {
					if (!a.body) {
						throw new Error(
							`Failed to get stream for page ${a.url}`
						);
					}

					return {
						data: a.body,
						filename: page.filename,
					};
				});
			})
		);

		const uploadedUrls = await CgasApi.get()
			.upload(streams)
			.then((a) => a?.map((b) => b.url));

		if (!uploadedUrls) {
			throw new Error(`Failed to upload pages ${pages}`);
		}

		return uploadedUrls;
	}

	async handleSearch(
		_query?: string,
		_page?: string
	): Promise<ISearchResponse> {
		throw new Error(`Search not implemented for source with id ${this.id}`);
	}

	async handleManga(_mangaId: string): Promise<IMangaResponse> {
		throw new Error(`Manga not implemented for source with id ${this.id}`);
	}

	async handleChapters(_mangaId: string): Promise<IChaptersResponse> {
		throw new Error(
			`Chapters not implemented for source with id ${this.id}`
		);
	}

	async handleChapter(
		_mangaId: string,
		_chapterId: string
	): Promise<IChapterResponse> {
		throw new Error(
			`Chapter not implemented for source with id ${this.id}`
		);
	}

	async getChapterFromMangaPlus(url: string): Promise<IChapterResponse> {
		return await withBrowserPage<IChapterResponse>(async (browserPage) => {
			await browserPage.evaluateOnNewDocument(() => {
				// const oldFunc = URL.createObjectURL

				// URL.createObjectURL = (...args) => {
				// 	console.log("CREATING OBJECT URL")
				// 	return oldFunc(...args)
				// }
				URL.revokeObjectURL = (...args) => {
					console.log('Cheeky website trying to revoke', ...args);
				};
			});

			await browserPage.goto(url, {
				waitUntil: 'networkidle2',
			});

			await browserPage.waitForSelector('.zao-surface .zao-image');

			const pagesB64 = await browserPage.evaluate(async () => {
				const targetElement =
					document.querySelector('.zao-surface')!;
				const firstElement = targetElement.children[0]!;
				let scrollDelta = 0;
				let lastPos = firstElement.getBoundingClientRect().y;
				let previousLast: Element | null = null;
				do {
					await new Promise<void>((res) => {
						const child =
							targetElement.children[
								targetElement.children.length - 1
							]!;
						if (child !== previousLast) {
							targetElement.addEventListener(
								'scrollend',
								() => {
									res();
								}
							);

							child.scrollIntoView({
								behavior: 'smooth',
							});
							previousLast = child;
						} else {
							res();
						}
					});
					const newPos = firstElement.getBoundingClientRect().y;
					scrollDelta = Math.abs(newPos - lastPos);
					lastPos = newPos;
				} while (scrollDelta > 10);

				async function blobUrlToBase64(blobUrl: string) {
					return new Promise<string>((resolve, reject) => {
						const xhr = new XMLHttpRequest();
						xhr.open('GET', blobUrl, true);
						xhr.responseType = 'blob';

						xhr.onload = () => {
							const reader = new FileReader();
							reader.onloadend = () => {
								if (reader.result) {
									const base64String = (
										reader.result as string
									).split(',')[1]!;
									resolve(base64String);
								} else {
									reject(
										new Error(
											'Failed to convert Blob URL to Base64.'
										)
									);
								}
							};
							reader.readAsDataURL(xhr.response);
						};

						xhr.onerror = () => {
							reject(new Error('Failed to load Blob URL.'));
						};

						xhr.send();
					});
				}

				return await Promise.all(
					Array.from(
						document.querySelectorAll('.zao-surface .zao-image')
					).map((a) => blobUrlToBase64(a.getAttribute('src')!))
				);
			});

			return await Promise.all(
				pagesB64.map((a, idx) =>
					pageCache
						.cache(
							`${url}${idx}`,
							Buffer.from(a, 'base64')
						)
						.then((a) => ({
							src: `https://manga.oyintare.dev/pages/${a}`,
							headers: [],
						}))
				)
			);
		});
	}
}

export class SourceManager {
	sourcesPath = path.join(__dirname, 'sources');
	sources: Map<SourceBase['id'], SourceBase> = new Map();

	useSource(source: SourceBase) {
		this.sources.set(source.id, source);
	}

	async loadSourceFromFile(file: string) {
		const sourceFactory: () => SourceBase[] = require(file).default;
		sourceFactory().map((a) => this.useSource(a));
	}

	async loadSources() {
		const sources = await fsPromises
			.readdir(this.sourcesPath)
			.then((a) => a.filter((b) => b.endsWith('.js')));

		await Promise.allSettled(sources.map(c => this.loadSourceFromFile(
			path.join(this.sourcesPath, c)
		)))
	}

	getSource(id: string) {
		return this.sources.get(id);
	}
}
