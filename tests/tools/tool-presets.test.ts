import { afterEach, describe, expect, test } from "bun:test";
import { getAllRuntimeTools, isKnownPreset, knownPresets } from "../../src/server/registered-tools";

const previous = process.env.TALEND_MCP_FILTER;

afterEach(() => {
  if (previous === undefined) delete process.env.TALEND_MCP_FILTER;
  else process.env.TALEND_MCP_FILTER = previous;
});

function withFilter(filter: string | undefined) {
  if (filter === undefined) delete process.env.TALEND_MCP_FILTER;
  else process.env.TALEND_MCP_FILTER = filter;
  return getAllRuntimeTools().map((tool) => tool.name);
}

describe("presets de tools", () => {
  test("los presets conocidos son los que declara el registro", () => {
    expect(isKnownPreset("agent")).toBe(true);
    expect(isKnownPreset(" AGENT ")).toBe(true);
    expect(isKnownPreset("no-existe")).toBe(false);
    expect(knownPresets()).toContain("core");
    expect(knownPresets()).toContain("agent");
  });

  test("sin filtro se exponen todas las tools", () => {
    const all = withFilter(undefined);
    expect(all.length).toBeGreaterThan(150);
  });

  test("agent es un subconjunto corto de canonical y siempre incluye la guia", () => {
    const agent = withFilter("agent");
    const canonical = new Set(withFilter("canonical"));
    expect(agent).toContain("talend_guide");
    expect(agent).toContain("talend_job_apply_custom_spec");
    expect(agent.length).toBeLessThan(80);
    expect(agent.every((name) => canonical.has(name))).toBe(true);
  });

  test("canonical oculta el alias legacy y all lo conserva", () => {
    const canonical = withFilter("canonical");
    const all = withFilter("all");
    expect(canonical).not.toContain("talend_report_generate_snippets");
    expect(all).toContain("talend_report_generate_snippets");
  });

  test("los presets se combinan y aceptan comodines", () => {
    const combined = withFilter("errors,secrets");
    expect(combined.some((name) => name.startsWith("talend_errors_"))).toBe(true);
    expect(combined.some((name) => name.startsWith("talend_secrets_"))).toBe(true);
    expect(combined.every((name) => name === "talend_guide" || /talend_(errors|secrets)_/.test(name))).toBe(true);

    const wildcard = withFilter("talend_jobs_*");
    expect(wildcard).toContain("talend_jobs_list");
    expect(wildcard.every((name) => name === "talend_guide" || name.startsWith("talend_jobs_"))).toBe(true);
  });

  test("cada preset de modulo expone al menos una tool", () => {
    const vacios = knownPresets().filter((preset) => {
      if (preset === "all" || preset === "canonical" || preset === "agent" || preset === "core") return false;
      return withFilter(preset).filter((name) => name !== "talend_guide").length === 0;
    });
    expect(vacios, `Presets sin tools: ${vacios.join(", ")}`).toEqual([]);
  });
});
