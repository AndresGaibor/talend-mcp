import { describe, expect, test } from "bun:test";
import {
  getLiveWatcherStatus,
  stopTalendWatcher,
} from "../../src/talend/live/watcher";

/**
 * Caracterizacion del watcher sin arrancar temporizadores ni observadores:
 * el estado inicial es "no hay watcher activo" y parar sin arrancar falla.
 */
describe("watcher de cambios del proyecto", () => {
  test("el estado inicial informa que no hay watcher activo", () => {
    const status = getLiveWatcherStatus();
    expect(status.ok).toBe(false);
    expect(status.confidence).toBe("none");
    expect(status.source).toBe("unknown");
    expect(status.error).toContain("No hay un watcher activo");
    expect(status.data).toBeUndefined();
  });

  test("detener sin arrancar devuelve error en vez de lanzar", async () => {
    const stopped = await stopTalendWatcher();
    expect(stopped.ok).toBe(false);
    expect(stopped.error).toContain("No hay un watcher activo");
  });

  test("el estado sigue inactivo despues de un intento de parada", () => {
    expect(getLiveWatcherStatus().ok).toBe(false);
  });
});
