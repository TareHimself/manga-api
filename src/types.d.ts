export const enum EMangaStatus {
	COMPLETE = 'Complete',
	ON_GOING = 'OnGoing',
	UNKNOWN = 'Unknown',
}

export interface IMangaChapter {
	id: string;
	name: string;
	released: string | null;
}

export interface IMangaExtras {
	name: string;
	value: string;
}

export interface IApiImage {
	src: string;
	headers: {
		key: string;
		value: string;
	}[];
}

export interface IMangaPreview {
	id: string;
	name: string;
	cover: IApiImage;
}

export interface IManga extends IMangaPreview {
	share: string;
	status: EMangaStatus;
	description: string;
	tags: string[];
	extras: IMangaExtras[];
}

export type IMangaResponse = Pick<IManga,Exclude<keyof IManga, 'id'>>;

export interface ISearchResponse {
	items: IMangaPreview[];
	next: string | null;
}



export type IChaptersResponse = IMangaChapter[];

export type IChapterResponse = IApiImage[];

export interface IProxyData {
	url: string;
	headers: Record<string, string>;
}

export interface ICgasApiResponse {
	url: string;
	thumb_url: string | null;
	deletion_url?: string;
}

export interface IPageProxy {
	filename: string;
	url: string;
	headers: Record<string, string>;
}

export interface IFileToUpload {
	filename: string;
	data: Buffer | NodeJS.ReadableStream;
}

declare global {
	namespace NodeJS {
		// Alias for compatibility
		interface ProcessEnv extends Dict<string> {
			CGAS_API_KEY: string;
		}
	}
}
