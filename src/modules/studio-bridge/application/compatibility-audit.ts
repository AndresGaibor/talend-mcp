export type CompatibilityCheck = {
  name: string;
  ok: boolean;
  detail?: string;
};

export type CompatibilityReport = {
  schemaVersion: 1;
  testedAt: string;
  platform: string;
  studioVersion: string;
  bridge: { plugin: string; version: string; mode: string; javaVersion?: string };
  capabilities: { count: number; names: string[] };
  checks: CompatibilityCheck[];
  javaTests: { ok: boolean; passed?: number; failed?: number; exitCode: number | null };
  verdict: "passed" | "failed";
};

export function buildCompatibilityReport(input: Omit<CompatibilityReport, "schemaVersion" | "verdict">): CompatibilityReport {
  const checks = [...input.checks];
  checks.push({ name: "java-bridge-tests", ok: input.javaTests.ok });
  return {
    schemaVersion: 1,
    ...input,
    checks,
    verdict: checks.every((check) => check.ok) ? "passed" : "failed",
  };
}

export function javaTestSummary(output: string, exitCode: number | null): CompatibilityReport["javaTests"] {
  const match = output.match(/RESULT passed=(\d+) failed=(\d+)/)
    ?? output.match(/(\d+) pass(?:ed)?\s+(\d+) fail(?:ed)?/i);
  const passed = match ? Number(match[1]) : undefined;
  const failed = match ? Number(match[2]) : undefined;
  return {
    ok: exitCode === 0 && failed === 0 && passed !== undefined && passed > 0,
    ...(passed === undefined ? {} : { passed }),
    ...(failed === undefined ? {} : { failed }),
    exitCode,
  };
}
