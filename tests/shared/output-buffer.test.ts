import { describe, expect, test } from "bun:test";
import { MAX_SALIDA_POR_DEFECTO, SalidaAcotada } from "../../src/shared/output-buffer";

describe("SalidaAcotada", () => {
  test("conserva la salida corta tal cual", () => {
    const salida = new SalidaAcotada(100);
    salida.append("linea uno\n");
    salida.append("linea dos\n");

    expect(salida.value).toBe("linea uno\nlinea dos\n");
    expect(salida.truncada).toBe(false);
  });

  test("se queda con el final y avisa del recorte", () => {
    const salida = new SalidaAcotada(100);
    salida.append("x".repeat(500) + "FINAL");

    expect(salida.truncada).toBe(true);
    expect(salida.value.length).toBeLessThanOrEqual(100);
    expect(salida.value.endsWith("FINAL")).toBe(true);
  });

  test("no crece sin limite aunque se le manden muchos trozos", () => {
    const salida = new SalidaAcotada(1000);
    for (let i = 0; i < 10_000; i++) {
      salida.append(`linea ${i}\n`);
    }

    expect(salida.value.length).toBeLessThanOrEqual(1000);
    expect(salida.truncada).toBe(true);
    // Lo ultimo escrito sigue estando: es donde aparecen los errores.
    expect(salida.value).toContain("linea 9999");
  });

  test("el tope por defecto es razonable para una salida de job", () => {
    expect(MAX_SALIDA_POR_DEFECTO).toBeGreaterThanOrEqual(1_000_000);
    expect(MAX_SALIDA_POR_DEFECTO).toBeLessThanOrEqual(10_000_000);
  });
});
