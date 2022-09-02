"use strict";
const MangaSource = require("../mangaSource");

class Source extends MangaSource {
  async getSearchUrl(search) {
    return {
      url: search
        ? `https://manhwa18.net/manga-list.html?name=${encodeURIComponent(
          search
        )}`
        : `https://manhwa18.net/manga-list.html?listType=pagination&page=1&artist=&author=&group=&m_status=&name=&genre=&ungenre=&sort=last_update&sort_type=DESC`,
      selector: ".card-body",
    };
  }

  async getSearchFromPage(page, search) {
    return await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.thumb-item-flow.col-6.col-md-3')).map(div => {

        return {
          id: div.querySelector('.thumb_attr.series-title a').href.match(/\/manga-([^.]+)/)[1],
          title: div.querySelector('.thumb_attr.series-title a').textContent.trim(),
          cover: window.location.origin + div.querySelector('.a6-ratio div').getAttribute('data-bg')
        }
      })
    });
  }

  async getMangaUrl(manga) {
    return {
      url: `https://manhwa18.net/manga-${encodeURIComponent(manga)}.html`,
      selector: ".content-wrapper",
    };
  }

  async getMangaFromPage(page, manga) {
    return await page.evaluate(async () => {
      const root = document.querySelector('.col-md-8.mt-2')
      const subElement = root.querySelector('.col-md-8');
      return {
        id: window.location.pathname.match(/\/manga-([^.]+)/)[1],
        title: subElement.children[0].children[1].textContent.split(':')[1].trim(),
        cover: root.querySelector('img').src,
        status: subElement.children[0].children[4].children[1].textContent.trim().replaceAll(' ', ''),
        tags: Array.from(subElement.children[0].children[3].querySelectorAll('a')).map(a => a.textContent.trim()),
        description: root.querySelector('.summary-content').textContent.trim(),
      }
    });
  }

  async getChaptersUrl(manga) {
    return {
      url: `https://manhwa18.net/manga-${encodeURIComponent(manga)}.html`,
      selector: ".content-wrapper",
    };
  }

  async getChaptersFromPage(page, manga) {
    return await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.list-chapters.at-series.list-unstyled a')).map(a => {
        return {
          id: a.href.match(/[^.]+-(.*)\./)[1],
          title: a.title
        }
      })
    });
  }

  async getChapterUrl(manga, chapter) {
    return {
      url: `https://manhwa18.net/read-${encodeURIComponent(manga)}-chapter-${encodeURIComponent(chapter)}.html/`,
      selector: ".chapter-content",
    };
  }

  async getChapterFromPage(page, manga, chapter) {
    return await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.chapter-content img')).map(img => img.getAttribute('data-original').trim())
    });
  }
}

module.exports = new Source("mh18", 'manhwa18');
