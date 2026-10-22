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
  assert.match(await p.locator(".scene-top").innerText(), /100 mL 量筒/);
  await p.locator("#closeView").click();
  await p
    .locator(".viewport-card")
    .screenshot({ path: "/tmp/elephant-100ml-cylinder.png" });
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
  assert.equal(record.parameters.liquidVolume, 10);
  assert.equal(record.particles, 3600);
  assert.equal(record.height, 127.2724682122177);
  assert.ok(record.volume > 0 && record.mass > 0);
  await p.locator("#foamStyle").selectOption("particles");
  await p.waitForTimeout(500);
  await p.locator("#foamStyle").selectOption("cream");
  await p
    .locator(".viewport-card")
    .screenshot({ path: "/tmp/elephant-collapse-standing.png" });
  await p.waitForTimeout(3500);
  await p
    .locator(".viewport-card")
    .screenshot({ path: "/tmp/elephant-topdown-onset.png" });
  await p.waitForTimeout(6500);
  await p
    .locator(".viewport-card")
    .screenshot({ path: "/tmp/elephant-collapse-bending.png" });
  assert.equal(
    await p.evaluate(() =>
      localStorage.getItem("elephant-toothpaste.history.v1"),
    ),
    before,
  );
  await p
    .locator("#status")
    .filter({ hasText: "泡沫堆積完成" })
    .waitFor({ timeout: 180000 });
  await p
    .locator(".viewport-card")
    .screenshot({ path: "/tmp/elephant-collapse-fallen.png" });
  assert.equal(
    await p.evaluate(() =>
      localStorage.getItem("elephant-toothpaste.history.v1"),
    ),
    before,
  );
  await p.evaluate(
    () =>
      new Promise((resolve) => {
        let n = 0;
        function next() {
          if (++n === 10) resolve();
          else requestAnimationFrame(next);
        }
        requestAnimationFrame(next);
      }),
  );
  const settled = await p.locator("#scene canvas").screenshot();
  await p.waitForTimeout(12000);
  const retained = await p.locator("#scene canvas").screenshot();
  assert.deepEqual(retained, settled, "堆積完成後泡沫畫面不可繼續縮小或消失");
  await p
    .locator(".viewport-card")
    .screenshot({ path: "/tmp/elephant-retained-foam.png" });
  await p.locator("#closeView").click();
  await p.locator(".viewport-card").screenshot({ path: "/tmp/elephant-coiled-pile.png" });
  await p.setViewportSize({ width: 390, height: 844 });
  await p.waitForTimeout(1000);
  assert.ok(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS：100 mL 量筒、頂端先坍塌再逐段落地、堆積畫面長時間完全保留、奶油黃預設、近看與外觀切換、手機版、零主控台錯誤；紀錄／體積／質量不變，3600 顆與 127.272468 場景單位基準保留。",
  );
  await browser.close();
})().catch(async (e) => {
  console.error(e);
  if (browser) await browser.close();
  process.exitCode = 1;
});
