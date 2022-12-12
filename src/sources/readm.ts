import { MangaSource } from '../mangaSource'


const source = new MangaSource("rm", 'readm', {
  async getSearchUrl(search) {
    return {
      url: search ? `https://readm.org/` : 'https://readm.org/latest-releases/1',
      selector: search ? "#tvSearch" : '.clearfix.latest-updates',
    };
  },

  async getSearchFromPage(page, search) {
    if (!search) {
      return await page.evaluate(async () => {
        return Array.from(document.querySelectorAll('.clearfix.latest-updates .segment-poster-sm')).map((item) => {
          const anchor = item.querySelector('.truncate a')! as HTMLAnchorElement
          return {
            id: anchor.href.match(/manga\/([^\/]+)/gm)![0].split('/')[1],
            title: anchor.textContent!.trim(),
            cover: window.location.origin + item.querySelector('img')!.getAttribute('data-src')!.replace(/_([0-9]+)x0/gm, '_198x0')
          }
        })
      });

    } else {
      try {
        await page.focus('#tvSearch')
        await page.keyboard.type(search);
        await page.waitForSelector("#search-response .dark-segment", { timeout: 3000 });

        return await page.evaluate(async () => {
          return Array.from(document.querySelectorAll('#search-response .segment-poster')).map((li) => {
            return {
              id: li.querySelector('a')!.href.trim().split('/').reverse()[0],
              title: li.querySelector('a h2')!.textContent!.trim(),
              cover: li.querySelector('img')!.src.replace(/_([0-9]+)x0/gm, '_198x0')
            }
          })
        });
      } catch (error) {
        return [];
      }
    }
  },

  async getMangaUrl(manga) {
    return {
      url: `https://readm.org/manga/${encodeURIComponent(manga)}/`,
      selector: ".page-title",
    };
  },

  async getMangaFromPage(page, manga) {
    return await page.evaluate(async () => {
      const wrapper = document.querySelector('#series-profile-wrapper')!
      const titleElement = document.querySelector(".page-title")!
      return {
        id: (titleElement.parentElement as HTMLAnchorElement).href.split('/').reverse()[0],
        title: titleElement.textContent!.trim(),
        cover: (wrapper.querySelector('img') as HTMLImageElement).src,
        tags: Array.from(wrapper.querySelectorAll(".ui.list .item a")).map(
          (a) => a.textContent || ""
        ),
        status: document
          .querySelector(".series-status.aqua")
          ?.textContent?.trim() || 'ongoing',
        description: document.querySelector(".series-summary-wrapper")!.children[2].textContent || "",
      }
    });
  },

  async getChaptersUrl(manga) {
    return {
      url: `https://readm.org/manga/${encodeURIComponent(manga)}/`,
      selector: ".page-title",
    };
  },

  async getChaptersFromPage(page, manga) {
    return await page.evaluate(() => {
      return (Array.from(document.querySelectorAll('.item.season_start a')) as HTMLAnchorElement[]).map(a => {
        return {
          title: a.textContent!.trim(),
          id: a.href.match(/manga\/[^\/]+\/([^\/]+)/gm)![0].split('/').reverse()[0]
        }
      })
    });
  },

  async getChapterUrl(manga, chapter) {
    return {
      url: `https://readm.org/manga/${encodeURIComponent(
        manga
      )}/${encodeURIComponent(chapter)}/all-pages`,
      selector: ".ch-images.ch-image-container",
    };
  },

  async getChapterFromPage(page, manga, chapter) {
    return await page.evaluate(() => {
      return (Array.from(document.querySelectorAll('.ch-images.ch-image-container img')) as HTMLImageElement[]).map(img => img.src.trim());
    });
  }
})

export default source
