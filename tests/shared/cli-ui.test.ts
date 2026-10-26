import { describe, expect, test } from "bun:test";
import {
  createUi,
  formatDuration,
  parseUiLevel,
  shouldUseColor,
  truncateLine,
} from "../../src/shared/cli/ui";

function capture(options: Parameters<typeof createUi>[0] = {}) {
  const lines: string[] = [];
  const ui = createUi({
    color: false,
    stream: { write: (chunk: string) => lines.push(chunk) },
    ...options,
  });
  return { ui, lines };
}

describe("salida de consola", () => {
  test("normaliza el nivel desde la variable de entorno", () => {
    expect(parseUiLevel("quiet")).toBe("quiet");
    expect(parseUiLevel(" VERBOSE ")).toBe("verbose");
    expect(parseUiLevel(undefined)).toBe("normal");
    expect(parseUiLevel("otro")).toBe("normal");
  });

  test("sin color no emite secuencias ANSI", () => {
    expect(shouldUseColor({}, true)).toBe(true);
    expect(shouldUseColor({ NO_COLOR: "1" }, true)).toBe(false);
    expect(shouldUseColor({ FORCE_COLOR: "1" }, false)).toBe(true);
    expect(shouldUseColor({}, false)).toBe(false);
    const { ui, lines } = capture();
    ui.ok("listo");
    ui.warn("ojo");
    expect(lines.join("")).not.toContain("\x1b[");
  });

  test("quiet calla la informacion pero deja ver errores y avisos", () => {
    const { ui, lines } = capture({ level: "quiet" });
    ui.info("no");
    ui.step("tampoco");
    ui.ok("tampoco");
    ui.debug("tampoco");
    ui.warn("aviso");
    ui.fail("error");
    expect(lines).toEqual(["⚠ aviso\n", "✖ error\n"]);
  });

  test("verbose muestra la traza de depuracion", () => {
    const { ui, lines } = capture({ level: "verbose" });
    ui.debug("consulta");
    expect(lines.join("")).toContain("consulta");
  });

  test("timed informa el resultado con su duracion", async () => {
    let tick = 0;
    const { ui, lines } = capture({ now: () => (tick += 250) });
    const value = await ui.timed("compilar", () => 42);
    expect(value).toBe(42);
    expect(lines[0]).toBe("✓ compilar (250 ms)\n");
  });

  test("timed informa el fallo y propaga el error", async () => {
    const { ui, lines } = capture();
    await expect(ui.timed("compilar", () => { throw new Error("boom"); })).rejects.toThrow("boom");
    expect(lines[0]).toContain("✖ compilar");
  });

  test("formatea duraciones y recorta lineas largas", () => {
    expect(formatDuration(320)).toBe("320 ms");
    expect(formatDuration(1250)).toBe("1,3 s");
    expect(formatDuration(12500)).toBe("13 s");
    const long = "palabra ".repeat(30);
    expect(truncateLine(long, 20).length).toBeLessThanOrEqual(20);
    expect(truncateLine("  texto   con   espacios  ", 40)).toBe("texto con espacios");
  });
});
