"use strict";
const MangaSource = require("../mangaSource");

class Source extends MangaSource {
  async getSearchUrl(search) {
    return {
      url: search
        ? `https://flamescans.org/?s=${encodeURIComponent(search)}`
        : `https://flamescans.org/`,
      selector: "#content",
    };
  }

  async getSearchFromPage(page, search) {
    if (!search) {
      return await page.evaluate(() => {
        return Array.from(
          document.querySelectorAll(".latest-updates .bsx")
        ).map((d) => {
          return {
            id: d.children[0].getAttribute("href").split("/")[4],
            title: d.children[1].children[0].children[0].children[0].textContent
              .slice(1)
              .trim(),
            cover: d.children[0].children[0].children[0].src,
          };
        });
      });
    } else {
      return await page.evaluate(() => {
        return Array.from(document.querySelectorAll(".listupd a")).map((a) => {
          return {
            id: a.getAttribute("href").split("/")[4],
            title: a.children[1].children[1].textContent.slice(1).trim(),
            cover: a.children[0].children[1].src,
          };
        });
      });
    }
  }

  async getMangaUrl(manga) {
    return {
      url: `https://flamescans.org/series/${encodeURIComponent(manga)}/`,
      selector: "#content",
    };
  }

  async getMangaFromPage(page, manga) {
    return await page.evaluate(async () => {
      return {
        id: document
          .querySelector('meta[name="url"]')
          .getAttribute("content")
          .split("/")[4],
        title: document.querySelector(".entry-title").textContent.trim(),
        cover: document.querySelector(".attachment-.size-.wp-post-image").src,
        tags: Array.from(document.querySelectorAll('a[rel="tag"]')).map(
          (a) => a.textContent
        ),
        status: document.querySelector(".status").children[1].textContent,
        description: Array.from(
          document.querySelector('div[itemprop="description"]').children
        )
          .map((c) => c.textContent)
          .reduce((p, c) => (p += c), ""),
      };
    });
  }

  async getChaptersUrl(manga) {
    return {
      url: `https://flamescans.org/series/${encodeURIComponent(manga.trim())}/`,
      selector: "#chapterlist",
    };
  }

  async getChaptersFromPage(page, manga) {
    return await page.evaluate(async () => {
      return Array.from(document.querySelectorAll("#chapterlist ul a")).map(
        (a) => {
          const num = a.href.split("chapter-").reverse()[0].replaceAll("/", "");
          return { title: num.replaceAll("-", "."), id: "chapter-" + num };
        }
      );
    });
  }

  async getChapterUrl(manga, chapter) {
    return {
      url: `https://flamescans.org/${encodeURIComponent(
        manga
      )}-${encodeURIComponent(chapter)}/`,
      selector: "#readerarea",
    };
  }

  async getChapterFromPage(page, manga, chapter) {
    return await page.evaluate(async () => {
      return Array.from(document.querySelectorAll("#readerarea img")).map(
        (img) => img.src
      );
    });
  }
}

module.exports = new Source("fs", 'flame scans');
