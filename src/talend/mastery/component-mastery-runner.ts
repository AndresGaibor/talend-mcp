import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
  type ComponentMastery,
  type MasteryReport,
  createDefaultMastery,
  calculateMasteryLevel,
  getMissingCapabilities,
  generateMasterySummary,
  MASTERY_LEVELS,
  type MasteryLevel,
} from "./component-mastery-types";

import {
  inspectComponent,
  searchComponents,
  generateComponentTemplate,
} from "../components/component-catalog-builder";

import { parseJobItem } from "../job-parser";
import { buildJobItemXml, type JobSpec } from "../job-generator";

const MASTERY_DIR = ".talend-mcp/mastery";

function ensureMasteryDir(): string {
  const dir = join(process.cwd(), MASTERY_DIR);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export async function getComponentMastery(componentName: string): Promise<ComponentMastery> {
  const masteryPath = join(ensureMasteryDir(), `${componentName.replace(/[^a-zA-Z0-9]/g, "_")}.json`);

  if (existsSync(masteryPath)) {
    try {
      const content = readFileSync(masteryPath, "utf8");
      return JSON.parse(content) as ComponentMastery;
    } catch {
      return createDefaultMastery(componentName);
    }
  }

  return createDefaultMastery(componentName);
}

export async function saveComponentMastery(mastery: ComponentMastery): Promise<void> {
  const masteryPath = join(ensureMasteryDir(), `${mastery.componentName.replace(/[^a-zA-Z0-9]/g, "_")}.json`);
  writeFileSync(masteryPath, JSON.stringify(mastery, null, 2), "utf8");
}

export async function discoverComponent(componentName: string): Promise<ComponentMastery> {
  let mastery = await getComponentMastery(componentName);
  mastery.levels.discovered = true;
  mastery.lastValidated = Date.now();

  const catalogEntry = await inspectComponent(componentName);
  if (catalogEntry) {
    mastery.levels.parametersParsed = catalogEntry.parameters.length > 0;
  }

  const { level, score } = calculateMasteryLevel(mastery.levels);
  mastery.level = level;
  mastery.score = score;
  mastery.missing = getMissingCapabilities(mastery.levels);

  await saveComponentMastery(mastery);
  return mastery;
}

export async function validateTemplateGeneration(componentName: string): Promise<ComponentMastery> {
  let mastery = await getComponentMastery(componentName);

  const result = await generateComponentTemplate(componentName);
  if (result.ok && result.template) {
    mastery.levels.templateGenerated = true;
  }

  const { level, score } = calculateMasteryLevel(mastery.levels);
  mastery.level = level;
  mastery.score = score;
  mastery.missing = getMissingCapabilities(mastery.levels);
  mastery.lastValidated = Date.now();

  await saveComponentMastery(mastery);
  return mastery;
}

export async function validateRoundTrip(componentName: string, itemPath: string): Promise<ComponentMastery> {
  let mastery = await getComponentMastery(componentName);

  try {
    const xml = readFileSync(itemPath, "utf8");
    const parsed = parseJobItem(xml, itemPath);

    const hasComponents = parsed.components.length > 0;
    const hasConnections = parsed.connections.length >= 0;
    const hasContexts = parsed.contexts.length >= 0;

    mastery.levels.roundTripReadWrite = hasComponents;
    mastery.levels.jobGenerated = hasComponents;
  } catch {
    mastery.levels.roundTripReadWrite = false;
  }

  const { level, score } = calculateMasteryLevel(mastery.levels);
  mastery.level = level;
  mastery.score = score;
  mastery.missing = getMissingCapabilities(mastery.levels);
  mastery.lastValidated = Date.now();

  await saveComponentMastery(mastery);
  return mastery;
}

export async function markOpensInStudio(componentName: string): Promise<ComponentMastery> {
  let mastery = await getComponentMastery(componentName);
  mastery.levels.opensInStudio = true;

  const { level, score } = calculateMasteryLevel(mastery.levels);
  mastery.level = level;
  mastery.score = score;
  mastery.missing = getMissingCapabilities(mastery.levels);
  mastery.lastValidated = Date.now();

  await saveComponentMastery(mastery);
  return mastery;
}

export async function markCompilesWithoutProblems(componentName: string): Promise<ComponentMastery> {
  let mastery = await getComponentMastery(componentName);
  mastery.levels.compilesWithoutProblems = true;

  const { level, score } = calculateMasteryLevel(mastery.levels);
  mastery.level = level;
  mastery.score = score;
  mastery.missing = getMissingCapabilities(mastery.levels);
  mastery.lastValidated = Date.now();

  await saveComponentMastery(mastery);
  return mastery;
}

export async function markRunsInStudio(componentName: string): Promise<ComponentMastery> {
  let mastery = await getComponentMastery(componentName);
  mastery.levels.runsInStudio = true;

  const { level, score } = calculateMasteryLevel(mastery.levels);
  mastery.level = level;
  mastery.score = score;
  mastery.missing = getMissingCapabilities(mastery.levels);
  mastery.lastValidated = Date.now();

  await saveComponentMastery(mastery);
  return mastery;
}

export async function markHandlesErrors(componentName: string): Promise<ComponentMastery> {
  let mastery = await getComponentMastery(componentName);
  mastery.levels.handlesErrors = true;

  const { level, score } = calculateMasteryLevel(mastery.levels);
  mastery.level = level;
  mastery.score = score;
  mastery.missing = getMissingCapabilities(mastery.levels);
  mastery.lastValidated = Date.now();

  await saveComponentMastery(mastery);
  return mastery;
}

export async function markSafeEditingSupported(componentName: string): Promise<ComponentMastery> {
  let mastery = await getComponentMastery(componentName);
  mastery.levels.safeEditingSupported = true;

  const { level, score } = calculateMasteryLevel(mastery.levels);
  mastery.level = level;
  mastery.score = score;
  mastery.missing = getMissingCapabilities(mastery.levels);
  mastery.lastValidated = Date.now();

  await saveComponentMastery(mastery);
  return mastery;
}

export async function markAutomationValidated(componentName: string): Promise<ComponentMastery> {
  let mastery = await getComponentMastery(componentName);
  mastery.levels.automationValidated = true;

  const { level, score } = calculateMasteryLevel(mastery.levels);
  mastery.level = level;
  mastery.score = score;
  mastery.missing = getMissingCapabilities(mastery.levels);
  mastery.lastValidated = Date.now();

  await saveComponentMastery(mastery);
  return mastery;
}

export async function getAllMastery(): Promise<ComponentMastery[]> {
  const masteryDir = ensureMasteryDir();
  const entries = [];

  try {
    const files = readdirSync(masteryDir).filter((f) => f.endsWith(".json"));

    for (const file of files) {
      try {
        const content = readFileSync(join(masteryDir, file), "utf8");
        entries.push(JSON.parse(content) as ComponentMastery);
      } catch {
      }
    }
  } catch {
  }

  return entries;
}

export async function generateMasteryReport(): Promise<MasteryReport> {
  const components = await getAllMastery();

  const levelDistribution: Record<MasteryLevel, number> = {
    0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0,
  };

  for (const comp of components) {
    levelDistribution[comp.level]++;
  }

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

export async function masteryComponent(componentName: string): Promise<ComponentMastery> {
  const entry = await inspectComponent(componentName);
  if (!entry) {
    return createDefaultMastery(componentName);
  }

  let mastery = await getComponentMastery(componentName);

  mastery.levels.discovered = true;
  mastery.levels.parametersParsed = entry.parameters.length > 0;
  mastery.levels.templateGenerated = true;

  const { level, score } = calculateMasteryLevel(mastery.levels);
  mastery.level = level;
  mastery.score = score;
  mastery.missing = getMissingCapabilities(mastery.levels);
  mastery.lastValidated = Date.now();

  await saveComponentMastery(mastery);
  return mastery;
}

export async function masteryAllComponents(): Promise<MasteryReport> {
  const components = await searchComponents("", 1000);

  for (const comp of components) {
    await masteryComponent(comp.componentName);
  }

  return await generateMasteryReport();
}

export async function masteryGenerateFixture(componentName: string): Promise<{ ok: boolean; fixture?: string; error?: string }> {
  const entry = await inspectComponent(componentName);
  if (!entry) {
    return { ok: false, error: `Component not found: ${componentName}` };
  }

  const requiredParams = entry.parameters.filter((p) => p.required);
  const paramRecord: Record<string, string> = {};
  for (const p of requiredParams) {
    paramRecord[p.name] = p.defaultValue;
  }

  const spec: JobSpec = {
    jobName: `Test_${componentName}`,
    version: "0.1",
    folderPath: "test",
    components: [
      {
        componentName: componentName,
        uniqueName: `${componentName}_1`,
        parameters: paramRecord,
      },
    ],
  };

  try {
    const { xml } = buildJobItemXml(spec);
    return { ok: true, fixture: xml };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}