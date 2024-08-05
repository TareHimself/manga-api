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

class FlameScansSource extends SourceBase {
	baseUrl: string;
	constructor() {
		super();
		this.baseUrl = 'https://flamescans.org/';
	}

	override get id(): string {
		return 'flamescans';
	}

	override get name(): string {
		return 'Flame Scans';
	}

	override get nsfw(): boolean {
		return false;
	}

	override async handleSearch(
		query?: string,
		page?: string
	): Promise<ISearchResponse> {
		const fetch = (await importFetch()).default;

		const searchUrl = page
			? page
			: query
			? `${this.baseUrl}?s=${encodeURIComponent(query)}`
			: this.baseUrl + 'series/?order=update';

		const dom = html(await fetch(searchUrl).then((a) => a.text()));

		const searchResults: IMangaPreview[] = [];

		const elements = dom.querySelectorAll('.listupd a');

		for (const element of elements) {
			const itemId =
				element
					.getAttribute('href')
					?.split('/')
					.filter((a) => a.trim().length !== 0)
					.reverse()[0] ?? '';

			searchResults.push({
				id: encodeURIComponent(itemId),
				name: element.querySelector('.tt')?.textContent.trim() ?? '',
				cover: {
					src: element.querySelector('img')?.getAttribute('src') ?? '',
					headers: []
				}
			});
		}

		let navElement = dom.querySelector('.pagination .next.page-numbers');

		if (navElement) {
			return {
				items: searchResults,
				next: navElement.getAttribute('href') ?? null,
			};
		}

		if (!navElement) {
			navElement = dom.querySelector('.hpage .r');
			if (navElement) {
				const target = navElement.getAttribute('href');
				return {
					items: searchResults,
					next: target ? `${this.baseUrl}series/${target}` : null,
				};
			}
		}

		return {
			items: searchResults,
			next: null,
		};
	}

	override async handleManga(mangaId: string): Promise<IMangaResponse> {
		const fetch = (await importFetch()).default;

		const dom = html(
			await fetch(`${this.baseUrl}series/${mangaId}`).then((a) =>
				a.text()
			)
		);

		let status = EMangaStatus.UNKNOWN;

		const mangaStatus = dom
			.querySelectorAll('.tsinfo.bixbox .imptdt')
			.find((a) => a.querySelector('h1')?.textContent.trim() === 'Status')
			?.querySelector('i')
			?.textContent.trim();

		if (mangaStatus === 'Ongoing') {
			status = EMangaStatus.ON_GOING;
		} else if (mangaStatus === 'Complete') {
			status = EMangaStatus.COMPLETE;
		}
		return {
			share: `${this.baseUrl}series/${mangaId}`,
			name: dom.querySelector('.entry-title')?.textContent.trim() ?? '',
			cover: {
				src: dom.querySelector('.thumb img')?.getAttribute('src') ?? '',
				headers: []
			},
			tags: dom
				.querySelectorAll('.genres-container .mgen a')
				.map((a) => a.textContent.trim()),
			status: status,
			description:
				dom
					.querySelector(
						'.summary .entry-content.entry-content-single'
					)
					?.textContent.trim() ?? '',
			extras: [],
		};
	}

	override async handleChapters(mangaId: string): Promise<IChaptersResponse> {
		const fetch = (await importFetch()).default;

		const dom = html(
			await fetch(`${this.baseUrl}series/${mangaId}`).then((a) =>
				a.text()
			)
		);

		const targetElements = dom.querySelectorAll('#chapterlist ul li');
		const chaptersToSend: IMangaChapter[] = [];

		for (const element of targetElements) {
			const chapterId =
				element
					.querySelector('a')
					?.getAttribute('href')
					?.split('/')
					.filter((a) => a.trim().length > 0)
					.reverse()[0] ?? '';
			const chapterName =
				element
					.querySelector('.chapternum')
					?.textContent.trim()
					.replaceAll('\n', ' ') ?? '';
			const chapterDate =
				element.querySelector('.chapterdate')?.textContent.trim() ?? '';

			chaptersToSend.push({
				id: encodeURIComponent(chapterId),
				name: chapterName,
				released: extractAndFormatDate(chapterDate),
			});
		}

		return chaptersToSend;
	}

	override async handleChapter(
		_mangaId: string,
		chapterId: string
	): Promise<IChapterResponse> {
		const fetch = (await importFetch()).default;

		const dom = html(
			await fetch(`${this.baseUrl}${chapterId}`).then((a) => a.text())
		);

		const chapterElements = dom.querySelectorAll('#readerarea img');

		return chapterElements.map((a) => makeApiImage(encodeURI(a.getAttribute('src')!)));
	}
}

export default function factory() {
	return [] // Flamescans website currently offline
	return [new FlameScansSource()];
}
