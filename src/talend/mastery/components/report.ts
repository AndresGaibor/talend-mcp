import {
  type MasteryReport,
  generateMasterySummary,
} from "../component-mastery-types";

import { getAllMastery } from "./persistence";
import { computeLevelDistribution } from "./mastery-levels";

export async function generateMasteryReport(): Promise<MasteryReport> {
  const components = await getAllMastery();

  const levelDistribution = computeLevelDistribution(components);

  const totalScore = components.reduce((sum, c) => sum + c.score, 0);
  const averageScore = components.length > 0 ? totalScore / components.length : 0;

  const report: MasteryReport = {
    generatedAt: Date.now(),
    totalComponents: components.length,
    averageScore,
    levelDistribution,
    components,
    summary: generateMasterySummary({
      generatedAt: Date.now(),
      totalComponents: components.length,
      averageScore,
      levelDistribution,
      components,
      summary: "",
    }),
  };

  return report;
}
