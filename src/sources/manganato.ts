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
// import * as fs from 'fs/promises'
class ManganatoSource extends SourceBase {
	baseUrl: string;
	constructor() {
		super();
		this.baseUrl = 'https://natomanga.com/';
	}

	override get id(): string {
		return 'manganato';
	}

	override get name(): string {
		return 'Manganato';
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
				? `${this.baseUrl}search/story/${encodeURIComponent(
					query.split(' ').join('_')
				)}`
				: this.baseUrl + 'genre/all');

		console.log("Using", searchUrl)
		const dom = html(await fetch(searchUrl).then((a) => a.text()));
		const searchResults: IMangaPreview[] = [];

		if (query) {
			let elements = dom.querySelectorAll('.search-story-item');
			if (elements.length === 0) {
				elements = dom.querySelectorAll('.content-genres-item');
			}

			// await fs.writeFile("tes.html",await fetch(searchUrl).then((a) => a.text()))

			for (const element of elements) {
				const itemId =
					element
						.querySelector('a')
						?.getAttribute('href')
						?.split('/')
						.reverse()
						.slice(0, 2)
						.reverse()
						.join('|') ?? '';

				searchResults.push({
					id: encodeURIComponent(itemId),
					name: element.querySelector('h3')?.textContent.trim() ?? '',
					cover: {
						src:
							element.querySelector('img')?.getAttribute('src') ?? '',
						headers: [],
					},
				});
			}

			const navElements = dom.querySelectorAll('.group-page a').slice(1, -1);
			const currentNavElementIndex = navElements.findIndex(
				(a) =>
					a.classNames.includes('page-select') ||
					a.classNames.includes('page-blue')
			);

			if (currentNavElementIndex !== -1) {
				const nextPageIndex =
					currentNavElementIndex + 1 < navElements.length - 1
						? currentNavElementIndex + 1
						: -1;

				if (nextPageIndex !== -1) {
					return {
						items: searchResults,
						next:
							navElements[nextPageIndex]?.getAttribute('href') ??
							null,
					};
				}
			}

			return {
				items: searchResults,
				next: null,
			};
		}
		else
		{
			let elements = dom.querySelectorAll('.truyen-list .list-truyen-item-wrap');
			// await fs.writeFile("tes.html",await fetch(searchUrl).then((a) => a.text()))
			console.log(dom,elements)
			for (const element of elements) {
				const itemId =
					element
						.querySelector('a')
						?.getAttribute('href')
						?.split('/')
						.reverse()[0] ?? '';

				searchResults.push({
					id: encodeURIComponent(itemId),
					name: element.querySelector('h3 > a')?.textContent.trim() ?? '',
					cover: {
						src:
							element.querySelector('a > img')?.getAttribute('src') ?? '',
						headers: [
							{
								key: "User-Agent",
								value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
							},
							{
								key: "referer",
								value: this.baseUrl
							}
						],
					},
				});
			}

			const navElements = dom.querySelectorAll('.group-page a').slice(1, -1);
			const currentNavElementIndex = navElements.findIndex(
				(a) =>
					a.classNames.includes('page-select') ||
					a.classNames.includes('page-blue')
			);

			if (currentNavElementIndex !== -1) {
				const nextPageIndex =
					currentNavElementIndex + 1 < navElements.length - 1
						? currentNavElementIndex + 1
						: -1;

				if (nextPageIndex !== -1) {
					return {
						items: searchResults,
						next:
							navElements[nextPageIndex]?.getAttribute('href') ??
							null,
					};
				}
			}

			return {
				items: searchResults,
				next: null,
			};
		}
	}

	override async handleManga(mangaId: string): Promise<IMangaResponse> {
		const fetch = (await importFetch()).default;
		const [domain, target] = mangaId.split('|');

		const targetUrl = `https://${domain}/${target}`;
		const dom = html(await fetch(targetUrl).then((a) => a.text()));

		dom.querySelector('.panel-story-info-description h3')?.remove();
		let status = EMangaStatus.UNKNOWN;

		const mangaStatus = dom
			.querySelectorAll('.variations-tableInfo tr')
			.find((a) => a.querySelector('.info-status'))
			?.querySelector('.table-value')
			?.textContent.trim();

		if (mangaStatus === 'Ongoing') {
			status = EMangaStatus.ON_GOING;
		} else if (mangaStatus === 'Complete') {
			status = EMangaStatus.COMPLETE;
		}

		return {
			share: targetUrl,
			name: dom.querySelector('.story-info-right h1')?.text.trim() ?? '',
			cover: {
				src:
					dom.querySelector('.info-image img')?.getAttribute('src') ??
					'',
				headers: [],
			},
			tags: dom
				.querySelectorAll('.story-info-right .table-value .a-h')
				.map((a) => a.textContent.trim()),
			status: status,
			description:
				dom
					.querySelector('.panel-story-info-description')
					?.textContent.trim() ?? '',
			extras: [],
		};
	}

	override async handleChapters(mangaId: string): Promise<IChaptersResponse> {
		const fetch = (await importFetch()).default;
		const [domain, target] = mangaId.split('|');

		const dom = html(
			await fetch(`https://${domain}/${target}`).then((a) => a.text())
		);

		const targetElements = dom.querySelectorAll(
			'.row-content-chapter .a-h'
		);
		const chaptersToSend: IMangaChapter[] = [];
		const allChapters = new Set<string>();
		for (const element of targetElements) {
			const chapterId =
				element
					.querySelector('a')
					?.getAttribute('href')
					?.split('/')
					.reverse()[0] ?? '';
			if (!allChapters.has(chapterId)) {
				chaptersToSend.push({
					id: encodeURIComponent(chapterId),
					name: element.querySelector('a')?.textContent.trim() ?? '',
					released: extractAndFormatDate(
						element.querySelector('.chapter-time.text-nowrap')
							?.textContent ?? ''
					),
				});

				allChapters.add(chapterId);
			}
		}

		return chaptersToSend;
	}

	override async handleChapter(
		mangaId: string,
		chapterId: string
	): Promise<IChapterResponse> {
		const fetch = (await importFetch()).default;
		const [_, target] = mangaId.split('|');
		const htmlText = await fetch(
			`https://chapmanganato.com/${target}/${chapterId}`
		).then((a) => a.text());
		const dom = html(htmlText);

		const chapterElements = dom.querySelectorAll(
			'.container-chapter-reader img'
		);

		return chapterElements.map((a) => {
			return makeApiImage(encodeURI(a.getAttribute('src')!), {
				'User-Agent':
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
				Referer: `https://chapmanganato.com/`,
			});
		});
	}
}

export default function factory() {
	return [new ManganatoSource()];
}
