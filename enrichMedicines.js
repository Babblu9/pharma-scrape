import fs from 'fs';
import { chromium } from 'playwright';
import mongoose from 'mongoose';
import Medicine from './models/Medicine.js'; // Import Schema

// CONFIG
const SOURCE_FILE = './medicines_letters_B_to_Z.json';
const BATCH_SIZE = 50; // Reduced batch size for safety with DB writes
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/medicine_db";

async function enrichMedicines() {
    console.log("🚀 Starting Medicine Enrichment with Mongoose...");

    // 1. Load Source Data
    let sourceData = [];
    try {
        if (fs.existsSync(SOURCE_FILE)) {
            const raw = fs.readFileSync(SOURCE_FILE, 'utf8');
            const json = JSON.parse(raw);
            if (Array.isArray(json)) {
                sourceData = json;
            } else if (json.medicines) {
                sourceData = json.medicines;
            } else if (json.letters && Array.isArray(json.letters)) {
                json.letters.forEach(lg => {
                    if (lg.medicines) sourceData.push(...lg.medicines);
                });
            } else {
                Object.values(json).forEach(arr => {
                    if (Array.isArray(arr)) sourceData.push(...arr);
                });
            }
        } else {
            console.error("❌ Source file not found:", SOURCE_FILE);
            return;
        }
    } catch (e) {
        console.error("❌ Error reading source file:", e);
        return;
    }

    // 2. Connect to Mongoose
    try {
        await mongoose.connect(MONGO_URI);
        console.log("✅ Connected to MongoDB via Mongoose");
    } catch (e) {
        console.error("❌ MongoDB Connection Failed:", e);
        return;
    }

    // 3. Filter Items (Resume Logic using DB)
    // Fetch URLs of already enriched medicines
    const existingDocs = await Medicine.find({}, { url: 1 }).lean();
    const processedUrls = new Set(existingDocs.map(d => d.url));

    const toProcess = sourceData.filter(m => !processedUrls.has(m.url));

    console.log(`📊 Total Source: ${sourceData.length} | In DB: ${existingDocs.length} | Queue: ${toProcess.length}`);

    if (toProcess.length === 0) {
        console.log("✅ All medicines have been enriched!");
        await mongoose.connection.close();
        return;
    }

    // 4. Select Batch
    const batch = toProcess.slice(0, BATCH_SIZE);
    console.log(`📦 Processing Batch of ${batch.length} medicines...`);

    const browser = await chromium.launch({ headless: true }); // Headless must be true for CI
    const context = await browser.newContext({
        viewport: { width: 1366, height: 768 },
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    });

    await context.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    const page = await context.newPage();
    // page.on('console', msg => console.log('PAGE LOG:', msg.text())); // Disabled for production


    for (let i = 0; i < batch.length; i++) {
        const med = batch[i];
        console.log(`\n[${i + 1}/${batch.length}] 💊 Enriching: ${med.name}`);
        console.log(`   🔗 URL: ${med.url}`);

        try {
            await page.goto(med.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await behaveLikeHuman(page);

            const details = await page.evaluate(() => {
                const getSectionContent = (headerText) => {
                    // Broader selector to catch headers in H tags or divs with header-like classes
                    const headers = Array.from(document.querySelectorAll('h2, h3, h4, h5, h6, div[class*="title"], div[class*="Title"], div[class*="header"], div[class*="Header"], div[class*="head"], div[class*="Head"]'));
                    const header = headers.find(h => h.innerText.trim().toUpperCase().includes(headerText.toUpperCase()));
                    if (header) {
                        let content = header.nextElementSibling;
                        if (content && content.innerText.trim()) return content.innerText.trim();
                        const container = header.parentElement;
                        if (container && container.nextElementSibling) {
                            return container.nextElementSibling.innerText.trim();
                        }
                    }
                    return null;
                };

                const getSectionList = (headerText) => {
                    const headers = Array.from(document.querySelectorAll('h2, h3, h4, h5, h6, div[class*="title"], div[class*="Title"], div[class*="header"], div[class*="Header"], div[class*="head"], div[class*="Head"]'));
                    const header = headers.find(h => h.innerText.trim().toUpperCase().includes(headerText.toUpperCase()));
                    if (header) {
                        let container = header.parentElement;
                        let listItems = [];
                        if (header.nextElementSibling) {
                            listItems = Array.from(header.nextElementSibling.querySelectorAll('li'));
                        }
                        if (listItems.length === 0 && container.nextElementSibling) {
                            listItems = Array.from(container.nextElementSibling.querySelectorAll('li'));
                        }
                        return listItems.map(li => li.innerText.trim());
                    }
                    return [];
                };

                const getSafetyAdvice = () => {
                    const set = {};
                    const headers = Array.from(document.querySelectorAll('h2, h3, h4, div[class*="title"]'));
                    const safetyHeader = headers.find(h => h.innerText.trim().toUpperCase() === 'SAFETY ADVICE');
                    if (!safetyHeader) return set;
                    const container = safetyHeader.parentElement;
                    if (!container) return set;
                    const warningRows = Array.from(container.querySelectorAll('div[class*="warning-top"]'));
                    warningRows.forEach(row => {
                        const labelEl = row.querySelector('span');
                        if (!labelEl) return;
                        const label = labelEl.innerText.trim();
                        const key = label.toLowerCase().replace(/\s+/g, '');
                        const statusEl = row.querySelector('div[class*="warning-tag"]');
                        const status = statusEl ? statusEl.innerText.trim().toUpperCase() : 'UNKNOWN';
                        const detailsEl = row.nextElementSibling;
                        const details = detailsEl ? detailsEl.innerText.trim() : '';
                        const validKeys = ['alcohol', 'pregnancy', 'breastfeeding', 'driving', 'kidney', 'liver'];
                        if (validKeys.includes(key)) {
                            set[key] = { status, details };
                        }
                    });
                    return set;
                };

                const getMissedDose = () => {
                    const headers = Array.from(document.querySelectorAll('h2, h3'));
                    const header = headers.find(h => h.innerText.includes("forget to take"));
                    if (header && header.nextElementSibling) {
                        return header.nextElementSibling.innerText.trim();
                    }
                    return null;
                };

                const getSubstitutes = () => {
                    const headers = Array.from(document.querySelectorAll('h2, h3, div')).filter(h => h.innerText.trim() === 'All substitutes');
                    const header = headers[0];
                    if (!header) return [];
                    let container = header.closest('div[class*="DrugPane__title"]');
                    if (container && container.nextElementSibling) {
                        const listContainer = container.nextElementSibling;
                        const items = Array.from(listContainer.querySelectorAll('div[class*="SubstituteItem__item"]'));
                        if (items.length === 0) {
                            const links = Array.from(listContainer.querySelectorAll('a[href*="/drugs/"]'));
                            return links.map(link => {
                                let price = "Unknown";
                                let parent = link.closest('div');
                                if (parent && parent.innerText.includes('₹')) {
                                    price = parent.innerText.match(/₹[\d\.]+/)?.[0] || "Unknown";
                                }
                                return { name: link.innerText.trim(), price: price, url: link.href };
                            });
                        }
                        return items.map(item => {
                            const nameEl = item.querySelector('div[class*="name"]');
                            const priceEl = item.querySelector('div[class*="price"]');
                            return { name: nameEl ? nameEl.innerText.trim() : "Unknown", price: priceEl ? priceEl.innerText.trim() : "Unknown", url: item.querySelector('a')?.href || null };
                        });
                    }
                    return [];
                };

                const getPatientConcerns = () => {
                    const headers = Array.from(document.querySelectorAll('h2, h3'));
                    const header = headers.find(h => h.innerText.trim() === 'Patient concerns');
                    if (!header) return [];
                    let container = header.parentElement.nextElementSibling;
                    if (container) {
                        const slides = Array.from(container.querySelectorAll('.slick-slide:not(.slick-cloned)'));
                        if (slides.length > 0) return slides.map(slide => slide.innerText.trim());
                        return [container.innerText.trim()];
                    }
                    return [];
                };

                const getFAQs = () => {
                    const faqTiles = Array.from(document.querySelectorAll('div[class*="Faqs__tile"]'));
                    if (faqTiles.length > 0) {
                        return faqTiles.map(tile => {
                            const q = tile.querySelector('h3[class*="Faqs__ques"]');
                            const a = tile.querySelector('div[class*="Faqs__ans"]');
                            return { question: q ? q.innerText.trim() : "Unknown", answer: a ? a.innerText.trim() : "Unknown" };
                        });
                    }
                    return [];
                };

                return {
                    introduction: getSectionContent('PRODUCT INTRODUCTION'),
                    uses: getSectionList('Uses of'),
                    benefits: getSectionContent('Benefits of'),
                    sideEffects: {
                        summary: getSectionContent('Side effects of'),
                        common: getSectionList('Common side effects of')
                    },
                    howToUse: getSectionContent('How to use'),
                    howItWorks: getSectionContent('works'), // Matches "How <Name> works"
                    safetyAdvice: getSafetyAdvice(),
                    missedDose: getMissedDose(),
                    substitutes: getSubstitutes(),
                    quickTips: getSectionList('Quick tips'),
                    factBox: {
                        habitForming: document.body.innerText.includes("Habit Forming\nNo") ? false : (document.body.innerText.includes("Habit Forming\nYes") ? true : "Unknown"),
                        therapeuticClass: getSectionContent('Therapeutic Class') || (document.body.innerText.match(/Therapeutic Class\n(.*)/)?.[1])
                    },
                    patientConcerns: getPatientConcerns(),
                    faqs: getFAQs(),
                    manufacturerDetails: getSectionContent('Marketer details')
                };
            });

            // Upsert (Insert if new, Update if exists)
            await Medicine.findOneAndUpdate(
                { url: med.url },
                { $set: { ...med, ...details, lastUpdated: new Date() } },
                { upsert: true, new: true }
            );

            console.log(`   ✅ Saved to Mongoose DB`);
            // await page.waitForTimeout(2000 + Math.random() * 3000); // Politeness delay

        } catch (error) {
            console.error(`   ❌ Failed to enrich ${med.url}: ${error.message}`);
            await Medicine.findOneAndUpdate(
                { url: med.url },
                { $set: { ...med, parsingError: error.message, lastUpdated: new Date() } },
                { upsert: true, new: true }
            );
        }
    }

    await browser.close();
    await mongoose.connection.close();
    console.log("🏁 Batch processing complete.");
}

async function behaveLikeHuman(page) {
    try {
        await page.mouse.move(Math.random() * 500, Math.random() * 500);
        await page.mouse.wheel(0, 500);
        await page.waitForTimeout(1000);
        await page.mouse.wheel(0, 1000);
        await page.waitForTimeout(500);
    } catch (e) { }
}

enrichMedicines();
