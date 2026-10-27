/**
 * Contextos del job y del proyecto (entornos y variables).
 *
 * Los del job viven en el `.item`; los del proyecto son items de tipo Contexts
 * del repositorio.
 */

import { BridgeJobClient } from "./bridge-job.client";
import type { BridgeResult } from "./bridge-types";

export class BridgeContextClient extends BridgeJobClient {
  /** Los contextos (entornos) del job con sus variables. */
  async jobContexts(options?: { job?: string }): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/automation/job/contexts", {
      method: "POST",
      body: options ?? {},
    });
  }

  /** Agrega variables al contexto por defecto del job abierto. */
  async addContextParameters(options: {
    job?: string;
    contexts: Array<{ name: string; type: string; value: string; comment?: string }>;
    removeManagedTodoNames?: string[];
  }): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/automation/job/contexts/parameters", {
      method: "POST",
      body: options,
    });
  }

  /** Crea un contexto (un entorno) en el job. */
  async createJobContext(options: { job?: string; name: string }): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/automation/job/contexts/create", {
      method: "POST",
      body: options,
    });
  }

  /** Crea o cambia una variable de un contexto. */
  async setJobContextParameter(options: {
    job?: string;
    context: string;
    name: string;
    value: string;
    type?: string;
    comment?: string;
  }): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/automation/job/contexts/parameter", {
      method: "POST",
      body: options,
    });
  }

  /** Borra una variable de un contexto. */
  async deleteJobContextParameter(options: {
    job?: string;
    context: string;
    name: string;
  }): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/automation/job/contexts/parameter/delete", {
      method: "POST",
      body: options,
    });
  }

  /** Borra un contexto del job. */
  async deleteJobContext(options: { job?: string; name: string }): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/automation/job/contexts/delete", {
      method: "POST",
      body: options,
    });
  }

  /** Los contextos del proyecto (los items de tipo Contexts del repositorio). */
  async repositoryContexts(options?: { project?: string }): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/automation/repository/contexts", {
      method: "POST",
      body: options ?? {},
    });
  }

  /** Lista conexiones compartidas del proyecto, sin parametros ni credenciales. */
  async repositoryConnections(): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/automation/repository/connections", {
      method: "POST",
      body: {},
    });
  }

  /** Crea un contexto del proyecto. */
  async createRepositoryContext(options: {
    name: string;
    version?: string;
    context?: string;
    parameters?: Array<{ name: string; value: string; type?: string }>;
  }): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/automation/repository/contexts/create", {
      method: "POST",
      body: options,
    });
  }

  /** Crea o cambia una variable de un contexto del proyecto. */
  async setRepositoryContextParameter(options: {
    name: string;
    context: string;
    parameter: string;
    value: string;
    type?: string;
  }): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/automation/repository/contexts/parameter", {
      method: "POST",
      body: options,
    });
  }

  /** Borra una variable de un contexto del proyecto. */
  async deleteRepositoryContextParameter(options: {
    name: string;
    context: string;
    parameter: string;
  }): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/automation/repository/contexts/parameter/delete", {
      method: "POST",
      body: options,
    });
  }

  /** Borra un contexto del proyecto. */
  async deleteRepositoryContext(options: { name: string }): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/automation/repository/contexts/delete", {
      method: "POST",
      body: options,
    });
  }
}
