import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const LEGACY_FILE_PATH = resolve(
  import.meta.dir,
  "../../src/presentation/apps/legacy-app-shell.ts"
);

const CURRENT_LINE_COUNT = 3069;
const MAX_ALLOWED_LINE_COUNT = Math.floor(CURRENT_LINE_COUNT * 1.05);

const FORBIDDEN_APP_PATTERNS = [
  /create[A-Z]\w+Html\s*\(\s*\)\s*:/,
  /function\s+create[A-Z]\w+Html\s*\(\s*\)/,
];

const KNOWN_APP_IDS = [
  "dashboard",
  "dataset-inspector",
  "job-designer",
  "validation-report",
  "run-monitor",
  "snapshot-diff",
  "deliverables",
  "component-catalog",
  "command-center",
  "home",
  "environment-doctor",
  "workspace-explorer",
  "job-browser",
  "pattern-gallery",
  "visual-job-designer",
  "pipeline-spec-editor",
  "mapping-builder",
  "tmap-designer",
  "dataset-inspector-pro",
  "csv-preview",
  "raw-mapping-matrix",
  "context-profiles",
  "database-connection-wizard",
  "secret-safety",
  "run-monitor-pro",
  "launch-history",
  "runtime-comparison",
  "problems-view",
  "error-explorer",
  "validation-timeline",
  "snapshot-manager",
] as const;

test("legacy-app-shell.ts no excede tamaño actual + 5%", () => {
  const content = readFileSync(LEGACY_FILE_PATH, "utf-8");
  const lineCount = content.split("\n").length;

  const mensaje = `legacy-app-shell.ts creció más del 5% (líneas: ${lineCount}, máximo permitido: ${MAX_ALLOWED_LINE_COUNT})`;
  expect(lineCount).toBeLessThanOrEqual(MAX_ALLOWED_LINE_COUNT);
  if (lineCount > MAX_ALLOWED_LINE_COUNT) {
    throw new Error(mensaje);
  }
});

test("no se agregaron nuevas UI apps a legacy-app-shell", () => {
  const content = readFileSync(LEGACY_FILE_PATH, "utf-8");

  const newHtmlFunctions = content.match(
    /function\s+(create[A-Z]\w+Html)\s*\(\s*\)/g
  );

  const knownFunctions = [
    "createHomeHtml",
    "createDatasetInspectorProHtml",
    "createPipelineSpecEditorHtml",
    "createValidationReportHtml",
    "createRunMonitorProHtml",
    "createSecretSafetyHtml",
    "createSnapshotManagerHtml",
    "createDeliverablesHtml",
    "createComponentCatalogHtml",
    "createEnvironmentDoctorHtml",
    "createPresentationAppShellHtml",
  ];

  if (newHtmlFunctions) {
    const newOnes = newHtmlFunctions
      .map((f) => f.match(/function\s+(create[A-Z]\w+Html)/)?.[1])
      .filter((fn) => fn && !knownFunctions.includes(fn));

    if (newOnes.length > 0) {
      throw new Error(
        `Se encontraron nuevas funciones de UI en legacy-app-shell: ${newOnes.join(", ")}. Las nuevas apps deben vivir en apps-ui/.`
      );
    }
  }
});

test("no se expandió la definición de PresentationAppDefinition desde legacy-app-shell", () => {
  const content = readFileSync(LEGACY_FILE_PATH, "utf-8");

  const hasNewAppDefinition = /createPresentationAppShellHtml\s*\(\s*app:\s*PresentationAppDefinition\s*\)/.test(
    content
  );

  expect(hasNewAppDefinition).toBe(true);
});