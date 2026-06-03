import { existsSync, readFileSync } from "node:fs";
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

async function getMasteryScore(): Promise<number> {
  try {
    const masteryDir = join(process.cwd(), ".talend-mcp", "mastery");
    if (!existsSync(masteryDir)) return 0;
    const files = (await Bun.file(masteryDir).text().then((t) => t.split("\n"))).filter((f) => f.endsWith(".json"));
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

async function getBridgeEndpointCount(): Promise<number> {
  const endpoints = [
    "/ping",
    "/capabilities",
    "/audit/environment",
    "/workbench/state",
    "/talend/active-job/model",
    "/commands/list",
    "/commands/execute",
    "/launch/configs",
    "/launch/run",
    "/workbench/selection",
    "/workbench/views",
    "/workbench/open-resource",
    "/workspace/state",
    "/problems/markers",
    "/talend/probe/classes",
    "/talend/active-editor/introspect",
    "/events/recent",
    "/events/clear",
    "/workbench/save-active",
    "/workbench/save-all",
    "/workspace/refresh",
    "/automation/run-active-job",
  ];
  return endpoints.length;
}

async function getLaunchTracksDir(): Promise<{ count: number; hasTerminatedData: boolean }> {
  try {
    const tracksDir = join(process.cwd(), ".talend-mcp", "launch-tracks");
    if (!existsSync(tracksDir)) return { count: 0, hasTerminatedData: false };
    const files = (await Bun.file(tracksDir).text().then((t) => t.split("\n"))).filter((f) => f.endsWith(".json"));
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
}): Promise<AutomationCoverageReport> {
  const masteryScore = await getMasteryScore();
  const componentCount = await getCatalogComponentCount();
  const launchTracks = await getLaunchTracksDir();
  const bridgeEndpoints = await getBridgeEndpointCount();

  const componentsScore = masteryScore > 0 ? masteryScore : Math.min(100, componentCount * 5);
  const executionScore = launchTracks.hasTerminatedData
    ? Math.min(100, 50 + (launchTracks.count > 0 ? 25 : 0) + (launchTracks.hasTerminatedData ? 25 : 0))
    : launchTracks.count > 0 ? 55 : 40;
  const studioBridgeScore = Math.min(100, (bridgeEndpoints / 22) * 70 + 30);

  const dynamicAreas: CoverageArea = {
    workspace: 90,
    jobs: 75,
    components: componentsScore,
    contexts: 60,
    dq: 50,
    execution: executionScore,
    studioBridge: studioBridgeScore,
    uiAutomation: 15,
  };

  const areas = { ...dynamicAreas, ...options?.override };

  const defaultMissing: string[] = [];
  if (componentsScore < 70) defaultMissing.push("Catalogo de componentes requiere mas datos de mastery");
  if (!launchTracks.hasTerminatedData) defaultMissing.push("No hay datos de ejecucion real (launch tracking)");
  if (studioBridgeScore < 80) defaultMissing.push("Plugin bridge necesita mas endpoints");
  if (areas.uiAutomation < 30) defaultMissing.push("UI automation no disponible aun");

  return {
    overall: computeOverall(areas),
    areas,
    missing: options?.missing ?? defaultMissing,
    generatedAt: Date.now(),
  };
}