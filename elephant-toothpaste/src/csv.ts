import type { RecordEntry } from "./history";
const cell = (v: unknown) => '"' + String(v).replace(/"/g, '""') + '"';
export function csv(records: RecordEntry[]) {
  const rows: unknown[][] = [
    [
      "紀錄ID",
      "模擬編號",
      "時間（ISO）",
      "H₂O₂模擬濃度（%）",
      "催化劑",
      "化學式",
      "催化劑名目濃度（w/w%）",
      "濃度基準",
      "R",
      "G",
      "B",
      "相對速率指標（未校準）",
      "動畫最高高度（場景單位）",
      "泡沫體積（mL，示意估算）",
      "泡沫質量（g，示意估算）",
      "反應進度（%）",
      "液面下降（場景單位，視覺估算）",
      "動畫粒子總數",
      "模擬時間（秒）",
      "名目液體體積（mL）",
      "模型版本",
      "證據等級",
      "限制說明",
      "體積質量估算假設（JSON）",
    ],
  ];
  for (const r of records)
    rows.push([
      r.id,
      r.number,
      r.date,
      r.parameters.h2o2,
      r.catalystName,
      r.formula,
      r.parameters.concentration,
      r.concentrationBasis,
      ...r.parameters.rgb,
      r.rate,
      r.height,
      r.volume ?? "未估算",
      r.mass ?? "未估算",
      r.progress * 100,
      r.liquidDrop,
      r.particles,
      r.duration,
      r.parameters.liquidVolume,
      r.modelVersion,
      r.evidence,
      r.notes,
      r.estimateAssumptions ? JSON.stringify(r.estimateAssumptions) : "未估算",
    ]);
  return "\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n");
}
export function download(records: RecordEntry[], name: string) {
  const url = URL.createObjectURL(
    new Blob([csv(records)], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
