import { PLAYBACK_SPEED } from "./foam-timing";
import { estimateFoam, ESTIMATE_NOTE } from "./estimates";
import "./style.css";
import { catalysts, catalystById } from "./catalysts";
import {
  bounded,
  defaults,
  FoamSimulation,
  calculateCatalystEffect,
  DURATION,
  type Parameters,
} from "./model";
import {
  createRecord,
  loadHistory,
  concentrations,
  group,
  unfair,
  STORAGE_KEY,
  type RecordEntry,
} from "./history";
import { download } from "./csv";
import { LabScene } from "./scene";
const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const fmt = (n: number) =>
  n.toLocaleString("zh-TW", { maximumFractionDigits: 1 });
$("#app").innerHTML =
  `<header><a class="brand" href="#">◌ 反應觀察室 <span>互動科學實驗</span></a><span class="tag">3D 科學視覺化 · 無須登入</span></header>
<main><section class="intro"><p class="eyebrow">探索 · 觀察 · 比較</p><h1>讓化學，<em>湧現眼前。</em></h1><p>大象牙膏實驗噴發效果模擬遊戲</p><p class="subtitle">調整反應條件，觀察泡沫的立體變化。每一次探索，都會成為可比較的紀錄。</p></section>
<div class="lab-layout"><section class="viewport-card"><div class="scene-top"><span>100 mL 量筒 <small>三維即時模擬</small></span><span id="status" role="status">準備就緒</span></div><div id="scene"><div id="loading">正在載入三維場景…</div></div><div class="scene-bottom"><span>↔ 拖曳旋轉 · 滾輪縮放</span><span>動畫單位 ≠ 真實尺寸</span></div><div class="live-metrics"><div><small>反應進度（示意）</small><strong id="progress">0%</strong></div><div><small>最高高度（場景單位）</small><strong id="height">0</strong></div><div><small>動畫粒子總數</small><strong id="particles">0</strong></div></div><progress id="timeline" value="0" max="16" aria-label="模擬時間進度"></progress></section>
<aside class="panel"><div class="section-title"><span class="step">01</span><h2>設定反應條件</h2></div><label for="h2o2">H₂O₂ 模擬濃度 <span class="unit">%</span></label><div class="input-row"><input id="h2o2Range" type="range" min="0" max="100" step="0.1"><input id="h2o2" type="number" min="0" max="100" step="0.1" aria-label="H₂O₂ 模擬濃度"></div><p class="hint">0–100% 為模型輸入範圍，不表示均適合真實操作。</p>
<label for="catalyst">催化劑／比較物質</label><select id="catalyst">${catalysts.map((c) => `<option value="${c.id}">${c.name}（${c.formula}）</option>`).join("")}</select><div id="catalystInfo" class="info"></div>
<label id="concentrationLabel" for="concentration">KI 名目濃度（w/w%）</label><div class="input-row"><input id="concentrationRange" type="range" min="0" max="100" step="0.1"><input id="concentration" type="number" min="0" max="100" step="0.1" aria-label="催化劑名目濃度"></div><p class="hint">溶液 w/w%＝溶質質量 ÷ 溶液總質量 × 100%；懸浮液採固體質量 ÷ 混合物總質量 × 100%。同一百分比不等於同一莫耳濃度或活性。</p>
<div class="section-title color-title"><span class="step">02</span><h2>調配泡沫顏色</h2><input id="color" type="color" aria-label="泡沫顏色"></div><div class="rgb">${["R", "G", "B"].map((c, i) => `<label>${c}<input id="rgb${i}" type="number" min="0" max="255" aria-label="${c} 色彩值"></label>`).join("")}</div><label class="checkbox"><input id="syncLiquid" type="checkbox" checked>同步液體顏色</label>
<label for="foamStyle">泡沫外觀</label><select id="foamStyle"><option value="cream">連續泡沫條（影片參考）</option><option value="particles">原始粒子觀察</option></select><div class="toolbar" style="margin-top:12px"><button id="referenceColor">參考圖奶油黃</button><button id="closeView">近看量筒與泡沫</button></div><p class="hint">外觀模式僅改變表面呈現，不改變反應、動畫統計或歷史估算。</p><div class="actions"><button id="start" class="primary">開始模擬 ↗</button><button id="pause" disabled>暫停</button><button id="restart">重新開始</button><button id="stop" disabled>停止本次</button><button id="reset">重設參數</button></div><p class="hint">動畫以兩倍速度播放。反應模型計時 16 秒後自動保存一筆；泡沫從 10 mL 液面上升，高度連續 0.5 模型秒未明顯增加時即開始倒塌，不等待紀錄完成。重新開始會捨棄未完成的本次動畫，歷史保留。</p></aside></div>
<p id="notice" role="alert"></p><section class="summary"><div><p class="eyebrow">本次觀察</p><h2>本次模擬結果</h2><p id="summary">設定條件後，開始你的第一次觀察。</p></div><div>泡沫體積（示意估算）<strong id="volume">尚未模擬</strong></div><div>泡沫質量（示意估算）<strong id="mass">尚未模擬</strong></div><p class="hint">依名目液體量、反應進度與固定泡沫假設換算，尚未校準；不由動畫粒子數推算。舊紀錄保留未估算。</p></section>
<section class="records"><div class="section-heading"><div><p class="eyebrow">每一次探索，都有跡可循</p><h2>模擬歷史紀錄 <span id="count" class="count">0</span></h2></div><div class="toolbar"><button id="export">匯出模擬紀錄 CSV</button><button id="clear" class="danger">清除全部紀錄</button></div></div><p class="hint">紀錄只保存在此瀏覽器，不會共用或跨裝置同步；清除瀏覽器資料可能遺失。建議匯出 CSV 保存。</p><div id="history"></div></section>
<section class="comparison"><div class="section-heading"><div><p class="eyebrow">從歷史紀錄自動同步</p><h2>催化劑比較</h2></div><button id="exportGroup">匯出此組 CSV</button></div><div class="filters"><label>H₂O₂ 濃度分組<select id="group"></select></label><label>比較指標<select id="metric"><option value="height">動畫最高高度（場景單位）</option><option value="rate">相對反應速率（未校準）</option><option value="volume">泡沫體積（mL，示意估算）</option><option value="mass">泡沫質量（g，示意估算）</option></select></label></div><p id="fairness" class="info"></p><div id="comparison"></div><h3 id="chartTitle">動畫最高高度比較</h3><div id="chart" role="img" aria-label="依歷史紀錄繪製的比較圖"></div></section>
<section class="science"><h2>理解模型，才是實驗的開始</h2><p>本網站為電腦視覺化模擬，所有反應速率、泡沫高度、體積及質量均依模型假設產生，不代表真實實驗的精確預測。不同催化劑的模擬結果不可直接視為經實驗證實的催化能力排名。真實化學實驗須由合格教師或專業人員依適當的實驗室安全規範進行。</p><details><summary>查看模型假設與資料依據</summary><p>模型版本 illustrative-1.1。相對速率＝示意係數 × √（催化劑名目百分比 ÷ 10）×（H₂O₂ 百分比 ÷ 30）；百分比數值僅在此轉換比例。反應進度＝1−exp(−相對速率 × 秒數 ÷ 4)。無催化劑或 H₂O₂ 為零時，本模型忽略自發分解。係數並非化學常數。</p><p>容器為 100 mL 量筒外觀，初始名目 10 mL 對齊 10 mL 刻度；反應時液面下降仍屬視覺估算。固定名目液體體積 10 mL；液面下降不超過初始液深的 80%，且上限為 7.5 場景單位，僅為進度視覺化。重力、粒子數及噴發速度皆為動畫參數。不同物質相同 w/w% 不代表相同有效活性；金屬鹽與對照物質不具普遍固定排名。</p><p>${ESTIMATE_NOTE}</p><p>已知機制參考：<a href="https://edu.rsc.org/experiments/elephants-toothpaste/724.article" target="_blank" rel="noreferrer">RSC Education：Elephant’s toothpaste</a>；此示範不提供本模型的定量校準。本網站不提供高濃度過氧化氫配製、混合或操作步驟。</p></details></section></main><footer>反應觀察室 · 在模擬中探索，在證據中理解。</footer>`;
let parameters = defaults(),
  concentrationState: Record<string, number> = Object.fromEntries(
    catalysts.map((c) => [c.id, 10]),
  );
