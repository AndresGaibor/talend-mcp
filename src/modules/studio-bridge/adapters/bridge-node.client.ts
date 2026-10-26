/**
 * Nodos del job y catalogo de componentes.
 *
 * Las operaciones de nodo trabajan sobre el job abierto en Studio; `job` es
 * opcional y sirve para apuntar a otro job del repositorio.
 */

import { BridgeContextClient } from "./bridge-context.client";
import type { BridgeResult } from "./bridge-types";

export class BridgeNodeClient extends BridgeContextClient {
  /** Anade un componente al job abierto, con los parametros que pidio Studio. */
  async addNode(options: {
    type: string;
    /** Job en el que se anade. Sin esto, se usa el que este abierto. */
    job?: string;
    label?: string;
    position?: { x: number; y: number };
    /**
     * Parametros del componente.
     *
     * El valor es un texto, o una lista de valores (los parametros de tipo
     * SCHEMA, como el `SCHEMA_FLOW` del `tDBOutput`, guardan una lista).
     */
    parameters?: Record<string, { value: string | Array<Record<string, string>>; field?: string; literal?: boolean }>;
    tables?: Record<string, { columns?: string[]; rows?: Array<string[] | Record<string, string>> }>;
    schema?: Array<{ connector?: string; name: string; columns: Array<Record<string, unknown>> }>;
    mapper?: Record<string, unknown>;
  }): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/automation/nodes/add", {
      method: "POST",
      body: options,
    });
  }

  /** Configura un componente ya anadido: parametros, tablas, schema o mapper. */
  async configureNode(options: {
    uniqueName: string;
    /** Job en el que esta el componente. Sin esto, se usa el que este abierto. */
    job?: string;
    label?: string;
    /**
     * Parametros del componente.
     *
     * El valor es un texto, o una lista de valores (los parametros de tipo
     * SCHEMA, como el `SCHEMA_FLOW` del `tDBOutput`, guardan una lista).
     */
    parameters?: Record<string, { value: string | Array<Record<string, string>>; field?: string; literal?: boolean }>;
    tables?: Record<string, { columns?: string[]; rows?: Array<string[] | Record<string, string>> }>;
    schema?: Array<{ connector?: string; name: string; columns: Array<Record<string, unknown>> }>;
    mapper?: Record<string, unknown>;
  }): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/automation/nodes/configure", {
      method: "POST",
      body: options,
    });
  }

  /** Conecta dos nodos del job abierto. */
  async connectNodes(options: {
    source: string;
    target: string;
    /** Job en el que estan los nodos. Sin esto, se usa el que este abierto. */
    job?: string;
    type?: string;
    name?: string;
  }): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/automation/nodes/connect", {
      method: "POST",
      body: options,
    });
  }

  /** Cambia parametros o etiqueta de un nodo del job abierto. */
  async updateNode(options: {
    uniqueName: string;
    label?: string;
    parameters?: Record<string, { value: string; field?: string; literal?: boolean }>;
  }): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/automation/nodes/update", {
      method: "POST",
      body: options,
    });
  }

  /** Define el schema (las columnas) de un nodo del job abierto. */
  async setNodeSchema(options: {
    uniqueName: string;
    /** Job en el que esta el nodo. Sin esto, se usa el que este abierto. */
    job?: string;
    connector?: string;
    columns: Array<{
      name: string;
      type?: string;
      length?: number;
      precision?: number;
      nullable?: boolean;
      key?: boolean;
    }>;
    values?: string[][];
  }): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/automation/nodes/schema", {
      method: "POST",
      body: options,
    });
  }

  /** Lista los nodos del job abierto. */
  async listNodes(options?: { job?: string }): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/automation/nodes/list", {
      method: "POST",
      body: options ?? {},
    });
  }

  /** Lista los componentes del catalogo de Talend. */
  async listComponents(options?: { filter?: string; limit?: number }): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/automation/components", {
      method: "POST",
      body: options ?? {},
    });
  }

  /** Parametros de un componente del catalogo, con su valor por defecto. */
  async componentParameters(options: { name: string }): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/automation/components/parameters", {
      method: "POST",
      body: options,
    });
  }
}
