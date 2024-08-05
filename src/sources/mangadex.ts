import SourceBase from '../source';
import {
	ISearchResponse,
	IMangaResponse,
	IChaptersResponse,
	IMangaPreview,
	EMangaStatus,
	IMangaChapter,
	IChapterResponse,
} from '../types';
import { extractAndFormatDate, importFetch } from '../utils';

interface IMangaDexTags {
	id: string;
	type: 'tag';
	attributes: {
		name: Record<string, string>;
		description: Record<string, string>;
		group: string;
		version: number;
	};
}
type IMangaDexRelationship = {
	id: string;
} & (
	| { type: 'author' | 'artist' | 'creator' }
	| {
			type: 'cover_art';
			attributes: {
				description: string;
				volume: number;
				fileName: string;
				locale: string;
				createdAt: string;
				updatedAt: string;
				version: number;
			};
	  }
);

interface IMangaDexMangaAttributes {
	title: Record<string, string>;
	altTitles: Record<string, string>[];
	description: Record<string, string>;
	status: string;
	tags: IMangaDexTags[];
}

interface IMangaDexManga {
	id: string;
	type: 'manga';
	attributes: IMangaDexMangaAttributes;
	relationships: IMangaDexRelationship[];
}

interface IMangaDexChapter {
	id: string;
	type: 'chapter';
	attributes: {
		volume: string | null;
		chapter: string;
		title: string | null;
		translatedLanguage: string;
		externalUrl: string | null;
		publishAt: string;
		readableAt: string;
		createdAt: string;
		updatedAt: string;
		pages: number;
		version: number;
	};
	relationships: (
		| {
				id: string;
				type: 'scanlation_group';
				attributes: {
					name: string;
				};
		  }
		| {
				id: string;
				type: 'manga';
		  }
		| {
				id: string;
				type: 'user';
		  }
	)[];
}

interface IMangaDexResponseError {
	id: string;
	status: 0;
	title: string;
	detail: string;
	context: string;
}

type IMangaDexResponse<T> =
	| {
			result: 'ok';
			data: T;
	  }
	| {
			result: 'error';
			data: IMangaDexResponseError[];
	  };

type IMangaDexPagesResponse =
	| {
			result: 'ok';
			baseUrl: string;
			chapter: {
				hash: string;
				data: string[];
				dataSaver: string[];
			};
			response: string;
	  }
	| {
			result: 'error';
			data: IMangaDexResponseError[];
	  };

type IMangaDexStandardResponse<T> = IMangaDexResponse<T> & {};

type IMangaDexSearchResponse = IMangaDexStandardResponse<IMangaDexManga[]> & {
	limit: number;
	offset: number;
	total: number;
};

type IMangaDexMangaResponse = IMangaDexStandardResponse<IMangaDexManga>;

type IMangaDexChaptersResponse = IMangaDexStandardResponse<
	IMangaDexChapter[]
> & {
	limit: number;
	offset: number;
	total: number;
};

class MangaDexSource extends SourceBase {
	apiBaseUrl: string;
	mangaCache: Map<string, IMangaDexManga>;
	searchLimit: number;

	constructor() {
		super();
		this.apiBaseUrl = 'https://api.mangadex.org/';
		this.mangaCache = new Map();
		this.searchLimit = 30;
	}

	override get id(): string {
		return 'mangadex';
	}

	override get name(): string {
		return 'MangaDex';
	}

	override get nsfw(): boolean {
		return false;
	}

	getMangaCover(manga: IMangaDexManga) {
		const targetRelationship = manga.relationships.find(
			(a) => a.type === 'cover_art'
		);

		if (targetRelationship && targetRelationship.type === 'cover_art') {
			return `https://uploads.mangadex.org/covers/${manga.id}/${targetRelationship.attributes.fileName}`;
		}

		return '';
	}

	getMangaName(manga: IMangaDexManga) {
		return Object.values(manga.attributes.title)[0] ?? '';
	}

	getDescription(manga: IMangaDexManga) {
		return Object.values(manga.attributes.description)[0] ?? '';
	}

	getMangaStatus(manga: IMangaDexManga) {
		if (manga.attributes.status === 'completed') {
			return EMangaStatus.COMPLETE;
		} else if (manga.attributes.status === 'ongoing') {
			return EMangaStatus.ON_GOING;
		}

		return EMangaStatus.UNKNOWN;
	}
	override async handleSearch(
		query?: string,
		page?: string
	): Promise<ISearchResponse> {
		const fetch = (await importFetch()).default;

		const searchUrl =
			page ||
			`${
				this.apiBaseUrl
			}manga?includes[]=cover_art&includes[]=tag&limit=${
				this.searchLimit
			}${query ? '&title=' + encodeURIComponent(query) : ''}`;

		const apiResponse = await fetch(searchUrl)
			.then((a) => a.json()).catch((e) => {
				console.log("Mangadex Api Error",e)
			})
			.then((a) => a as IMangaDexSearchResponse);

		if (apiResponse.result === 'error') {
			throw new Error(
				`MangaDex Api Error ${apiResponse.data.toString()}`
			);
		}

		const searchResults: IMangaPreview[] = [];

		for (const result of apiResponse.data) {
			searchResults.push({
				id: encodeURIComponent(result.id),
				name: this.getMangaName(result),
				cover: {
					src: this.getMangaCover(result),
					headers: [],
				},
			});
			this.mangaCache.set(result.id, result);
		}

		return {
			items: searchResults,
			next: (() => {
				if (
					apiResponse.limit + apiResponse.offset <
					apiResponse.total
				) {
					const currentParams = new URLSearchParams(
						decodeURIComponent(encodeURI(searchUrl).split('?')[1]!)
					);
					currentParams.set(
						'offset',
						(apiResponse.offset + apiResponse.limit).toString()
					);
					return `${
						this.apiBaseUrl
					}manga?${currentParams.toString()}`;
				} else {
					return null;
				}
			})(),
		};
	}

