/**
 * Medicion de cobertura y memoria del JVM.
 *
 * La medicion corre dentro de Studio y tarda minutos: se arranca y se consulta
 * el estado. La memoria se vigila para no dejar el IDE sin heap.
 */

import { BridgeNodeClient } from "./bridge-node.client";
import type { BridgeResult } from "./bridge-types";

export class BridgeCoverageClient extends BridgeNodeClient {
  /**
   * Mide quantos componentes del catalogo se pueden crear y configurar.
   *
   * Recorre el catalogo entero de Talend Studio: anade cada componente a un
   * job de pruebas, lo configura con dos de sus parametros y lo borra.
   * Arranca la medicion y devuelve enseguida: el progreso se consulta con `coverageStatus`.
   */
  async coverage(options?: {
    filter?: string;
    max?: number;
    compile?: boolean;
    mount?: Record<string, unknown>;
    components?: string[];
  }): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/automation/coverage", {
      method: "POST",
      body: options ?? {},
    });
  }

  /** Progreso de la medicion de cobertura y, al terminar, su informe. */
  async coverageStatus(options?: { cancel?: boolean }): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/automation/coverage/status", {
      method: "POST",
      body: options ?? {},
    });
  }

  /**
   * Memoria del JVM de Studio.
   *
   * Las mediciones largas llenan el heap y el IDE deja de responder: con esto
   * se puede ver cuanto queda y pedir una recoleccion.
   */
  async memory(options?: { gc?: boolean }): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/automation/memory", {
      method: "POST",
      body: options ?? {},
    });
  }
}
