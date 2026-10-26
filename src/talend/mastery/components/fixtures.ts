import {
  type MasteryReport,
} from "../component-mastery-types";
import { inspectComponent, searchComponents } from "../../components/component-catalog-builder";
import { buildJobItemXml, type JobSpec } from "../../job-generator";

import { masteryComponent } from "./component-evaluation";
import { generateMasteryReport } from "./report";

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
