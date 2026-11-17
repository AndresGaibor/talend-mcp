/**
 * Ciclo de vida del job: abrir, crear, ejecutar, compilar, empaquetar y borrar.
 *
 * Tambien expone el modelo del job abierto, que es la base de las tools de
 * inspeccion activa.
 */

import { BridgeWorkbenchClient } from "./bridge-workbench.client";
import type { BridgeActiveJobModel, BridgeResult } from "./bridge-types";

/**
 * Plazo de una construccion, en milisegundos.
 *
 * El plazo de la configuracion (2,5 s) es para lecturas: generar el codigo de un
 * Job abre el modelo, lo genera y lo compila, y eso tarda minutos en un Job
 * grande. Con el plazo corto la peticion se abortaba a mitad y parecia que el
 * bridge estaba caido.
 */
export const BUILD_TIMEOUT_MS = 180_000;

/** Plazo de un lote: cubre miles de Jobs a los 0,2 s por Job que da el bridge. */
export const BUILD_BATCH_TIMEOUT_MS = 300_000;

export class BridgeJobClient extends BridgeWorkbenchClient {
  async activeJobModel(): Promise<BridgeResult<BridgeActiveJobModel>> {
    return await this.request<BridgeActiveJobModel>("/talend/active-job/model");
  }

  async activeJobDetails(): Promise<BridgeResult<any>> {
    return await this.request<any>("/talend/active-job/details");
  }

  async activeJobDependencies(): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/talend/active-job/dependencies");
  }

  async activeComponentDetails(uniqueName: string, includeRaw?: boolean): Promise<BridgeResult<any>> {
    return await this.request<any>("/talend/active-component/details", {
      method: "POST",
      body: { uniqueName, includeRaw },
    });
  }

  async selectComponent(uniqueName: string): Promise<BridgeResult<any>> {
    return await this.request<any>("/talend/active-job/select-component", {
      method: "POST",
      body: { uniqueName },
    });
  }

  /** `init.timeoutMs` es el tiempo de la peticion HTTP; `options.timeoutMs`, el de la espera del job. */
  async runActiveJob(
    options: {
      dryRun?: boolean;
      saveBefore?: boolean;
      waitForTermination?: boolean;
      timeoutMs?: number;
    },
    init?: { timeoutMs?: number },
  ): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/automation/run-active-job", {
      method: "POST",
      body: options,
      timeoutMs: init?.timeoutMs,
    });
  }

  /** Crea un job vacio en el repositorio de Talend y lo abre en el editor. */
  async createJob(options: {
    name: string;
    version?: string;
    folder?: string;
    description?: string;
    replace?: boolean;
    /** Tipo de job: Standard, Big_Data_Batch (Spark Batch), Big_Data_Stream... */
    jobType?: string;
    /** Framework del job: Spark, Storm, MapReduce. */
    framework?: string;
  }): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/automation/job/create", {
      method: "POST",
      body: options,
    });
  }

  /** Genera el codigo del job y comprueba que compila, sin ejecutarlo. */
  async jobCompile(options?: { job?: string }): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/automation/job/compile", {
      method: "POST",
      body: options ?? {},
    });
  }

  /**
   * Construye el job sin ejecutarlo: genera el codigo, lo compila y hace el build de Maven
   * (deja `target/classpath.jar`). Un error de compilacion vuelve en `result.error`.
   */
  async jobBuild(options?: {
    job?: string;
    instalar?: boolean;
    timeoutMs?: number;
  }): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/automation/job/build", {
      method: "POST",
      body: options ?? {},
      timeoutMs: options?.timeoutMs ?? BUILD_TIMEOUT_MS,
    });
  }

  /**
   * Construye muchos jobs del repositorio sin abrir su editor: genera el codigo desde el item y lo compila
   * en paralelo. Devuelve el resultado de cada job en `result.jobs`.
   */
  async jobBuildBatch(options: {
    jobs: string[];
    parallelism?: number;
    timeoutMs?: number;
  }): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/automation/job/build-batch", {
      method: "POST",
      body: { jobs: options.jobs, parallelism: options.parallelism },
      timeoutMs: options.timeoutMs ?? BUILD_BATCH_TIMEOUT_MS,
    });
  }

  /** Inicia un build batch en segundo plano y devuelve su operationId. */
  async jobBuildBatchStart(options: { jobs: string[]; parallelism?: number; operationId?: string }): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/automation/job/build-batch/start", {
      method: "POST",
      body: options,
    });
  }

  /** Consulta progreso o resultado terminal de un build batch. */
  async jobBuildBatchStatus(operationId: string): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/automation/job/build-batch/status", {
      method: "POST",
      body: { operationId },
    });
  }

  /** Solicita cancelacion cooperativa del build batch. */
  async jobBuildBatchCancel(operationId: string): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/automation/job/build-batch/cancel", {
      method: "POST",
      body: { operationId },
    });
  }

  /** Errores y avisos de diseno de un job (la vista Problemas de Studio). */
  async jobProblems(options?: { job?: string; release?: boolean }): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/automation/job/problems", {
      method: "POST",
      body: options ?? {},
    });
  }

  /** Descarga un artefacto de Maven al repositorio local de Studio. */
  async installArtifact(options: {
    groupId: string;
    artifactId: string;
    version: string;
    /** Jar local ya descargado (para los componentes de Talend Exchange). */
    file?: string;
  }): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/automation/artifacts/install", {
      method: "POST",
      body: options,
    });
  }

  /**
   * Build Job: escribe el zip autonomo de un job compilado y lo extrae en `destination`.
   * Tarda del orden de segundos (8 s para un job pequeno), asi que el timeout va aparte.
   */
  async buildJob(options: {
    job: string;
    destination: string;
    version?: string;
    context?: string;
  }): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/automation/build-job", {
      method: "POST",
      body: options,
      timeoutMs: 300_000,
    });
  }

  /**
   * Ejecuta un job ya generado y devuelve su salida.
   *
   * Es la forma de comprobar que el resultado es el esperado: la salida del
   * job (las filas que imprime el tLogRow) llega aqui, cosa que con la vista
   * Run de Studio no se puede leer.
   */
  async executeJob(options: {
    name: string;
    version?: string;
    context?: string;
    timeoutMs?: number;
  }): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/automation/job/execute", {
      method: "POST",
      body: options,
    });
  }

  /** Borra un job del repositorio de Talend, con sus archivos. */
  async deleteJob(options: { name: string; version?: string }): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/automation/job/delete", {
      method: "POST",
      body: options,
    });
  }

  /** Abre un job del proyecto en el editor de Talend. */
  async openJob(options: {
    name: string;
    version?: string;
    itemPath?: string;
  }): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/automation/job/open", {
      method: "POST",
      body: options,
    });
  }

  /**
   * Ejecuta codigo Java dentro de Studio.
   *
   * El codigo ve las mismas APIs que ve el IDE, asi que sirve para lo que no
   * cabe en una tool. Debe tener una clase con `public static Object run()`.
   */
  async runCode(options: {
    code: string;
    className?: string;
    /** Con `true` el codigo corre en el hilo de la UI de Studio: necesario para tocar widgets. */
    uiThread?: boolean;
  }): Promise<BridgeResult<Record<string, unknown>>> {
    return await this.request<Record<string, unknown>>("/automation/run-code", {
      method: "POST",
      body: options,
    });
  }
}
