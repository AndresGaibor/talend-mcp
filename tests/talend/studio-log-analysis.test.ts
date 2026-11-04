import { describe, expect, test } from "bun:test";
import {
  analyzeStudioLog,
  describeBridgeDown,
  explainBridgeState,
  lastSessionOf,
} from "../../src/talend/studio/log-analysis";

describe("explainBridgeState", () => {
  test("con el bridge conectado no hay nada que explicar", () => {
    expect(explainBridgeState({ studioRunning: true, bridgeConnected: true, logTail: "" })).toEqual({ nextSteps: [] });
  });

  test("con Studio cerrado pide abrirlo e iniciar sesion", () => {
    const { nextSteps } = explainBridgeState({ studioRunning: false, bridgeConnected: false, logTail: "" });
    expect(nextSteps.join(" ").toLowerCase()).toContain("abre");
  });

  test("con Studio abierto y bridge caido analiza solo la ultima sesion del log", () => {
    const log = "!SESSION 1 ---\nRefresh token failed.\n!SESSION 2 ---\nINFO limpio\n";
    const { nextSteps, analysis } = explainBridgeState({ studioRunning: true, bridgeConnected: false, logTail: log });
    expect(analysis?.findings).toEqual([]);
    expect(nextSteps.join(" ").toLowerCase()).toContain("login");
  });

  test("con Studio abierto y el token roto en la sesion actual lo senala", () => {
    const log = "!SESSION 1 ---\nlogged on X\nRefresh token failed.\n";
    const { nextSteps, analysis } = explainBridgeState({ studioRunning: true, bridgeConnected: false, logTail: log });
    expect(analysis?.findings.map((f) => f.code)).toContain("SSO_TOKEN_REFRESH_FAILED");
    expect(nextSteps.join(" ")).toContain("connection_user.properties");
  });
});

const sesionVieja = `!SESSION 2026-11-04 12:21:00.000 ----
!MESSAGE 2026-11-04 12:21:48,616 INFO  CommonExceptionHandler  - Refresh token failed.
`;
const sesionNueva = `!SESSION 2026-11-04 12:34:29.143 ----
!MESSAGE 2026-11-04 12:34:50,652 INFO  Proxy  - listo
`;

describe("lastSessionOf", () => {
  test("devuelve solo el texto desde el ultimo !SESSION", () => {
    const session = lastSessionOf(sesionVieja + sesionNueva);
    expect(session).toContain("12:34:29");
    expect(session).not.toContain("Refresh token failed");
  });

  test("sin marcas de sesion devuelve todo el texto", () => {
    expect(lastSessionOf("sin sesion")).toBe("sin sesion");
  });
});

describe("analyzeStudioLog", () => {
  test("detecta el fallo de refresco del token SSO una sola vez aunque se repita", () => {
    const log = "Refresh token failed.\nRefresh token failed.\nRefresh token failed.\n";
    const { findings } = analyzeStudioLog(log);
    expect(findings.filter((f) => f.code === "SSO_TOKEN_REFRESH_FAILED")).toHaveLength(1);
  });

  test("detecta el 401 de la sesion remota", () => {
    const { findings } = analyzeStudioLog("401:Authentication credentials were missing or incorrect.");
    expect(findings.map((f) => f.code)).toContain("SSO_UNAUTHORIZED");
  });

  test("detecta la carrera de ConcurrentModificationException en el login", () => {
    const { findings } = analyzeStudioLog("Caused by: java.util.ConcurrentModificationException\n at DynaEnum.values");
    expect(findings.map((f) => f.code)).toContain("REPOSITORY_TYPES_RACE");
  });

  test("detecta el cierre anterior sin guardar el workspace", () => {
    const { findings } = analyzeStudioLog("The workspace exited with unsaved changes in the previous session");
    expect(findings.map((f) => f.code)).toContain("WORKSPACE_UNCLEAN_EXIT");
  });

  test("marca si el logon llego a completarse", () => {
    expect(analyzeStudioLog("Nasimba logged on PRJ-BANCOLOMBIA").loggedOn).toBe(true);
    expect(analyzeStudioLog("nada relevante").loggedOn).toBe(false);
  });

  test("un log limpio no produce hallazgos", () => {
    expect(analyzeStudioLog("INFO todo bien").findings).toEqual([]);
  });

  test("cada hallazgo trae un siguiente paso concreto", () => {
    const { findings } = analyzeStudioLog("Refresh token failed.");
    expect(findings[0]?.nextStep.length).toBeGreaterThan(10);
  });
});

describe("describeBridgeDown", () => {
  test("con el token roto explica el bucle de login y propone renovar la conexion", () => {
    const steps = describeBridgeDown(analyzeStudioLog("Nasimba logged on X\nRefresh token failed."));
    expect(steps.join(" ")).toContain("connection_user.properties");
  });

  test("sin hallazgos explica que el bridge espera al login", () => {
    const steps = describeBridgeDown(analyzeStudioLog("INFO todo bien"));
    expect(steps.join(" ").toLowerCase()).toContain("login");
  });
});
