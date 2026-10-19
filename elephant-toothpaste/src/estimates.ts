import type { Parameters } from "./model";
// Educational scenario assumptions, not measured reaction/foam constants.
export const ESTIMATE_ASSUMPTIONS = Object.freeze({
  version: "foam-scenario-1.0",
  solutionDensityGPerMl: 1,
  liquidDensityGPerMl: 1,
  molarMassH2O2: 34.0147,
  molarMassO2: 31.998,
  gasMolarVolumeMl: 24465,
  gasCaptureFraction: 0.15,
  nominalLiquidVolumeFraction: 0.02,
  maxEntrainedLiquidFraction: 0.5,
});
export type EstimateAssumptions = typeof ESTIMATE_ASSUMPTIONS;
export function estimateFoam(p: Parameters, progress: number) {
  const a = ESTIMATE_ASSUMPTIONS;
  const fraction = Math.max(
    0,
    Math.min(1, Number.isFinite(progress) ? progress : 0),
  );
  const initialMass = p.liquidVolume * a.solutionDensityGPerMl;
  const consumedH2O2 = initialMass * (p.h2o2 / 100) * fraction;
  // 2 H₂O₂ → 2 H₂O + O₂. Gas volume assumes 25 °C and 1 atm.
  const oxygenMoles = consumedH2O2 / a.molarMassH2O2 / 2;
  const gasVolume = oxygenMoles * a.gasMolarVolumeMl * a.gasCaptureFraction;
  const gasMass = oxygenMoles * a.molarMassO2 * a.gasCaptureFraction;
  const remainingLiquidMass = Math.max(
    0,
    initialMass - oxygenMoles * a.molarMassO2,
  );
  const liquidVolume = Math.min(
    (gasVolume * a.nominalLiquidVolumeFraction) /
      (1 - a.nominalLiquidVolumeFraction),
    (remainingLiquidMass * a.maxEntrainedLiquidFraction) /
      a.liquidDensityGPerMl,
  );
  return {
    volume: gasVolume + liquidVolume,
    mass: gasMass + liquidVolume * a.liquidDensityGPerMl,
  };
}
export const ESTIMATE_NOTE =
  "示意估算，尚未校準：H₂O₂ 輸入視為名目 w/w%；初始液體 100 mL，溶液及液相密度均假設 1 g/mL；氣體按 25°C、1 atm 的 24,465 mL/mol 換算，假設捕捉 15% 氧氣、目標泡沫液相體積比 2%，夾帶液體最多為殘餘液體質量的 50%。未計催化劑添加體積與質量、蒸發及熱效應；泡沫質量為夾帶液體加捕捉氧氣，不是生成物總質量。動畫粒子數不參與換算。";
