import SourceBase from '../source';
import html from 'node-html-parser';
import {
	ISearchResponse,
	IMangaResponse,
	IChaptersResponse,
	IChapterResponse,
	IMangaPreview,
	EMangaStatus,
	IMangaChapter,
} from '../types';
import { extractAndFormatDate, importFetch, makeApiImage } from '../utils';
import { withBrowserPage } from '../browser';
import { pageCache } from '../cache';

class MangaFireSource extends SourceBase {
	baseUrl: string;
	constructor() {
		super();
		this.baseUrl = 'https://mangafire.to/';
	}

	override get id(): string {
		return 'mangafire';
	}

	override get name(): string {
		return 'MangaFire';
	}

	override get nsfw(): boolean {
		return false;
	}

	override async handleSearch(
		query?: string,
		page?: string
	): Promise<ISearchResponse> {
		const fetch = (await importFetch()).default;

		const searchUrl =
			page ||
			(query
				? `${this.baseUrl}filter?keyword=${encodeURIComponent(query)}`
				: `${this.baseUrl}updated`);

		const dom = html(await fetch(searchUrl).then((a) => a.text()));

		const searchResults: IMangaPreview[] = [];

		for (const element of dom.querySelectorAll('.original .unit .inner')) {
			const aTag = element.querySelector('a');
			if (aTag) {
				const itemId = aTag.getAttribute('href') ?? '';
				searchResults.push({
					id: encodeURIComponent(
						itemId.split('/').reverse()[0] ?? ''
					),
					name:
						element.querySelector('.info a')?.textContent.trim() ??
						'',
					cover: {
						src:
							aTag.querySelector('img')?.getAttribute('src') ??
							'',
						headers: [],
					},
				});
			}
		}

		let nextPage: string | null = null;

		const pageItems = dom
			.querySelectorAll('.pagination .page-item')
			.filter(
				(a) => a.querySelector('a')?.getAttribute('rel') === undefined
			);
		const currentIdx = pageItems.findIndex((a) =>
			a.classNames.includes('active')
		);
		if (currentIdx !== -1 && currentIdx + 1 < pageItems.length) {
			nextPage =
				pageItems[currentIdx + 1]
					?.querySelector('a')
					?.getAttribute('href') ?? null;
		}

		return {
			items: searchResults,
			next: nextPage,
		};
	}

	override async handleManga(mangaId: string): Promise<IMangaResponse> {
		const fetch = (await importFetch()).default;

		const targetUrl = `${this.baseUrl}manga/${mangaId}`;

		const dom = html(await fetch(targetUrl).then((a) => a.text()));

		const statusString =
			dom.querySelector('.info p')?.textContent.trim().toLowerCase() ??
			'';

		dom.querySelector('#synopsis .modal-content .modal-close')?.remove();

		return {
			share: targetUrl,
			name: dom.querySelector('.info h1')?.textContent.trim() ?? '',
			cover: {
				src:
					dom.querySelector('.poster img')?.getAttribute('src') ?? '',
				headers: [],
			},
			tags:
				dom
					.querySelectorAll('.sidebar .meta div')
					?.find((a) =>
						a
							.querySelector('span')
							?.textContent.toLowerCase()
							.includes('genres:')
					)
					?.querySelectorAll('a')
					.map((b) => b.textContent.trim()) ?? [],
			status:
				statusString === 'releasing'
					? EMangaStatus.ON_GOING
					: statusString === 'completed'
					? EMangaStatus.COMPLETE
					: EMangaStatus.UNKNOWN,
			description:
				dom
					.querySelector('#synopsis .modal-content')
					?.textContent.trim() ?? '',
			extras: [],
		};
	}

