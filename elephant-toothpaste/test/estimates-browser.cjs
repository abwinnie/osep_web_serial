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
    viewport: { width: 1100, height: 900 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (e) => {
    if (e.type() === "error") errors.push(e.text());
  });
  const response = await page.goto(process.env.TEST_URL || "http://127.0.0.1:5173");
  assert.equal(response.status(), 200, "測試站必須提供正式建置頁面");
  await page.locator("#scene canvas").waitFor();
  await page.locator("#start").click();
  await page
    .locator("#status")
    .filter({ hasText: "已新增紀錄" })
    .waitFor({ timeout: 180000 });
  const record = await page.evaluate(
    () => JSON.parse(localStorage.getItem("elephant-toothpaste.history.v1"))[0],
  );
  assert.ok(record.volume > 0 && record.mass > 0);
  assert.equal(record.particles, 3600);
  assert.equal(record.modelVersion, "illustrative-1.1");
  assert.equal(record.estimateAssumptions.version, "foam-scenario-1.0");
  assert.match(await page.locator("#volume").innerText(), /mL/);
  assert.match(await page.locator("#mass").innerText(), /g/);
  const number = (n) => n.toLocaleString("zh-TW", { maximumFractionDigits: 1 });
  assert.equal(
    await page.locator("#volume").innerText(),
    number(record.volume) + " mL",
  );
  assert.equal(
    await page.locator("#mass").innerText(),
    number(record.mass) + " g",
  );
  await page.evaluate((r) => {
    const old = {
      ...r,
      id: "legacy-record",
      number: 0,
      volume: null,
      mass: null,
      modelVersion: "illustrative-1.0",
    };
    delete old.estimateAssumptions;
    localStorage.setItem(
      "elephant-toothpaste.history.v1",
      JSON.stringify([r, old]),
    );
  }, record);
  await page.reload();
  assert.equal(await page.locator("#history tbody tr").count(), 2);
  assert.match(await page.locator("#history").innerText(), /未估算/);
  for (const metric of ["volume", "mass"]) {
    await page.locator("#metric").selectOption(metric);
    assert.equal(await page.locator("#chart .bar-row").count(), 1);
    assert.match(
      await page.locator("#chart .bar-row").innerText(),
      new RegExp(metric === "volume" ? "mL" : " g"),
    );
  }
  const before = await page.evaluate(() =>
    localStorage.getItem("elephant-toothpaste.history.v1"),
  );
  await page.locator("#h2o2").fill("50");
  assert.equal(
    await page.evaluate(() =>
      localStorage.getItem("elephant-toothpaste.history.v1"),
    ),
    before,
  );
  const promise = page.waitForEvent("download");
  await page.locator("#export").click();
  const download = await promise;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const csv = Buffer.concat(chunks).toString("utf8");
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes(String(record.volume)));
  assert.ok(csv.includes(String(record.mass)));
  assert.ok(csv.includes("未估算"));
  assert.ok(csv.includes("foam-scenario-1.0"));
  assert.deepEqual(errors, []);
  console.log(
    "PASS：摘要、歷史、體積／質量圖表、CSV 一致；舊資料與空值保留、重載成功，噴發仍為 3600 顆。",
    JSON.stringify({
      volume: record.volume,
      mass: record.mass,
      height: record.height,
    }),
  );
  await browser.close();
})().catch(async (e) => {
  console.error(e);
  if (browser) await browser.close();
  process.exitCode = 1;
});
