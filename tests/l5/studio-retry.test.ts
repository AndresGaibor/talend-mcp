import { describe, expect, test } from "bun:test";

import {
  compilando,
  errorDe,
  reintentar,
  transitorioDeStudio,
} from "../../scripts/l5/studio-retry";

describe("reintentos de Studio", () => {
  test("reconoce los avisos transitorios y los del build", () => {
    expect(transitorioDeStudio("No se pudo abrir el job X en el editor")).toBe(true);
    expect(transitorioDeStudio("Studio esta ocupado")).toBe(true);
    expect(transitorioDeStudio("hilo de la interfaz")).toBe(true);
    expect(transitorioDeStudio("el job no compila")).toBe(false);

    expect(compilando("el job no esta compilado")).toBe(true);
    expect(compilando("No se encontro la clase principal")).toBe(true);
    expect(compilando("error de SQL")).toBe(false);
  });

  test("errorDe prefiere el mensaje y recorta el texto crudo", () => {
    expect(errorDe({ error: { message: "fallo" }, rawText: "otra cosa" })).toBe("fallo");
    expect(errorDe({ rawText: "x".repeat(400) })).toHaveLength(300);
    expect(errorDe({})).toBe("error desconocido");
  });

  test("no reintenta un error que no es transitorio", async () => {
    let llamadas = 0;
    const respuesta = await reintentar(
      async () => {
        llamadas++;
        return { ok: false, error: { message: "job inexistente" } };
      },
      transitorioDeStudio,
      { esperaMs: 0 },
    );

    expect(llamadas).toBe(1);
    expect(respuesta.ok).toBe(false);
  });

  test("reintenta mientras el aviso sea transitorio", async () => {
    let llamadas = 0;
    const respuesta = await reintentar(
      async () => {
        llamadas++;
        return llamadas < 3
          ? { ok: false, error: { message: "Studio esta ocupado" } }
          : { ok: true };
      },
      transitorioDeStudio,
      { esperaMs: 0, intentos: 5 },
    );

    expect(llamadas).toBe(3);
    expect(respuesta.ok).toBe(true);
  });

  test("respeta el limite de intentos", async () => {
    let llamadas = 0;
    const respuesta = await reintentar(
      async () => {
        llamadas++;
        return { ok: false, error: { message: "ocupado" } };
      },
      transitorioDeStudio,
      { esperaMs: 0, intentos: 2 },
    );

    expect(llamadas).toBe(3);
    expect(respuesta.ok).toBe(false);
  });
});
