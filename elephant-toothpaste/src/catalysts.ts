export interface Catalyst {
  id: string;
  name: string;
  formula: string;
  type: string;
  concentrationBasis: string;
  modelCoefficient: number;
  evidenceLevel: string;
  notes: string;
  source: string;
}
const solution = "水溶液名目質量百分比（w/w%）；高濃度不代表可溶或可操作";
export const catalysts: Catalyst[] = [
  {
    id: "ki",
    name: "碘化鉀",
    formula: "KI",
    type: "碘離子催化代表",
    concentrationBasis: solution,
    modelCoefficient: 1,
    evidenceLevel: "已知機制；係數未校準",
    notes: "碘離子參與過氧化氫分解循環；受溫度、酸鹼度及配方影響。",
    source:
      "RSC Education：Elephant’s toothpaste（示範原理）；非本模型常數來源",
  },
  {
    id: "mno2",
    name: "二氧化錳",
    formula: "MnO₂",
    type: "異相固體催化",
    concentrationBasis: "固體懸浮液名目質量百分比（w/w%）",
    modelCoefficient: 0.85,
    evidenceLevel: "已知機制；係數未校準",
    notes: "不假設溶於水；表面積、粒徑及表面狀態影響活性。",
    source: "一般化學：過氧化氫異相分解原理；未採用實測常數",
  },
  {
    id: "yeast",
    name: "酵母",
    formula: "含 catalase",
    type: "酵素懸浮液",
    concentrationBasis: "酵母懸浮液名目質量百分比（w/w%）",
    modelCoefficient: 0.75,
    evidenceLevel: "已知酵素機制；活性未校準",
    notes: "含過氧化氫酶；酵母種類、活性、溫度及失活狀態均影響結果。",
    source: "過氧化氫酶分解原理；未採用實測活性",
  },
  ...[
    ["fecl2", "氯化亞鐵", "FeCl₂", "亞鐵鹽"],
    ["fecl3", "氯化鐵", "FeCl₃", "三價鐵鹽"],
    ["feso4", "硫酸亞鐵", "FeSO₄", "亞鐵鹽"],
    ["fe2so43", "硫酸鐵", "Fe₂(SO₄)₃", "三價鐵鹽"],
    ["cuso4", "硫酸銅", "CuSO₄", "銅鹽"],
  ].map(([id, name, formula, type]) => ({
    id,
    name,
    formula,
    type,
    concentrationBasis: solution,
    modelCoefficient: 0.45,
    evidenceLevel: "條件相依；示意係數",
    notes:
      "金屬離子及氧化還原路徑受酸鹼度、配位與物種影響；相同係數僅用於教學情境，不構成排名。",
    source: "金屬離子／Fenton 類反應概念；無定量校準",
  })),
  ...[
    ["mgso4", "硫酸鎂", "MgSO₄"],
    ["nacl", "氯化鈉", "NaCl"],
  ].map(([id, name, formula]) => ({
    id,
    name,
    formula,
    type: "比較／對照物質",
    concentrationBasis: solution,
    modelCoefficient: 0.025,
    evidenceLevel: "示意對照；尚未校準",
    notes: "示意模型僅保留微弱相對影響；不代表所有條件下完全無作用。",
    source: "未建立可量化的催化模型；非實驗資料",
  })),
];
export const catalystById = (id: string) =>
  catalysts.find((c) => c.id === id) ?? catalysts[0];
