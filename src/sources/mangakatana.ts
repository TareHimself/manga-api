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
import { extractAndFormatDate, importFetch } from '../utils';
import { withBrowserPage } from '../browser';
// INCOMPLETE
class MangaKatanaSource extends SourceBase {
	baseUrl: string;
	constructor() {
		super();
		this.baseUrl = 'https://mangakatana.com/';
	}

	override get id(): string {
		return 'mangakatana';
	}

	override get name(): string {
		return 'MangaKatana';
	}

	override get nsfw(): boolean {
		return false;
	}

	override async handleSearch(
		query?: string,
		page?: string
	): Promise<ISearchResponse> {
		const fetch = (await importFetch()).default;

		const searchUrl = page || (query ? `${this.baseUrl}?search=${encodeURIComponent(query)}&search_by=book_name` : this.baseUrl)

		const dom = html(await fetch(searchUrl).then((a) => a.text()));

		const searchResults: IMangaPreview[] = [];

		for (const element of dom.querySelectorAll(
			'#wrap_content #book_list .item'
		)) {
			const aTag = element.querySelector('.wrap_img a');
			if (aTag) {
				const itemId = aTag.getAttribute('href') ?? '';
				searchResults.push({
					id: encodeURIComponent(itemId.split('/').reverse()[0] ?? ''),
					name: element.querySelector('.title a')?.textContent.trim() ?? '',
					cover: {
						src: aTag.querySelector('img')?.getAttribute('src') ?? '',
						headers: []
					}
				});
			}
		}

		return {
			items: searchResults,
			next: dom.querySelector('.next.page-numbers')?.getAttribute('href') ?? null,
		};
	}

	override async handleManga(mangaId: string): Promise<IMangaResponse> {
		const fetch = (await importFetch()).default;

		const targetUrl = `${this.baseUrl}manga/${mangaId}`

		const dom = html(
			await fetch(targetUrl).then((a) => a.text())
		);

		const statusString = dom.querySelector('.d-cell-small.value.status')?.textContent ?? ''
		return {
			share: targetUrl,
			name: dom.querySelector('.info .heading')?.textContent.trim() ?? '',
			cover: {
				src: dom
				.querySelector('.cover img')
				?.getAttribute('src') ?? '',
				headers: []
			},
			tags: dom.querySelectorAll('.d-cell-small.value .genres a')?.map(a => a.textContent.trim()) ?? [],
			status: statusString === 'Ongoing' ? EMangaStatus.ON_GOING : statusString === 'Complete' ? EMangaStatus.COMPLETE : EMangaStatus.UNKNOWN,
			description:
				dom
					.querySelector('.summary p')?.textContent.trim() ?? '',
			extras: [],
		};
	}

	override async handleChapters(mangaId: string): Promise<IChaptersResponse> {
		const fetch = (await importFetch()).default;

		const dom = html(
			await fetch(`${this.baseUrl}manga/${mangaId}`).then((a) => a.text())
		);

		const targetElements = dom.querySelectorAll(
			'.chapters tr'
		);

		const chaptersToSend: IMangaChapter[] = [];
		for (const element of targetElements) {
			const aTag = element.querySelector('a');
			if(aTag){
				chaptersToSend.push({
					id: encodeURIComponent(aTag.getAttribute('href')?.split('/').reverse()[0] ?? ''),
					name: aTag.textContent.trim(),
					released: extractAndFormatDate(element.querySelector('.update_time')?.textContent ?? '')

				});
			}
		}

		return chaptersToSend;
	}

	override async handleChapter(
		mangaId: string,
		chapterId: string
	): Promise<IChapterResponse> {
		const targetUri = `${this.baseUrl}manga/${mangaId}/${chapterId}`;

		return await withBrowserPage(async (page)=>{
			await page.goto(targetUri,{
				waitUntil: 'networkidle2'
			})

			return page.evaluate(()=>{
				return Array.from(document.querySelectorAll('#imgs img')).map(a => ({
					src: a.getAttribute('data-src') ?? '',
					headers: []
				}))
			})
		})
	}
}

export default function factory() {
	return [new MangaKatanaSource()]
}
