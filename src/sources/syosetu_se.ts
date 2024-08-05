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

class SyosetuSeSource extends SourceBase {
	baseUrl: string;
	constructor() {
		super();
		this.baseUrl = 'https://syosetu.se/';
	}

	override get id(): string {
		return 'syosetu-se';
	}

	override get name(): string {
		return 'Syosetu';
	}

	override get nsfw(): boolean {
		return false;
	}

	override async handleSearch(
		query?: string,
		page?: string
	): Promise<ISearchResponse> {
		const fetch = (await importFetch()).default;

		const searchUrl = page || (query ? `${this.baseUrl}?s=${query.trim().split(' ').join('+')}` : this.baseUrl)

		console.log(searchUrl)

		const dom = html(await fetch(searchUrl).then((a) => a.text()));

		const searchResults: IMangaPreview[] = [];

		for (const element of (query ? dom.querySelectorAll('.side-book-item') : dom.querySelectorAll(
			'.side-feature-banner-item.side-feature-banner-item-four'
		))) {
			const aTag = element.querySelector('a');
			if (aTag) {
				const itemId = aTag.getAttribute('href') ?? '';
				searchResults.push({
					id: encodeURIComponent(itemId.slice(1, itemId.length - 1)),
					name: aTag.getAttribute('title') ?? '',
					cover: {
						src: this.baseUrl +
						aTag
							.querySelector('img')
							?.getAttribute('data-src') ?? '',
							headers: []
					}
						,
				});
			}
		}

		const navElements = dom
			.querySelectorAll('.slick-slide')
			.filter(
				(a) => a.querySelector('a')?.getAttribute('title') !== undefined
			);

		const currentNavIndex = navElements.findIndex((a) =>
			a.classNames.includes('slick-current')
		);

		if (
			currentNavIndex !== -1 &&
			currentNavIndex + 1 < navElements.length
		) {
			return {
				items: searchResults,
				next:
					navElements[currentNavIndex + 1]
						?.querySelector('a')
						?.getAttribute('href') ?? null,
			};
		}

		return {
			items: searchResults,
			next: null,
		};
	}

	override async handleManga(mangaId: string): Promise<IMangaResponse> {
		const fetch = (await importFetch()).default;

		const targetUrl = `${this.baseUrl}${mangaId}`
		const dom = html(
			await fetch(targetUrl).then((a) => a.text())
		);

		return {
			share: targetUrl,
			name: dom.querySelector('.detail-header-title')?.text.trim() ?? '',
			cover: makeApiImage(`${this.baseUrl}${
				dom
					.querySelector('.detail-header-image img')
					?.getAttribute('src') ?? ''
			}`),
			tags: [],
			status: EMangaStatus.UNKNOWN,
			description:
				dom
					.querySelector('.detail-description')
					?.childNodes[2]?.textContent.trim() ?? '',
			extras: [],
		};
	}

	override async handleChapters(mangaId: string): Promise<IChaptersResponse> {
		const fetch = (await importFetch()).default;

		const dom = html(
			await fetch(`${this.baseUrl}${mangaId}`).then((a) => a.text())
		);

		const targetElements = dom.querySelectorAll(
			'.side-episode-list .side-episode-item'
		);
		const chaptersToSend: IMangaChapter[] = [];
		for (const element of targetElements) {
			const chapterId =
				(element.querySelector('a')?.getAttribute('href') ?? '')
					.split('/')
					.reverse()[1] ?? '';
			chaptersToSend.push({
				id: encodeURIComponent(chapterId),
				name:
					element.querySelector('.side-episode-title')?.textContent ??
					'',
				released: extractAndFormatDate(element.querySelector('.side-episode-date')?.textContent ?? '')
					// element
					// 	.querySelector('.side-episode-date')
					// 	?.text.split('/')
					// 	.join('-') ?? null,
			});
		}

		return chaptersToSend;
	}

	override async handleChapter(
		_mangaId: string,
		chapterId: string
	): Promise<IChapterResponse> {
		const fetch = (await importFetch()).default;

		const targetUri = `${this.baseUrl}chapters/${chapterId}/`;
		const dom = html(await fetch(targetUri).then((a) => a.text()));

		const chapterElements = dom.querySelectorAll(
			'.container-chapter-reader .card-wrap img'
		);

		return chapterElements.map((a) => {
			return makeApiImage(a.getAttribute('data-src')!,{
				'User-Agent':
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
				Referer: this.baseUrl,
			})
		});
		
	}
}

export default function factory() {
	return [new SyosetuSeSource()];
}
