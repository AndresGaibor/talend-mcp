/**
 * Dialogos abiertos en Talend Studio, clasificados para decidir si bloquean el IDE.
 *
 * Un dialogo modal deja el hilo de la UI dentro de su bucle: ni Studio ni el
 * bridge pueden seguir (ver INTERNALS 13). Antes de lanzar o compilar un job
 * se comprueba si hay uno, para fallar con un motivo claro en vez de quedarse
 * esperando.
 *
 * La comprobacion es solo de lectura. Usa el endpoint nativo
 * `/workbench/dialogs/list` (milisegundos). Con un plugin anterior, que no lo
 * tiene, cae a la sonda Java por `run-code`, que tarda varios segundos y
 * necesita `unsafeActions`.
 */
import { UI_DIALOG_PROBE_CLASS, UI_DIALOG_PROBE_SOURCE } from "./tools-job-operations/studio-ui-inventory-probes";
import { isBridgeOutdated } from "./tools-base";

import type { TalendStudioBridgeClient } from "./bridge-client";

export type StudioDialogKind = "progress" | "missing_modules" | "job_name" | "save_resource" | "unknown";

export type StudioDialog = {
  title: string;
  modal: boolean;
  kind: StudioDialogKind;
  blocking: boolean;
  buttons: string[];
  texts: string[];
  hint: string;
};

export type StudioDialogCheck =
  | { status: "clear" | "blocked"; dialogs: StudioDialog[]; blocking: StudioDialog[] }
  | { status: "unavailable"; reason: string };

const KIND_PATTERNS: Array<{ kind: StudioDialogKind; titles: string[] }> = [
  {
    kind: "progress",
    titles: [
      "progress", "progreso", "building", "loading", "cargando", "compilando",
      // El dialogo de Eclipse que espera un trabajo de segundo plano (refrescar el repositorio): se cierra solo.
      "intervención del usuario", "intervencion del usuario", "user operation is waiting",
    ],
  },
  {
    kind: "missing_modules",
    titles: ["third part", "third-party", "missing third", "modulos de terceros", "third party modules"],
  },
  { kind: "job_name", titles: ["jobname error", "job name error", "invalid job name"] },
  { kind: "save_resource", titles: ["save resource", "guardar recursos"] },
];

const HINTS: Record<StudioDialogKind, string> = {
  progress: "Progreso normal: Studio sigue trabajando. No bloquea.",
  missing_modules:
    "Faltan modulos de terceros. Llama a talend_studio_install_modules para descargarlos, o cierra el dialogo en Studio.",
  job_name:
    "Ya existe un job con esa etiqueta. Cambia la etiqueta, o crea el job con replace:true. talend_studio_dismiss_dialogs responderia Yes y reemplazaria el job.",
  save_resource:
    "Studio pide guardar cambios pendientes. talend_studio_dismiss_dialogs responderia Yes y los guardaria.",
  unknown: "Dialogo sin manejo automatico. Cierralo en Studio o pide la decision al usuario.",
};

/** Tipo de dialogo a partir de su titulo. */
export function classifyStudioDialog(title: string): StudioDialogKind {
  const normalized = title.trim().toLowerCase();
  for (const pattern of KIND_PATTERNS) {
    if (pattern.titles.some((text) => normalized.includes(text))) {
      return pattern.kind;
    }
  }
  return "unknown";
}

/**
 * Un dialogo bloquea cuando es modal y no es un progreso normal. Un shell no
 * modal (un tooltip, una ventana flotante) no detiene a Studio.
 */
