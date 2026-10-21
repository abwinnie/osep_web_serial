const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
let browser;
(async () => {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  const p = await browser.newPage({ viewport: { width: 1360, height: 1000 } });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (e) => {
    if (e.type() === "error") errors.push(e.text());
  });
  const response = await p.goto(
    process.env.TEST_URL || "http://127.0.0.1:5173",
  );
  assert.equal(response.status(), 200);
  await p.locator("#scene canvas").waitFor();
  assert.equal(await p.locator("#foamStyle").inputValue(), "cream");
  await p.locator("#referenceColor").click();
  assert.equal(await p.locator("#color").inputValue(), "#f4cc5e");
  await p.locator("#start").click();
  await p.waitForTimeout(6500);
  await p
    .locator(".viewport-card")
    .screenshot({ path: "/tmp/elephant-pillar-column.png" });
  await p
    .locator("#status")
    .filter({ hasText: "已新增紀錄" })
    .waitFor({ timeout: 180000 });
  const before = await p.evaluate(() =>
    localStorage.getItem("elephant-toothpaste.history.v1"),
  );
  const record = JSON.parse(before)[0];
  assert.equal(record.particles, 3600);
  assert.equal(record.height, 127.2724682122177);
  assert.ok(record.volume > 0 && record.mass > 0);
  await p.locator("#foamStyle").selectOption("particles");
  await p.waitForTimeout(500);
  await p.locator("#foamStyle").selectOption("cream");
  await p.locator("#closeView").click();
  await p.waitForTimeout(10000);
  await p
    .locator(".viewport-card")
    .screenshot({ path: "/tmp/elephant-pillar-close.png" });
  assert.equal(
    await p.evaluate(() =>
      localStorage.getItem("elephant-toothpaste.history.v1"),
    ),
    before,
  );
  await p.setViewportSize({ width: 390, height: 844 });
  await p.waitForTimeout(1000);
  assert.ok(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS：直立粗柱表面、奶油黃預設、近看與外觀切換、手機版、零主控台錯誤；紀錄／體積／質量不變，3600 顆與 127.272468 場景單位基準保留。",
  );
  await browser.close();
})().catch(async (e) => {
  console.error(e);
  if (browser) await browser.close();
  process.exitCode = 1;
});
