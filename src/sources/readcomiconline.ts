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
	IManga,
	IApiImage,
} from '../types';
import { extractAndFormatDate, importFetch, makeApiImage } from '../utils';
import { withBrowserPage } from '../browser';
import { pageCache } from '../cache';

class ReadComicOnlineSource extends SourceBase {
	baseUrl: string;
	constructor() {
		super();
		this.baseUrl = 'https://readcomiconline.li/';
	}

	override get id(): string {
		return 'readcomiconline';
	}

	override get name(): string {
		return 'Read Comic Online';
	}

	override get nsfw(): boolean {
		return false;
	}

	override async handleSearch(
		query?: string,
		page?: string
	): Promise<ISearchResponse> {
		const searchUrl =
			page ||
			(query
				? `${this.baseUrl}AdvanceSearch?comicName=${encodeURIComponent(query)}&ig=&eg=&status=&pubDate=`
				: `${this.baseUrl}ComicList/LatestUpdate`);

		return await withBrowserPage(async (browserPage) => {
			await browserPage.goto(searchUrl, {
				waitUntil: "networkidle2",
			});

			await browserPage.waitForSelector('.list-comic');

			return await browserPage.evaluate(() => {
				const elements = Array.from(
					document.querySelectorAll('.list-comic > .item > a')
				);

				const results: IMangaPreview[] = elements.map((a) => {
					return {
						id: encodeURIComponent(
							(
								(a as HTMLLinkElement).getAttribute('href') ?? ''
							).slice(1)
						),
						cover: {
							src: (a.querySelector('img') as HTMLImageElement | null)?.src ?? '',
							headers: [
								{
									key: 'User-Agent',
									value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
								},
								{ key: 'Referer', value: window.location.href },
							],
						},
						name: a.querySelector('.title')?.textContent ?? '',
					};
				});

				const nextElement = Array.from(
					document.querySelectorAll(
						'.pager > li > a'
					)
				).filter((a) => a.textContent?.toLowerCase()?.includes("next") == true)[0] as HTMLLinkElement | null;

				return {
					items: results,
					next: nextElement?.href ?? null,
				};
			});
		});
	}

	override async handleManga(mangaId: string): Promise<IMangaResponse> {
		const url = this.baseUrl + decodeURIComponent(mangaId);

		return await withBrowserPage(async (browserPage) => {
			await browserPage.goto(url, {
				waitUntil: "networkidle2",
			});

			await browserPage.waitForSelector('#leftside > div:nth-child(1) > div.barContent > div');

			return await browserPage.evaluate((mangaId) => {
				const element = document.querySelector("#leftside > div:nth-child(1) > div.barContent > div");

				let result: IManga = {
					share: window.location.href,
					status: EMangaStatus.COMPLETE,
					description: '',
					tags: [],
					extras: [],
					id: mangaId,
					name: element?.querySelector('a')?.textContent?.trim() ?? '',
					cover: {
						src: (document.querySelector('#rightside > div:nth-child(1) > div.barContent > div > img') as HTMLImageElement | null)?.src ?? '',
						headers: [
							{
								key: 'User-Agent',
								value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
							},
							{ key: 'Referer', value: window.location.href },
						]
					}
				};

				const pElements = Array.from(element?.querySelectorAll("p") ?? []);
				for (const elem of pElements) {
					const infoElem = elem.querySelector('.info');
					if (infoElem == null && (elem.textContent?.trim()?.length ?? 0) > 0) {
						result.description = elem.textContent?.trim() ?? '';
						continue;
					}

					const content = infoElem?.textContent?.trim()?.toLowerCase() ?? '';
					if (content === "genres:") {
						result.tags = Array.from(elem?.querySelectorAll(".dotUnder") ?? []).map(c => c.textContent?.trim() ?? '');
					}
					else if (content === "status:") {
						const status = elem?.textContent?.toLowerCase() ?? '';
						if (status.includes("completed")) {
							result.status = EMangaStatus.COMPLETE
						} else if (status.includes("ongoing")) {
							result.status = EMangaStatus.ON_GOING
						} else {
							result.status = EMangaStatus.UNKNOWN
						}
					}
				}
				return result;
			}, mangaId);
		});
	}

	override async handleChapters(mangaId: string): Promise<IChaptersResponse> {
		const url = this.baseUrl + decodeURIComponent(mangaId);

		return await withBrowserPage(async (browserPage) => {
			await browserPage.goto(url, {
				waitUntil: "networkidle2",
			});

			await browserPage.waitForSelector('#leftside > div:nth-child(1) > div.barContent > div');

			return await browserPage.evaluate(() => {
				const element = document.querySelector("#leftside > div:nth-child(1) > div.barContent > div");
				const mangaName = element?.querySelector('a')?.textContent?.trim() ?? '';
				const chapterElements = Array.from(document.querySelectorAll('#leftside > div:nth-child(3) > div.barContent.episodeList > div > table > tbody > tr > td > a')) as HTMLLinkElement[]

				return chapterElements.map(el => {
					const children = el.parentElement?.parentElement?.children ?? [];

					const result: IMangaChapter = {
						id: encodeURIComponent(
							(
								el.getAttribute('href') ?? ''
							).slice(1)
						),
						name: el.textContent?.trim()?.replace(mangaName, '') ?? "Unknown Name",
						released: children[children.length - 1].textContent?.trim() ?? ''
					};

					return result;
				});
			}).then(c => c.map(d => ({...d, released: extractAndFormatDate(d.released)})));
		});
	}

	override async handleChapter(
		mangaId: string,
		chapterId: string
	): Promise<IChapterResponse> {
		const targetUri = `${this.baseUrl}${chapterId}&quality=hq&readType=1`;

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

			return await page
				.evaluate(async () => {

					const pagesFound: IApiImage[] = [];
					const items = Array.from(
						document.querySelectorAll('#divImage > p > img')
					) as HTMLImageElement[];

					for (const item of items) {
						while (
							item.getAttribute('data-load') !== "1"
						) {
							//window.scrollBy(0, 100);
							item.scrollIntoView({
								behavior: 'instant' as ScrollBehavior,
							});

							await new Promise((r) => setTimeout(r, 50));
						}

						const src = item.src;

						if (!src) {
							continue;
						}

						pagesFound.push({
							src: src,
							headers: [
								{
									key: 'User-Agent',
									value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
								},
								{ key: 'Referer', value: window.location.href },
							]
						});
					}

					return pagesFound;
				})
		});
	}
}

export default function factory() {
	return [new ReadComicOnlineSource()];
}
