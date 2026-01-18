// discovery.js - Real product discovery via category/search GraphQL
import axios from "axios";

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Discover products from category pages using Playwright
 * This captures REAL SKUs from Apollo's category listings
 */
export async function discoverCategoryProducts(page, categoryUrl, maxProducts = 50) {
    console.log(`   🔍 Discovering products from: ${categoryUrl}`);

    await page.goto(categoryUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
    });

    // Wait for products to load
    await page.waitForTimeout(3000);

    // Scroll to load more products
    for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await page.waitForTimeout(1000);
    }

    // Extract product data from page
    const products = await page.evaluate(() => {
        const productList = [];

        // Find all product links
        const links = document.querySelectorAll('a[href*="/medicine-info/"], a[href*="/otc/"]');

        links.forEach(link => {
            const href = link.href;

            // Extract SKU from URL
            let sku = null;
            const match = href.match(/\/(medicine-info|otc)\/([^/?#]+)/i);
            if (match && match[2]) {
                // Get the URL slug as SKU
                sku = match[2];

                // Try to find actual SKU in the slug (usually at the end)
                // Pattern: product-name-SKU123 or just SKU123
                const skuMatch = sku.match(/([A-Z]{3,}\d{3,})/i);
                if (skuMatch) {
                    sku = skuMatch[1];
                }
            }

            // Also check data attributes
            const dataSkuEl = link.closest('[data-sku]') || link.querySelector('[data-sku]');
            if (dataSkuEl) {
                const dataSku = dataSkuEl.getAttribute('data-sku');
                if (dataSku && dataSku.length > 2) {
                    sku = dataSku;
                }
            }

            // Extract name
            const nameEl = link.querySelector('h2, h3, [class*="name"], [class*="Name"], [class*="title"]') || link;
            const name = nameEl?.textContent?.trim();

            // Extract price
            const priceEl = link.querySelector('[class*="price"], [class*="Price"]') ||
                link.closest('[class*="product"]')?.querySelector('[class*="price"]');
            const priceText = priceEl?.textContent?.trim();

            if (sku && sku.length > 2 && name && name.length > 3) {
                productList.push({
                    sku: sku.toUpperCase(),
                    name: name,
                    priceText: priceText || null,
                });
            }
        });

        return productList;
    });

    // Remove duplicates
    const uniqueProducts = Array.from(
        new Map(products.map(p => [p.sku, p])).values()
    );

    console.log(`   ✅ Found ${uniqueProducts.length} unique products`);

    return uniqueProducts.slice(0, maxProducts);
}

/**
 * Discover all categories from homepage
 */
export async function discoverCategories(page) {
    console.log("📂 Discovering categories...");

    await page.goto("https://www.apollopharmacy.in/", {
        waitUntil: "domcontentloaded",
        timeout: 60000,
    });

    await page.waitForTimeout(3000);

    const categories = await page.evaluate(() => {
        const categoryList = [];
        const seen = new Set();

        // Find category links
        const links = document.querySelectorAll('a[href*="/category/"], a[href*="/otc"], a[href*="/medicines"]');

        links.forEach(link => {
            const href = link.href;
            const text = link.textContent?.trim();

            if (href && text && !seen.has(href) && text.length > 2 && text.length < 50) {
                seen.add(href);
                categoryList.push({
                    name: text,
                    url: href,
                });
            }
        });

        return categoryList;
    });

    console.log(`✅ Found ${categories.length} categories`);

    return categories;
}

/**
 * Enrich SKU with full product data using GraphQL
 * Includes proper error handling and token refresh detection
 */
export async function enrichSku(token, sku, pincode = "500032") {
    try {
        const response = await axios.post(
            "https://api.apollo247.com/",
            {
                operationName: "getSkuInfo",
                variables: {
                    skuInfoInput: {
                        sku,
                        qty: 1,
                        addressInfo: {
                            pincode,
                            lat: 0,
                            lng: 0,
                        },
                    },
                },
                query: `
          query getSkuInfo($skuInfoInput: SkuInfoInput!) {
            getSkuInfo(skuInfoInput: $skuInfoInput) {
              stat
              expiryDate
              pdpPriceInfo {
                price
                mrp
                discount
                sellingPrice
                discountPercent
              }
              tatInfo {
                magentoAvailability
                message
                unitPrice
                packInfo
              }
            }
          }
        `,
            },
            {
                headers: {
                    authorization: `Bearer ${token}`,
                    "content-type": "application/json",
                    origin: "https://www.apollopharmacy.in",
                    referer: "https://www.apollopharmacy.in/",
                    "user-agent": "Mozilla/5.0",
                },
            }
        );

        // Check for auth errors
        if (response.data.errors) {
            const authError = response.data.errors.find(
                e => e.extensions?.code === "UNAUTHENTICATED"
            );
            if (authError) {
                throw new Error("TOKEN_EXPIRED");
            }
        }

        return response.data.data?.getSkuInfo;

    } catch (error) {
        if (error.message === "TOKEN_EXPIRED") {
            throw error;
        }

        // Check for auth errors in response
        if (error.response?.data?.errors) {
            const authError = error.response.data.errors.find(
                e => e.extensions?.code === "UNAUTHENTICATED"
            );
            if (authError) {
                throw new Error("TOKEN_EXPIRED");
            }
        }

        throw error;
    }
}

/**
 * Rate-limited enrichment with retry logic
 */
export async function enrichSkuSafe(token, sku, pincode = "500032", retries = 2) {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const data = await enrichSku(token, sku, pincode);

            // Rate limit: 1.2 seconds between requests
            await sleep(1200);

            return data;
        } catch (error) {
            if (error.message === "TOKEN_EXPIRED") {
                throw error; // Let caller handle token refresh
            }

            if (attempt === retries - 1) {
                throw error;
            }

            // Wait before retry
            await sleep(2000);
        }
    }
}
