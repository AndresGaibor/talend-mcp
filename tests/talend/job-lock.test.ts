import { describe, expect, test } from "bun:test";
import { conCandadoDeJob } from "../../src/talend/studio/job-lock";

/** Espera un turno del event loop, para que las promesas pendientes avancen. */
const respirar = () => new Promise<void>((resolve) => setTimeout(resolve, 5));

describe("candado por job", () => {
  test("dos operaciones del mismo job no se solapan", async () => {
    const orden: string[] = [];

    const primera = conCandadoDeJob("MCP_Job", async () => {
      orden.push("primera:entra");
      await respirar();
      orden.push("primera:sale");
    });
    const segunda = conCandadoDeJob("MCP_Job", async () => {
      orden.push("segunda:entra");
      orden.push("segunda:sale");
    });

    await Promise.all([primera, segunda]);

    expect(orden).toEqual(["primera:entra", "primera:sale", "segunda:entra", "segunda:sale"]);
  });

  test("jobs distintos siguen en paralelo", async () => {
    let enCurso = 0;
    let maximo = 0;

    const tarea = () => async () => {
      enCurso++;
      maximo = Math.max(maximo, enCurso);
      await respirar();
      enCurso--;
    };

    await Promise.all([
      conCandadoDeJob("MCP_Uno", tarea()),
      conCandadoDeJob("MCP_Dos", tarea()),
    ]);

    expect(maximo).toBe(2);
  });

  test("el nombre del job no distingue mayusculas", async () => {
    const orden: string[] = [];

    await Promise.all([
      conCandadoDeJob("MCP_Job", async () => {
        await respirar();
        orden.push("primera");
      }),
      conCandadoDeJob("mcp_job", async () => {
        orden.push("segunda");
      }),
    ]);

    expect(orden).toEqual(["primera", "segunda"]);
  });

  test("si una operacion falla, la siguiente se ejecuta igual", async () => {
    await expect(conCandadoDeJob("MCP_Job", async () => {
      throw new Error("fallo a proposito");
    })).rejects.toThrow("fallo a proposito");

    await expect(conCandadoDeJob("MCP_Job", async () => "sigue")).resolves.toBe("sigue");
  });

  test("el candado se libera al terminar", async () => {
    // Si la clave quedara retenida, la segunda llamada esperaria a la primera
    // para siempre. Que resuelva basta para saber que se libero.
    await conCandadoDeJob("MCP_Job", async () => undefined);
    await expect(conCandadoDeJob("MCP_Job", async () => "libre")).resolves.toBe("libre");
  });
});
