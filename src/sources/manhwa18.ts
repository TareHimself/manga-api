import { MangaSource } from '../mangaSource'


const source = new MangaSource("mh18", 'manhwa18', {
  async getSearchUrl(search) {
    return {
      url: search
        ? `https://manhwa18.net/manga-list.html?name=${encodeURIComponent(
          search
        )}`
        : `https://manhwa18.net/manga-list.html?listType=pagination&page=1&artist=&author=&group=&m_status=&name=&genre=&ungenre=&sort=last_update&sort_type=DESC`,
      selector: ".card-body",
    };
  },

  async getSearchFromPage(search, page) {
    if (!page) return []
    return await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.thumb-item-flow.col-6.col-md-3')).map(div => {
        const anchor = (div.querySelector('.thumb_attr.series-title a') as HTMLAnchorElement)
        return {
          id: anchor.href.match(/\/manga-([^.]+)/)![1],
          title: anchor.textContent!.trim(),
          cover: window.location.origin + div.querySelector('.a6-ratio div')!.getAttribute('data-bg') || ""
        }
      })
    });
  },

  async getMangaUrl(manga) {
    return {
      url: `https://manhwa18.net/manga-${encodeURIComponent(manga)}.html`,
      selector: ".content-wrapper",
    };
  },

  async getMangaFromPage(manga, page) {
    if (!page) return null
    return await page.evaluate(async () => {
      const root = document.querySelector('.col-md-8.mt-2')!
      const subElement = root.querySelector('.col-md-8')!;
      return {
        id: window.location.pathname.match(/\/manga-([^.]+)/)![1],
        title: subElement.children[0].children[1].textContent!.split(':')[1].trim(),
        cover: (root.querySelector('img') as HTMLImageElement).src,
        status: subElement.children[0].children[4].children[1].textContent!.trim().replaceAll(' ', ''),
        tags: Array.from(subElement.children[0].children[3].querySelectorAll('a')).map(a => a.textContent!.trim()),
        description: root.querySelector('.summary-content')!.textContent!.trim(),
      }
    });
  },

  async getChaptersUrl(manga) {
    return {
      url: `https://manhwa18.net/manga-${encodeURIComponent(manga)}.html`,
      selector: ".content-wrapper",
    };
  },

  async getChaptersFromPage(manga, page) {
    if (!page) return []
    return await page.evaluate(() => {
      return (Array.from(document.querySelectorAll('.list-chapters.at-series.list-unstyled a')) as HTMLAnchorElement[]).map(a => {
        return {
          id: a.href.match(/[^.]+-(.*)\./)![1],
          title: a.title
        }
      })
    });
  },

  async getChapterUrl(manga, chapter) {
    return {
      url: `https://manhwa18.net/read-${encodeURIComponent(manga)}-chapter-${encodeURIComponent(chapter)}.html/`,
      selector: ".chapter-content",
    };
  },

  async getChapterFromPage(manga, chapter, page) {
    if (!page) return []
    return await page.evaluate(() => {
      return (Array.from(document.querySelectorAll('.chapter-content img')) as HTMLImageElement[]).map(img => img.getAttribute('data-original')!.trim())
    });
  }
})

export default source
