import { MangaSource } from '../mangaSource'


const source = new MangaSource('fs', 'flame scans', {
  async getSearchUrl(search) {
    return {
      url: search
        ? `https://flamescans.org/ahhh/?s=${encodeURIComponent(search)}`
        : `https://flamescans.org/ahhh/`,
      selector: "#content",
    };
  },

  async getSearchFromPage(search, page) {
    if (!page) return []
    if (!search) {
      return await page.evaluate(() => {
        return Array.from(
          document.querySelectorAll(".latest-updates .bsx")
        ).map((d) => {
          return {
            id: d.children[0].getAttribute("href")!.split("/").reverse()[1],
            title: d.children[1].children[0].children[0].children[0].textContent!
              .slice(1)
              .trim(),
            cover: d.children[0].children[0].querySelector('img')!.src,
          };
        });
      });
    } else {
      return await page.evaluate(() => {
        return Array.from(document.querySelectorAll(".listupd a")).map((a) => {
          return {
            id: a.getAttribute("href")!.split("/").reverse()[1],
            title: a.children[1].children[1].textContent!.slice(1).trim(),
            cover: a.children[0].querySelector('img')!.src,
          };
        });
      });
    }
  },

  async getMangaUrl(manga) {
    return {
      url: `https://flamescans.org/ahhh/series/${encodeURIComponent(manga)}/`,
      selector: "#content",
    };
  },

  async getMangaFromPage(manga, page) {
    if (!page) return null
    return await page.evaluate(async () => {
      return {
        id: document
          .querySelector('meta[name="url"]')!
          .getAttribute("content")!
          .split("/").reverse()[1],
        title: document.querySelector(".entry-title")!.textContent!.trim(),
        cover: document.querySelector(".attachment-.size-.wp-post-image")!.getAttribute('src')!,
        tags: Array.from(document.querySelectorAll('a[rel="tag"]')).map(
          (a) => a.textContent || ''
        ),
        status: document.querySelector(".status")!.children[1].textContent || "",
        description: Array.from(
          document.querySelector('div[itemprop="description"]')!.children
        )
          .map((c) => c.textContent)
          .reduce((p, c) => (p! += c!), "") || "",
      };
    });
  },

  async getChaptersUrl(manga) {

    return {
      url: `https://flamescans.org/ahhh/series/${encodeURIComponent(manga.trim())}/`,
      selector: "#chapterlist",
    };
  },

  async getChaptersFromPage(manga, page) {
    if (!page) return []
    return await page.evaluate(async () => {
      return Array.from(document.querySelectorAll("#chapterlist ul a")).map(
        (a) => {
          const num = a.getAttribute('href')!.split("chapter-").reverse()[0].replaceAll("/", "");
          return { title: num.replaceAll("-", "."), id: "chapter-" + num };
        }
      );
    });
  },

  async getChapterUrl(manga, chapter) {
    return {
      url: `https://flamescans.org/ahhh/${encodeURIComponent(
        manga
      )}-${encodeURIComponent(chapter)}/`,
      selector: "#readerarea",
    };
  },

  async getChapterFromPage(manga, chapter, page) {
    if (!page) return []
    return await page.evaluate(async () => {
      return Array.from(document.querySelectorAll("#readerarea img")).map(
        (img) => img.getAttribute('src')!.trim()
      );
    });
  }
})

export default source
