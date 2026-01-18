// extract.js — Product Extraction (SAFE SELECTORS) - Updated
export async function extractProducts(page) {
    // Wait for products to load - try multiple selectors
    try {
        await page.waitForSelector('div[class*="style__product-card"], div[class*="ProductCard"], a[href*="/drugs/"]', {
            timeout: 60000
        });
    } catch (e) {
        console.log("   ⚠️  Product cards not found, trying alternative selectors...");
        await page.waitForTimeout(5000);
    }

    return await page.evaluate(() => {
        const products = [];

        // Strategy 1: Find product containers
        let containers = document.querySelectorAll('div[class*="style__product-card"]');

        // Strategy 2: If not found, try finding product links
        if (containers.length === 0) {
            containers = document.querySelectorAll('div[class*="ProductCard"], div[class*="product"]');
        }

        // Strategy 3: Find by structure (common pattern)
        if (containers.length === 0) {
            // Look for divs that contain product links
            const allDivs = document.querySelectorAll('div');
            containers = Array.from(allDivs).filter(div => {
                const link = div.querySelector('a[href*="/drugs/"], a[href*="/otc/"]');
                const hasPrice = div.innerText.includes('₹') || div.innerText.includes('MRP');
                return link && hasPrice;
            });
        }

        containers.forEach(container => {
            try {
                // Find product link
                const link = container.querySelector('a[href*="/drugs/"], a[href*="/otc/"]');
                if (!link) return;

                const url = link.href;

                // Extract name - try multiple selectors
                let name = container.querySelector('div[class*="name"], h3, h2, .product-name')?.innerText?.trim();
                if (!name) {
                    // Try getting from link text
                    name = link.innerText?.split('\n')[0]?.trim();
                }

                // Extract manufacturer
                const manufacturer = container.querySelector('div[class*="manufacturer"], div[class*="Manufacturer"]')?.innerText?.trim();

                // Extract pack size
                const packSize = container.querySelector('div[class*="pack"], div[class*="Pack"]')?.innerText?.trim();

                // Extract price
                const priceText = container.innerText;
                const priceMatch = priceText.match(/₹\s*([\d,]+\.?\d*)/);
                const price = priceMatch ? priceMatch[1] : "";

                // Extract MRP
                const mrpMatch = priceText.match(/MRP\s*₹\s*([\d,]+\.?\d*)/i);
                const mrp = mrpMatch ? mrpMatch[1] : price;

                // Prescription
                const prescriptionRequired = priceText.includes('Prescription') ? 'Yes' : 'No';

                if (name && name.length > 2) {
                    products.push({
                        name,
                        manufacturer: manufacturer || 'N/A',
                        packSize: packSize || 'N/A',
                        price,
                        mrp,
                        prescriptionRequired,
                        url
                    });
                }
            } catch (e) {
                // Skip invalid containers
            }
        });

        return products;
    });
}
