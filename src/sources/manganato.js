"use strict";
const MangaSource = require("../mangaSource");

class MCSource extends MangaSource {
  async getSearchUrl(search) {
    return {
      url: search
        ? `https://manganato.com/search/story/${encodeURIComponent(
            search.replaceAll(" ", "_")
          )}`
        : `https://manganato.com/`,
      selector: search ? ".panel-search-story" : ".panel-content-homepage",
    };
  }

  async getSearchFromPage(page, search) {
    if (!search) {
      return await page.evaluate(() => {
        return Array.from(
          document.querySelectorAll(".content-homepage-item")
        ).map((d) => {
          return {
            id: d.children[0].getAttribute("href").split("/")[3],
            title: d.children[1].children[0].textContent.replaceAll("\n", ""),
            cover: d.children[0].children[0].src,
          };
        });
      });
    } else {
      return await page.evaluate(() => {
        return Array.from(document.querySelectorAll(".search-story-item")).map(
          (d) => {
            return {
              id: d.children[0].getAttribute("href").split("/")[3],
              title: d.children[1].children[0].textContent.replaceAll("\n", ""),
              cover: d.children[0].children[0].src,
            };
          }
        );
      });
    }
  }

  async getMangaUrl(manga) {
    return {
      url: `https://readmanganato.com/${encodeURIComponent(manga)}`,
      selector: ".panel-story-info",
    };
  }

  async getMangaFromPage(page, manga) {
    return await page.evaluate(async () => {
      const table = document.querySelector(".variations-tableInfo tbody");
      document
        .querySelector("#panel-story-info-description")
        .children[0]?.remove();

      return {
        id: document
          .querySelector('meta[property="og:url"]')
          .getAttribute("content")
          .split("/")[3],
        title:
          document.querySelector(".story-info-right").children[0].textContent,
        cover: document.querySelector(".info-image").children[0].src,
        status: table.children[2].children[1].textContent,
        tags: Array.from(table.children[3].querySelectorAll("a")).map(
          (a) => a.textContent
        ),
        description: document
          .querySelector("#panel-story-info-description")
          .textContent.trim(),
      };
    });
  }

  async getChaptersUrl(manga) {
    return {
      url: `https://readmanganato.com/${encodeURIComponent(manga)}`,
      selector: ".panel-story-chapter-list",
    };
  }

  async getChaptersFromPage(page, manga) {
    return await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll(".chapter-name.text-nowrap")
      ).map((a) => {
        const id =
          a.href.trim().split("/").reverse()[0] ||
          a.href.trim().split("/").reverse()[1];
        return { title: id.slice(8).replaceAll("-", "."), id };
      });
    });
  }

  async getChapterUrl(manga, chapter) {
    return {
      url: `https://readmanganato.com/${encodeURIComponent(
        manga
      )}/${encodeURIComponent(chapter)}/`,
      selector: ".container-chapter-reader",
    };
  }

  async getChapterFromPage(page, manga, chapter) {
    return await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll(".container-chapter-reader img")
      ).map((img) => img.src);
    });
  }
}

module.exports = new MCSource("mn");
