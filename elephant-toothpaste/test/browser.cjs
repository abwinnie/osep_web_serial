const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
let browser;
(async () => {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
  });
  const errors = [];
  page.setDefaultTimeout(30000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.TEST_URL || "http://127.0.0.1:5173");
  await page.locator("#scene canvas").waitFor();
  await page.screenshot({ path: "/tmp/elephant-initial.png", fullPage: true });
  await page.locator("#h2o2").fill("20");
  assert.equal(await page.locator("#h2o2Range").inputValue(), "20");
  await page.locator("#h2o2Range").fill("30");
  assert.equal(await page.locator("#h2o2").inputValue(), "30");
  await page.locator("#concentration").fill("17");
  await page.locator("#catalyst").selectOption("mno2");
  await page.locator("#concentration").fill("25");
  await page.locator("#catalyst").selectOption("ki");
  assert.equal(await page.locator("#concentration").inputValue(), "17");
  await page.locator("#concentration").fill("10");
  await page.locator("#rgb0").fill("255");
  assert.equal(await page.locator("#color").inputValue(), "#ffcca9");
  await page.locator("#reset").click();
  await page.locator("#start").click();
  console.log("已開始一次真實模擬");
  await page.waitForTimeout(2000);
  await page.locator("#pause").click();
  const t = await page.locator("#timeline").evaluate((e) => e.value);
  await page.waitForTimeout(500);
  assert.equal(await page.locator("#timeline").evaluate((e) => e.value), t);
  await page.locator("#pause").click();
  await page.waitForTimeout(4000);
  await page
    .locator(".viewport-card")
    .screenshot({ path: "/tmp/elephant-eruption.png" });
  await page
    .locator("#status")
    .filter({ hasText: "已新增紀錄" })
    .waitFor({ timeout: 180000 });
  console.log("第一次模擬已完成");
  assert.equal(await page.locator("#history tbody tr").count(), 1);
  assert.equal(await page.locator("#comparison tbody tr").count(), 1);
  await page.locator("#h2o2").fill("20");
  await page.locator("#start").click();
  console.log("已開始一次真實模擬");
  await page
    .locator("#status")
    .filter({ hasText: "已新增紀錄" })
    .waitFor({ timeout: 180000 });
  console.log("第二次模擬已完成，驗證儲存與比較");
  await page.reload();
  assert.equal(await page.locator("#history tbody tr").count(), 2);
  await page.locator("#group").selectOption("20");
  assert.equal(await page.locator("#comparison tbody tr").count(), 1);
  await page.locator("#group").selectOption("30");
  assert.equal(await page.locator("#chart .bar-row").count(), 1);
  await page.locator("#history tbody tr").last().locator("details").click();
  assert.match(
    await page.locator("#history tbody tr").last().innerText(),
    /30%/,
  );
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export").click();
  const download = await downloadPromise;
  await download.saveAs("/tmp/elephant-export.csv");
  await page
    .locator("#history tbody tr")
    .last()
    .getByRole("button", { name: "刪除", exact: true })
    .click();
  assert.equal(await page.locator("#comparison tbody tr").count(), 0);
  page.once("dialog", (d) => d.accept());
  await page.locator("#clear").click();
  assert.equal(await page.locator("#history tbody tr").count(), 0);
  assert.match(await page.locator("#chart").innerText(), /尚無模擬資料/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/elephant-mobile.png", fullPage: true });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS：控制項、KI 狀態、RGB、暫停繼續、兩次自動紀錄、快照、重載、分組圖表、刪除清除、CSV、手機版與頁面錯誤",
  );
  await browser.close();
})().catch(async (e) => {
  console.error(e);
  if (browser) await browser.close();
  process.exitCode = 1;
});
