// scrapeAll.js - Extended functionality for bulk scraping
import { getApolloToken } from "./token.js";
import { getSkuInfo } from "./skuInfo.js";
import fs from "fs";

// Helper function for rate limiting
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function scrapeMultipleSkus(skus, pincode = "", outputFile = "products.json") {
    let token = await getApolloToken();
    const results = [];
    let tokenRefreshCount = 0;

    console.log(`🚀 Starting bulk scrape for ${skus.length} SKUs...`);
    console.log(`⏱️  Rate limit: 1 request/second\n`);

    for (let i = 0; i < skus.length; i++) {
        const sku = skus[i];

        try {
            console.log(`[${i + 1}/${skus.length}] Fetching SKU: ${sku}`);

            const data = await getSkuInfo(token, sku, pincode);
            results.push({
                sku,
                timestamp: new Date().toISOString(),
                data,
            });

            console.log(`✅ Success - Price: ₹${data.pdpPriceInfo?.sellingPrice || 'N/A'}`);

        } catch (error) {
            // Check if token expired
            if (error.response?.status === 401 || error.message.includes("UNAUTHENTICATED")) {
                console.log("🔄 Token expired, refreshing...");
                token = await getApolloToken();
                tokenRefreshCount++;

                // Retry the same SKU
                try {
                    const data = await getSkuInfo(token, sku, pincode);
                    results.push({
                        sku,
                        timestamp: new Date().toISOString(),
                        data,
                    });
                    console.log(`✅ Success after token refresh`);
                } catch (retryError) {
                    console.error(`❌ Failed even after token refresh: ${retryError.message}`);
                    results.push({
                        sku,
                        timestamp: new Date().toISOString(),
                        error: retryError.message,
                    });
                }
            } else {
                console.error(`❌ Error: ${error.message}`);
                results.push({
                    sku,
                    timestamp: new Date().toISOString(),
                    error: error.message,
                });
            }
        }

        // Rate limiting: wait 1 second between requests
        if (i < skus.length - 1) {
            await sleep(1000);
        }
    }

    // Save results to file
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));

    console.log(`\n✅ Scraping complete!`);
    console.log(`📁 Results saved to: ${outputFile}`);
    console.log(`📊 Total SKUs: ${skus.length}`);
    console.log(`✅ Successful: ${results.filter(r => !r.error).length}`);
    console.log(`❌ Failed: ${results.filter(r => r.error).length}`);
    console.log(`🔄 Token refreshes: ${tokenRefreshCount}`);

    return results;
}

// Example usage
if (import.meta.url === `file://${process.argv[1]}`) {
    const exampleSkus = [
        "NEU1021",
        "OTC123456", // Add more SKUs here
        "MED789012",
    ];

    scrapeMultipleSkus(exampleSkus, "500032")
        .catch(error => {
            console.error("Fatal error:", error);
            process.exit(1);
        });
}