export function isBlockingDialog(dialog: Pick<StudioDialog, "modal" | "kind">): boolean {
  return dialog.modal && dialog.kind !== "progress";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/** Convierte la lista de dialogos (de `/workbench/dialogs/list` o de la sonda) en dialogos clasificados. */
export function parseStudioDialogs(listing: unknown): StudioDialog[] {
  const list = asRecord(listing).dialogs;
  const dialogs: unknown[] = Array.isArray(list) ? list : [];
  return dialogs.map((raw) => {
    const entry = asRecord(raw);
    const title = typeof entry.title === "string" ? entry.title : "";
    const modal = entry.modal === true;
    const kind = classifyStudioDialog(title);
    return {
      title,
      modal,
      kind,
      blocking: isBlockingDialog({ modal, kind }),
      buttons: asStrings(entry.buttons),
      texts: asStrings(entry.texts),
      hint: HINTS[kind],
    };
  });
}

function summarize(dialogs: StudioDialog[], ignoreDialogs: boolean): StudioDialogCheck {
  const blocking = dialogs.filter((dialog) => dialog.blocking);
  const status = !ignoreDialogs && blocking.length > 0 ? "blocked" : "clear";
  return { status, dialogs, blocking };
}

export type StudioPreparation = {
  check: StudioDialogCheck;
  /** True si se pulso la descarga del dialogo de modulos y Studio quedo libre despues. */
  autoInstalledModules: boolean;
  waitedMs: number;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Prepara Studio antes de lanzar o compilar. Si lo unico que bloquea es el
 * dialogo de modulos de terceros y se pidio `installMissing`, pulsa la descarga
 * y espera a que Studio quede libre (la descarga es lenta: pueden ser minutos).
 * Cualquier otro dialogo bloqueante se devuelve tal cual, sin tocarlo.
 */
export async function prepareStudioForJob(
  bridge: TalendStudioBridgeClient,
  options: { ignoreDialogs: boolean; installMissing: boolean; waitMs?: number; pollMs?: number },
): Promise<StudioPreparation> {
  const first = await checkStudioDialogs(bridge, options.ignoreDialogs);
  const onlyModules = first.status === "blocked" && first.blocking.every((dialog) => dialog.kind === "missing_modules");
  if (!options.installMissing || !onlyModules) {
    return { check: first, autoInstalledModules: false, waitedMs: 0 };
  }

  const install = await bridge.installModules();
  const installed = Array.isArray(install.data?.installed) ? install.data.installed.length : 0;
  if (!install.ok || installed === 0) {
    return { check: first, autoInstalledModules: false, waitedMs: 0 };
  }

  const started = Date.now();
  const waitMs = options.waitMs ?? 120_000;
  const pollMs = options.pollMs ?? 2_000;
  let check = await checkStudioDialogs(bridge, options.ignoreDialogs);
  while (check.status === "blocked" && Date.now() - started < waitMs) {
    await sleep(pollMs);
    check = await checkStudioDialogs(bridge, options.ignoreDialogs);
  }
  return { check, autoInstalledModules: true, waitedMs: Date.now() - started };
}

/**
 * Comprueba si hay dialogos que bloquean Studio. Con `ignoreDialogs` la
 * respuesta sigue listando lo que hay, pero el estado no bloquea.
 */
export async function checkStudioDialogs(
  bridge: TalendStudioBridgeClient,
  ignoreDialogs: boolean,
): Promise<StudioDialogCheck> {
  const listed = await bridge.listDialogs();
  if (listed.ok) {
    return summarize(parseStudioDialogs(listed.data), ignoreDialogs);
  }
  if (!isBridgeOutdated({ ...listed.error, status: listed.status })) {
    return { status: "unavailable", reason: String(listed.error?.message ?? "el bridge no respondio") };
  }

  // Plugin anterior a /workbench/dialogs/list: la misma lectura por la sonda Java.
  const run = await bridge.runCode({
    code: UI_DIALOG_PROBE_SOURCE,
    className: UI_DIALOG_PROBE_CLASS,
    uiThread: true,
  });
  const payload = asRecord(run.data);
  if (!run.ok || payload.ok === false) {
    return { status: "unavailable", reason: String(payload.error ?? run.error?.message ?? "la sonda no devolvio resultado") };
  }
  return summarize(parseStudioDialogs(payload.result), ignoreDialogs);
}
