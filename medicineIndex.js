// medicineIndex.js - Scrape ALL medicines from A-Z index with pagination
import { chromium } from "playwright";
import { behaveLikeHuman } from "./human.js";
import fs from "fs";

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Extract medicines from current page
 */
async function extractMedicines(page) {
    return await page.evaluate(() => {
        const medicines = [];

        // Find all medicine cards/links
        const cards = document.querySelectorAll('a[href*="/drugs/"], div[class*="style__product"], div[class*="medicine"]');

        cards.forEach(card => {
            try {
                // Get link
                const link = card.tagName === 'A' ? card : card.querySelector('a[href*="/drugs/"]');
                if (!link) return;

                const url = link.href;

                // Extract name
                let name = card.querySelector('h3, h2, div[class*="name"], .product-name')?.innerText?.trim();
                if (!name) {
                    name = link.innerText?.split('\n')[0]?.trim();
                }

                // Extract formula/pack size
                const formula = card.querySelector('div[class*="pack"], div[class*="Pack"], div[class*="quantity"]')?.innerText?.trim();

                // Extract price
                const priceText = card.innerText;
                const priceMatch = priceText.match(/₹\s*([\d,]+\.?\d*)/);
                const price = priceMatch ? priceMatch[1] : "";

                // Extract image
                const img = card.querySelector('img');
                const image = img?.src || img?.getAttribute('data-src') || "";

                if (name && name.length > 2) {
                    medicines.push({
                        name,
                        formula: formula || 'N/A',
                        price,
                        image,
                        url
                    });
                }
            } catch (e) {
                // Skip invalid cards
            }
        });

        return medicines;
    });
}

/**
 * Check if there's a next page
 */
async function hasNextPage(page) {
    return await page.evaluate(() => {
        const nextButton = document.querySelector('a[rel="next"], button[class*="next"], a[class*="next"]');
        return nextButton && !nextButton.classList.contains('disabled');
    });
}

/**
 * Go to next page
 */
async function goToNextPage(page) {
    await page.evaluate(() => {
        const nextButton = document.querySelector('a[rel="next"], button[class*="next"], a[class*="next"]');
        if (nextButton) nextButton.click();
    });

    await page.waitForTimeout(3000);
}

/**
 * Scrape all medicines from A-Z index with pagination
 */
async function scrapeMedicineIndex(options = {}) {
    const {
        letter = "A",
        maxPages = 100, // Max pages to scrape (10000 results / ~30 per page = ~333 pages)
        startPage = 1,
        outputFile = "medicines_all.json",
    } = options;

    console.log("🚀 Starting Medicine Index Scraper\n");
    console.log(`📋 Letter: ${letter}`);
    console.log(`📄 Max Pages: ${maxPages}`);
    console.log(`⏱️  Estimated time: ${Math.ceil(maxPages * 0.5)} minutes\n`);

    const browser = await chromium.launch({
        headless: false,
        slowMo: 80,
    });

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

    const allMedicines = [];
    let currentPage = startPage;

    try {
        // Load first page
        const url = `https://www.1mg.com/drugs-all-medicines?page=${currentPage}&label=${letter}`;
        console.log(`🌐 Loading: ${url}\n`);

        await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 90000
        });

        await behaveLikeHuman(page);

        while (currentPage <= maxPages) {
            console.log(`\n📄 Page ${currentPage}/${maxPages}`);

            // Extract medicines from current page
            console.log(`   📦 Extracting medicines...`);
            const medicines = await extractMedicines(page);

            console.log(`   ✅ Found ${medicines.length} medicines`);

            // Show first 3
            medicines.slice(0, 3).forEach((m, idx) => {
                console.log(`      ${idx + 1}. ${m.name} - ₹${m.price}`);
            });

            // Add to results
            medicines.forEach(m => {
                allMedicines.push({
                    id: allMedicines.length + 1,
                    ...m
                });
            });

            // Save progress every 10 pages
            if (currentPage % 10 === 0) {
                const progressOutput = {
                    scrapedAt: new Date().toISOString(),
                    letter: letter,
                    pagesScraped: currentPage,
                    totalMedicines: allMedicines.length,
                    medicines: allMedicines,
                };

                fs.writeFileSync(outputFile, JSON.stringify(progressOutput, null, 2));
                console.log(`\n   💾 Progress saved (${allMedicines.length} medicines from ${currentPage} pages)\n`);
            }

            // Check if there's a next page
            const hasNext = await hasNextPage(page);

            if (!hasNext || medicines.length === 0) {
                console.log(`\n   ⚠️  No more pages or no medicines found`);
                break;
            }

            // Navigate to next page
            currentPage++;

            // Use URL navigation instead of clicking (more reliable)
            const nextUrl = `https://www.1mg.com/drugs-all-medicines?page=${currentPage}&label=${letter}`;
            console.log(`   🔄 Loading page ${currentPage}...`);

            await page.goto(nextUrl, {
                waitUntil: "domcontentloaded",
                timeout: 90000
            });

            // Light human behavior between pages
            await page.waitForTimeout(2000);
            await page.mouse.wheel(0, 500);
            await page.waitForTimeout(1000);
        }

    } catch (error) {
        console.error(`\n❌ Error: ${error.message}`);
    } finally {
        await browser.close();
    }

    // Final save
    const finalOutput = {
        scrapedAt: new Date().toISOString(),
        letter: letter,
        pagesScraped: currentPage - 1,
        totalMedicines: allMedicines.length,
        medicines: allMedicines,
    };

    fs.writeFileSync(outputFile, JSON.stringify(finalOutput, null, 2));

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Scraping Complete!`);
    console.log(`${'='.repeat(60)}`);
    console.log(`📁 Saved to: ${outputFile}`);
    console.log(`📦 Total medicines: ${allMedicines.length}`);
    console.log(`📄 Pages scraped: ${currentPage - 1}`);

    return finalOutput;
}

// Run
scrapeMedicineIndex({
    letter: "A",
    maxPages: 100, // Start with 100 pages, can increase later
    outputFile: "medicines_letter_A.json",
})
    .then(results => {
        console.log(`\n🎉 Success! Scraped ${results.totalMedicines} medicines from ${results.pagesScraped} pages`);
    })
    .catch(error => {
        console.error("\n💥 Error:", error);
        process.exit(1);
    });