	override async handleChapters(mangaId: string): Promise<IChaptersResponse> {
		const fetch = (await importFetch()).default;
		console.log('Chapters url', `${this.baseUrl}manga/${mangaId}`);
		const dom = html(
			await fetch(`${this.baseUrl}manga/${mangaId}`).then((a) => a.text())
		);

		const targetElements =
			dom
				.querySelectorAll('.list-body .scroll-sm')[0]
				?.querySelectorAll('.item') ?? [];

		const chaptersToSend: IMangaChapter[] = [];
		for (const element of targetElements) {
			const aTag = element.querySelector('a');
			if (aTag) {
				chaptersToSend.push({
					id: encodeURIComponent(
						aTag
							.getAttribute('href')
							?.split('/')
							.reverse()
							.slice(0, 2)
							.reverse()
							.join('/') ?? ''
					),
					name:
						aTag.getAttribute('title') ??
						element.getAttribute('data-number') ??
						'',
					released: extractAndFormatDate(
						aTag.querySelectorAll('span')[1]?.textContent.trim() ??
							''
					),
				});
			}
		}

		return chaptersToSend;
	}

	override async handleChapter(
		mangaId: string,
		chapterId: string
	): Promise<IChapterResponse> {
		const targetUri = `${this.baseUrl}read/${mangaId}/${chapterId}`;

		return await withBrowserPage(async (page) => {
			await page.evaluateOnNewDocument(() => {
				// const oldFunc = URL.createObjectURL

				// URL.createObjectURL = (...args) => {
				// 	console.log("CREATING OBJECT URL")
				// 	return oldFunc(...args)
				// }
				URL.revokeObjectURL = (...args) => {
					console.log('Cheeky website trying to revoke', ...args);
				};
			});

			await page.goto(targetUri, {
				waitUntil: 'networkidle2',
			});

			await page.evaluate(() => {
				(
					document.querySelector(
						'.tab-content div[data-value="longstrip"]'
					) as HTMLElement | null
				)?.click();
			});

			await page.waitForSelector('.pages.longstrip');

			const userAgent = await page.browser().userAgent();

			return await page
				.evaluate(async () => {
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

					const pagesFound = [];
					const items = Array.from(
						document.querySelectorAll('.pages.longstrip .page')
					);

					for (const item of items) {
						while (
							!item.querySelector('img')?.getAttribute('src')
						) {
							window.scrollBy(0, 100);
							item.scrollIntoView({
								behavior: 'instant' as ScrollBehavior,
							});

							await new Promise((r) => setTimeout(r, 50));
						}

						const src =
							item.querySelector('img')?.getAttribute('src') ??
							null;

						if (!src) {
							continue;
						}

						pagesFound.push(
							src.startsWith('blob')
								? await blobUrlToBase64(src)
								: src
						);
					}

					return pagesFound;
				})
				.then((a) =>
					Promise.all(
						a.map(async (b, idx) => {
							if (b.startsWith('http')) {
								return makeApiImage(b, {
									'User-Agent': userAgent,
									Referer: this.baseUrl,
									Origin: this.baseUrl,
								});
							} else {
								console.log('Converting to b64', idx, b.length);
								const cachedKey = await pageCache.cache(
									`${targetUri}${idx}`,
									Buffer.from(b, 'base64')
								);
								return {
									src: `https://manga.oyintare.dev/pages/${cachedKey}`,
									headers: [],
								};
							}
						})
					)
				);
		});
	}
	// override async handleChapter(
	// 	mangaId: string,
	// 	chapterId: string
	// ): Promise<IChapterResponse> {
	// 	const targetUri = `${this.baseUrl}read/${mangaId}/${chapterId}`;

	// 	return await withBrowserPage(async (page) => {
	// 		await page.evaluateOnNewDocument(() => {
	// 			URL.revokeObjectURL = (...args) => {
	// 				console.log('Cheeky website trying to revoke', ...args);
	// 			};
	// 		});

	// 		await page.goto(targetUri, {
	// 			waitUntil: 'networkidle2',
	// 		});

	// 		await page.evaluate(() => {
	// 			(
	// 				document.querySelector(
	// 					'.left-switch.btn[for="mode-vertical"]'
	// 				) as HTMLElement | null
	// 			)?.click();
	// 		});

