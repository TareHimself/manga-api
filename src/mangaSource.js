"use strict";
const { getPage, closePage } = require("./pages");
const { getCachedItem, tCacheItem } = require("./sqlite");

// cache times in seconds
const SEARCH_CACHE_TIME = 7200; // cache for 2hrs
const MANGA_CACHE_TIME = 604800; // cache for 7 days
const CHAPTER_CACHE_TIME = 3600; // cache for 1hr
const CHAPTERS_CACHE_TIME = 2.628e6; // cache for 1month

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
class MangaSource {
  constructor(id, name) {
    this.id = id;
    this.name = name;
  }

  async search(req, res) {
    const search = (req.query.s || "")
      .trim()
      .toLowerCase()
      .replace(/ +(?= )/g, "");

    const cachedData = getCachedItem(
      this.id,
      search,
      `search`,
      SEARCH_CACHE_TIME
    );

    if (cachedData) {
      try {
        res.send(JSON.parse(cachedData));
        return;
      } catch (error) { }
    }

    const { url, selector } = await this.getSearchUrl(search);

    const loader = getPage();

    loader.onLoaded(async (page) => {
      try {
        const result = await this.getSearchFromPage(page, search);

        if (!loader.bWascancelled) {
          res.send(result);
          tCacheItem.deferred(this.id, search, `search`, result);
        }

      } catch (error) {
        console.log("Error making search", this.name, search, '\n', error)
        res.sendStatus(500)
      }
      await closePage(page);
    });

    loader.onCancelled(() => { });

    loader.load(url || "", selector || "");

    req.once("close", function (err) {
      loader.cancel();
    });
  }

  async getSearchUrl(search) {
    return { url: "", selector: "" };
  }

  async getSearchFromPage(page, search) { }

  async getManga(req, res) {
    const manga = (req.params.manga || "").trim();

    const cachedData = getCachedItem(this.id, manga, "manga", MANGA_CACHE_TIME);

    if (cachedData) {
      try {
        res.send(JSON.parse(cachedData));
        return;
      } catch (error) { }
    }

    const { url, selector } = await this.getMangaUrl(manga);

    if (!url) {
      res.send("Error generating page url");
      return;
    }

    const loader = getPage();

    loader.onLoaded(async (page) => {
      try {
        const result = await this.getMangaFromPage(page, manga);

        if (!loader.bWascancelled) {
          res.send(result);
          tCacheItem.deferred(this.id, manga, "manga", result);
        }


      } catch (error) {
        console.log("Error fetching Manga", this.name, manga, '\n', error)
        res.sendStatus(500)
      }
      await closePage(page);

    });

    loader.onCancelled(() => { });

    loader.load(url, selector || "");

    req.once("close", function (err) {
      loader.cancel();
    });
  }

  async getMangaUrl(manga) {
    return { url: "", selector: "" };
  }

  async getMangaFromPage(page, manga) {
    return {};
  }

  async getChapters(req, res) {
    const manga = (req.params.manga || "").trim();
    const cachedData = getCachedItem(
      this.id,
      manga,
      "chapters",
      CHAPTERS_CACHE_TIME
    );

    if (cachedData) {
      try {
        res.send(JSON.parse(cachedData));
        return;
      } catch (error) { }
    }

    const { url, selector } = await this.getChaptersUrl(manga);
    if (!url) {
      res.send("Error generating page url");
      return;
    }

    const loader = getPage();

    loader.onLoaded(async (page) => {
      try {
        const result = await this.getChaptersFromPage(page, manga);

        if (!loader.bWascancelled) {
          res.send(result);
          tCacheItem.deferred(this.id, manga, "chapters", result);
        }
      } catch (error) {
        console.log("Error fetching chapters", this.name, manga, '\n', error)
        res.sendStatus(500)
      }

      await closePage(page);
    });

    loader.onCancelled(() => { });

    loader.load(url || "", selector || "");

    req.once("close", function (err) {
      loader.cancel();
    });
  }

  async getChaptersUrl(manga) {
    return { url: "", selector: "" };
  }

  async getChaptersFromPage(page, manga) {
    return {};
  }

  async getChapter(req, res) {
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
        res.send(JSON.parse(cachedData));
        return;
      } catch (error) { }
    }

    const { url, selector } = await this.getChapterUrl(manga, chapter);

    if (!url) {
      res.send("Error generating page url");
      return;
    }

    const loader = getPage();

    loader.onLoaded(async (page) => {
      try {
        const result = await this.getChapterFromPage(page, manga, chapter);

        if (!loader.bWascancelled) {
          res.send(result);
          tCacheItem.deferred(this.id, manga + chapter, "chapter", result);
        }

      } catch (error) {
        console.log("Error fetching chapter", this.name, manga, chapter, '\n', error)
        res.sendStatus(500)
      }
      await closePage(page);
    });

    loader.onCancelled(() => { });

    loader.load(url || "", selector || "");

    req.once("close", function (err) {
      loader.cancel();
    });
  }

  async getChapterUrl(manga, chapter) {
    return { url: "", selector: "" };
  }

  async getChapterFromPage(page, manga, chapter) {
    return {};
  }
}

module.exports = MangaSource;
