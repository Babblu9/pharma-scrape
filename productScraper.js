// productScraper.js - Working product scraper with actual Apollo API
import axios from "axios";
import { getSkuInfo } from "./skuInfo.js";

/**
 * Get enhanced product details using available API fields
 * Note: Apollo's API is limited, so we use getSkuInfo which provides pricing and availability
 * @param {string} token - Bearer authentication token
 * @param {string} sku - Product SKU code
 * @param {string} pincode - Optional pincode for location-based pricing
 * @returns {Promise<Object>} Product information with pricing and availability
 */
export async function getProductInfo(token, sku, pincode = "") {
    // Use the working getSkuInfo query
    const skuData = await getSkuInfo(token, sku, pincode);

    // Enhance with product URL (can be constructed from SKU)
    const productUrl = `https://www.apollopharmacy.in/medicine-info/${sku}`;

    return {
        sku,
        productUrl,
        stats: skuData.stat,
        expiryDate: skuData.expiryDate,
        pricing: {
            price: skuData.pdpPriceInfo?.price,
            mrp: skuData.pdpPriceInfo?.mrp,
            discount: skuData.pdpPriceInfo?.discount,
            sellingPrice: skuData.pdpPriceInfo?.sellingPrice,
            discountPercent: skuData.pdpPriceInfo?.discountPercent,
        },
        availability: {
            inStock: skuData.tatInfo?.magentoAvailability,
            message: skuData.tatInfo?.message,
            unitPrice: skuData.tatInfo?.unitPrice,
            packInfo: skuData.tatInfo?.packInfo,
        },
        rawData: skuData, // Include full API response
    };
}

/**
 * Search for products using Apollo's search API
 * @param {string} token - Bearer authentication token
 * @param {string} searchText - Search query
 * @param {number} pageSize - Number of results per page
 * @returns {Promise<Object>} Search results
 */
export async function searchProducts(token, searchText, pageSize = 20) {
    const res = await axios.post(
        "https://api.apollo247.com/",
        {
            operationName: "searchMedicineProducts",
            variables: {
                searchText,
                pageSize,
                offset: 0,
            },
            query: `
        query searchMedicineProducts($searchText: String!, $pageSize: Int, $offset: Int) {
          searchMedicineProducts(searchText: $searchText, pageSize: $pageSize, offset: $offset) {
            products {
              id
              name
              sku
              price
              special_price
              mrp
              thumbnail
              url_key
              type_id
              is_in_stock
              is_prescription_required
            }
            total_count
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

    return res.data.data.searchMedicineProducts;
}

/**
 * Get product details by scraping the product page (fallback for additional data)
 * This uses Playwright to extract data not available via API
 * @param {string} sku - Product SKU
 * @returns {Promise<Object>} Scraped product details
 */
export async function scrapeProductPage(sku) {
    const { chromium } = await import("playwright");

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
        await page.goto(`https://www.apollopharmacy.in/medicine-info/${sku}`, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
        });

        // Extract data from the page
        const productData = await page.evaluate(() => {
            const getName = () => {
                const h1 = document.querySelector('h1');
                return h1 ? h1.textContent.trim() : null;
            };

            const getImage = () => {
                const img = document.querySelector('img[alt*="product"], .product-image img, [class*="ProductImage"] img');
                return img ? img.src : null;
            };

            const getDescription = () => {
                const desc = document.querySelector('[class*="description"], .product-description');
                return desc ? desc.textContent.trim() : null;
            };

            const getAllImages = () => {
                const images = document.querySelectorAll('.product-gallery img, [class*="gallery"] img');
                return Array.from(images).map(img => img.src);
            };

            return {
                name: getName(),
                mainImage: getImage(),
                description: getDescription(),
                galleryImages: getAllImages(),
            };
        });

        await browser.close();
        return productData;

    } catch (error) {
        await browser.close();
        throw error;
    }
}
