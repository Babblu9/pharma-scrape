// token.js
import { chromium } from "playwright";

export async function getApolloToken() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  let token = null;

  page.on("request", req => {
    const auth = req.headers()["authorization"];
    if (auth && auth.startsWith("Bearer ")) {
      token = auth.replace("Bearer ", "");
    }
  });

  await page.goto("https://www.apollopharmacy.in/", {
    waitUntil: "domcontentloaded", // Changed from networkidle for faster loading
    timeout: 60000, // Increased timeout to 60 seconds
  });

  // wait until token captured (up to 30 seconds)
  for (let i = 0; i < 60 && !token; i++) {
    await page.waitForTimeout(500);
  }

  await browser.close();

  if (!token) throw new Error("Auth token not found");

  return token;
}
