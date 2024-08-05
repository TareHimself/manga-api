import { withBrowserPage } from '../browser';
import SourceBase from '../source';
import {
	ISearchResponse,
	IMangaResponse,
	IChaptersResponse,
	IChapterResponse,
	IMangaPreview,
	EMangaStatus,
} from '../types';

class nHentaiSource extends SourceBase {
	baseUrl: string;
	englishOnly: boolean;
	constructor(isEnglishOnly: boolean) {
		super();
		this.englishOnly = isEnglishOnly;
		this.baseUrl = 'https://nhentai.com/';
	}

	override get id(): string {
		return `nhentai-com${this.englishOnly ? '-en' : '-multi'}`;
	}

	override get name(): string {
		return `nHentai.com${this.englishOnly ? ' (English)' : ' (Multi)'}`;
	}

	override get nsfw(): boolean {
		return true;
	}

	override async handleSearch(
		query?: string,
		page?: string
	): Promise<ISearchResponse> {
		let searchUrl =
			page ||
			`${this.baseUrl}en/latest?page=1&q=${encodeURIComponent(
				query ?? ''
			)}&sort=uploaded_at&order=desc${
				this.englishOnly ? '&languages=2' : ''
			}&duration=day`;

		return await withBrowserPage(async (browserPage) => {
			await browserPage.goto(searchUrl, {
				waitUntil: 'networkidle0',
			});

			return await browserPage.evaluate(async () => {
				const elements = Array.from(
					document.querySelectorAll(
						'.container .row.my-3 .col-6.col-sm-4.col-md-3.col-lg-2.p-3'
					)
				);

				const results: IMangaPreview[] = [];

				for (const element of elements) {
					results.push({
						id:
							encodeURIComponent(element
								.querySelector('a')
								?.getAttribute('href')
								?.split('/')
								.reverse()[0] ?? ''),
						name:
							element
								.querySelector('.title')
								?.getAttribute('title')
								?.trim() ?? '',
						cover:
							{
								src: element
								.querySelector('div[role="img"]')
								?.getAttribute('style')
								?.split('"')
								.reverse()[1]
								?.trim() ?? '',
								headers: []
							}
					});
				}

				const searchParams = new URLSearchParams(
					document.location.search
				);
				const currentPage = parseInt(searchParams.get('page') ?? '-1');

				if (currentPage != -1) {
					const hasNextPage =
						Array.from(
							document.querySelectorAll('.pagination .page-link')
						)
							.reverse()[1]
							?.className.includes('disabled') === false;
					if (hasNextPage) {
						searchParams.set('page', `${currentPage + 1}`);
						return {
							items: results,
							next:
								document.location.origin +
								document.location.pathname +
								'?' +
								searchParams.toString(),
						};
					} else {
						return {
							items: results,
							next: null,
						};
					}
				}

				return {
					items: results,
					next: null,
				};
			});
		});
	}

	override async handleManga(mangaId: string): Promise<IMangaResponse> {
		return await withBrowserPage(async (browserPage) => {
			await browserPage.goto(`${this.baseUrl}en/comic/${mangaId}/`, {
				waitUntil: 'networkidle0',
			});

			return await browserPage.evaluate(async (baseUrl,mangaId) => {
				const result: IMangaResponse = {
					share: `${baseUrl}en/comic/${mangaId}/`,
					status: EMangaStatus.COMPLETE,
					description: '',
					tags: Array.from(
						document.querySelectorAll('.tag-link')
					).map((a) => a.textContent?.trim() ?? ''),
					extras: [],
					name:
						document
							.querySelector('.comic-title')
							?.textContent?.trim() ?? '',
					cover:
						{
							src: document
							.querySelector('.comic-image.my-4 img')
							?.getAttribute('src') ?? '',headers: []
						}
				};

				return result;
			},this.baseUrl,mangaId);
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
		return await withBrowserPage(async (browserPage) => {
			await browserPage.goto(
				`${this.baseUrl}en/comic/${mangaId}/reader`,
				{
					waitUntil: 'networkidle0',
				}
			);

			return await browserPage.evaluate(() => {
				return Array.from(
					document.querySelectorAll('.vertical-image img')
				).map((a) => ({
					src: encodeURI(a.getAttribute('data-src') ?? ''),
					headers: [],
				}));
			});
		});
	}
}

export default function factory() {
	return [new nHentaiSource(false), new nHentaiSource(true)];
}
