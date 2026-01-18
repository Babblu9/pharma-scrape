# Tata 1mg Complete Category Scraper

Production-grade scraper for ALL Tata 1mg categories with anti-bot protection.

## 🚀 Quick Start

```bash
# Scrape ALL categories (takes ~7 minutes)
node allCategories.js

# Or scrape specific categories
node run.js
```

## 📂 Categories Covered

1. Vitamins & Supplements
2. Ayurveda
3. Homeopathy
4. Fitness & Wellness
5. Mom & Baby
6. Devices
7. Personal Care
8. Health Food & Drinks
9. Skin Care
10. Home Care
11. Diabetic Care
12. Elderly Care
13. Sexual Wellness
14. Health Conditions

## ✅ Anti-Bot Measures

| Feature | Implementation |
|---------|----------------|
| **Visible Browser** | `headless: false` |
| **Human Behavior** | Mouse movements, scrolling, clicks |
| **Rate Limiting** | 30s sleep between categories |
| **Indian Locale** | `en-IN`, `Asia/Kolkata` |
| **WebDriver Hiding** | Removed navigator.webdriver |
| **SlowMo** | 80ms delays |
| **Progress Saving** | Auto-save after each category |

## 📊 Output Format

```json
{
  "scrapedAt": "2026-01-17T...",
  "source": "Tata 1mg",
  "status": "Complete",
  "totalCategories": 14,
  "totalProducts": 150,
  "categories": [
    {
      "categoryId": 1,
      "categoryName": "Vitamins & Supplements",
      "categoryUrl": "https://...",
      "productCount": 27,
      "products": [
        {
          "name": "Product Name",
          "manufacturer": "Manufacturer Name",
          "packSize": "30 tablets",
          "price": "299",
          "mrp": "399",
          "prescriptionRequired": "No",
          "url": "https://..."
        }
      ]
    }
  ]
}
```

## 🎯 Features

### Progress Saving
- Auto-saves after each category
- Resume from where it left off if interrupted
- Error recovery built-in

### Category-Wise Organization
- Each category stored separately
- Easy to filter and analyze
- Product count per category

### Complete Product Details
- Product name
- Manufacturer (when available)
- Pack size
- Price & MRP
- Prescription requirements
- Direct product URL

## ⏱️ Timing

- **Per Category**: ~30 seconds
- **Total Time**: ~7 minutes for all 14 categories
- **Rate Limit**: 30s sleep between categories

## 🔧 Customization

### Scrape Specific Categories

Edit `allCategories.js`:

```javascript
const ALL_CATEGORIES = [
  { name: "Vitamins & Supplements", url: "..." },
  // Comment out categories you don't want
];
```

### Change Rate Limiting

```javascript
await sleep(60000); // 60 seconds instead of 30
```

### Add Proxy

Edit `scraper.js`:

```javascript
const products = await scrapeCategory(category.url, {
  useProxy: true,
  proxyServer: "http://proxy:port",
  proxyUsername: "user",
  proxyPassword: "pass",
});
```

## 📈 Expected Results

- ✅ 100-200+ products total
- ✅ No timeouts
- ✅ No captchas
- ✅ Stable execution
- ⏱️ ~7 minutes total time

## 🐛 Troubleshooting

### "Timeout exceeded"
- Increase timeout in `scraper.js` to 120000
- Check internet connection

### "0 products found"
- Category page structure may have changed
- Check browser window to see what's loading
- Update selectors in `extract.js`

### "Error after X categories"
- Check `tata1mg_all_categories.json` for progress
- Re-run to continue from where it stopped

## 📝 Files

- `allCategories.js` - Main scraper for all categories
- `run.js` - Scraper for specific categories
- `scraper.js` - Browser setup
- `extract.js` - Product extraction logic
- `human.js` - Human behavior simulation
- `debug.js` - Debug tool with screenshots

## 🎯 Best Practices

1. **Run during off-peak hours** - Better success rate
2. **Use residential proxy** - For scaling
3. **Monitor first run** - Watch browser to ensure it's working
4. **Save results** - Auto-saved to `tata1mg_all_categories.json`
5. **Don't rush** - 30s delays are critical

## 📊 Sample Run

```
🚀 Starting COMPLETE Tata 1mg Category Scraper

📂 Total Categories: 14

⚠️  This will take approximately 7 minutes

[1/14] Vitamins & Supplements
✅ Found 27 products

⏳ Sleeping 30 seconds...

[2/14] Ayurveda
✅ Found 15 products

...

✅ COMPLETE SCRAPING FINISHED!
📦 Total products: 150
📂 Categories scraped: 14
✅ Categories with products: 12
```

---

**Note:** This scraper respects Tata 1mg's servers with proper rate limiting and human-like behavior. Use responsibly.
