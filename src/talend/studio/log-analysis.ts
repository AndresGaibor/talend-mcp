import { closeSync, existsSync, fstatSync, openSync, readSync } from "node:fs";

/**
 * Lectura del `.log` del workspace de Studio para explicar por que el bridge no responde.
 *
 * El bridge arranca con el workbench, es decir, despues del login. Con Studio abierto y el bridge
 * caido, lo normal es que Studio este en la pantalla de login, y el motivo por el que no pasa de ahi
 * solo esta en su log. Estas funciones son puras (salvo `readStudioLogTail`) para poder probarlas con
 * texto de ejemplo.
 */

export type LogFinding = {
  code: "SSO_TOKEN_REFRESH_FAILED" | "SSO_UNAUTHORIZED" | "REPOSITORY_TYPES_RACE" | "WORKSPACE_UNCLEAN_EXIT";
  message: string;
  nextStep: string;
};

export type StudioLogAnalysis = {
  /** True si la sesion llego a completar el logon de un proyecto. */
  loggedOn: boolean;
  findings: LogFinding[];
};

/** Texto de la ultima sesion de Studio: desde el ultimo `!SESSION`, o todo si no hay marcas. */
export function lastSessionOf(log: string): string {
  const index = log.lastIndexOf("!SESSION ");
  return index === -1 ? log : log.slice(index);
}

const RULES: Array<{ pattern: RegExp; finding: LogFinding }> = [
  {
    pattern: /Refresh token failed/,
    finding: {
      code: "SSO_TOKEN_REFRESH_FAILED",
      message: "Studio no puede renovar el token SSO de Talend Cloud (Refresh token failed / Bad Request).",
      nextStep:
        "Cierra Studio, copia y aparta configuration\\connection_user.properties (guarda la conexion con el token viejo) y vuelve a crear la conexion a Talend Cloud con el login SSO.",
    },
  },
  {
    pattern: /401:Authentication credentials were missing or incorrect/,
    finding: {
      code: "SSO_UNAUTHORIZED",
      message: "La sesion remota de Talend Cloud responde 401: las credenciales guardadas ya no valen.",
      nextStep: "Vuelve a autenticarte por SSO en la conexion de Talend Cloud; si sigue el 401, revisa tu usuario con quien administre el tenant.",
    },
  },
  {
    pattern: /ConcurrentModificationException/,
    finding: {
      code: "REPOSITORY_TYPES_RACE",
      message: "El login choco con otro hilo que modificaba la lista de tipos de repositorio (ConcurrentModificationException).",
      nextStep: "Reintenta el login. Si se repite, abre Studio con -clean; la carrera es interna de Talend.",
    },
  },
  {
    pattern: /exited with unsaved changes in the previous session/,
    finding: {
      code: "WORKSPACE_UNCLEAN_EXIT",
      message: "La sesion anterior de Studio se cerro de golpe (cierre forzado o caida).",
      nextStep: "Cierra Studio con normalidad. Si el workspace se comporta raro, aparta .metadata\\.plugins\\org.eclipse.core.resources\\*.snap tras hacer copia.",
    },
  },
];

export function analyzeStudioLog(sessionText: string): StudioLogAnalysis {
  const findings = RULES.filter((rule) => rule.pattern.test(sessionText)).map((rule) => rule.finding);
  return { loggedOn: /logged on /.test(sessionText), findings };
}

/** Pasos a seguir cuando Studio esta abierto y el bridge no responde. */
export function describeBridgeDown(analysis: StudioLogAnalysis): string[] {
  const steps: string[] = [];
  if (analysis.findings.some((f) => f.code === "SSO_TOKEN_REFRESH_FAILED" || f.code === "SSO_UNAUTHORIZED")) {
    steps.push(
      analysis.loggedOn
        ? "El logon se completa pero el token SSO no se puede renovar, y Studio vuelve a la pantalla de login en bucle."
        : "El token SSO no se puede renovar y Studio no llega a completar el login.",
    );
  }
  for (const finding of analysis.findings) steps.push(`${finding.message} ${finding.nextStep}`);
  if (steps.length === 0) {
    steps.push(
      "Studio esta abierto pero el bridge no responde. El bridge arranca al abrir el workbench, despues del login: comprueba si Studio espera en la pantalla de login.",
    );
  }
  return steps;
}

/**
 * Que decir segun el estado: sin nada que explicar si el bridge responde; si Studio esta cerrado, que se abra;
 * si esta abierto y el bridge no responde, lo que diga la ultima sesion de su log.
 */
export function explainBridgeState(input: {
  studioRunning: boolean;
  bridgeConnected: boolean;
  logTail: string;
}): { nextSteps: string[]; analysis?: StudioLogAnalysis } {
  if (input.bridgeConnected) return { nextSteps: [] };
  if (!input.studioRunning) {
    return {
      nextSteps: ["Studio no esta abierto: abre Talend Studio e inicia sesion; el bridge arranca con el workbench, despues del login."],
    };
  }
  const analysis = analyzeStudioLog(lastSessionOf(input.logTail));
  return { nextSteps: describeBridgeDown(analysis), analysis };
}

/** Ultimos `maxBytes` del log (los logs de Studio rondan el MB). Vacio si no existe o no se puede leer. */
export function readStudioLogTail(logPath: string, maxBytes = 512 * 1024): string {
  if (!existsSync(logPath)) return "";
  let fd: number | undefined;
  try {
    fd = openSync(logPath, "r");
    const size = fstatSync(fd).size;
    const length = Math.min(size, maxBytes);
    const buffer = Buffer.alloc(length);
    readSync(fd, buffer, 0, length, size - length);
    return buffer.toString("utf8");
  } catch {
    return "";
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}