	// 		await page.waitForSelector('.content.vertical');

	// 		const userAgent = await page.browser().userAgent();

	// 		return await page
	// 			.evaluate(async () => {
	// 				const targetElement = Array.from(
	// 					document.querySelectorAll('.page')
	// 				).reverse()[0]!!;

	// 				do {
	// 					await new Promise<void>((res) => {
	// 						const onEnd = () => {
	// 							res();
	// 							console.log('Scroll finished');
	// 							window.removeEventListener('scrollend', onEnd);
	// 						};
	// 						window.addEventListener('scrollend', onEnd);
	// 						targetElement.scrollIntoView();
	// 						console.log('Starting scroll');
	// 					});
	// 					await new Promise((r) => setTimeout(r, 500));
	// 				} while (targetElement.querySelector('img') === null);

	// 				async function blobUrlToBase64(blobUrl: string) {
	// 					return new Promise<string>((resolve, reject) => {
	// 						const xhr = new XMLHttpRequest();
	// 						xhr.open('GET', blobUrl, true);
	// 						xhr.responseType = 'blob';

	// 						xhr.onload = () => {
	// 							const reader = new FileReader();
	// 							reader.onloadend = () => {
	// 								if (reader.result) {
	// 									const base64String = (
	// 										reader.result as string
	// 									).split(',')[1]!;
	// 									resolve(base64String);
	// 								} else {
	// 									reject(
	// 										new Error(
	// 											'Failed to convert Blob URL to Base64.'
	// 										)
	// 									);
	// 								}
	// 							};
	// 							reader.readAsDataURL(xhr.response);
	// 						};

	// 						xhr.onerror = () => {
	// 							reject(new Error('Failed to load Blob URL.'));
	// 						};

	// 						xhr.send();
	// 					});
	// 				}

	// 				const pagesFound: string[] = [];

	// 				for (const item of document.querySelectorAll('.page img')) {
	// 					const src = item.getAttribute('src') ?? '' ?? null;

	// 					if (!src) {
	// 						continue;
	// 					}

	// 					pagesFound.push(
	// 						src.startsWith('blob')
	// 							? await blobUrlToBase64(src)
	// 							: src
	// 					);
	// 				}

	// 				return pagesFound;
	// 			})
	// 			.then((a) =>
	// 				Promise.all(
	// 					a.map(async (b, idx) => {
	// 						if (b.startsWith('http')) {
	// 							return makeApiImage(b, {
	// 								'User-Agent': userAgent,
	// 								Referer: this.baseUrl,
	// 								Origin: this.baseUrl,
	// 							});
	// 						} else {
	// 							console.log('Converting to b64', idx, b.length);
	// 							const cachedKey = await pageCache.cache(
	// 								`${targetUri}${idx}`,
	// 								Buffer.from(b, 'base64')
	// 							);
	// 							return {
	// 								src: `https://manga.oyintare.dev/pages/${cachedKey}`,
	// 								headers: [],
	// 							};
	// 						}
	// 					})
	// 				)
	// 			);
	// 	});
	// }
}

// class MangaFireSource extends SourceBase {
// 	baseUrl: string;
// 	constructor() {
// 		super();
// 		this.baseUrl = 'https://mangafire.to/';
// 	}

// 	override get id(): string {
// 		return 'mangafire';
// 	}

// 	override get name(): string {
// 		return 'MangaFire';
// 	}

// 	override get nsfw(): boolean {
// 		return false;
// 	}

// 	override async handleSearch(
// 		query?: string,
// 		page?: string
// 	): Promise<ISearchResponse> {
// 		const fetch = (await importFetch()).default;

// 		const searchUrl =
// 			page ||
// 			(query
// 				? `${this.baseUrl}filter?keyword=${encodeURIComponent(query)}`
// 				: `${this.baseUrl}updated`);

// 		console.log('Using Url', searchUrl);
// 		const dom = html(await fetch(searchUrl).then((a) => a.text()));

// 		const searchResults: IMangaPreview[] = [];

