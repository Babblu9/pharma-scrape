// index.js
import { getApolloToken } from "./token.js";
import { getSkuInfo } from "./skuInfo.js";

(async () => {
    try {
        console.log("🔐 Extracting Apollo Pharmacy authentication token...");
        const token = await getApolloToken();
        console.log("✅ Token:", token.slice(0, 10), "...");

        console.log("\n📦 Fetching SKU information for NEU1021...");
        const skuData = await getSkuInfo(token, "NEU1021");

        console.log("\n📊 Product Data:");
        console.log(JSON.stringify(skuData, null, 2));
    } catch (error) {
        console.error("❌ Error:", error.message);
        process.exit(1);
    }
})();
