// simpleCategories.js - Simplified category scraper with known SKUs
import { getApolloToken } from "./token.js";
import { getProductInfo } from "./productScraper.js";
import fs from "fs";

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Scrape products organized by categories
 * Input: Category structure with SKU lists
 * Output: Structured JSON with name, formula, price per product
 */
export async function scrapeByCategories(categoryData, outputFile = "organized_products.json") {
    console.log("🚀 Starting category-based product scraping...\n");

    // Get authentication token
    console.log("🔐 Getting authentication token...");
    const token = await getApolloToken();
    console.log("✅ Token obtained\n");

    const results = [];

    for (let i = 0; i < categoryData.length; i++) {
        const category = categoryData[i];
        console.log(`\n[${i + 1}/${categoryData.length}] Category: ${category.name}`);

        const products = [];

        for (let j = 0; j < category.skus.length; j++) {
            const sku = category.skus[j];
            console.log(`   [${j + 1}/${category.skus.length}] Processing SKU: ${sku}`);

            try {
                const details = await getProductInfo(token, sku);

                products.push({
                    productId: j + 1,
                    sku: sku,
                    name: `Product ${sku}`, // Can be enhanced with page scraping
                    formula: details.availability?.packInfo || "N/A",
                    price: {
                        selling: details.pricing.sellingPrice,
                        mrp: details.pricing.mrp,
                        discount: `${details.pricing.discount}%`,
                    },
                    availability: details.availability.inStock ? "In Stock" : "Out of Stock",
                    stats: details.stats,
                    expiryDate: details.expiryDate,
                });

                console.log(`      ✅ ₹${details.pricing.sellingPrice} - ${details.availability.packInfo}`);

            } catch (error) {
                console.log(`      ❌ Error: ${error.message}`);
                products.push({
                    productId: j + 1,
                    sku: sku,
                    error: error.message,
                });
            }

            // Rate limiting
            if (j < category.skus.length - 1) {
                await sleep(1000);
            }
        }

        results.push({
            categoryId: i + 1,
            categoryName: category.name,
            productCount: products.length,
            products: products,
        });
    }

    // Save results
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));

    // Print summary
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Scraping Complete!`);
    console.log(`${'='.repeat(60)}`);
    console.log(`📁 Results saved to: ${outputFile}`);
    console.log(`📂 Categories: ${results.length}`);

    const totalProducts = results.reduce((sum, cat) => sum + cat.products.length, 0);
    const successfulProducts = results.reduce((sum, cat) =>
        sum + cat.products.filter(p => !p.error).length, 0);

    console.log(`📦 Total products: ${totalProducts}`);
    console.log(`✅ Successful: ${successfulProducts}`);
    console.log(`❌ Failed: ${totalProducts - successfulProducts}`);

    return results;
}

// Example usage
if (import.meta.url === `file://${process.argv[1]}`) {
    // Define your categories and SKUs
    const categoryData = [
        {
            name: "Vitamins & Supplements",
            skus: ["NEU1021", "VIT001", "SUP002"],
        },
        {
            name: "Pain Relief",
            skus: ["PAIN001", "PAIN002"],
        },
        {
            name: "Diabetes Care",
            skus: ["DIA001", "DIA002", "DIA003"],
        },
    ];

    scrapeByCategories(categoryData, "organized_products.json")
        .then(results => {
            console.log(`\n🎉 Successfully organized ${results.length} categories!`);
        })
        .catch(error => {
            console.error("\n💥 Fatal error:", error);
            process.exit(1);
        });
}