let records: RecordEntry[] = [];
let storageWritable = true;
function notify(message: string) {
  $("#notice").textContent = message;
}
try {
  records = loadHistory(localStorage);
} catch {
  storageWritable = false;
  notify(
    "無法載入本機紀錄或資料格式不相容。原始資料保留，本次僅於記憶體操作；請先匯出資料。",
  );
}
let simulation: FoamSimulation | null = null,
  running = false,
  recorded = false;
let scene: LabScene | null = null;
try {
  scene = new LabScene($("#scene"));
  $("#loading").remove();
} catch {
  $("#loading").textContent =
    "無法啟動三維場景，請確認瀏覽器支援 WebGL；紀錄與資料匯出仍可使用。";
  $("#start").setAttribute("disabled", "");
  $("#restart").setAttribute("disabled", "");
}
$("#foamStyle").addEventListener("change", () =>
  scene?.setFoamStyle(
    $<HTMLSelectElement>("#foamStyle").value as "cream" | "particles",
  ),
);
$("#referenceColor").addEventListener("click", () => {
  parameters.rgb = [244, 204, 94];
  $<HTMLSelectElement>("#foamStyle").value = "cream";
  scene?.setFoamStyle("cream");
  syncInputs();
});
$("#closeView").addEventListener("click", () => scene?.focusBottle());
function syncInputs() {
  for (const [key, value] of [
    ["h2o2", parameters.h2o2],
    ["concentration", parameters.concentration],
  ] as const) {
    $<HTMLInputElement>("#" + key).value = String(value);
    $<HTMLInputElement>("#" + key + "Range").value = String(value);
  }
  $<HTMLSelectElement>("#catalyst").value = parameters.catalystId;
  parameters.rgb.forEach((n, i) => {
    $<HTMLInputElement>("#rgb" + i).value = String(n);
  });
  $<HTMLInputElement>("#color").value =
    "#" + parameters.rgb.map((n) => n.toString(16).padStart(2, "0")).join("");
  $<HTMLInputElement>("#syncLiquid").checked = parameters.syncLiquid;
  const c = catalystById(parameters.catalystId);
  $("#concentrationLabel").textContent = c.formula + " 名目濃度（w/w%）";
  $("#catalystInfo").textContent =
    `${c.type} · ${c.evidenceLevel}。${c.concentrationBasis}。${c.notes} 資料：${c.source}`;
}
for (const key of ["h2o2", "concentration"] as const)
  for (const suffix of ["", "Range"])
    $<HTMLInputElement>("#" + key + suffix).addEventListener("input", (e) => {
      const input = e.target as HTMLInputElement;
      parameters[key] = bounded(input.value, 0, 100);
      if (key === "concentration")
        concentrationState[parameters.catalystId] = parameters.concentration;
      syncInputs();
    });