// 		for (const element of dom.querySelectorAll('.mids .m-item .m-inner')) {
// 			const aTag = element.querySelector('a');
// 			if (aTag) {
// 				const itemId = aTag.getAttribute('href') ?? '';
// 				searchResults.push({
// 					id: encodeURIComponent(
// 						itemId.split('/').reverse()[0] ?? ''
// 					),
// 					name:
// 						element
// 							.querySelector('.info .title')
// 							?.textContent.trim() ?? '',
// 					cover: {
// 						src:
// 							aTag.querySelector('img')?.getAttribute('src') ??
// 							'',
// 						headers: [],
// 					},
// 				});
// 			}
// 		}

// 		let nextPage: string | null = null;

// 		const pageItems = dom
// 			.querySelectorAll('.pagination .page-item')
// 			.filter(
// 				(a) => a.querySelector('a')?.getAttribute('rel') === undefined
// 			);
// 		const currentIdx = pageItems.findIndex((a) =>
// 			a.classNames.includes('active')
// 		);
// 		if (currentIdx !== -1 && currentIdx + 1 < pageItems.length) {
// 			nextPage =
// 				pageItems[currentIdx + 1]
// 					?.querySelector('a')
// 					?.getAttribute('href') ?? null;
// 		}

// 		return {
// 			items: searchResults,
// 			next: nextPage,
// 		};
// 	}

// 	override async handleManga(mangaId: string): Promise<IMangaResponse> {
// 		const fetch = (await importFetch()).default;

// 		const targetUrl = `${this.baseUrl}manga/${mangaId}`;

// 		const dom = html(await fetch(targetUrl).then((a) => a.text()));

// 		const statusString =
// 			dom
// 				.querySelector('.m-info .status')
// 				?.textContent.trim()
// 				.toLowerCase() ?? '';
// 		return {
// 			share: targetUrl,
// 			name: dom.querySelector('.m-info .name')?.textContent.trim() ?? '',
// 			cover: {
// 				src: dom.querySelector('.cover img')?.getAttribute('src') ?? '',
// 				headers: [],
// 			},
// 			tags:
// 				dom
// 					.querySelectorAll('.m-meta div')
// 					?.find((a) =>
// 						a
// 							.querySelector('span')
// 							?.textContent.toLowerCase()
// 							.includes('genres:')
// 					)
// 					?.querySelectorAll('a')
// 					.map((b) => b.textContent.trim()) ?? [],
// 			status:
// 				statusString === 'releasing'
// 					? EMangaStatus.ON_GOING
// 					: statusString === 'completed'
// 					? EMangaStatus.COMPLETE
// 					: EMangaStatus.UNKNOWN,
// 			description:
// 				dom
// 					.querySelector(
// 						'.description .cts-block[data-name="full"] div'
// 					)
// 					?.textContent.trim() ?? '',
// 			extras: [],
// 		};
// 	}

// 	override async handleChapters(mangaId: string): Promise<IChaptersResponse> {
// 		console.log('Chapters url', `${this.baseUrl}manga/${mangaId}`);

// 		// await fetch(`${this.baseUrl}manga/${mangaId}`).then((a) => a.text())
// 		const dom = html(
// 			await withBrowserPage(async (browserPage) => {
// 				await browserPage.goto(`${this.baseUrl}manga/${mangaId}`, {
// 					waitUntil: 'networkidle2',
// 				});

// 				await browserPage.waitForSelector('.content ul li');
// 				return await browserPage.content();
// 			})
// 		);

// 		const targetElements = dom.querySelectorAll('.content ul li');

// 		const chaptersToSend: IMangaChapter[] = [];
// 		for (const element of targetElements) {
// 			const aTag = element.querySelector('a');
// 			if (aTag) {
// 				chaptersToSend.push({
// 					id: encodeURIComponent(
// 						aTag
// 							.getAttribute('href')
// 							?.split('/')
// 							.reverse()
// 							.slice(0, 2)
// 							.reverse()
// 							.join('/') ?? ''
// 					),
// 					name:
// 						aTag.getAttribute('title') ??
// 						element.getAttribute('data-number') ??
// 						'',
// 					released: extractAndFormatDate(
// 						aTag.querySelectorAll('span')[1]?.textContent.trim() ??
// 							''
// 					),
// 				});
// 			}
// 		}

