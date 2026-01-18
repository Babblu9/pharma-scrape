// allCategories.js - Scrape ALL Tata 1mg categories
import { scrapeCategory } from "./scraper.js";
import fs from "fs";

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// All major Tata 1mg categories
const ALL_CATEGORIES = [
    { name: "Vitamins & Supplements", url: "https://www.1mg.com/categories/vitamins-supplements-328" },
    { name: "Ayurveda", url: "https://www.1mg.com/categories/ayurveda-104" },
    { name: "Homeopathy", url: "https://www.1mg.com/categories/homeopathy-105" },
    { name: "Fitness & Wellness", url: "https://www.1mg.com/categories/fitness-wellness-330" },
    { name: "Mom & Baby", url: "https://www.1mg.com/categories/mom-baby-329" },
    { name: "Devices", url: "https://www.1mg.com/categories/devices-106" },
    { name: "Personal Care", url: "https://www.1mg.com/categories/personal-care-108" },
    { name: "Health Food & Drinks", url: "https://www.1mg.com/categories/health-food-drinks-107" },
    { name: "Skin Care", url: "https://www.1mg.com/categories/skin-care-331" },
    { name: "Home Care", url: "https://www.1mg.com/categories/home-care-332" },
    { name: "Diabetic Care", url: "https://www.1mg.com/categories/diabetic-care-333" },
    { name: "Elderly Care", url: "https://www.1mg.com/categories/elderly-care-334" },
    { name: "Sexual Wellness", url: "https://www.1mg.com/categories/sexual-wellness-335" },
    { name: "Health Conditions", url: "https://www.1mg.com/categories/health-conditions-336" },
];

(async () => {
    console.log("🚀 Starting COMPLETE Tata 1mg Category Scraper\n");
    console.log(`📂 Total Categories: ${ALL_CATEGORIES.length}\n`);
    console.log("⚠️  This will take approximately " + Math.ceil(ALL_CATEGORIES.length * 0.5) + " minutes");
    console.log("    (30s delay between each category for anti-bot safety)\n");

    const allResults = [];
    let totalProducts = 0;

    for (let i = 0; i < ALL_CATEGORIES.length; i++) {
        const category = ALL_CATEGORIES[i];

        console.log(`\n${'='.repeat(60)}`);
        console.log(`[${i + 1}/${ALL_CATEGORIES.length}] ${category.name}`);
        console.log(`${'='.repeat(60)}`);
        console.log(`URL: ${category.url}\n`);

        try {
            const products = await scrapeCategory(category.url);

            console.log(`✅ Found ${products.length} products\n`);

            // Show first 5
            products.slice(0, 5).forEach((p, idx) => {
                console.log(`   ${idx + 1}. ${p.name} - ₹${p.price}`);
            });

            if (products.length > 5) {
                console.log(`   ... and ${products.length - 5} more`);
            }

            allResults.push({
                categoryId: i + 1,
                categoryName: category.name,
                categoryUrl: category.url,
                productCount: products.length,
                products: products,
            });

            totalProducts += products.length;

            // Save progress after each category
            const progressOutput = {
                scrapedAt: new Date().toISOString(),
                source: "Tata 1mg",
                status: "In Progress",
                categoriesCompleted: i + 1,
                totalCategories: ALL_CATEGORIES.length,
                totalProducts: totalProducts,
                categories: allResults,
            };

            fs.writeFileSync("tata1mg_all_categories.json", JSON.stringify(progressOutput, null, 2));
            console.log(`\n💾 Progress saved (${totalProducts} products from ${i + 1} categories)`);

            // Sleep between categories (CRITICAL for anti-bot)
            if (i < ALL_CATEGORIES.length - 1) {
                console.log(`\n⏳ Sleeping 30 seconds before next category...\n`);
                await sleep(30000);
            }

        } catch (error) {
            console.error(`❌ Error: ${error.message}\n`);
            allResults.push({
                categoryId: i + 1,
                categoryName: category.name,
                categoryUrl: category.url,
                error: error.message,
            });

            // Save progress even on error
            const progressOutput = {
                scrapedAt: new Date().toISOString(),
                source: "Tata 1mg",
                status: "In Progress (with errors)",
                categoriesCompleted: i + 1,
                totalCategories: ALL_CATEGORIES.length,
                totalProducts: totalProducts,
                categories: allResults,
            };

            fs.writeFileSync("tata1mg_all_categories.json", JSON.stringify(progressOutput, null, 2));
        }
    }

    // Final save
    const finalOutput = {
        scrapedAt: new Date().toISOString(),
        source: "Tata 1mg",
        status: "Complete",
        totalCategories: ALL_CATEGORIES.length,
        categoriesWithProducts: allResults.filter(c => c.productCount > 0).length,
        totalProducts: totalProducts,
        categories: allResults,
    };

    fs.writeFileSync("tata1mg_all_categories.json", JSON.stringify(finalOutput, null, 2));

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ COMPLETE SCRAPING FINISHED!`);
    console.log(`${'='.repeat(60)}`);
    console.log(`📁 Saved to: tata1mg_all_categories.json`);
    console.log(`📦 Total products: ${totalProducts}`);
    console.log(`📂 Categories scraped: ${ALL_CATEGORIES.length}`);
    console.log(`✅ Categories with products: ${allResults.filter(c => c.productCount > 0).length}`);
    console.log(`❌ Categories with errors: ${allResults.filter(c => c.error).length}`);

    // Summary by category
    console.log(`\n📊 Summary by Category:`);
    allResults.forEach(cat => {
        if (cat.productCount > 0) {
            console.log(`   ✅ ${cat.categoryName}: ${cat.productCount} products`);
        } else if (cat.error) {
            console.log(`   ❌ ${cat.categoryName}: Error`);
        } else {
            console.log(`   ⚠️  ${cat.categoryName}: 0 products`);
        }
    });

})();
