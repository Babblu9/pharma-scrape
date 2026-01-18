// human.js — Human Behaviour Engine
export async function behaveLikeHuman(page) {
    await page.waitForTimeout(2000);

    await page.mouse.move(200, 300, { steps: 20 });
    await page.waitForTimeout(800);

    await page.mouse.move(600, 400, { steps: 25 });
    await page.waitForTimeout(1000);

    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(1500);

    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(1200);

    await page.click("body");
    await page.waitForTimeout(1000);
}
