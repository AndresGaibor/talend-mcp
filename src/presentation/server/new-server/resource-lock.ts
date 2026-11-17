/** Exclusión mutua en memoria para escrituras sobre recursos Talend. */

type Espera = {
  keys: string[];
  signal?: AbortSignal;
  resolve: (release: () => void) => void;
  reject: (error: Error) => void;
  onAbort?: () => void;
};

function normalizar(keys: string[]): string[] {
  return [...new Set(keys.map((key) => key.trim().toLowerCase()).filter(Boolean))].sort();
}

function choca(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.endsWith(":*") && b.startsWith(a.slice(0, -1))) return true;
  if (b.endsWith(":*") && a.startsWith(b.slice(0, -1))) return true;
  return false;
}

/**
 * Cola por claves: las escrituras sobre el mismo Job se serializan y las
 * operaciones con claves distintas pueden avanzar a la vez. La clave
 * `job:*` se usa cuando una operación selecciona Jobs por expresión regular.
 */
export class ResourceLockManager {
  private readonly activos = new Set<string>();
  private readonly cola: Espera[] = [];

  async run<T>(keys: string[], signal: AbortSignal | undefined, action: () => Promise<T>): Promise<T> {
    const normalizadas = normalizar(keys);
    if (normalizadas.length === 0) return await action();
    const release = await this.acquire(normalizadas, signal);
    try {
      return await action();
    } finally {
      release();
    }
  }

  private acquire(keys: string[], signal?: AbortSignal): Promise<() => void> {
    if (signal?.aborted) return Promise.reject(new Error("La operación se canceló antes de obtener el bloqueo."));
    return new Promise((resolve, reject) => {
      const waiter: Espera = { keys, signal, resolve, reject };
      if (signal) {
        waiter.onAbort = () => {
          const index = this.cola.indexOf(waiter);
          if (index >= 0) {
            this.cola.splice(index, 1);
            reject(new Error("La operación se canceló esperando un bloqueo del recurso."));
            this.despachar();
          }
        };
        signal.addEventListener("abort", waiter.onAbort, { once: true });
      }
      this.cola.push(waiter);
      this.despachar();
    });
  }

  private despachar(): void {
    for (let index = 0; index < this.cola.length;) {
      const waiter = this.cola[index]!;
      if (waiter.signal?.aborted) {
        this.cola.splice(index, 1);
        waiter.signal.removeEventListener("abort", waiter.onAbort!);
        waiter.reject(new Error("La operación se canceló esperando un bloqueo del recurso."));
        continue;
      }
      if (waiter.keys.some((key) => [...this.activos].some((active) => choca(key, active)))) {
        index++;
        continue;
      }

      this.cola.splice(index, 1);
      waiter.signal?.removeEventListener("abort", waiter.onAbort!);
      for (const key of waiter.keys) this.activos.add(key);
      let liberado = false;
      waiter.resolve(() => {
        if (liberado) return;
        liberado = true;
        for (const key of waiter.keys) this.activos.delete(key);
        this.despachar();
      });
    }
  }
}

/** Extrae identificadores estables de los esquemas habituales de tools de Jobs. */
export function clavesDeRecurso(toolName: string, input: unknown): string[] {
  if (!input || typeof input !== "object" || Array.isArray(input)) return [];
  const value = input as Record<string, unknown>;
  const keys = new Set<string>();
  const add = (name: unknown): void => {
    if (typeof name === "string" && name.trim()) keys.add(`job:${name.trim()}`);
  };
  const addResource = (kind: string, value: unknown): void => {
    if (typeof value !== "string" || !value.trim()) return;
    const normalized = value.trim().replace(/[\\/]+/g, "/").replace(/\/$/, "").toLowerCase();
    keys.add(`${kind}:${normalized}`);
  };

  add(value.job);
  add(value.jobName);
  add(value.sourceJobName);
  add(value.targetJobName);
  if (Array.isArray(value.jobs)) value.jobs.forEach(add);

  if (toolName.includes("context")) {
    const contextName = value.contextName ?? value.context ?? value.name;
    if (typeof contextName === "string" && contextName.trim()) keys.add(`context:${contextName.trim()}`);
    if (toolName.startsWith("talend_job_") && !value.job && !value.jobName) keys.add("job:*");
  }

  // Estas tools modifican estado compartido de Studio, no un Job individual.
  // Se usa el mismo candado global conservador que para selecciones de Jobs.
  if ([
    "talend_bridge_execute_command",
    "talend_bridge_save_all",
    "talend_bridge_save_active_editor",
    "talend_studio_handle_modals",
  ].includes(toolName)) keys.add("job:*");

  if (toolName === "talend_deliverables_build_job") {
    add(value.jobName);
    addResource("output", value.destinationDir || value.jobName);
  }
  if (toolName === "talend_deliverables_export_job" || toolName === "talend_deliverables_create_package") {
    add(value.jobName);
    addResource("output", value.destinationDir || value.jobName);
  }
  if (toolName === "talend_evidence_pack_export") {
    addResource("output", value.destinationPath || value.packId);
  }
  if (toolName === "talend_mastery_generate_fixture") {
    addResource("mastery-fixture", value.componentName);
  }

  const batch = /talend_jobs_(create|edit)_batch/.test(toolName);
  if (batch && typeof value.namePattern === "string" && value.namePattern) return ["job:*"];
  if (batch && value.template && typeof value.template === "object" && Array.isArray(value.rows)) {
    const templateName = (value.template as Record<string, unknown>).jobName;
    if (typeof templateName === "string") {
      for (const row of value.rows) {
        if (!row || typeof row !== "object" || Array.isArray(row)) continue;
        let name = templateName;
        for (const [variable, replacement] of Object.entries(row as Record<string, unknown>)) {
          name = name.replaceAll(`{{${variable}}}`, String(replacement));
        }
        add(name);
      }
    }
  }
  if (batch && keys.size === 0) return ["job:*"];
  return [...keys];
}

export const resourceLocks = new ResourceLockManager();
