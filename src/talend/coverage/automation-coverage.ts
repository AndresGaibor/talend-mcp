import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type CoverageArea = {
  workspace: number;
  jobs: number;
  components: number;
  contexts: number;
  dq: number;
  execution: number;
  studioBridge: number;
  uiAutomation: number;
};

export type AutomationCoverageReport = {
  overall: number;
  areas: CoverageArea;
  missing: string[];
  generatedAt: number;
};

function computeOverall(areas: CoverageArea): number {
  const weights: Record<keyof CoverageArea, number> = {
    workspace: 0.10,
    jobs: 0.20,
    components: 0.15,
    contexts: 0.10,
    dq: 0.10,
    execution: 0.15,
    studioBridge: 0.15,
    uiAutomation: 0.05,
  };

  let total = 0;
  for (const [key, weight] of Object.entries(weights)) {
    total += (areas[key as keyof CoverageArea] ?? 0) * weight;
  }
  return Math.round(total);
}

async function getWorkspaceScore(bridgeHealth: number): Promise<number> {
  let score = 0;
  if (process.env.TALEND_PROJECT && existsSync(process.env.TALEND_PROJECT)) score += 20;
  if (existsSync(join(process.cwd(), ".metadata"))) score += 20;
  if (existsSync(join(process.cwd(), "process"))) score += 20;
  if (existsSync(join(process.cwd(), "context"))) score += 20;
  if (bridgeHealth > 0) score += 20;
  return score;
}

async function getJobsScore(): Promise<number> {
  let score = 0;
  // Si tenemos repository-contexts y job-parser, asumimos soporte básico
  if (existsSync("src/talend/repository.ts")) score += 20;
  if (existsSync("src/talend/job-parser.ts")) score += 20;
  if (existsSync("src/talend/job-generator.ts")) score += 20;
  if (existsSync("src/talend/sync/studio-file-sync.ts")) score += 20;
  if (existsSync("src/talend/automation/job-automation.ts")) score += 20;
  return score;
}

async function getContextsScore(): Promise<number> {
  let score = 0;
  if (existsSync("src/talend/project-contexts.ts")) score += 25;
  if (existsSync("src/talend/repository-contexts.ts")) score += 25;
  if (existsSync("src/talend/sync/studio-file-sync.ts")) score += 25;
  // TODO: validar missing values logic
  score += 10; 
  return score;
}

async function getDqScore(): Promise<number> {
  let score = 0;
  if (existsSync("src/talend/dq-analysis.ts")) score += 25;
  if (existsSync("src/talend/dq-crud.ts")) score += 25;
  if (existsSync("src/talend/dq-editor.ts")) score += 25;
  // TODO: run analysis logic
  return score;
}

async function getMasteryScore(): Promise<number> {
  try {
    const masteryDir = join(process.cwd(), ".talend-mcp", "mastery");
    if (!existsSync(masteryDir)) return 0;
    const files = readdirSync(masteryDir).filter((f) => f.endsWith(".json"));
    if (files.length === 0) return 0;
    let totalScore = 0;
    for (const file of files) {
      try {
        const content = readFileSync(join(masteryDir, file), "utf8");
        const mastery = JSON.parse(content);
        totalScore += mastery.score ?? 0;
      } catch { /* skip */ }
    }
    return Math.round(totalScore / files.length);
  } catch {
    return 0;
  }
}

async function getCatalogComponentCount(): Promise<number> {
  try {
    const catalogPath = join(process.cwd(), ".talend-mcp", "component-catalog.json");
    if (!existsSync(catalogPath)) return 0;
    const content = readFileSync(catalogPath, "utf8");
    const data = JSON.parse(content);
    return data.entries?.length ?? 0;
  } catch {
    return 0;
  }
}

async function getBridgeHealthScore(bridge?: { ping: () => Promise<any>; capabilities: () => Promise<any>; workbenchState: () => Promise<any>; launchConfigs: () => Promise<any>; eventsRecent: () => Promise<any> }): Promise<number> {
  if (!bridge) return 0;

  let score = 0;

  try {
    if ((await bridge.ping()).ok) score += 20;
  } catch { /* noop */ }

  try {
    if ((await bridge.capabilities()).ok) score += 20;
  } catch { /* noop */ }

  try {
    if ((await bridge.workbenchState()).ok) score += 20;
  } catch { /* noop */ }

  try {
    if ((await bridge.launchConfigs()).ok) score += 20;
  } catch { /* noop */ }

  try {
    if ((await bridge.eventsRecent()).ok) score += 20;
  } catch { /* noop */ }

  return score;
}

async function getLaunchTracksDir(): Promise<{ count: number; hasTerminatedData: boolean }> {
  try {
    const tracksDir = join(process.cwd(), ".talend-mcp", "launch-tracks");
    if (!existsSync(tracksDir)) return { count: 0, hasTerminatedData: false };
    const files = readdirSync(tracksDir).filter((f) => f.endsWith(".json"));
    let hasTerminatedData = false;
    for (const file of files) {
      try {
        const content = readFileSync(join(tracksDir, file), "utf8");
        const track = JSON.parse(content);
        if (track.terminatedAt) hasTerminatedData = true;
      } catch { /* skip */ }
    }
    return { count: files.length, hasTerminatedData };
  } catch {
    return { count: 0, hasTerminatedData: false };
  }
}

export async function generateCoverageReport(options?: {
  override?: Partial<CoverageArea>;
  missing?: string[];
  bridge?: { ping: () => Promise<any>; capabilities: () => Promise<any>; workbenchState: () => Promise<any>; launchConfigs: () => Promise<any>; eventsRecent: () => Promise<any> };
}): Promise<AutomationCoverageReport> {
  const masteryScore = await getMasteryScore();
  const componentCount = await getCatalogComponentCount();
  const launchTracks = await getLaunchTracksDir();
  const bridgeHealthScore = options?.bridge ? await getBridgeHealthScore(options.bridge) : 0;

  const componentsScore = masteryScore > 0 ? masteryScore : Math.min(100, componentCount * 5);
  const executionScore = launchTracks.hasTerminatedData
    ? Math.min(100, 50 + (launchTracks.count > 0 ? 25 : 0) + (launchTracks.hasTerminatedData ? 25 : 0))
    : launchTracks.count > 0 ? 55 : 40;
  
  const workspaceScore = await getWorkspaceScore(bridgeHealthScore);
  const jobsScore = await getJobsScore();
  const contextsScore = await getContextsScore();
  const dqScore = await getDqScore();
  const uiAutomationScore = existsSync("src/talend/ui/ui-driver.ts") ? 20 : 0;

  const dynamicAreas: CoverageArea = {
    workspace: workspaceScore,
    jobs: jobsScore,
    components: componentsScore,
    contexts: contextsScore,
    dq: dqScore,
    execution: executionScore,
    studioBridge: bridgeHealthScore,
    uiAutomation: uiAutomationScore,
  };

  const areas = { ...dynamicAreas, ...options?.override };

  const defaultMissing: string[] = [];
  if (componentsScore < 70) defaultMissing.push("Catalogo de componentes requiere mas datos de mastery");
  if (!launchTracks.hasTerminatedData) defaultMissing.push("No hay datos de ejecucion real (launch tracking)");
  if (bridgeHealthScore < 80) defaultMissing.push("Plugin bridge necesita mas endpoints");
  if (areas.uiAutomation < 30) defaultMissing.push("UI automation no disponible aun");

  return {
    overall: computeOverall(areas),
    areas,
    missing: options?.missing ?? defaultMissing,
    generatedAt: Date.now(),
  };
}