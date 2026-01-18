// scrapeBtoZ.js - Scrape medicines from letters B-Z
import { chromium } from "playwright";
import fs from "fs";

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function extractMedicinesFromPage(page) {
    return await page.evaluate(() => {
        const medicines = [];
        const cards = document.querySelectorAll('a[href^="/drugs/"]');

        cards.forEach(card => {
            try {
                const nameEl = card.querySelector('.bodyMediumBold.textMain, div.textMain');
                const name = nameEl?.innerText?.trim();

                const compositionEl = card.querySelector('div.truncateTo1, div.textAdditional.bodyRegular.truncateTo1');
                const formula = compositionEl?.innerText?.trim();

                const allDivs = Array.from(card.querySelectorAll('div'));
                const textDivs = allDivs.map(d => d.innerText?.trim()).filter(t => t && t.length > 0 && t.length < 100);
                const packSize = textDivs.find(t => t.includes('strip') || t.includes('bottle') || t.includes('tube') || t.includes('pack')) || 'N/A';

                const priceEl = card.querySelector('.textPrimary .bodyMediumBold, div[class*="textPrimary"] .bodyMediumBold');
                const priceText = priceEl?.innerText?.trim();
                const priceMatch = priceText?.match(/[\d,]+\.?\d*/);
                const price = priceMatch ? priceMatch[0] : "";

                const imgEl = card.querySelector('img');
                const image = imgEl?.src || imgEl?.getAttribute('data-src') || "";

                const url = card.href;

                if (name && name.length > 2) {
                    medicines.push({ name, formula: formula || 'N/A', packSize, price, image, url });
                }
            } catch (e) { }
        });

        return medicines;
    });
}

async function scrapeLetter(browser, letter, maxPages = 334) {
    const context = await browser.newContext({
        viewport: { width: 1366, height: 768 },
        locale: "en-IN",
        timezoneId: "Asia/Kolkata",
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    });

    await context.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    const page = await context.newPage();
    const allMedicines = [];

    try {
        for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
            const url = `https://www.1mg.com/drugs-all-medicines?page=${pageNum}&label=${letter}`;
            console.log(`   📄 Page ${pageNum}/${maxPages}`);

            await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
            await page.waitForTimeout(1500);
            await page.mouse.wheel(0, 500);
            await page.waitForTimeout(1000);

            const medicines = await extractMedicinesFromPage(page);
            console.log(`      ✅ Found ${medicines.length} medicines`);

            if (medicines.length === 0) {
                console.log(`      ⚠️  No medicines found, stopping...`);
                break;
            }

            medicines.forEach(m => {
                allMedicines.push({ id: allMedicines.length + 1, letter: letter, ...m });
            });

            if (pageNum % 10 === 0) {
                console.log(`      💾 Progress: ${allMedicines.length} medicines from ${pageNum} pages`);
            }

            await sleep(1500);
        }
    } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
    } finally {
        await context.close();
    }

    return allMedicines;
}

(async () => {
    const letters = ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];
    const outputFile = "medicines_letters_B_to_Z.json";

    console.log("🚀 Starting B-Z Medicine Scraper\n");
    console.log(`📋 Letters: ${letters.join(', ')}`);
    console.log(`⏱️  Estimated time: ${Math.ceil(letters.length * 8)} minutes\n`);

    const browser = await chromium.launch({ headless: false, slowMo: 50 });
    const allResults = [];

    try {
        for (let i = 0; i < letters.length; i++) {
            const letter = letters[i];
            console.log(`\n${'='.repeat(60)}`);
            console.log(`[${i + 1}/${letters.length}] Letter: ${letter}`);
            console.log(`${'='.repeat(60)}\n`);

            const medicines = await scrapeLetter(browser, letter, 334);
            console.log(`\n   ✅ Total for letter ${letter}: ${medicines.length} medicines\n`);

            allResults.push({ letter, medicineCount: medicines.length, medicines });

            const progressOutput = {
                scrapedAt: new Date().toISOString(),
                source: "Tata 1mg B-Z",
                lettersCompleted: i + 1,
                totalLetters: letters.length,
                totalMedicines: allResults.reduce((sum, l) => sum + l.medicineCount, 0),
                letters: allResults,
            };

            fs.writeFileSync(outputFile, JSON.stringify(progressOutput, null, 2));
            console.log(`   💾 Progress saved: ${progressOutput.totalMedicines} total medicines\n`);

            if (i < letters.length - 1) {
                console.log(`   ⏳ Sleeping 30 seconds before next letter...\n`);
                await sleep(30000);
            }
        }
    } finally {
        await browser.close();
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ COMPLETE!`);
    console.log(`${'='.repeat(60)}`);
    console.log(`📁 Saved to: ${outputFile}`);
    console.log(`📦 Total medicines: ${allResults.reduce((sum, l) => sum + l.medicineCount, 0)}`);
})();
