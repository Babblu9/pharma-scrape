// auth.js - Production-grade session bootstrap with token capture
import { chromium } from "playwright";

/**
 * Bootstrap a complete browser session with valid token
 * Returns browser, context, page, and token for reuse
 */
export async function bootstrapSession() {
    console.log("🔐 Bootstrapping session...");

    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
    });

    const page = await context.newPage();

    let token = null;

    // Capture token from network requests
    page.on("request", req => {
        const auth = req.headers()["authorization"];
        if (auth?.startsWith("Bearer ")) {
            token = auth.replace("Bearer ", "");
        }
    });

    // Navigate and wait for token
    await page.goto("https://www.apollopharmacy.in/", {
        waitUntil: "domcontentloaded",
        timeout: 60000,
    });

    // Wait for token capture
    for (let i = 0; i < 60 && !token; i++) {
        await page.waitForTimeout(500);
    }

    if (!token) {
        await browser.close();
        throw new Error("❌ Token not captured");
    }

    console.log(`✅ Session ready - Token: ${token.slice(0, 15)}...`);

    return { browser, context, page, token };
}

/**
 * Refresh session when token expires
 */
export async function refreshSession(oldBrowser) {
    console.log("🔄 Refreshing session (token expired)...");

    if (oldBrowser) {
        try {
            await oldBrowser.close();
        } catch (e) {
            // Ignore close errors
        }
    }

    return await bootstrapSession();
}
