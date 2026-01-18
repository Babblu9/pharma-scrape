// allMedicinesAZ.js - Scrape ALL 10,000+ medicines from A-Z index
import { chromium } from "playwright";
import { behaveLikeHuman } from "./human.js";
import fs from "fs";

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Extract medicines from current page
 */
async function extractMedicinesFromPage(page) {
    return await page.evaluate(() => {
        const medicines = [];

        // Find all medicine links
        const cards = document.querySelectorAll('a[href^="/drugs/"]');

        cards.forEach(card => {
            try {
                // Extract name
                const nameEl = card.querySelector('.bodyMediumBold.textMain, div.textMain');
                const name = nameEl?.innerText?.trim();

                // Extract composition/formula
                const compositionEl = card.querySelector('div.truncateTo1, div.textAdditional.bodyRegular.truncateTo1');
                const formula = compositionEl?.innerText?.trim();

                // Extract pack size (usually appears after composition)
                const allDivs = Array.from(card.querySelectorAll('div'));
                const textDivs = allDivs.map(d => d.innerText?.trim()).filter(t => t && t.length > 0 && t.length < 100);
                // Pack size is usually something like "strip of 10 tablets"
                const packSize = textDivs.find(t => t.includes('strip') || t.includes('bottle') || t.includes('tube') || t.includes('pack')) || 'N/A';

                // Extract price
                const priceEl = card.querySelector('.textPrimary .bodyMediumBold, div[class*="textPrimary"] .bodyMediumBold');
                const priceText = priceEl?.innerText?.trim();
                const priceMatch = priceText?.match(/[\d,]+\.?\d*/);
                const price = priceMatch ? priceMatch[0] : "";

                // Extract image
                const imgEl = card.querySelector('img');
                const image = imgEl?.src || imgEl?.getAttribute('data-src') || "";

                // Product URL
                const url = card.href;

                if (name && name.length > 2) {
                    medicines.push({
                        name,
                        formula: formula || 'N/A',
                        packSize,
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
 * Scrape all medicines for a specific letter
 */
async function scrapeLetter(browser, letter, maxPages = 334) {
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

    try {
        for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
            const url = `https://www.1mg.com/drugs-all-medicines?page=${pageNum}&label=${letter}`;

            console.log(`   📄 Page ${pageNum}/${maxPages}`);

            await page.goto(url, {
                waitUntil: "domcontentloaded",
                timeout: 90000
            });

            // Light human behavior (faster than full simulation)
            await page.waitForTimeout(1500);
            await page.mouse.wheel(0, 500);
            await page.waitForTimeout(1000);

            // Extract medicines
            const medicines = await extractMedicinesFromPage(page);

            console.log(`      ✅ Found ${medicines.length} medicines`);

            if (medicines.length === 0) {
                console.log(`      ⚠️  No medicines found, stopping...`);
                break;
            }

            // Add to results
            medicines.forEach(m => {
                allMedicines.push({
                    id: allMedicines.length + 1,
                    letter: letter,
                    ...m
                });
            });

            // Save progress every 10 pages
            if (pageNum % 10 === 0) {
                console.log(`      💾 Progress: ${allMedicines.length} medicines from ${pageNum} pages`);
            }

            // Small delay between pages
            await sleep(1500);
        }
    } catch (error) {
        console.error(`   ❌ Error on page: ${error.message}`);
    } finally {
        await context.close();
    }

    return allMedicines;
}

/**
 * Main scraper function
 */
async function scrapeAllMedicines(options = {}) {
    const {
        letters = ["A"], // Start with A, can add more letters
        maxPagesPerLetter = 334,
        outputFile = "all_medicines_az.json",
    } = options;

    console.log("🚀 Starting Medicine A-Z Index Scraper\n");
    console.log(`📋 Letters: ${letters.join(', ')}`);
    console.log(`📄 Max Pages per Letter: ${maxPagesPerLetter}`);
    console.log(`⏱️  Estimated time: ${Math.ceil(letters.length * maxPagesPerLetter * 0.025)} minutes\n`);

    const browser = await chromium.launch({
        headless: false,
        slowMo: 50,
    });

    const allResults = [];

    try {
        for (let i = 0; i < letters.length; i++) {
            const letter = letters[i];

            console.log(`\n${'='.repeat(60)}`);
            console.log(`[${i + 1}/${letters.length}] Letter: ${letter}`);
            console.log(`${'='.repeat(60)}\n`);

            const medicines = await scrapeLetter(browser, letter, maxPagesPerLetter);

            console.log(`\n   ✅ Total for letter ${letter}: ${medicines.length} medicines\n`);

            allResults.push({
                letter: letter,
                medicineCount: medicines.length,
                medicines: medicines,
            });

            // Save progress after each letter
            const progressOutput = {
                scrapedAt: new Date().toISOString(),
                source: "Tata 1mg A-Z Index",
                lettersCompleted: i + 1,
                totalLetters: letters.length,
                totalMedicines: allResults.reduce((sum, l) => sum + l.medicineCount, 0),
                letters: allResults,
            };

            fs.writeFileSync(outputFile, JSON.stringify(progressOutput, null, 2));
            console.log(`   💾 Progress saved: ${progressOutput.totalMedicines} total medicines\n`);

            // Sleep between letters (30s for anti-bot safety)
            if (i < letters.length - 1) {
                console.log(`   ⏳ Sleeping 30 seconds before next letter...\n`);
                await sleep(30000);
            }
        }
    } finally {
        await browser.close();
    }

    // Final output
    const finalOutput = {
        scrapedAt: new Date().toISOString(),
        source: "Tata 1mg A-Z Index",
        status: "Complete",
        totalLetters: letters.length,
        totalMedicines: allResults.reduce((sum, l) => sum + l.medicineCount, 0),
        letters: allResults,
    };

    fs.writeFileSync(outputFile, JSON.stringify(finalOutput, null, 2));

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ SCRAPING COMPLETE!`);
    console.log(`${'='.repeat(60)}`);
    console.log(`📁 Saved to: ${outputFile}`);
    console.log(`📦 Total medicines: ${finalOutput.totalMedicines}`);
    console.log(`📋 Letters scraped: ${letters.join(', ')}`);

    return finalOutput;
}

// Run - Start with letter A (10,000 medicines)
scrapeAllMedicines({
    letters: ["A"], // Can add more: ["A", "B", "C", ...]
    maxPagesPerLetter: 334, // ~10,000 medicines / 30 per page
    outputFile: "medicines_letter_A_complete.json",
})
    .then(results => {
        console.log(`\n🎉 Success! Scraped ${results.totalMedicines} medicines`);
    })
    .catch(error => {
        console.error("\n💥 Error:", error);
        process.exit(1);
    });
