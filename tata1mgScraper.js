// tata1mgScraper.js - Simple UI scraper for Tata 1mg
import { chromium } from "playwright";
import fs from "fs";

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Scrape products from Tata 1mg medicine listing page
 */
async function scrapeTata1mg(options = {}) {
    const {
        letter = "Z",  // Medicine starting letter
        maxPages = 3,
        outputFile = "tata1mg_products.json",
    } = options;

    console.log("🚀 Starting Tata 1mg scraper...\n");
    console.log(`📋 Letter: ${letter}`);
    console.log(`📄 Max Pages: ${maxPages}\n`);

    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    const allProducts = [];

    try {
        for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
            const url = `https://www.1mg.com/drugs-all-medicines?page=${pageNum}&label=${letter}`;

            console.log(`\n📄 Page ${pageNum}: ${url}`);

            await page.goto(url, {
                waitUntil: "networkidle",
                timeout: 30000,
            });

            // Wait for products to load
            try {
                await page.waitForSelector('a[class*="AllMedicinespage__cardContainer"]', { timeout: 10000 });
            } catch (e) {
                console.log(`   ⚠️  Products not loaded yet, waiting longer...`);
            }

            await page.waitForTimeout(5000);

            // Extract products from page
            const products = await page.evaluate(() => {
                const productCards = [];

                // Find all product cards - using correct selector
                const cards = document.querySelectorAll('a[class*="AllMedicinespage__cardContainer"]');

                cards.forEach(card => {
                    try {
                        // Product name
                        const nameEl = card.querySelector('div.textMain, .bodyMediumBold.textMain');
                        const name = nameEl?.textContent?.trim();

                        // Manufacturer
                        const mfgEl = card.querySelector('div.mY-4.textAdditional, div.textAdditional.bodyRegular.mY-4');
                        const manufacturer = mfgEl?.textContent?.trim();

                        // Pack size
                        const packEl = card.querySelector('div.mTop-4.textAdditional, div.textAdditional.bodyRegular.mTop-4');
                        const packSize = packEl?.textContent?.trim();

                        // Composition/Formula
                        const compositionEl = card.querySelector('div.truncateTo1.textAdditional, div.textAdditional.bodyRegular.truncateTo1');
                        const composition = compositionEl?.textContent?.trim();

                        // Price
                        const priceEl = card.querySelector('.textPrimary .bodyMediumBold, div[class*="textPrimary"] .bodyMediumBold');
                        const priceText = priceEl?.textContent?.trim();
                        const priceMatch = priceText?.match(/[\d,]+\.?\d*/);
                        const price = priceMatch ? parseFloat(priceMatch[0].replace(/,/g, '')) : null;

                        // MRP (if discounted)
                        const mrpEl = card.querySelector('.textDisabled.bodySmall');
                        const mrpText = mrpEl?.textContent?.trim();
                        const mrpMatch = mrpText?.match(/[\d,]+\.?\d*/);
                        const mrp = mrpMatch ? parseFloat(mrpMatch[0].replace(/,/g, '')) : price;

                        // Prescription required
                        const prescriptionText = card.innerText;
                        const prescriptionRequired = prescriptionText.includes('Prescription Required') ? 'Yes' : 'No';

                        // Product URL
                        const url = card.href;

                        if (name) {
                            productCards.push({
                                name,
                                manufacturer: manufacturer || 'N/A',
                                packSize: packSize || 'N/A',
                                composition: composition || 'N/A',
                                price,
                                mrp,
                                prescriptionRequired,
                                url,
                            });
                        }
                    } catch (e) {
                        // Skip invalid cards
                    }
                });

                return productCards;
            });

            console.log(`   ✅ Found ${products.length} products`);

            // Add to results
            products.forEach((p, idx) => {
                allProducts.push({
                    productId: allProducts.length + 1,
                    ...p,
                });

                if (idx < 3) {  // Show first 3
                    console.log(`      ${idx + 1}. ${p.name} - ₹${p.price}`);
                }
            });

            if (products.length === 0) {
                console.log(`   ⚠️  No products found, stopping...`);
                break;
            }

            // Rate limiting
            await sleep(2000);
        }

    } finally {
        await browser.close();
    }

    // Save results
    const output = {
        scrapedAt: new Date().toISOString(),
        source: "Tata 1mg",
        letter: letter,
        totalProducts: allProducts.length,
        products: allProducts,
    };

    fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Scraping Complete!`);
    console.log(`${'='.repeat(60)}`);
    console.log(`📁 Saved to: ${outputFile}`);
    console.log(`📦 Total products: ${allProducts.length}`);

    return output;
}

// Run
scrapeTata1mg({
    letter: "Z",
    maxPages: 2,
    outputFile: "tata1mg_products.json",
})
    .then(results => {
        console.log(`\n🎉 Success! Scraped ${results.totalProducts} products from Tata 1mg`);
    })
    .catch(error => {
        console.error("\n💥 Error:", error);
        process.exit(1);
    });
