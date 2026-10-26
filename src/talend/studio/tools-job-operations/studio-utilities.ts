/** Tools de jobOperationsTools: studio-utilities. */
import * as z from "zod/v4";

import { bridgeFail, bridgeOk, loadBridge } from "../tools-base";
import { checkStudioDialogs } from "../studio-dialogs";

import { columnSchema, componentSpecShape, parameterSchema } from "../tools-job-operation-schemas";

import { jobContextTools } from "../tools-job-contexts";

import { studioMaintenanceTools } from "../tools-studio-maintenance";

import { jobDiagnosticsTools } from "../tools-job-diagnostics";

import { componentCatalogTools } from "../tools-component-catalog";

import { nodeConnectionTools } from "../tools-node-connection";
export const studioUtilities = [
{
    name: "talend_studio_install_modules",
    description: "Instala los modulos de terceros que Studio echa de menos. Necesario para los componentes cuyo runtime no esta descargado (tMap, tJavaRow, tSortRow, tAggregateRow...). Descarga de internet, asi que hay que pedirlo de forma explicita.",
    inputSchema: z.object({}),
    handler: async () => {
      const bridge = await loadBridge();

      // Antes de pulsar: que modulos lista el dialogo, para que la respuesta diga que se descarga.
      const before = await checkStudioDialogs(bridge, true);
      const pending = before.status === "unavailable"
        ? []
        : before.dialogs.filter((dialog) => dialog.kind === "missing_modules");

      const result = await bridge.installModules();
      const installed: unknown[] = Array.isArray(result.data?.installed) ? result.data.installed : [];
      if (result.ok && installed.length === 0) {
        return bridgeFail({
          ok: false,
          source: "studio-bridge",
          confidence: "high",
          endpoint: "/workbench/modules/install",
          error: {
            code: "NO_MODULES_DIALOG",
            message: "No hay ningun dialogo de modulos de terceros abierto. El guardian lo cierra a los 30 s: vuelve a lanzar el job para que Studio lo muestre otra vez.",
          },
        });
      }

      return bridgeOk({
        ok: result.ok,
        source: result.source,
        confidence: result.confidence,
        endpoint: "/workbench/modules/install",
        data: {
          ...(result.data ?? {}),
          dialogTexts: pending.flatMap((dialog) => dialog.texts),
        },
        error: result.error,
      });
    },
  },
{
    name: "talend_studio_run_code",
    description: "Compila y ejecuta codigo Java dentro de Talend Studio, con acceso a las APIs del IDE. El codigo debe tener una clase con 'public static Object run()'. Requiere unsafeActions=true en el bridge.",
    inputSchema: z.object({
      code: z.string().describe("Codigo fuente Java con un metodo estatico 'public static Object run()'"),
      className: z.string().optional().describe("Nombre de la clase. Si se omite, se deduce del codigo"),
    }),
    handler: async ({ code, className }: { code: string; className?: string }) => {
      const bridge = await loadBridge();
      const result = await bridge.runCode({ code, className });
      return bridgeOk({
        ok: result.ok,
        source: result.source,
        confidence: result.confidence,
        endpoint: "/automation/run-code",
        data: result.data,
        error: result.error,
      });
    },
  }
];
