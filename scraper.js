// scraper.js — Anti-Bot Safe Browser Setup
import { chromium } from "playwright";
import { behaveLikeHuman } from "./human.js";
import { extractProducts } from "./extract.js";

export async function scrapeCategory(url, options = {}) {
    const {
        useProxy = false,
        proxyServer = "",
        proxyUsername = "",
        proxyPassword = "",
    } = options;

    const launchOptions = {
        headless: false, // ❗ MUST be false
        slowMo: 80,
    };

    // Add proxy if provided
    if (useProxy && proxyServer) {
        launchOptions.proxy = {
            server: proxyServer,
            username: proxyUsername,
            password: proxyPassword,
        };
    }

    const browser = await chromium.launch(launchOptions);

    const context = await browser.newContext({
        viewport: { width: 1366, height: 768 },
        locale: "en-IN",
        timezoneId: "Asia/Kolkata",
        userAgent:
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
            "AppleWebKit/537.36 (KHTML, like Gecko) " +
            "Chrome/120.0.0.0 Safari/537.36"
    });

    await context.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", {
            get: () => undefined
        });
    });

    const page = await context.newPage();

    console.log(`🌐 Loading: ${url}`);

    await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 90000
    });

    console.log(`🤖 Behaving like human...`);
    await behaveLikeHuman(page);

    console.log(`📦 Extracting products...`);
    const products = await extractProducts(page);

    await browser.close();

    return products;
}
