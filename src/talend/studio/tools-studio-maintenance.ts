import * as z from "zod/v4";
import { clearBridgeClientCache } from "../../modules/studio-bridge/adapters/http-studio-bridge.client";
import { readTalendStudioBridgeConfig } from "../../modules/studio-bridge/adapters/bridge-config";
import { decideRestart, restartStudio } from "./studio-restart";
import { bridgeFail, bridgeOk, loadBridge } from "./tools-base";

export const studioMaintenanceTools = [
  {
    name: "talend_studio_coverage",
    description: "Mide cuantos componentes del catalogo de Talend se pueden crear, configurar y borrar con el MCP. Tarda minutos, asi que no espera: 'start' la arranca y devuelve enseguida; 'status' da el progreso y, al terminar, el informe; 'cancel' la para.",
    inputSchema: z.object({
      action: z.enum(["start", "status", "cancel"]).optional().default("start").describe("start (por defecto), status o cancel"),
      filter: z.string().optional().describe("Solo con start: texto que tiene que aparecer en el nombre del componente"),
      max: z.number().optional().describe("Solo con start: maximo de componentes que probar"),
      compile: z.boolean().optional().describe("Solo con start: ademas genera el codigo de cada componente y comprueba que compila (nivel L4, ~2 s mas por componente)"),
    }),
    handler: async ({ action, filter, max, compile }: { action?: "start" | "status" | "cancel"; filter?: string; max?: number; compile?: boolean }) => {
      const bridge = await loadBridge();
      const mode = action ?? "start";
      const result = mode === "start"
        ? await bridge.coverage({ filter, max, compile })
        : await bridge.coverageStatus({ cancel: mode === "cancel" });
      return bridgeOk({
        ok: result.ok,
        source: result.source,
        confidence: result.confidence,
        endpoint: mode === "start" ? "/automation/coverage" : "/automation/coverage/status",
        data: result.data,
        error: result.error,
      });
    },
  },
  {
    name: "talend_studio_install_artifact",
    description:
      "Descarga un artefacto de Maven Central al repositorio local de Talend Studio. Necesario para los componentes cuyo runtime no viene con Studio (por ejemplo el tFileInputJSON, que necesita com.jayway.jsonpath:json-path). Con `file` se instala un jar que ya este en el equipo: los componentes de Talend Exchange (el tMap necesita talend-tmap-dataset) no estan en Maven Central y su dominio no se resuelve desde todas las redes.",
    inputSchema: z.object({
      groupId: z.string().describe("Group id de Maven, por ejemplo com.jayway.jsonpath"),
      artifactId: z.string().describe("Artifact id de Maven, por ejemplo json-path"),
      version: z.string().describe("Version, por ejemplo 2.9.0"),
      file: z.string().optional().describe("Ruta de un jar local ya descargado. Si se da, no se descarga de Maven"),
    }),
    handler: async ({ groupId, artifactId, version, file }: { groupId: string; artifactId: string; version: string; file?: string }) => {
      const bridge = await loadBridge();
      const result = await bridge.installArtifact({ groupId, artifactId, version, file });
      return bridgeOk({
        ok: result.ok,
        source: result.source,
        confidence: result.confidence,
        endpoint: "/automation/artifacts/install",
        data: result.data,
        error: result.error,
      });
    },
  },
  {
    name: "talend_studio_memory",
    description:
      "Dice cuanto heap de memoria lleva usado el JVM de Talend Studio. Las mediciones largas (el codigo generado de cada job) llenan la memoria y el IDE deja de responder: con esta tool se comprueba antes y despues, y con `gc` se pide una recoleccion.",
    inputSchema: z.object({
      gc: z.boolean().optional().describe("Fuerza una recoleccion de basura antes de medir"),
    }),
    handler: async ({ gc }: { gc?: boolean }) => {
      const bridge = await loadBridge();
      const result = await bridge.memory({ gc });
      return bridgeOk({
        ok: result.ok,
        source: result.source,
        confidence: result.confidence,
        endpoint: "/automation/memory",
        data: result.data,
        error: result.error,
      });
    },
  },
  {
    name: "talend_studio_restart",
    description:
      "Reinicia Talend Studio: cierra la ventana principal, lo vuelve a abrir y espera a que el bridge responda (1-3 min). Es la unica forma de liberar la memoria que Studio retiene tras crear muchos Jobs. Con `onlyIfMemoryAbove` solo reinicia si el heap supera ese porcentaje. Cierra por su cuenta los dialogos abiertos (un modal impide salir) y, si Studio no sale en 2 minutos, termina el proceso (`force`, por defecto). Se rechaza solo si el bridge esta en solo lectura. Cierra el IDE del usuario: los editores sin guardar se pierden y puede pedirse volver a iniciar sesion en Talend Cloud, asi que no la llames sin que haga falta.",
    inputSchema: z.object({
      onlyIfMemoryAbove: z.number().min(1).max(99).optional().describe("Solo reinicia si el heap usado supera este porcentaje (tras una recoleccion). El portal recomienda reiniciar a partir del 75"),
      force: z.boolean().optional().default(true).describe("Si Studio no sale tras cerrar sus dialogos y pedir el cierre (2 min), termina el proceso. Con false se rinde sin tocarlo"),
      reinstallBridge: z.boolean().optional().default(false).describe("Reinstala el plugin del bridge tras arrancar; solo hace falta si se publico en caliente una version nueva"),
    }),
    handler: async ({ onlyIfMemoryAbove, reinstallBridge, force }: { onlyIfMemoryAbove?: number; reinstallBridge?: boolean; force?: boolean }) => {
      const endpoint = "studio-restart";
      const fail = (code: string, message: string, data?: unknown) =>
        bridgeFail({ ok: false, source: "studio-bridge", confidence: "high", endpoint, data, error: { code, message } });

      const bridge = await loadBridge();
      const config = await readTalendStudioBridgeConfig();
      const memory = await bridge.memory({ gc: true });
      const usedPercent = (memory.data as { usedPercent?: number } | undefined)?.usedPercent;

      const decision = decideRestart({ platform: process.platform, readOnly: config.readOnly, usedPercent, onlyIfMemoryAbove });
      if (!decision.proceed) {
        // Que no haga falta reiniciar no es un fallo: la llamada cumplio su condicion.
        if (decision.code === "STUDIO_RESTART_NOT_NEEDED") {
          return bridgeOk({ ok: true, source: "studio-bridge", confidence: "high", endpoint, data: { restarted: false, usedPercent, reason: decision.message } });
        }
        return fail(decision.code, decision.message, { usedPercent });
      }

      try {
        const result = await restartStudio({ reinstallBridge, force });
        clearBridgeClientCache();
        return bridgeOk({ ok: true, source: "studio-bridge", confidence: "high", endpoint, data: { restarted: true, usedPercentBefore: usedPercent, ...result } });
      } catch (error) {
        return fail("STUDIO_RESTART_FAILED", error instanceof Error ? error.message : String(error), { usedPercent });
      }
    },
  },
];
