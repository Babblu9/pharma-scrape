const fs = require('fs');
const { chromium } = require('playwright');

// FILES
const SOURCE_FILE = './medicines_letters_B_to_Z.json'; // Can be changed to process other files
const OUTPUT_FILE = './medicines_enriched.json'; // The master output file
const BATCH_SIZE = 100; // Process 100 items per run (adjust based on timeout needs)

async function enrichMedicines() {
    console.log("🚀 Starting Medicine Enrichment...");

    // 1. Load Source Data
    let sourceData = [];
    try {
        if (fs.existsSync(SOURCE_FILE)) {
            const raw = fs.readFileSync(SOURCE_FILE, 'utf8');
            // Handle if source is structured as { letter: "A", medicines: [...] } or just [...]
            const json = JSON.parse(raw);
            if (Array.isArray(json)) {
                sourceData = json;
            } else if (json.medicines) {
                // If the file structure is like { letter: "Z", medicines: [...] }
                sourceData = json.medicines;
            } else if (json.letters && Array.isArray(json.letters)) {
                // If the file structure is like { letters: [{ letter: "A", medicines: [...] }] }
                json.letters.forEach(letterGroup => {
                    if (letterGroup.medicines && Array.isArray(letterGroup.medicines)) {
                        sourceData.push(...letterGroup.medicines);
                    }
                });
            } else {
                // If structure is object with keys "A": [...], "B": [...]
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

    // 2. Load Existing Progress (Resume Logic)
    let enrichedData = [];
    if (fs.existsSync(OUTPUT_FILE)) {
        try {
            enrichedData = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
            console.log(`📂 Loaded ${enrichedData.length} already enriched medicines.`);
        } catch (e) {
            console.error("⚠️ Could not read existing output, starting fresh.");
        }
    } else {
        console.log("📂 No existing output file. Starting fresh.");
    }

    // 3. Filter Items to Process
    // Find items in sourceData that are NOT present in enrichedData (by ID or URL)
    const processedUrls = new Set(enrichedData.map(m => m.url));
    const toProcess = sourceData.filter(m => !processedUrls.has(m.url));

    console.log(`📊 Total: ${sourceData.length} | Done: ${enrichedData.length} | Remaining: ${toProcess.length}`);

    if (toProcess.length === 0) {
        console.log("✅ All medicines have been enriched!");
        return;
    }

    // 4. Select Batch
    const batch = toProcess.slice(0, BATCH_SIZE);
    console.log(`📦 Processing Batch of ${batch.length} medicines...`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1366, height: 768 },
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    });

    // Anti-detect injection
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
            await behaveLikeHuman(page); // Scroll and wiggle

            // Extract details
            const details = await page.evaluate(() => {
                // --- HELPER FUNCTIONS ---
                const getSectionContent = (headerText) => {
                    const headers = Array.from(document.querySelectorAll('h2, h3, h4, div[class*="title"]'));
                    const header = headers.find(h => h.innerText.trim().toUpperCase() === headerText.toUpperCase());
                    if (header) {
                        // Attempt 1: Next sibling div
                        let content = header.nextElementSibling;
                        if (content && content.innerText.trim()) return content.innerText.trim();

                        // Attempt 2: Parent's next sibling (common in 1mg layout)
                        const container = header.parentElement;
                        if (container && container.nextElementSibling) {
                            return container.nextElementSibling.innerText.trim();
                        }
                    }
                    return null;
                };

                const getSectionList = (headerText) => {
                    const headers = Array.from(document.querySelectorAll('h2, h3, h4, div[class*="title"]'));
                    const header = headers.find(h => h.innerText.trim().toUpperCase() === headerText.toUpperCase());
                    if (header) {
                        // Find the nearest list container
                        let container = header.parentElement;
                        // Try finding <li> or list items nearby
                        let listItems = [];

                        // Check sibling
                        if (header.nextElementSibling) {
                            listItems = Array.from(header.nextElementSibling.querySelectorAll('li'));
                        }

                        // Check parent's sibling
                        if (listItems.length === 0 && container.nextElementSibling) {
                            listItems = Array.from(container.nextElementSibling.querySelectorAll('li'));
                        }

                        if (listItems.length > 0) {
                            return listItems.map(li => li.innerText.trim());
                        }
                    }
                    return [];
                };

                // Safety Advice Logic
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
                            set[key] = {
                                status: status,
                                details: details
                            };
                        }
                    });

                    return set;
                };

                // Missed Dose Logic
                const getMissedDose = () => {
                    const headers = Array.from(document.querySelectorAll('h2, h3'));
                    const header = headers.find(h => h.innerText.includes("forget to take"));
                    if (header && header.nextElementSibling) {
                        return header.nextElementSibling.innerText.trim();
                    }
                    return null;
                };

                // Substitutes Logic
                const getSubstitutes = () => {
                    const headers = Array.from(document.querySelectorAll('h2, h3, div')).filter(h => h.innerText.trim() === 'All substitutes');
                    const header = headers[0];
                    if (!header) return [];

                    let container = header.closest('div[class*="DrugPane__title"]');
                    if (container && container.nextElementSibling) {
                        const listContainer = container.nextElementSibling;
                        const items = Array.from(listContainer.querySelectorAll('div[class*="SubstituteItem__item"]'));

                        if (items.length === 0) {
                            // Fallback
                            const links = Array.from(listContainer.querySelectorAll('a[href*="/drugs/"]'));
                            return links.map(link => {
                                let price = "Unknown";
                                let parent = link.closest('div');
                                if (parent && parent.innerText.includes('₹')) {
                                    price = parent.innerText.match(/₹[\d\.]+/)?.[0] || "Unknown";
                                }
                                return {
                                    name: link.innerText.trim(),
                                    price: price,
                                    url: link.href
                                };
                            });
                        }

                        return items.map(item => {
                            const nameEl = item.querySelector('div[class*="name"]');
                            const priceEl = item.querySelector('div[class*="price"]');
                            return {
                                name: nameEl ? nameEl.innerText.trim() : "Unknown",
                                price: priceEl ? priceEl.innerText.trim() : "Unknown",
                                url: item.querySelector('a')?.href || null
                            };
                        });
                    }
                    return [];
                };

                // Patient Concerns Logic
                const getPatientConcerns = () => {
                    const headers = Array.from(document.querySelectorAll('h2, h3'));
                    const header = headers.find(h => h.innerText.trim() === 'Patient concerns');
                    if (!header) return [];

                    let container = header.parentElement.nextElementSibling;
                    if (container) {
                        const slides = Array.from(container.querySelectorAll('.slick-slide:not(.slick-cloned)'));
                        if (slides.length > 0) {
                            return slides.map(slide => slide.innerText.trim());
                        }
                        return [container.innerText.trim()];
                    }
                    return [];
                };

                // FAQs Logic
                const getFAQs = () => {
                    const faqTiles = Array.from(document.querySelectorAll('div[class*="Faqs__tile"]'));
                    if (faqTiles.length > 0) {
                        return faqTiles.map(tile => {
                            const q = tile.querySelector('h3[class*="Faqs__ques"]');
                            const a = tile.querySelector('div[class*="Faqs__ans"]');
                            return {
                                question: q ? q.innerText.trim() : "Unknown",
                                answer: a ? a.innerText.trim() : "Unknown"
                            };
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
                    howItWorks: getSectionContent('How') && getSectionContent('How').toLowerCase().includes('works') ? getSectionContent('How') : getSectionContent('How it works'),
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

            // Merge details into the original object
            const enrichedMed = { ...med, ...details, lastUpdated: new Date().toISOString() };
            enrichedData.push(enrichedMed);

            console.log(`   ✅ Extracted Data`);
            // await page.waitForTimeout(2000 + Math.random() * 3000); // Politeness delay

        } catch (error) {
            console.error(`   ❌ Failed to enrich ${med.url}: ${error.message}`);
            // Add to list anyway with error flag so we don't retry immediately? 
            // Or skip adding so it retries next run? 
            // Let's Add it with an "error" field to prevent infinite loops on bad URLs
            enrichedData.push({ ...med, parsingError: error.message, lastUpdated: new Date().toISOString() });
        }
    }

    await browser.close();

    // 5. Save Progress
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(enrichedData, null, 2));
    console.log(`💾 Saved ${enrichedData.length} medicines to ${OUTPUT_FILE}`);
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
