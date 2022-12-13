const { PageHandler } = require('./dist/pages')


async function run() {
    const han = new PageHandler(1, 6, false, false)
    const opened = []
    for (let i = 0; i < 13; i++) {
        han.getPage(i < 6 ? "https://www.youtube.com/" : "https://hanime.tv/").then((page) => {
            setTimeout((p) => {
                han.closePage(p)
            }, i < 6 ? 500 : 100000, page)
        })
    }
}

run()