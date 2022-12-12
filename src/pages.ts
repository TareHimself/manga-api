import { Browser, Page, executablePath } from 'puppeteer';
import puppeteer from 'puppeteer-extra'
import StealthPlugin from "puppeteer-extra-plugin-stealth"
import AdblockerPlugin from "puppeteer-extra-plugin-adblocker"
import EventEmitter from 'events'


// Add stealth plugin and use defaults (all tricks to hide puppeteer usage)
puppeteer.use(StealthPlugin());

// Add adblocker plugin to block all ads and trackers (saves bandwidth)
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

const browsers: Browser[] = [];
const pages: Page[] = [];
const availablePages: Page[] = [];
const INITIAL_PAGE_POOL = 6;
const PAGE_LOAD_OPTIONS = {};
const MAX_PER_DOMAIN = 6;
const DOMAIN_NAME_REGEX = /^http?s:\/\/(.*?\.[a-z]+)(?:\/|$)/
const browserArgs = ["--no-sandbox"];

let showDebug = false;

export type DomainInfo = { [key: number]: number };

export class PageQueue {

}

export function getBrowserId(b: Browser) {
    return `${b.process()?.pid || -1}`
}

export function getDomainFromURL(url: string) {
    return url.match(DOMAIN_NAME_REGEX)![1]
}

export class PageHandler {
    numBrowsers: number;
    debug: boolean;
    availablePages: Page[];
    pages: { [key: number]: Page[] };
    pagesCount: { [key: number]: number };
    openDomains: { [key: number]: DomainInfo };
    browsers: { [key: number]: Browser };
    maxPagesPerBrowser: number;

    constructor(maxPagesPerBrowser = 6, browserCount = 1, debug = false) {
        this.maxPagesPerBrowser = maxPagesPerBrowser
        this.numBrowsers = browserCount;
        this.debug = debug
        this.openDomains = {}
        this.browsers = {}
        this.pages = {}
        this.pagesCount = {}
        this.start()
    }

    async start() {
        if (this.numBrowsers > 7) {
            process.setMaxListeners(0);
        }

        for (let i = 0; i < this.numBrowsers; i++) {
            const newBrowser = await puppeteer.launch({
                headless: true,
                args: browserArgs,
                userDataDir: "../cachedData",
                executablePath: executablePath(),
            });
            const browserId = getBrowserId(newBrowser)
            this.pagesCount[browserId] = 0
            this.browsers[browserId] = newBrowser
            this.pages[browserId] = []
        }

        console.log('Browsers Created')
    }

    async spawnNewPageForBrowser(browser: Browser) {
        const b_id = getBrowserId(browser)
        const newPage = await browser.newPage();

        await newPage.setUserAgent(
            "Mozilla/5.0 (Windows NT 5.1; rv:5.0) Gecko/20100101 Firefox/5.0"
        );

        newPage.setDefaultNavigationTimeout(0);

        this.pagesCount[b_id] += 1
        return newPage;
    }

    private async waitForPageWithDomain(url: string) {

    }
    private async getUsablePage(domainName: string): Promise<Page> {

        if (!this.openDomains[domainName]) {
            this.openDomains[domainName] = {}
        }

        const info = this.openDomains[domainName]

        const browserIdsInInfo = Object.keys(info)
        const browsersInUseByDomain = browserIdsInInfo.map(k => [k, this.browsers[k]])

        for (let i = 0; i < browsersInUseByDomain.length; i++) {
            const [browser_id, currentItem] = browsersInUseByDomain[i]
            const pageCount = info[browser_id]

            if (pageCount < MAX_PER_DOMAIN) {
                if (this.pages[browser_id].length > 0) {
                    return this.pages[browser_id].pop()!
                } else if (this.pagesCount[browser_id] < this.maxPagesPerBrowser) {
                    return await this.spawnNewPageForBrowser(currentItem)
                }
            }
        }

        const otherBrowsers = Object.keys(this.browsers).filter(a => !browserIdsInInfo.includes(a))

        if (otherBrowsers.length == 0) {
            throw new Error("IT ACTUALLY HAPPENED")
        }

        const browserIdWithPage = otherBrowsers.find(a => this.pages[a].length > 0 || this.pagesCount[a] < this.maxPagesPerBrowser)

        if (!browserIdWithPage) {
            throw new Error("IT ACTUALLY HAPPENED PT.2")
        }

        if (this.pages[browserIdWithPage].length > 0) {
            return this.pages[browserIdWithPage].pop()
        }

        return await this.spawnNewPageForBrowser(this.browsers[browserIdWithPage])
    }

    private async getOrCreatePage(url: string, selector: string): Promise<Page> {

        const domainName = getDomainFromURL(url)

        const page = await this.getUsablePage(domainName)
        const browserId = getBrowserId(page.browser())

        if (!this.openDomains[domainName][browserId]) this.openDomains[domainName][browserId] = 0

        this.openDomains[domainName][browserId] += 1
        if (selector.trim().length > 0) {
            await page.goto(url)
        }
        else {
            page.goto(url)
            await page.waitForSelector(selector)
        }
        return page
    }



    async getPage(url: string, waitForSelector: string): Promise<Page> {
        return await this.getOrCreatePage(url, waitForSelector);
    }

    closePage(page: Page) {
        const domainName = getDomainFromURL(page.url())
        const browserId = getBrowserId(page.browser())
        this.pages[browserId].push(page)
        this.openDomains[domainName][browserId] -= 1;
    }


}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPageNaviagation(page, url, selector) {
    try {
        //await sleep(10000);
        if (selector && selector.trim) {
            page.goto(url, PAGE_LOAD_OPTIONS);
            await page.waitForSelector(selector);
        } else {
            await page.goto(url, PAGE_LOAD_OPTIONS);
        }
    } catch (error) {
        console.log("error navigating to", url, error);
    }
}