	override async handleManga(mangaId: string): Promise<IMangaResponse> {
		let existing = this.mangaCache.get(mangaId);

		if (!existing) {
			const fetch = (await importFetch()).default;

			const apiResponse = await fetch(
				`${this.apiBaseUrl}manga/${mangaId}?includes[]=cover_art&includes[]=tag`
			)
				.then((a) => a.json())
				.then((a) => a as IMangaDexMangaResponse);

			if (apiResponse.result === 'error') {
				throw new Error(
					`MangaDex Api Error ${apiResponse.data.toString()}`
				);
			}

			this.mangaCache.set(apiResponse.data.id, apiResponse.data);

			existing = apiResponse.data;
		}

		return {
			share: `https://mangadex.org/title/${mangaId}`,
			status: this.getMangaStatus(existing),
			name: this.getMangaName(existing),
			cover: {
				src: this.getMangaCover(existing),
				headers: [],
			},
			description: this.getDescription(existing),
			tags: existing.attributes.tags
				.map((a) => Object.values(a.attributes.name)[0]?.trim() ?? '')
				.filter((a) => a.length !== 0),
			extras: [],
		};
	}

	async getAllMangaChapters(
		mangaId: string,
		offset: number = 0
	): Promise<IMangaDexChapter[]> {
		const fetch = (await importFetch()).default;

		const response = await fetch(
			`${this.apiBaseUrl}/manga/${mangaId}/feed?includes[]=scanlation_group&translatedLanguage[]=en&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic&order[chapter]=desc&limit=500&offset=${offset}`
		)
			.then((a) => a.json())
			.then((a) => a as IMangaDexChaptersResponse);

		if (response.result === 'error') {
			throw new Error(`MangaDex Api Error ${response.data.toString()}`);
		}

		if (response.limit + response.offset < response.total) {
			return [
				...response.data,
				...(await this.getAllMangaChapters(
					mangaId,
					Math.min(
						response.total - (response.limit + response.offset),
						500
					)
				)),
			];
		}

		return response.data;
	}

	override async handleChapters(mangaId: string): Promise<IChaptersResponse> {
		const chaptersFetched = await this.getAllMangaChapters(mangaId);

		const chaptersToSend: IMangaChapter[] = [];
		const chaptersProcessed = new Set<string>();
		for (const chapter of chaptersFetched) {
			if (chaptersProcessed.has(chapter.attributes.chapter)) {
				continue;
			}

			let id = '';

			if (new Date(chapter.attributes.publishAt) > new Date()) {
				if (chapter.attributes.externalUrl) {
					id = encodeURIComponent(chapter.attributes.externalUrl);
				} else {
					continue;
				}
			} else {
				id = encodeURIComponent(chapter.id);
			}

			chaptersToSend.push({
				id: id,
				name:
					chapter.attributes.title ||
					`Chapter ${chapter.attributes.chapter}`,
				released: extractAndFormatDate(chapter.attributes.readableAt),
			});

			chaptersProcessed.add(chapter.attributes.chapter);
		}

		return chaptersToSend;
	}

	override async handleChapter(
		_mangaId: string,
		chapterId: string
	): Promise<IChapterResponse> {
		if (chapterId.startsWith('http')) {
			return await this.getChapterFromMangaPlus(chapterId)
		} else {
			const fetch = (await importFetch()).default;

			const apiResponse = await fetch(
				`${this.apiBaseUrl}at-home/server/${chapterId}`
			)
				.then((a) => {
					return (async () => {
						if(a.status === 200){
							return a.json()
						}
						throw new Error(`[Mangadex] Failed to fetch chapters\n${await a.text()}`)
					})()
				})
				.then((a) => a as IMangaDexPagesResponse);

			if (apiResponse.result === 'error') {
				console.log(apiResponse);
				throw new Error(`MangaDex Api Error ${apiResponse.toString()}`);
			}

			return apiResponse.chapter.data.map((a) => ({
				src: `${apiResponse.baseUrl}/data/${apiResponse.chapter.hash}/${a}`,
				headers: [],
			}));
		}
	}
}

export default function factory() {
	return [new MangaDexSource()];
}
