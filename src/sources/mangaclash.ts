import { MangaSource } from '../mangaSource'


const source = new MangaSource("mc", 'mangaclash', {
  async getSearchUrl(search) {
    return {
      url: search
        ? `https://mangaclash.com/?post_type=wp-manga&s=${encodeURIComponent(
          search
        )}`
        : `https://mangaclash.com/`,
      selector: ".site-content",
    };
  },

  async getSearchFromPage(search, page) {
    if (!page) return []
    if (!search) {
      return await page.evaluate(() => {
        return Array.from(
          document.querySelectorAll(".page-item-detail.manga")
        ).map((element) => {
          const aTagBeforeImage = element.querySelector(
            ".item-thumb.c-image-hover a"
          ) as HTMLAnchorElement;

          return {
            id: aTagBeforeImage.href.split("/")[4],
            title: element.querySelector(
              ".item-summary .post-title.font-title h3 a"
            )!.textContent || "",
            cover: aTagBeforeImage.children[0].getAttribute("data-src") || "",
          };
        });
      });
    } else {
      return await page.evaluate(() => {
        return Array.from(
          document.querySelectorAll(".row.c-tabs-item__content")
        ).map((element) => {
          const imageElement = element.querySelector("img") as HTMLImageElement;
          const titleATag = element.querySelector(".post-title h3 a") as HTMLAnchorElement;

          return {
            id: titleATag.href.split("/")[4],
            title: titleATag.textContent || "",
            cover: imageElement.getAttribute("data-src") || "",
          };
        });
      });
    }
  },

  async getMangaUrl(manga) {
    return {
      url: `https://mangaclash.com/manga/${encodeURIComponent(manga)}/`,
      selector: ".summary_image a",
    };
  },

  async getMangaFromPage(manga, page) {
    if (!page) return null
    return await page.evaluate(async () => {
      const aTag = document.querySelector(".summary_image a") as HTMLAnchorElement;

      return {
        id: aTag.href.split("/")[4],
        title: document.querySelector(".post-title h1")!.textContent!.slice(1),
        cover: aTag.children[0].getAttribute("data-src") || "",
        tags: Array.from(document.querySelectorAll(".genres-content a")).map(
          (e) => e.textContent || ""
        ),
        status: document
          .querySelector(".post-status .post-content_item .summary-content")!
          .textContent!.replace("\n", "")
          .replace("\t", ""),
        description: document.querySelector("p")!.textContent || "",
      };
    });
  },

  async getChaptersUrl(manga) {
    return {
      url: `https://mangaclash.com/manga/${encodeURIComponent(manga)}/`,
      selector: ".site-content",
    };
  },

  async getChaptersFromPage(manga, page) {
    if (!page) return []
    return await page.evaluate(() => {
      return (Array.from(document.querySelectorAll(".wp-manga-chapter a")) as HTMLAnchorElement[]).map(
        (a) => {
          const id =
            a.href.trim().split("/").reverse()[0] ||
            a.href.trim().split("/").reverse()[1];
          return { title: id.slice(8).replaceAll("-", "."), id };
        }
      );
    });
  },

  async getChapterUrl(manga, chapter) {
    return {
      url: `https://mangaclash.com/manga/${encodeURIComponent(
        manga
      )}/${encodeURIComponent(chapter)}/`,
      selector: ".site-content",
    };
  },

  async getChapterFromPage(manga, chapter, page) {
    if (!page) return []
    return await page.evaluate(() => {
      return (Array.from(
        document.querySelectorAll(".reading-content .page-break.no-gaps img")
      ) as HTMLImageElement[]).map((img) =>
        img.getAttribute("data-src")!.replaceAll("\t", "").trim()
      );
    });
  }
})

export default source
