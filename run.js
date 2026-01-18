// run.js — Entry Point
import { scrapeCategory } from "./scraper.js";
import fs from "fs";

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
    console.log("🚀 Starting Tata 1mg scraper (Anti-Bot Safe)\n");

    // Categories to scrape
    const categories = [
        {
            name: "Vitamins & Supplements",
            url: "https://www.1mg.com/categories/vitamins-supplements-328"
        },
        {
            name: "Ayurveda",
            url: "https://www.1mg.com/categories/ayurveda-104"
        },
    ];

    const allResults = [];

    for (let i = 0; i < categories.length; i++) {
        const category = categories[i];

        console.log(`\n[${i + 1}/${categories.length}] ${category.name}`);
        console.log(`URL: ${category.url}\n`);

        try {
            const products = await scrapeCategory(category.url);

            console.log(`✅ Found ${products.length} products\n`);

            // Show first 3
            products.slice(0, 3).forEach((p, idx) => {
                console.log(`   ${idx + 1}. ${p.name} - ₹${p.price}`);
            });

            allResults.push({
                categoryName: category.name,
                categoryUrl: category.url,
                productCount: products.length,
                products: products,
            });

            // Sleep between categories (IMPORTANT)
            if (i < categories.length - 1) {
                console.log(`\n⏳ Sleeping 30 seconds before next category...\n`);
                await sleep(30000);
            }

        } catch (error) {
            console.error(`❌ Error: ${error.message}\n`);
            allResults.push({
                categoryName: category.name,
                categoryUrl: category.url,
                error: error.message,
            });
        }
    }

    // Save results
    const output = {
        scrapedAt: new Date().toISOString(),
        source: "Tata 1mg",
        totalCategories: allResults.length,
        totalProducts: allResults.reduce((sum, cat) => sum + (cat.productCount || 0), 0),
        categories: allResults,
    };

    fs.writeFileSync("tata1mg_final.json", JSON.stringify(output, null, 2));

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Scraping Complete!`);
    console.log(`${'='.repeat(60)}`);
    console.log(`📁 Saved to: tata1mg_final.json`);
    console.log(`📦 Total products: ${output.totalProducts}`);
    console.log(`📂 Categories: ${output.totalCategories}`);

})();
