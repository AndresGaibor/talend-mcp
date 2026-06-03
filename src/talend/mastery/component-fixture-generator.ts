import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildJobItemXml } from "../job-generator";
import type { JobSpec } from "../job-generator";

const FIXTURE_DIR = ".talend-mcp/fixtures/components";

function ensureFixtureDir(componentName: string): string {
  const dir = join(process.cwd(), FIXTURE_DIR, componentName);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export type FixtureGenerateResult = {
  ok: boolean;
  componentName: string;
  fixtureDir: string;
  itemPath: string | null;
  propertiesPath: string | null;
  error?: string;
};

export async function generateComponentFixture(componentName: string, options?: {
  parameterOverrides?: Record<string, string>;
}): Promise<FixtureGenerateResult> {
  const fixtureDir = ensureFixtureDir(componentName);

  const spec: JobSpec = {
    jobName: "Test_" + componentName,
    version: "0.1",
    folderPath: join(FIXTURE_DIR, componentName).split("/").slice(1).join("/"),
    components: [
      {
        componentName: componentName,
        uniqueName: componentName + "_1",
        parameters: options?.parameterOverrides ?? {},
        posX: 160,
        posY: 96,
      },
    ],
  };

  try {
    const { xml: itemXml, rootId } = buildJobItemXml(spec);
    const itemFile = "test_" + componentName + "_0.1.item";
    const propsFile = "test_" + componentName + "_0.1.properties";
    const itemPath = join(fixtureDir, itemFile);
    const propsPath = join(fixtureDir, propsFile);

    writeFileSync(itemPath, itemXml, "utf8");

    const propsSpec: JobSpec = { ...spec, jobName: spec.jobName };
    const { buildJobPropertiesXml } = require("../job-generator");
    const propsXml = buildJobPropertiesXml(propsSpec, rootId);
    writeFileSync(propsPath, propsXml, "utf8");

    return {
      ok: true,
      componentName,
      fixtureDir,
      itemPath,
      propertiesPath: propsPath,
    };
  } catch (e) {
    return {
      ok: false,
      componentName,
      fixtureDir,
      itemPath: null,
      propertiesPath: null,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
