const { getPage, closePage } = require("./pages");
import { PageHandler } from './pages'
import { getCachedItem, tCacheItem } from './sqlite';
import { WebRequest } from 'express-websocket-proxy'
import { Page } from 'puppeteer';
// cache times in seconds
const SEARCH_CACHE_TIME = 7200; // cache for 2hrs
const MANGA_CACHE_TIME = 604800; // cache for 7 days
const CHAPTER_CACHE_TIME = 3600; // cache for 1hr
const CHAPTERS_CACHE_TIME = 2.628e6; // cache for 1month


export interface MangaPreview {
  id: string;
  title: string;
  cover: string;
}

export interface MangaInfo extends MangaPreview {
  tags: string[]
  description: string;
  status: string;
}

export type MangaSearch = MangaPreview[]

export type MangaChapters = { id: string, title: string }[]

export type MangaChapter = string[]

export type GetUrlReturnType = { url: string; selector: string; }

export interface SourceMethods {
  getSearchUrl: (search: string) => Promise<GetUrlReturnType>;
  getSearchFromPage: (page: Page, search: string) => Promise<MangaSearch>;
  getMangaUrl: (manga: string) => Promise<GetUrlReturnType>;
  getMangaFromPage: (page: Page, manga: string) => Promise<MangaInfo>;
  getChaptersUrl: (manga: string) => Promise<GetUrlReturnType>;
  getChaptersFromPage: (page: Page, manga: string) => Promise<MangaChapters>;
  getChapterUrl: (manga: string, chapter: string) => Promise<GetUrlReturnType>;
  getChapterFromPage: (page: Page, manga: string, chapter: string) => Promise<MangaChapter>;
}

/**
 * Base class for a manga source
 * The following methods have to be implemented by child classes
 * getSearchUrl
 *	getSearchFromPage
 *	getMangaUrl
 *	getMangaFromPage
 *	getChaptersUrl
 *	getChaptersFromPage
 *	getChapterUrl
 *	getChapterFromPage
 */

const PAGES_HANDLER = new PageHandler(12, 1, false)
export class MangaSource {
  id: string;
  displayName: string;
  implemented: SourceMethods;
  constructor(id: string, displayName: string, methods: SourceMethods) {
    this.id = id;
    this.displayName = displayName;
    this.implemented = methods
  }

  async search(req: WebRequest) {

    // get the search term
    const search = (req.query.q || "")
      .trim()
      .toLowerCase()
      .replace(/ +(?= )/g, "");

    // check the cache for a recent search
    const cachedData = getCachedItem(
      this.id,
      search,
      `search`,
      SEARCH_CACHE_TIME
    );

    // return the cached data if it exists
    if (cachedData) {
      try {
        req.sendBody(JSON.parse(cachedData));
        return;
      } catch (error) { }
    }

    // get the search url and selector from the source
    const { url, selector } = await this.implemented.getSearchUrl(search);

    // fetch a page from the pages system
    const page = await PAGES_HANDLER.getPage(url, selector);

    try {
      const result = await this.implemented.getSearchFromPage(page, search);
      req.sendBody(result)
      if (result.length > 0) tCacheItem.deferred(this.id, search, 'search', result)

    } catch (error) {
      console.log("ERROR ", error)
      req.sendStatus(500)
    }

    PAGES_HANDLER.closePage(page)
  }

  async getManga(req) {
    const manga = (req.params.manga || "").trim();

    const cachedData = getCachedItem(this.id, manga, "manga", MANGA_CACHE_TIME);

    if (cachedData) {
      try {
        req.sendBody(JSON.parse(cachedData));
        return;
      } catch (error) { }
    }

    // get the search url and selector from the source
    const { url, selector } = await this.implemented.getMangaUrl(manga);

    // fetch a page from the pages system
    const page = await PAGES_HANDLER.getPage(url, selector);

    try {
      const result = await this.implemented.getMangaFromPage(page, manga);
      req.sendBody(result)
      if (Object.keys(result).length > 0) tCacheItem.deferred(this.id, manga, 'manga', result)

    } catch (error) {
      console.log("ERROR ", error)
      req.sendStatus(500)
    }

    PAGES_HANDLER.closePage(page)
  }

  async getChapters(req) {
    const manga = (req.params.manga || "").trim();
    const cachedData = getCachedItem(
      this.id,
      manga,
      "chapters",
      CHAPTERS_CACHE_TIME
    );

    if (cachedData) {
      try {
        console.log("From Cache")
        req.sendBody(JSON.parse(cachedData));
        return;
      } catch (error) { }
    }

    // get the search url and selector from the source
    const { url, selector } = await this.implemented.getChaptersUrl(manga);

    // fetch a page from the pages system
    const page = await PAGES_HANDLER.getPage(url, selector);

    try {
      const result = await this.implemented.getChaptersFromPage(page, manga);
      req.sendBody(result)
      if (result.length > 0) tCacheItem.deferred(this.id, manga, 'chapter', result)
    } catch (error) {
      console.log("ERROR ", error)
      req.sendStatus(500)
    }

    PAGES_HANDLER.closePage(page)
  }

  async getChapter(req) {
    const manga = (req.params.manga || "").trim();
    const chapter = (req.params.number || "1").trim();

    const cachedData = getCachedItem(
      this.id,
      manga + chapter,
      "chapter",
      CHAPTER_CACHE_TIME
    );

    if (cachedData) {
      try {
        req.sendBody(JSON.parse(cachedData));
        return;
      } catch (error) { }
    }

    // get the search url and selector from the source
    const { url, selector } = await this.implemented.getChapterUrl(manga, chapter);

    // fetch a page from the pages system
    const page = await PAGES_HANDLER.getPage(url, selector);

    try {
      const result = await this.implemented.getChapterFromPage(page, manga, chapter);
      req.sendBody(result)
      if (result.length > 0) tCacheItem.deferred(this.id, manga + chapter, 'chapter', result)

    } catch (error) {
      console.log("ERROR ", error)
      req.sendStatus(500)
    }

    PAGES_HANDLER.closePage(page)
  }
}
