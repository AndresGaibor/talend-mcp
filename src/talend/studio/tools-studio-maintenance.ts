import * as z from "zod/v4";
import { bridgeOk, loadBridge } from "./tools-base";

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
];
