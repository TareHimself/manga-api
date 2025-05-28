import puppeteer from 'puppeteer-extra';
import { Page } from 'puppeteer';
import { isDebug } from './env';
puppeteer.use(require('puppeteer-extra-plugin-adblocker')());
puppeteer.use(require('puppeteer-extra-plugin-stealth')());

let activeBrowser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
let isLoadingBrowser: boolean = false;
let pendingCallbacks: (() => void)[] = [];
let pagesOpen = 0;
let browserCloseTimeout: ReturnType<typeof setTimeout> | null = null;

function onPageOpened() {
	pagesOpen++;
	if (browserCloseTimeout != null) {
		clearTimeout(browserCloseTimeout);
		browserCloseTimeout = null;
	}
}

function onPageClosed() {
	pagesOpen--;

	if (pagesOpen === 0) {
		browserCloseTimeout = setTimeout(() => {
			activeBrowser?.close();
			activeBrowser = null;
			browserCloseTimeout = null;
		}, 1000 * 60 * 60);
	}
}
export async function getBrowser(headless: boolean = !isDebug()) {
	if (!activeBrowser) {
		if (isLoadingBrowser) {
			await new Promise<void>((res) => {
				pendingCallbacks.push(res);
			});
		} else {
			isLoadingBrowser = true;

			activeBrowser = await puppeteer.launch({ headless: headless, args: ['--no-sandbox'] });
			
			isLoadingBrowser = false;
			pendingCallbacks.forEach((a) => a());
		}
	}

	return activeBrowser!;
}

export async function getBrowserPage() {
	const newPage = await getBrowser().then((a) => a.newPage());
	onPageOpened();
	await Promise.all([
		newPage.setExtraHTTPHeaders({
			'Accept-Language': 'en-GB,en;q=0.9',
			'sec-ch-ua-platform': 'Windows',
			'sec-ch-ua':
				'"Not?A_Brand";v="8", "Chromium";v="108", "Google Chrome";v="108"',
		}),
		newPage.setUserAgent(
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
		),
	]);

	return newPage;
}

export async function withBrowserPage<T>(exec: (page: Page) => Promise<T>) {
	const newPage = await getBrowserPage();

	try {
		const result = await exec(newPage);
		newPage.close();
		onPageClosed();
		return result;
	} catch (error) {
		newPage.close();
		onPageClosed();
		throw error;
	}
}
