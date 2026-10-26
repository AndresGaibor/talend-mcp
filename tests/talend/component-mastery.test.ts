import { describe, expect, test } from "bun:test";

import {
  calculateMasteryLevel,
  createDefaultMastery,
  generateMasterySummary,
  getMissingCapabilities,
  type ComponentMastery,
} from "../../src/talend/mastery/component-mastery-types";
import {
  computeLevelDistribution,
  recalculateMastery,
} from "../../src/talend/mastery/components/mastery-levels";

// Activa todas las capacidades para comparar contra el nivel maximo.
function allCapabilitiesMastery(): ComponentMastery {
  const mastery = createDefaultMastery("tMap");
  for (const capability of Object.keys(mastery.levels) as Array<keyof ComponentMastery["levels"]>) {
    mastery.levels[capability] = true;
  }
  return mastery;
}

describe("maestria de componentes: piezas puras", () => {
  test("el mastery por defecto arranca en nivel 0 sin evidencia", () => {
    const mastery = createDefaultMastery("tMap");

    expect(mastery.componentName).toBe("tMap");
    expect(mastery.score).toBe(0);
    expect(mastery.level).toBe(0);
    expect(mastery.evidence).toEqual([]);
    expect(mastery.missing).toEqual(["Componente no descubierto aún"]);
    expect(mastery.lastValidated).toBeNull();
    expect(Object.values(mastery.levels).every((value) => value === false)).toBe(true);
  });

  test("todas las capacidades dan score 95 y nivel 10", () => {
    const { level, score } = calculateMasteryLevel(allCapabilitiesMastery().levels);

    expect(score).toBe(95);
    expect(level).toBe(10);
  });

  test("solo descubierto da score 10 y nivel 1", () => {
    const mastery = createDefaultMastery("tMap");
    mastery.levels.discovered = true;

    expect(calculateMasteryLevel(mastery.levels)).toEqual({ level: 1, score: 10 });
  });

  test("sin capacidades el nivel es 0", () => {
    expect(calculateMasteryLevel(createDefaultMastery("tMap").levels)).toEqual({ level: 0, score: 0 });
  });

  test("las capacidades pendientes listan una entrada por nivel sin validar", () => {
    expect(getMissingCapabilities(createDefaultMastery("tMap").levels)).toHaveLength(11);
    expect(getMissingCapabilities(allCapabilitiesMastery().levels)).toEqual([]);
  });

  test("recalcular actualiza nivel, score y pendientes sin tocar lastValidated", () => {
    const mastery = createDefaultMastery("tMap");
    mastery.levels.discovered = true;
    mastery.levels.parametersParsed = true;

    recalculateMastery(mastery);

    expect(mastery.score).toBe(20);
    expect(mastery.level).toBe(2);
    expect(mastery.missing).not.toContain("No se descubrió el componente");
    expect(mastery.missing).not.toContain("Parámetros no fueron parseados");
    expect(mastery.missing).toContain("No se generó plantilla");
    expect(mastery.lastValidated).toBeNull();
  });

  test("computeLevelDistribution cuenta componentes por nivel", () => {
    const nivel0 = createDefaultMastery("a");
    const nivel10 = allCapabilitiesMastery();
    nivel10.level = 10;

    const distribution = computeLevelDistribution([nivel0, nivel10, createDefaultMastery("b")]);

    expect(distribution[0]).toBe(2);
    expect(distribution[10]).toBe(1);
    expect(distribution[5]).toBe(0);
  });

  test("el resumen incluye totales, promedio y distribucion por nombre de nivel", () => {
    const mastery = allCapabilitiesMastery();
    mastery.level = 10;

    const summary = generateMasterySummary({
      generatedAt: 0,
      totalComponents: 1,
      averageScore: 95,
      levelDistribution: computeLevelDistribution([mastery]),
      components: [mastery],
      summary: "",
    });

    expect(summary).toContain("1 componentes");
    expect(summary).toContain("95.0/100");
    expect(summary).toContain("Automatización Completa: 1");
  });
});
