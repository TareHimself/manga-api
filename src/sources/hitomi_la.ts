import SourceBase from '../source';
import {
	ISearchResponse,
	IMangaResponse,
	IChaptersResponse,
	IChapterResponse,
	IMangaPreview,
	EMangaStatus,
	IApiImage,
} from '../types';
import { makeApiImage } from '../utils';
import { withBrowserPage } from '../browser';

class SyosetuSeSource extends SourceBase {
	baseUrl: string;
	constructor() {
		super();
		this.baseUrl = 'https://hitomi.la/';
	}

	override get id(): string {
		return 'hitomi-la';
	}

	override get name(): string {
		return 'Hitomi';
	}

	override get nsfw(): boolean {
		return true;
	}

	override async handleSearch(
		query?: string,
		page?: string
	): Promise<ISearchResponse> {
		const searchUrl =
			page ||
			(query
				? `${this.baseUrl}search.html?${encodeURIComponent(query)}`
				: this.baseUrl);

		return await withBrowserPage(async (browserPage) => {
			await browserPage.goto(searchUrl, {
				waitUntil: "networkidle2",
			});

			const div = await browserPage.waitForSelector('.gallery-content > div');

			if(div != null){
				const className = await div.evaluate((e) => e.id || e.className);
				if(className == "loader-content"){
					// Wait for loader to dissapear
					while((await browserPage.$('.gallery-content > #loader-content')) != null){
						await new Promise((r) => setTimeout(r,200));
					}
				}
			}

			return await browserPage.evaluate(() => {
				const elements = Array.from(
					document.querySelectorAll('.gallery-content > div')
				);

				if(elements.length == 1 && elements[0]?.className == "search-message"){
					return {
						items: [],
						next: null
					}
				}

				const results: IMangaPreview[] = elements.map((a) => {
					return {
						id: encodeURIComponent(
							(
								a.querySelector('a')?.getAttribute('href') ?? ''
							).slice(1)
						),
						cover: {
							src: `https:${
								a
									.querySelector('picture img')
									?.getAttribute('data-src') ?? ''
							}`,
							headers: [
								{
									key: 'User-Agent',
									value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
								},
								{ key: 'Referer', value: window.location.href },
							],
						},
						name: a.querySelector('h1')?.textContent ?? '',
					};
				});

				const navElements = Array.from(
					document.querySelectorAll(
						'.page-container[class="page-container"] > ul > li'
					)
				).filter((a) => a.textContent !== '...');
				const currentPageIndex = navElements.findIndex(
					(a) => a.querySelector('a') == null
				);
				const nextNavElements = navElements.filter(
					(_, idx) =>
						idx > currentPageIndex || currentPageIndex === -1
				);
				const nextPage = nextNavElements.find(
					(a) => a.querySelector('a') != undefined
				);
				if (nextPage) {
					return {
						items: results,
						next: nextPage.querySelector('a')?.href ?? null,
					};
				}

				return {
					items: results,
					next: null,
				};
			});
		});
	}

	override async handleManga(mangaId: string): Promise<IMangaResponse> {
		const targetUrl = `${this.baseUrl}${mangaId}`;

		return await withBrowserPage(async (browserPage) => {
			await browserPage.goto(targetUrl, {
				waitUntil: 'networkidle2',
			});

			await browserPage.waitForSelector('.content');

			return await browserPage.evaluate(() => {
				const result: IMangaResponse = {
					share: window.location.href,
					status: EMangaStatus.COMPLETE,
					description: '',
					tags: Array.from(document.querySelectorAll('#tags a')).map(
						(a) => a.textContent ?? ''
					),
					extras: [],
					name:
						document.querySelector('#gallery-brand a')
							?.textContent ?? '',
					cover: {
						src:
							document
								.querySelector('.cover picture img')
								?.getAttribute('src') ?? '',
						headers: [
							{
								key: 'User-Agent',
								value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
							},
							{ key: 'Referer', value: window.location.href },
						],
					},
				};

				return result;
			});
		});
	}

	override async handleChapters(
		_mangaId: string
	): Promise<IChaptersResponse> {
		return [
			{
				id: 'chapter',
				name: 'Chapter',
				released: null,
			},
		];
	}

	override async handleChapter(
		mangaId: string,
		_chapterId: string
	): Promise<IChapterResponse> {
		const targetUrl = `${this.baseUrl}${mangaId}`;

		return await withBrowserPage(async (browserPage) => {
			await browserPage.goto(targetUrl, {
				waitUntil: 'networkidle2',
			});

			await browserPage.waitForSelector('.content');

			const pages: IApiImage[] = [];

			const toVisit = await browserPage.evaluate(() =>
				Array.from(
					document.querySelectorAll(
						'.thumbnail-list .simplePagerPage1 a'
					)
				).map((a) => (a as HTMLAnchorElement).href)
			);

			for (const dest of toVisit) {
				await browserPage.goto(dest);
				const src = await browserPage
					.waitForSelector('#comicImages img')
					.then((a) =>
						a?.getProperty('src').then((b) => b.jsonValue())
					);
				if (src) {
					pages.push(
						makeApiImage(src, {
							'User-Agent':
								'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
							Referer: await browserPage.evaluate(
								() => window.location.href
							),
						})
					);
				}
			}

			return pages;
		});
	}
}

export default function factory() {
	return [new SyosetuSeSource()];
}
