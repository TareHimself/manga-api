import { MangaChapters, MangaSource } from '../mangaSource'

/* Prevent console from clearing
var maxId = setTimeout(function(){}, 0);

for(var i=0; i < maxId; i+=1) { 
    clearTimeout(i);
}
*/

const source = new MangaSource("nhen", 'nhentai', {
    async getSearchUrl(search) {
        return {
            url: search
                ? `https://nhentai.net/search/?q=${encodeURIComponent("language:english " + search)}`
                : `https://nhentai.net/search/?q=${encodeURIComponent("language:english")}`,
            selector: ".container.index-container",
        };
    },

    async getSearchFromPage(search, page) {
        if (!page) return []
        return await page.evaluate(() => {
            return (Array.from(document.querySelectorAll(".container.index-container div a")) as HTMLAnchorElement[]).map((a) => {

                return {
                    id: a.href.split("/").reverse()[1],
                    cover: a.children[0].getAttribute("data-src") || "",
                    title: a.children[2].textContent || ""
                }
            })
        });
    },

    async getMangaUrl(manga) {
        return {
            url: `https://nhentai.net/g/${encodeURIComponent(manga)}/`,
            selector: "#bigcontainer",
        };
    },

    async getMangaFromPage(manga, page) {
        if (!page) return null
        return await page.evaluate(async (id) => {
            return {
                id,
                title: document.querySelector(".pretty")?.textContent || "Unknown",
                cover: document.querySelector("#cover a img")?.getAttribute('data-src') || "Unknown",
                status: "Unknown",
                tags: Array.from(document.querySelector("#tags")!.children[2].querySelectorAll('a')).map(a => a.children[0].textContent?.trim() || ""),
                description: "We don't do that here",
            }
        }, manga);
    },

    async getChaptersUrl(manga) {
        return {
            url: `https://nhentai.net/g/${encodeURIComponent(manga)}/`,
            selector: "#thumbnail-container .thumbs .thumb-container a",
        };
    },

    async getChaptersFromPage(manga, page) {
        if (!page) return []
        return await page.evaluate(() => {
            const allPages = Array.from(document.querySelectorAll("#thumbnail-container .thumbs .thumb-container a img"))

            const maxPerPage = 8;
            const result: MangaChapters = []

            const regexp1 = /([0-9]+)\/[a-z0-9]+\.?.*/
            const regexp2 = /https:\/\/([a-z0-9]+).*\/([a-z0-9]+\.?.*)/

            function extractInfo(info, current) {
                const matched = current.getAttribute("data-src").match(regexp2)
                info.id += `|${matched[1].replace("t", "i")}-${matched[2].replace("t", "")}`
                return info
            }

            const maxIter = Math.ceil(allPages.length / maxPerPage)

            for (let i = 0; i < maxIter; i++) {
                const sliceStart = i * maxPerPage
                const section = allPages.slice(sliceStart, sliceStart + maxPerPage)
                const sectionGalleryId = section[0].getAttribute("data-src")!.match(regexp1)![1]
                result.unshift(section.reduce(extractInfo, { title: `Page ${i + 1}`, id: `${sectionGalleryId}` }))
            }

            return result;
        });
    },

    async getChapterUrl(manga, chapter) {
        return null
    },

    async getChapterFromPage(manga, chapter, page) {

        const argsForChapters = chapter.split("|")
        const galleryId = argsForChapters.splice(0, 1)[0]
        return argsForChapters.map((pageNum) => {
            const [sub_domain, page_actual] = pageNum.split('-')
            return `https://${sub_domain}.nhentai.net/galleries/${galleryId}/${page_actual}`
        })
    }
})

export default source
