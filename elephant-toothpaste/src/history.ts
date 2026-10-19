import {
  estimateFoam,
  ESTIMATE_ASSUMPTIONS,
  ESTIMATE_NOTE,
  type EstimateAssumptions,
} from "./estimates";
import { catalystById } from "./catalysts";
import { MODEL_VERSION, type Parameters, type FoamSimulation } from "./model";
export const STORAGE_KEY = "elephant-toothpaste.history.v1";
export interface RecordEntry {
  id: string;
  number: number;
  date: string;
  parameters: Parameters;
  catalystName: string;
  formula: string;
  concentrationBasis: string;
  rate: number;
  height: number;
  volume: number | null;
  mass: number | null;
  estimateAssumptions?: EstimateAssumptions;
  progress: number;
  liquidDrop: number;
  particles: number;
  duration: number;
  modelVersion: string;
  evidence: string;
  notes: string;
}
export function createRecord(
  sim: FoamSimulation,
  number: number,
  rate: number,
): RecordEntry {
  const p = structuredClone(sim.parameters),
    c = catalystById(p.catalystId);
  return {
    id: crypto.randomUUID(),
    number,
    date: new Date().toISOString(),
    parameters: p,
    catalystName: c.name,
    formula: c.formula,
    concentrationBasis: c.concentrationBasis,
    rate,
    height: sim.maxHeight,
    ...estimateFoam(p, sim.progress),
    estimateAssumptions: structuredClone(ESTIMATE_ASSUMPTIONS),
    progress: sim.progress,
    liquidDrop: sim.liquidDrop,
    particles: sim.emitted,
    duration: sim.elapsed,
    modelVersion: MODEL_VERSION,
    evidence: c.evidenceLevel,
    notes: c.notes + " 資料依據：" + c.source + " " + ESTIMATE_NOTE,
  };
}
export function validRecord(r: unknown): r is RecordEntry {
  if (!r || typeof r !== "object") return false;
  const x = r as RecordEntry,
    p = x.parameters;
  return (
    typeof x.id === "string" &&
    Number.isInteger(x.number) &&
    Number.isFinite(Date.parse(x.date)) &&
    !!p &&
    typeof p.catalystId === "string" &&
    [p.h2o2, p.concentration].every(
      (n) => Number.isFinite(n) && n >= 0 && n <= 100,
    ) &&
    Array.isArray(p.rgb) &&
    p.rgb.length === 3 &&
    p.rgb.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) &&
    Number.isFinite(p.liquidVolume) &&
    [x.rate, x.height, x.progress, x.liquidDrop, x.particles, x.duration].every(
      (n) => Number.isFinite(n) && n >= 0,
    ) &&
    typeof x.catalystName === "string" &&
    typeof x.formula === "string" &&
    typeof x.notes === "string" &&
    typeof x.modelVersion === "string" &&
    typeof x.evidence === "string" &&
    typeof x.concentrationBasis === "string" &&
    (x.volume === null || (Number.isFinite(x.volume) && x.volume >= 0)) &&
    (x.mass === null || (Number.isFinite(x.mass) && x.mass >= 0))
  );
}
export function unique(records: RecordEntry[]) {
  return [...new Map(records.map((r) => [r.id, r])).values()];
}
export function loadHistory(storage: Pick<Storage, "getItem">): RecordEntry[] {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const data: unknown = JSON.parse(raw);
  if (!Array.isArray(data) || !data.every(validRecord))
    throw new Error("紀錄格式不相容，原始資料已保留。");
  return unique(data);
}
export function concentrations(records: RecordEntry[]) {
  return [...new Set(records.map((r) => r.parameters.h2o2))].sort(
    (a, b) => a - b,
  );
}
export function group(records: RecordEntry[], concentration: number) {
  return unique(records).filter((r) => r.parameters.h2o2 === concentration);
}
export function unfair(records: RecordEntry[]) {
  return (
    new Set(
      records.map((r) =>
        JSON.stringify([
          r.parameters.concentration,
          r.parameters.liquidVolume,
          r.duration,
          r.progress,
          r.modelVersion,
        ]),
      ),
    ).size > 1
  );
}