// 		return chaptersToSend;
// 	}

// 	override async handleChapter(
// 		mangaId: string,
// 		chapterId: string
// 	): Promise<IChapterResponse> {
// 		const targetUri = `${this.baseUrl}read/${mangaId}/${chapterId}`;

// 		return await withBrowserPage(async (page) => {

//             await page.evaluateOnNewDocument(() => {
// 				// const oldFunc = URL.createObjectURL

// 				// URL.createObjectURL = (...args) => {
// 				// 	console.log("CREATING OBJECT URL")
// 				// 	return oldFunc(...args)
// 				// }
// 				URL.revokeObjectURL = (...args) => {
// 					console.log('Cheeky website trying to revoke', ...args);
// 				};
// 			});

// 			await page.goto(targetUri, {
// 				waitUntil: 'networkidle2',
// 			});

// 			await page.evaluate(() => {
// 				(
// 					document.querySelector(
// 						'.tab-content div[data-value="longstrip"]'
// 					) as HTMLElement | null
// 				)?.click();
// 			});

// 			await page.waitForSelector('.pages.longstrip');

// 			const userAgent = await page.browser().userAgent();

// 			return await page
// 				.evaluate(async () => {
// 					async function blobUrlToBase64(blobUrl: string) {
// 						return new Promise<string>((resolve, reject) => {
// 							const xhr = new XMLHttpRequest();
// 							xhr.open('GET', blobUrl, true);
// 							xhr.responseType = 'blob';

// 							xhr.onload = () => {
// 								const reader = new FileReader();
// 								reader.onloadend = () => {
// 									if (reader.result) {
// 										const base64String = (
// 											reader.result as string
// 										).split(',')[1]!;
// 										resolve(base64String);
// 									} else {
// 										reject(
// 											new Error(
// 												'Failed to convert Blob URL to Base64.'
// 											)
// 										);
// 									}
// 								};
// 								reader.readAsDataURL(xhr.response);
// 							};

// 							xhr.onerror = () => {
// 								reject(new Error('Failed to load Blob URL.'));
// 							};

// 							xhr.send();
// 						});
// 					}

//                     const pagesFound = []
// 					const items = Array.from(
// 						document.querySelectorAll('.pages.longstrip .page')
// 					)

//                     for(const item of items){
//                         while(!item.querySelector('img')?.getAttribute('src')){
//                             window.scrollBy(0,100)
//                             item.scrollIntoView({
//                                 behavior: "instant" as ScrollBehavior
//                             });

//                             await new Promise((r) => setTimeout(r, 50));
//                         }

//                         const src = item.querySelector('img')?.getAttribute('src') ?? null

//                         if(!src){
//                             continue
//                         }

//                         pagesFound.push(src.startsWith('blob') ? await blobUrlToBase64(src) : src)
//                     }

// 					return pagesFound;
// 				})
// 				.then((a) =>
// 					Promise.all(
// 						a.map(async (b, idx) => {

// 							if (b.startsWith('http')) {
// 								return makeApiImage(b, {
// 									'User-Agent': userAgent,
// 									Referer: this.baseUrl,
// 									Origin: this.baseUrl,
// 								});
// 							} else {
//                                 console.log("Converting to b64",idx,b.length)
// 								const cachedKey = await pageCache.cache(
// 									`${targetUri}${idx}`,
// 									Buffer.from(b, 'base64')
// 								);
// 								return {
// 									src: `https://manga.oyintare.dev/pages/${cachedKey}`,
// 									headers: [],
// 								};
// 							}
// 						})
// 					)
// 				);
// 		});
// 	}
// }

export default function factory() {
	return [new MangaFireSource()];
}
