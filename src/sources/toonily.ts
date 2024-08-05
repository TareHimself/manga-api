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

class ToonlySource extends SourceBase {
	baseUrl: string;
	isNsfw: boolean;

	constructor(isNsfw: boolean) {
		super();
		this.baseUrl = 'https://toonily.com/';
		this.isNsfw = isNsfw;
	}

	override get id(): string {
		return `toonily${this.isNsfw ? '-18' : ''}`;
	}

	override get name(): string {
		return `Toonily${this.isNsfw ? ' 18+' : ''}`;
	}

	override get nsfw(): boolean {
		return this.isNsfw;
	}

	override async handleSearch(
		query?: string,
		page?: string
	): Promise<ISearchResponse> {
		const fetch = (await importFetch()).default;

		const searchUrl = page
			? page
			: query
			? `${this.baseUrl}search/${query.split(' ').join('-')}`
			: this.baseUrl;

		const dom = html(
			await fetch(searchUrl, {
				headers: this.nsfw
					? {
							Cookie: 'toonily-mature=1',
					  }
					: {},
			}).then((a) => a.text())
		);

		const searchResults: IMangaPreview[] = [];

		for (const element of dom.querySelectorAll(
			'.page-listing-item .page-item-detail.manga'
		)) {
			const aTag = element.querySelector('a');
			const itemId =
				aTag
					?.getAttribute('href')
					?.split('/')
					.reverse()
					.filter((a) => a.trim().length !== 0)[0] ?? '';
			searchResults.push({
				id: encodeURIComponent(itemId),
				name: aTag?.getAttribute('title') ?? '',
				cover: {
					src: element.querySelector('img')?.getAttribute('data-src') ??
					'',
					headers: []
				},
			});
		}

		const nextNavAddress = dom
			.querySelector('.wp-pagenavi .nextpostslink')
			?.getAttribute('href')
			?.trim();

		return {
			items: searchResults,
			next: nextNavAddress ? nextNavAddress : null,
		};
	}

	override async handleManga(mangaId: string): Promise<IMangaResponse> {
		const fetch = (await importFetch()).default;

		const searchUrl = `${this.baseUrl}webtoon/${mangaId}/`
		const dom = html(
			await fetch(searchUrl).then((a) =>
				a.text()
			)
		);
		const originalStatus =
			dom
				.querySelectorAll('.post-status .post-content_item')
				.find(
					(a) =>
						a
							.querySelector('.summary-heading h5')
							?.textContent.trim()
							.toLowerCase() === 'status'
				)
				?.querySelector('.summary-content')
				?.textContent.trim() ?? '';

		return {
			share: `${this.baseUrl}webtoon/${mangaId}/`,
			name: dom.querySelector('.post-title')?.textContent.trim() ?? '',
			cover: {
				src: dom
				.querySelector('.summary_image img')
				?.getAttribute('data-src') ?? '',
				headers: []
			},
			tags: dom
				.querySelectorAll('.genres-content a')
				.map((a) => a.textContent.trim()),
			status:
				originalStatus === 'OnGoing'
					? EMangaStatus.ON_GOING
					: originalStatus === 'Complete'
					? EMangaStatus.COMPLETE
					: EMangaStatus.UNKNOWN,
			description:
				dom
					.querySelector('.description-summary .summary__content')
					?.textContent.trim() ?? '',
			extras: [],
		};
	}

	override async handleChapters(mangaId: string): Promise<IChaptersResponse> {
		const fetch = (await importFetch()).default;

		const dom = html(
			await fetch(`${this.baseUrl}webtoon/${mangaId}/`).then((a) =>
				a.text()
			)
		);

		const targetElements = dom.querySelectorAll('.wp-manga-chapter');
		const chaptersToSend: IMangaChapter[] = [];
		for (const element of targetElements) {
			const chapterId =
				(element.querySelector('a')?.getAttribute('href') ?? '')
					.split('/')
					.reverse()
					.filter((a) => a.trim().length !== 0)[0] ?? '';

			chaptersToSend.push({
				id: encodeURIComponent(chapterId),
				name: element.querySelector('a')?.textContent.trim() ?? '',
				released: extractAndFormatDate(
					element
						.querySelector('.chapter-release-date')
						?.textContent.trim() ?? ''
				),
			});
		}

		return chaptersToSend;
	}

	override async handleChapter(
		mangaId: string,
		chapterId: string
	): Promise<IChapterResponse> {
		const fetch = (await importFetch()).default;

		const targetUri = `${this.baseUrl}webtoon/${mangaId}/${chapterId}/`;
		const dom = html(await fetch(targetUri).then((a) => a.text()));

		const chapterElements = dom.querySelectorAll('.reading-content img');

		return chapterElements.map((a, idx) => {
			const url = a.getAttribute('data-src')?.trim();

			if (!url) {
				throw new Error(
					`Missing url for page ${targetUri} at index ${idx}`
				);
			}

			return makeApiImage(url,{
				'User-Agent':
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
				Referer: this.baseUrl,
			})
		});
	}
}

export default function factory() {
	return [new ToonlySource(false), new ToonlySource(true)];
}
