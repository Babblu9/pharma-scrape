// skuInfo.js
import axios from "axios";

export async function getSkuInfo(token, sku, pincode = "") {
    const res = await axios.post(
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

    return res.data.data.getSkuInfo;
}