$("#catalyst").addEventListener("change", () => {
  parameters.catalystId = $<HTMLSelectElement>("#catalyst").value;
  parameters.concentration = concentrationState[parameters.catalystId];
  syncInputs();
});
for (let i = 0; i < 3; i++)
  $("#rgb" + i).addEventListener("input", () => {
    parameters.rgb[i] = Math.round(
      bounded($<HTMLInputElement>("#rgb" + i).value, 0, 255),
    );
    syncInputs();
  });
$("#color").addEventListener("input", () => {
  const value = $<HTMLInputElement>("#color").value;
  parameters.rgb = [1, 3, 5].map((i) =>
    parseInt(value.slice(i, i + 2), 16),
  ) as Parameters["rgb"];
  syncInputs();
});
$("#syncLiquid").addEventListener("change", () => {
  parameters.syncLiquid = $<HTMLInputElement>("#syncLiquid").checked;
});
function begin() {
  if (!scene) return;
  simulation = new FoamSimulation(structuredClone(parameters));
  running = true;
  recorded = false;
  $("#status").textContent = "反應進行中";
  $("#pause").removeAttribute("disabled");
  $("#stop").removeAttribute("disabled");
  $("#pause").textContent = "暫停";
  $("#start").setAttribute("disabled", "");
  $("#summary").textContent =
    "模擬進行中；條件已快照保存，面板修改將用於下一次模擬。";
}
$("#stop").addEventListener("click", () => {
  running = false;
  simulation = null;
  $("#status").textContent = "已停止 · 未完成紀錄不保存";
  $("#start").removeAttribute("disabled");
  $("#pause").setAttribute("disabled", "");
  $("#stop").setAttribute("disabled", "");
  $("#progress").textContent = "0%";
  $("#height").textContent = "0";
  $("#particles").textContent = "0";
  $<HTMLProgressElement>("#timeline").value = 0;
  $("#volume").textContent = "尚未模擬";
  $("#mass").textContent = "尚未模擬";
  $("#summary").textContent = "本次模擬已停止；歷史紀錄保留。";
});
$("#start").addEventListener("click", begin);
$("#restart").addEventListener("click", begin);
$("#pause").addEventListener("click", () => {
  running = !running;
  $("#pause").textContent = running ? "暫停" : "繼續";
  $("#status").textContent = running ? "反應進行中" : "已暫停";
});
$("#reset").addEventListener("click", () => {
  parameters = defaults();
  concentrationState = Object.fromEntries(catalysts.map((c) => [c.id, 10]));
  syncInputs();
  notify("已恢復預設參數，歷史紀錄及本次動畫保留。");
});
function persist() {
  if (storageWritable)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch {
      notify(
        "瀏覽器無法保存紀錄（可能空間不足）；本次紀錄仍在記憶體，請匯出 CSV。",
      );
    }
  renderRecords();
}
function table(items: RecordEntry[], history = false) {
  if (!items.length)
    return `<div class="empty">${history ? "尚無模擬紀錄，請先開始一次模擬" : "此 H₂O₂ 濃度尚無模擬資料"}</div>`;
  return `<div class="table-scroll"><table><thead><tr><th>模擬</th><th>H₂O₂</th><th>催化劑</th><th>名目濃度</th><th>相對速率</th><th>動畫最高高度</th><th>估算體積（mL）</th><th>估算質量（g）</th><th>進度／秒數</th>${history ? "<th>詳細／操作</th>" : ""}</tr></thead><tbody>${items.map((r) => `<tr><td>#${r.number}</td><td>${r.parameters.h2o2}%</td><td><span class="swatch" style="background:rgb(${r.parameters.rgb.join(",")})"></span>${escape(r.catalystName)}<small>${escape(r.formula)}</small></td><td>${r.parameters.concentration} w/w%</td><td>${fmt(r.rate)}</td><td>${fmt(r.height)} <small>場景單位</small></td><td>${r.volume === null ? "未估算" : fmt(r.volume)}</td><td>${r.mass === null ? "未估算" : fmt(r.mass)}</td><td>${fmt(r.progress * 100)}%<small>${fmt(r.duration)} 秒</small></td>${history ? `<td><details><summary>詳細參數</summary><p>${escape(new Date(r.date).toLocaleString("zh-TW"))}<br>RGB ${r.parameters.rgb.join(" / ")}<br>液體 ${r.parameters.liquidVolume} mL（名目）<br>動畫粒子 ${r.particles}<br>液面下降 ${fmt(r.liquidDrop)} 場景單位<br>${escape(r.concentrationBasis)}<br>${escape(r.modelVersion)}<br>${escape(r.evidence)}<br>${escape(r.notes)}<br>ID ${escape(r.id)}</p></details><button data-delete="${escape(r.id)}" class="delete">刪除</button></td>` : ""}</tr>`).join("")}</tbody></table></div>`;
}
let selectedConcentration = 30;
function renderRecords() {
  $("#count").textContent = String(records.length);
  $("#history").innerHTML = table(records, true);
  const groups = concentrations(records);
  $<HTMLSelectElement>("#group").innerHTML = [
    ...new Set([selectedConcentration, ...groups]),
  ]
    .sort((a, b) => a - b)
    .map(
      (n) =>
        `<option value="${n}">${n}%${groups.includes(n) ? "" : "（尚無紀錄）"}</option>`,
    )
    .join("");
  $<HTMLSelectElement>("#group").value = String(selectedConcentration);
  $("#export").toggleAttribute("disabled", !records.length);
  $("#clear").toggleAttribute("disabled", !records.length);
  renderComparison();
}
function renderComparison() {
  const items = group(records, selectedConcentration);
  $("#comparison").innerHTML = table(items);
  $("#exportGroup").toggleAttribute("disabled", !items.length);
  $("#fairness").textContent = unfair(items)
    ? "比較提醒：催化劑濃度、時間、進度或模型版本不同，控制條件並不完全相同，不可視為公平催化能力排名。"
    : "僅比較此濃度的歷史快照；相同 w/w% 不代表同一活性。所有係數未校準，不構成催化能力排名。";
  const metric = $<HTMLSelectElement>("#metric").value;
  $("#chartTitle").textContent =
    `H₂O₂ ${selectedConcentration}% · ` +
    {
      height: "動畫最高高度比較（場景單位）",
      rate: "相對反應速率比較（未校準）",
      volume: "泡沫體積（mL，示意估算）",
      mass: "泡沫質量（g，示意估算）",
    }[metric];
  if (!items.length) {
    $("#chart").innerHTML = '<p class="empty">此 H₂O₂ 濃度尚無模擬資料</p>';
    return;
  }
  const valueOf = (r: RecordEntry) =>
    metric === "height"
      ? r.height
      : metric === "volume"
        ? r.volume
        : metric === "mass"
          ? r.mass
          : r.rate;
  const known = items.filter((r) => valueOf(r) !== null);
  if (!known.length) {
    $("#chart").textContent =
      "此組舊紀錄尚無體積／質量估算，請執行新的模擬；舊資料不會自動補算。";
    return;
  }
  const values = known.map((r) => valueOf(r)!),
    max = Math.max(1, ...values);
  const unit = metric === "volume" ? " mL" : metric === "mass" ? " g" : "";
  $("#chart").innerHTML =
    (known.length < items.length
      ? '<p class="hint">部分舊紀錄未估算，表格保留原值，圖表略過這些空值。</p>'
      : "") +
    known
      .map(
        (r, i) =>
          `<div class="bar-row"><span>#${r.number} ${escape(r.formula)} · ${r.parameters.concentration}%</span><div class="bar-track"><div class="bar" style="width:${(values[i] / max) * 100}%"></div></div><strong>${fmt(values[i])}${unit}</strong></div>`,
      )
      .join("");
}
$("#history").addEventListener("click", (e) => {
  const button = (e.target as HTMLElement).closest<HTMLButtonElement>(
    "[data-delete]",
  );
  if (button) {
    records = records.filter((r) => r.id !== button.dataset.delete);
    persist();
  }
});
$("#clear").addEventListener("click", () => {
  if (confirm("確定清除全部模擬紀錄？此操作無法復原，建議先匯出 CSV。")) {
    records = [];
    persist();
  }
});
$("#export").addEventListener("click", () =>
  download(records, "大象牙膏模擬紀錄.csv"),
);
$("#exportGroup").addEventListener("click", () =>
  download(
    group(records, selectedConcentration),
    `H2O2-${selectedConcentration}-比較.csv`,
  ),
);
$("#group").addEventListener("change", () => {
  selectedConcentration = Number($<HTMLSelectElement>("#group").value);
  renderComparison();
});
$("#metric").addEventListener("change", renderComparison);
syncInputs();
renderRecords();
let previous = performance.now(),
  frame = 0;
