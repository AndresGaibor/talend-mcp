/** Tools de jobOperationsTools: studio-ui-dialogs. */
import * as z from "zod/v4";

import { bridgeOk, bridgeFail, loadBridge } from "../tools-base";
import { checkStudioDialogs } from "../studio-dialogs";

export const studioUiDialogs = [
{
    name: "talend_studio_ui_dialogs",
    description:
      "Lista los dialogos abiertos en Talend Studio (titulo, si son modales, botones y textos) y marca cuales bloquean el IDE, con la accion sugerida. Solo lectura: no pulsa ni cierra nada, y responde al momento. Es la misma comprobacion que hacen talend_job_run_by_name y talend_job_compile antes de actuar.",
    inputSchema: z.object({}),
    annotations: { readOnly: true },
    handler: async () => {
      const bridge = await loadBridge();
      const check = await checkStudioDialogs(bridge, true);

      if (check.status === "unavailable") {
        return bridgeFail({
          ok: false,
          source: "studio-bridge",
          confidence: "medium",
          endpoint: "/automation/run-code",
          error: { code: "UI_DIALOGS_UNAVAILABLE", message: check.reason },
        });
      }

      return bridgeOk({
        ok: true,
        source: "studio-bridge",
        confidence: "medium",
        endpoint: "/automation/run-code",
        data: {
          blocked: check.blocking.length > 0,
          dialogs: check.dialogs,
          blocking: check.blocking,
        },
      });
    },
  },
];
