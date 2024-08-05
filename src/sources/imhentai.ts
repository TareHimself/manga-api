import SourceBase from '../source';
import html from 'node-html-parser';
import {
	ISearchResponse,
	IMangaResponse,
	IChaptersResponse,
	IChapterResponse,
	IMangaPreview,
	EMangaStatus,
} from '../types';
import { importFetch } from '../utils';

class imHentaiSource extends SourceBase {
	baseUrl: string;
	constructor() {
		super();
		this.baseUrl = 'https://imhentai.xxx/';
	}

	override get id(): string {
		return 'imhentai-xxx';
	}

	override get name(): string {
		return 'imHentai';
	}

	override get nsfw(): boolean {
		return true;
	}

	override async handleSearch(
		query?: string,
		page?: string
	): Promise<ISearchResponse> {
		const fetch = (await importFetch()).default;

		const searchUrl =
			page ||
			(query
				? `${this.baseUrl}search/?key=${encodeURIComponent(query)}`
				: this.baseUrl);

		const dom = html(await fetch(searchUrl).then((a) => a.text()));

		const searchResults: IMangaPreview[] = [];

		for (const element of dom.querySelectorAll('.thumb .thumbnail')) {
			const imgElement = element.querySelector('.inner_thumb a img');
			searchResults.push({
				id: encodeURIComponent(
					element
						.querySelector('.inner_thumb a')
						?.getAttribute('href')
						?.split('/')
						.reverse()[1] ?? ''
				),
				name:
					element.querySelector('.caption a')?.textContent.trim() ??
					'',
				cover:
					{
						src: (imgElement?.getAttribute('data-src') ||
						imgElement?.getAttribute('src')) ??
					'',
					headers: []
					}
			});
		}

		const navElements = dom.querySelectorAll('.pagination .page-item');

		const currentNavIndex = navElements.findIndex((a) =>
			a.classNames.includes('active')
		);

		if (
			currentNavIndex !== -1 &&
			currentNavIndex + 1 < navElements.length &&
			!isNaN(
				parseInt(
					navElements[currentNavIndex + 1]
						?.querySelector('a')
						?.textContent.trim() ?? ''
				)
			)
		) {
			return {
				items: searchResults,
				next: `https:${
					navElements[currentNavIndex + 1]
						?.querySelector('a')
						?.getAttribute('href') ?? ''
				}`,
			};
		}

		return {
			items: searchResults,
			next: null,
		};
	}

	override async handleManga(mangaId: string): Promise<IMangaResponse> {
		const fetch = (await importFetch()).default;

		const dom = html(
			await fetch(`${this.baseUrl}gallery/${mangaId}`).then((a) =>
				a.text()
			)
		);

		const targetElement = dom.querySelector(
			'.container .row.gallery_first'
		);
		Array.from(dom.querySelectorAll('.tag .badge')).forEach((a) =>
			a.remove()
		);

		const result: IMangaResponse = {
			share: `${this.baseUrl}gallery/${mangaId}`,
			name:
				targetElement
					?.querySelector(
						'.col-md-7.col-sm-7.col-lg-8.right_details h1'
					)
					?.textContent.trim() ?? '',
			cover: {
				src: targetElement
				?.querySelector('.left_cover img')
				?.getAttribute('data-src')
				?.trim() ?? '',
				headers: []
			},
			tags:
				dom
					.querySelectorAll('.galleries_info li')
					.filter((a) =>
						['artists:', 'tags:', 'characters:'].some((c) =>
							a.textContent?.toLowerCase().includes(c)
						)
					)
					?.map((b) =>
						b
							.querySelectorAll('.tag')
							?.map((a) =>
								a.textContent
									.trim()
									.split('|')
									.map((b) => b.trim())
							)
							.reduce((t, c) => [...t, ...c], [])
					)
					.reduce((t, c) => [...t, ...c], []) ?? [],
			status: EMangaStatus.COMPLETE,
			description: '',
			extras: [
				{
					name: 'Pages',
					value:
						targetElement
							?.querySelector('.pages')
							?.textContent.trim()
							.split(':')[1]
							?.trim() ?? 'IDK',
				},
			],
		};

		const artists =
			dom
				.querySelectorAll('.galleries_info li')
				.find((a) => a.textContent?.toLowerCase().includes('artists:'))
				?.querySelectorAll('.tag')
				?.map((a) =>
					a.textContent
						.trim()
						.split('|')
						.map((b) => b.trim())
				)
				.reduce((t, c) => [...t, ...c], []) ?? [];

		if (artists.length > 0) {
			result.extras.unshift({
				name: 'Artists',
				value: artists.join(' , '),
			});
		}

		return result;
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
		const fetch = (await importFetch()).default;

		const dom = html(
			await fetch(`${this.baseUrl}gallery/${mangaId}`).then((a) =>
				a.text()
			)
		);

		const numPages = parseInt(
			dom
				.querySelector('.container .row.gallery_first .pages')
				?.textContent.trim()
				.split(':')[1]
				?.trim() ?? '0'
		);

		if (numPages === 0) {
			return [];
		}

		const pageExample =
			dom
				.querySelector('#append_thumbs .gallery_th .gthumb a img')
				?.getAttribute('data-src') ?? '';
		const pageExampleArr = pageExample.split('/');
		const pageExt = [...pageExampleArr]
			.reverse()
			.filter((a) => a.trim().length !== 0)[0]
			?.split('.')[1];
		const pagesPrefix = pageExampleArr.slice(undefined, -1).join('/');

		const pages: IChapterResponse = [];

		for (let i = 1; i < numPages + 1; i++) {
			pages.push({
				src: encodeURI(`${pagesPrefix}/${i}.${pageExt}`),
				headers: [],
			});
		}

		return pages;
	}
}

export default function factory() {
	return [new imHentaiSource()];
}
