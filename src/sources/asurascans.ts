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
import { extractAndFormatDate,importFetch, makeApiImage } from '../utils';

class AsuraScansSource extends SourceBase {
	baseUrl: string;
	constructor() {
		super();
		this.baseUrl = 'https://asura.nacm.xyz/';
	}

	override get id(): string {
		return 'asurascans';
	}

	override get name(): string {
		return 'Asura Scans';
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
				? `${this.baseUrl}?s=${query.split(' ').join('+')}`
				: this.baseUrl + 'manga/?order=update');

		console.log(searchUrl)
		const dom = html(await fetch(searchUrl).then((a) => a.text()));

		const searchResults: IMangaPreview[] = [];

		const elements = dom.querySelectorAll('.listupd .bs .bsx a');

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
				cover: makeApiImage(element.querySelector('img')?.getAttribute('src') ?? '',{
					Referer: searchUrl,
					"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"
				})
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
					next: target ? `${this.baseUrl}manga/${target}` : null,
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

		const targetUrl = `${this.baseUrl}manga/${mangaId}`
		const dom = html(
			await fetch(`${this.baseUrl}manga/${mangaId}`).then((a) =>
				a.text()
			)
		);

		let status = EMangaStatus.UNKNOWN;

		const mangaStatus = dom
			.querySelectorAll('.tsinfo .imptdt')
			.find((a) => a.textContent.trim().toLowerCase().includes('status'))
			?.querySelector('i')
			?.textContent.trim();

		if (mangaStatus === 'Ongoing') {
			status = EMangaStatus.ON_GOING;
		} else if (mangaStatus === 'Complete') {
			status = EMangaStatus.COMPLETE;
		}
		return {
			share: `${this.baseUrl}manga/${mangaId}`,
			name: dom.querySelector('.entry-title')?.textContent.trim() ?? '',
			cover: makeApiImage( dom.querySelector('.thumb img')?.getAttribute('src') ?? '',{
				Referer: targetUrl,
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"
			}),
			tags: dom
				.querySelectorAll(".wd-full .mgen a[rel='tag']")
				.map((a) => a.textContent.trim()),
			status: status,
			description:
				dom
					.querySelector(`div[itemprop="description"]`)
					?.textContent.trim() ?? '',
			extras: [],
		};
	}

	override async handleChapters(mangaId: string): Promise<IChaptersResponse> {
		const fetch = (await importFetch()).default;

		const dom = html(
			await fetch(`${this.baseUrl}manga/${mangaId}`).then((a) =>
				a.text()
			)
		);
		

		console.log(`${this.baseUrl}manga/${mangaId}`);

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

		const targetUrl = `${this.baseUrl}${chapterId}`
		const dom = html(
			await fetch(targetUrl).then((a) => a.text())
		);

		const chapterElements = dom.querySelectorAll('#readerarea img');

		return chapterElements.map((a) => makeApiImage(encodeURI(a.getAttribute('src')!),{
			Referer: targetUrl,
			"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"
		}));
	}
}

export default function factory() {
	return []
	return [new AsuraScansSource()]; //Possible rotating manga id's thing
	
}