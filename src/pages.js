const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker');
const { EventEmitter } = require('events')

const browsers = [];
const pages = [];
const availablePages = [];
const MAX_PER_BROWSER = 6;
PAGE_LOAD_OPTIONS = {}

let showDebug = false;

async function Initialize(browserCount = 1, debug = false) {

	if (browserCount > 7) process.setMaxListeners(0);

	showDebug = debug;

	// Add stealth plugin and use defaults (all tricks to hide puppeteer usage)
	puppeteer.use(StealthPlugin())

	// Add adblocker plugin to block all ads and trackers (saves bandwidth)
	puppeteer.use(AdblockerPlugin({ blockTrackers: true }))

	for (i = 0; i < browserCount; i++) {
		const newBrowser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

		browsers.push(newBrowser);

		for (j = 0; j < MAX_PER_BROWSER; j++) {
			const newPage = await newBrowser.newPage();

			await newPage.setUserAgent('Mozilla/5.0 (Windows NT 5.1; rv:5.0) Gecko/20100101 Firefox/5.0')

			availablePages.push(newPage);

			pages.push(newPage);
		}
	}

	console.log(`Generated Pages Pool, ${browsers.length} Browsers | ${pages.length} Pages.`)

	if (showDebug) console.log(`${availablePages.length} Pages Available | ${pages.length} Pages Total`)
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForPageNaviagation(page, url) {
	try {
		//await sleep(10000);
		await page.goto(url, PAGE_LOAD_OPTIONS)
		await page.waitForSelector('.main_section')
	} catch (error) {

	}

}

function getPage() {
	return new PageLoader();
}

function closePage(page) {
	availablePages.push(page);

	if (showDebug) console.log(`${availablePages.length} Pages Available | ${pages.length} Pages Total`)
}

class PageLoader extends EventEmitter {
	constructor() {
		super();
		this.url = '';
		this.bWascancelled = false;
	}

	/**
	* Loads a page with the given url
	* @param {string} url
	*
	*/
	async load(url) {
		this.url = url;
		this.once('cancel', () => {
			this.bWascancelled = true;
		})

		let page = availablePages.pop();

		while (page === undefined && !this.bWascancelled) {
			await sleep(100)
			page = availablePages.pop();
		}

		if (this.bWascancelled) {
			if (page) closePage(page);

			this.emit('onCancelled');
			return;
		}



		try {

			let stopCallback = null;
			const stopPromise = new Promise(x => stopCallback = x);

			Promise.race([waitForPageNaviagation(page, this.url), stopPromise]).then(() => {
				if (this.bWascancelled) {
					if (page) closePage(page);

					console.log('cancelled during navigation')
					this.emit('onCancelled');
				}
				else {
					this.emit('onLoaded', page);
				}
			}).catch((error) => {
				console.log('Timed out navigating new page to ', this.url, error)
				if (this.bWascancelled) {
					if (page) closePage(page);

					this.emit('onCancelled');
				}
			});

			this.once('cancel', async () => {
				await page._client.send("Page.stopLoading");
				stopCallback();
			})
		} catch (error) {
			console.log('Timed out navigating new page to ', this.url, error)
			if (this.bWascancelled) {
				if (page) closePage(page);

				this.emit('onCancelled');
			}
		}
	}

	/**
	* Cancel's the page load
	* 
	*/
	cancel() {
		this.emit('cancel');
		this.emit('onCancelled');
	}

	/**
	* Called once the page has been loaded
	* @param {(page: puppeteer.page) => void} callback
	*
	*/
	onLoaded(callback) {
		if (callback) {
			this.once('onLoaded', callback)
		}
	}

	/**
	* Called once the page load has is cancelled
	* @param {() => void} callback
	*
	*/
	onCancelled(callback) {
		if (callback) {
			this.once('onCancelled', callback)
		}
	}
}

module.exports = {
	Initialize,
	getPage,
	closePage
}