function animate(now: number) {
  const dt = Math.min(0.5, (now - previous) / 1000) * PLAYBACK_SPEED;
  previous = now;
  if (running && simulation) {
    simulation.advance(dt);
    $("#progress").textContent = fmt(simulation.progress * 100) + "%";
    $("#height").textContent = fmt(simulation.maxHeight);
    $("#particles").textContent = String(simulation.emitted);
    const estimated = estimateFoam(simulation.parameters, simulation.progress);
    $("#volume").textContent = fmt(estimated.volume) + " mL";
    $("#mass").textContent = fmt(estimated.mass) + " g";
    $<HTMLProgressElement>("#timeline").value = simulation.elapsed;
    if (simulation.elapsed >= DURATION && !recorded) {
      recorded = true;
      running = false;
      const record = createRecord(
        simulation,
        Math.max(0, ...records.map((r) => r.number)) + 1,
        calculateCatalystEffect(simulation.parameters),
      );
      records.unshift(record);
      selectedConcentration = record.parameters.h2o2;
      persist();
      $("#status").textContent = "模擬完成 · 已新增紀錄";
      $("#stop").setAttribute("disabled", "");
      $("#pause").setAttribute("disabled", "");
      $("#start").removeAttribute("disabled");
      $("#summary").textContent =
        `#${record.number} · ${record.parameters.h2o2}% H₂O₂ ＋ ${record.catalystName} ${record.parameters.concentration}% · 相對速率 ${fmt(record.rate)} · 液面下降 ${fmt(record.liquidDrop)} 場景單位（視覺估算）`;
    }
  }
  if (recorded && simulation && simulation.emitted > 0 && scene) {
    const status = "已新增紀錄 · " + scene.foamStage;
    if ($("#status").textContent !== status) $("#status").textContent = status;
  }
  // Color changes are live, but the saved run snapshot stays immutable.
  scene?.update(
    simulation,
    {
      ...(simulation?.parameters ?? parameters),
      rgb: parameters.rgb,
      syncLiquid: parameters.syncLiquid,
    },
    running || recorded ? dt : 0,
  );
  frame = requestAnimationFrame(animate);
}
frame = requestAnimationFrame(animate);
window.addEventListener(
  "pagehide",
  () => {
    cancelAnimationFrame(frame);
    scene?.dispose();
  },
  { once: true },
);
