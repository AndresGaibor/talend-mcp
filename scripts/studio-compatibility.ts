import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import { createBridgeClient } from "../src/modules/studio-bridge/adapters/http-studio-bridge.client";
import { buildCompatibilityReport, javaTestSummary } from "../src/modules/studio-bridge/application/compatibility-audit";
import { detectStudio } from "./lib/studio-detect";

const root = process.cwd();
const studio = detectStudio();
if (!studio) {
  console.error("No se detectó una instalación de Talend Studio; define TALEND_STUDIO_HOME.");
  process.exit(2);
}

const client = await createBridgeClient();
const [ping, capabilities] = await Promise.all([client.ping(), client.capabilities()]);
const javaRun = spawnSync(process.execPath, ["test", "tests/talend/bridge-java.test.ts"], {
  cwd: root,
  encoding: "utf8",
  timeout: 300_000,
  windowsHide: true,
});
const javaOutput = `${javaRun.stdout ?? ""}\n${javaRun.stderr ?? ""}`;
const javaTests = javaTestSummary(javaOutput, javaRun.status);
const capabilityNames = Object.keys(capabilities.data?.capabilities ?? {}).sort();

const report = buildCompatibilityReport({
  testedAt: new Date().toISOString(),
  platform: `${process.platform}-${process.arch}`,
  studioVersion: basename(dirname(studio.studioDir)),
  bridge: {
    plugin: ping.data?.plugin ?? "unknown",
    version: ping.data?.version ?? "unknown",
    mode: ping.data?.mode ?? "unknown",
    ...(ping.data?.javaVersion ? { javaVersion: ping.data.javaVersion } : {}),
  },
  capabilities: { count: capabilityNames.length, names: capabilityNames },
  checks: [
    { name: "bridge-ping", ok: ping.ok && !!ping.data?.version },
    { name: "bridge-capabilities", ok: capabilities.ok && !!capabilities.data?.ok },
  ],
  javaTests,
});

const safeVersion = report.bridge.version.replace(/[^a-zA-Z0-9._-]/g, "_");
const outputDir = join(root, ".talend-mcp", "compatibility");
const outputPath = join(outputDir, `${report.platform}-studio-${report.studioVersion}-bridge-${safeVersion}.json`);
mkdirSync(outputDir, { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });

console.log(JSON.stringify({ ...report, reportPath: outputPath }, null, 2));
if (javaRun.error) console.error(`No se pudieron ejecutar las pruebas Java: ${javaRun.error.message}`);
if (report.verdict !== "passed") process.exit(1);
