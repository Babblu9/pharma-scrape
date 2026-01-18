// directScraper.js - Direct URL scraper for complete product details
import { chromium } from "playwright";
import fs from "fs";

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Scrape complete product details from direct URL
 */
async function scrapeProductDirect(page, productUrl) {
    console.log(`   🌐 Loading: ${productUrl}`);

    try {
        await page.goto(productUrl, {
            waitUntil: "networkidle",
            timeout: 30000,
        });

        await page.waitForTimeout(3000);

        const details = await page.evaluate(() => {
            const getText = (selector) => {
                const el = document.querySelector(selector);
                return el?.textContent?.trim() || null;
            };

            // Get text after a label by finding it in the page text
            const getAfterLabel = (labelText) => {
                const allText = document.body.innerText;
                const lines = allText.split('\\n').map(l => l.trim()).filter(l => l);

                for (let i = 0; i < lines.length; i++) {
                    if (lines[i] === labelText && i + 1 < lines.length) {
                        return lines[i + 1];
                    }
                }
                return null;
            };

            return {
                name: getText('h1'),
                manufacturer: getAfterLabel('Manufacturer/Marketer'),
                consumeType: getAfterLabel('Consume Type'),
                returnPolicy: getAfterLabel('Return Policy'),
                expiryDate: getAfterLabel('Expires on or after'),
                price: getText('[class*="SellingPrice"], [class*="sellingPrice"]'),
                mrp: getText('[class*="MRP"], [class*="mrp"]'),
                discount: getText('[class*="discount"], [class*="off"]'),
                image: document.querySelector('img[alt*="product"], img[class*="product"]')?.src,
            };
        });

        return details;

    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        return null;
    }
}

/**
 * Main scraper
 */
async function scrapeDirectUrls(productUrls) {
    console.log("🚀 Starting DIRECT URL scraper...\n");
    console.log(`📦 Scraping ${productUrls.length} products\n`);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    const results = [];

    try {
        for (let i = 0; i < productUrls.length; i++) {
            const url = productUrls[i];
            console.log(`\n[${i + 1}/${productUrls.length}]`);

            const details = await scrapeProductDirect(page, url);

            if (details && details.name) {
                // Parse numbers
                const priceMatch = details.price?.match(/[\d,]+\.?\d*/);
                const price = priceMatch ? parseFloat(priceMatch[0].replace(/,/g, '')) : 0;

                const mrpMatch = details.mrp?.match(/[\d,]+\.?\d*/);
                const mrp = mrpMatch ? parseFloat(mrpMatch[0].replace(/,/g, '')) : 0;

                const discountMatch = details.discount?.match(/(\d+)%/);
                const discount = discountMatch ? discountMatch[1] : "0";

                const product = {
                    productId: i + 1,
                    name: details.name,
                    manufacturer: details.manufacturer || "N/A",
                    consumeType: details.consumeType || "N/A",
                    returnPolicy: details.returnPolicy || "N/A",
                    expiryDate: details.expiryDate || "N/A",
                    price: {
                        selling: price,
                        mrp: mrp,
                        discount: discount + "%",
                    },
                    image: details.image || null,
                    url: url,
                };

                results.push(product);

                console.log(`   ✅ ${details.name}`);
                console.log(`      Manufacturer: ${product.manufacturer}`);
                console.log(`      Consume Type: ${product.consumeType}`);
                console.log(`      Return Policy: ${product.returnPolicy}`);
                console.log(`      Price: ₹${product.price.selling} (MRP: ₹${product.price.mrp})`);
            } else {
                console.log(`   ⚠️  Could not extract details`);
                results.push({
                    productId: i + 1,
                    url: url,
                    error: "Could not extract details",
                });
            }

            await sleep(2000);
        }

    } finally {
        await browser.close();
    }

    // Save results
    const output = {
        scrapedAt: new Date().toISOString(),
        totalProducts: results.filter(p => !p.error).length,
        products: results,
    };

    fs.writeFileSync("complete_products_direct.json", JSON.stringify(output, null, 2));

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Scraping Complete!`);
    console.log(`${'='.repeat(60)}`);
    console.log(`📁 Saved to: complete_products_direct.json`);
    console.log(`📦 Products with complete details: ${output.totalProducts}`);
    console.log(`❌ Failed: ${results.filter(p => p.error).length}`);

    return output;
}

// Example URLs (you can add more)
const productUrls = [
    "https://www.apollopharmacy.in/otc/neuherbs-deep-sea-fish-oil-lemon-flavoured-2500-mg-60-softgels",
];

scrapeDirectUrls(productUrls)
    .then(results => {
        console.log(`\n🎉 Success! Scraped ${results.totalProducts} products with COMPLETE details!`);
    })
    .catch(error => {
        console.error("\n💥 Error:", error);
        process.exit(1);
    });
