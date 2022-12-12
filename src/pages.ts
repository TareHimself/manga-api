import { Browser, Page } from 'puppeteer';
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

export interface DomainInfo {
  browserPageCount: Map<Browser, number>;
}
export class PageHandler {
  browserCounter: number;
  debug: boolean;
  availablePages: Page[];
  pages: Page[];
  openDomains: Map<string, DomainInfo>;
  browsers: Browser[];

  constructor(maxPagesPerBrowser = 6, browserCount = 1, debug = false) {
    this.browserCounter = browserCount;
    this.debug = debug
    this.openDomains = new Map<string, DomainInfo>()
    this.browsers = []
    this.pages = []
  }

  async start() {
    if (this.browserCounter > 7) {
      process.setMaxListeners(0);
    }

    for (let i = 0; i < this.browserCounter; i++) {
      const newBrowser = await puppeteer.launch({
        headless: true,
        args: browserArgs,
        userDataDir: "../cachedData",
      });

      this.browsers.push(newBrowser)

      for (let j = 0; j < INITIAL_PAGE_POOL; j++) {
        pages.push(await this.spawnNewPageForBrowser(newBrowser));
      }
    }

  }

  async spawnNewPageForBrowser(browser: Browser) {
    const newPage = await browser.newPage();

    await newPage.setUserAgent(
      "Mozilla/5.0 (Windows NT 5.1; rv:5.0) Gecko/20100101 Firefox/5.0"
    );

    await newPage.setDefaultNavigationTimeout(0);

    return newPage;
  }


}

async function Initialize(browserCount = 1, debug = false) {
  if (browserCount > 7)

    showDebug = debug;



  if (showDebug)
    console.log(
      `${availablePages.length} Pages Available | ${pages.length} Pages Total`
    );
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

function getPage() {
  return new PageLoader();
}

function closePage(page) {
  availablePages.push(page);

  if (showDebug)
    console.log(
      `${availablePages.length} Pages Available | ${pages.length} Pages Total`
    );
}

class PageLoader extends EventEmitter {
  url: string;
  bWascancelled: boolean;
  bHasLoaded: boolean;
  constructor() {
    super();
    this.url = "";
    this.bWascancelled = false;
    this.bHasLoaded = false;
  }

  /**
   * Loads a page with the given url
   * @param {string} url
   *
   */
  async load(url, selector = null) {
    this.url = url;
    this.once("cancel", () => {
      this.bWascancelled = true;
    });

    let page = availablePages.pop();

    while (page === undefined && !this.bWascancelled) {
      await sleep(100);
      page = availablePages.pop();
    }

    if (this.bWascancelled) {
      if (page) closePage(page);

      this.emit("onCancelled");
      return;
    }

    try {
      let stopCallback = null;
      const stopPromise = new Promise((x) => (stopCallback = x));

      Promise.race([
        waitForPageNaviagation(page, this.url, selector),
        stopPromise,
      ])
        .then(() => {
          if (this.bWascancelled) {
            if (page) closePage(page);

            this.emit("onCancelled");
          } else {
            this.bHasLoaded = true;
            this.emit("onLoaded", page);
          }
        })
        .catch((error) => {
          if (this.bWascancelled) {
            if (page) closePage(page);

            this.emit("onCancelled");
          }
        });

      this.once("cancel", async () => {
        await page._client.send("Page.stopLoading");
        stopCallback();
      });
    } catch (error) {
      if (this.bWascancelled) {
        if (page) closePage(page);

        this.emit("onCancelled");
      }
    }
  }

  /**
   * Cancel's the page load
   *
   */
  cancel() {
    if (!this.bWascancelled && !this.bHasLoaded) {
      this.emit("cancel");
      this.emit("onCancelled");
    }
  }

  /**
   * Called once the page has been loaded
   * @param {(page: puppeteer.page) => void} callback
   *
   */
  onLoaded(callback) {
    if (callback) {
      this.once("onLoaded", callback);
    }
  }

  /**
   * Called once the page load has is cancelled
   * @param {() => void} callback
   *
   */
  onCancelled(callback) {
    if (callback) {
      this.once("onCancelled", callback);
    }
  }
}

module.exports = {
  Initialize,
  getPage,
  closePage,
};
