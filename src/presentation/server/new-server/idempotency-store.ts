import { createHash, randomUUID } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Database } from "bun:sqlite";

const MAX_ENTRIES = 500;
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_RESULT_BYTES = 4 * 1024 * 1024;
const PROCESS_INSTANCE_ID = randomUUID();
const INFLIGHT = new Map<string, { fingerprint: string; promise: Promise<unknown> }>();

type Entry = {
  keyHash: string;
  fingerprint: string;
  createdAt: number;
  state: "pending" | "complete" | "uncertain";
  ownerPid: number | null;
  ownerInstance: string | null;
  resultJson: string | null;
};

type Claim = { kind: "owner" } | { kind: "pending" } | { kind: "complete"; result: unknown };

type LegacyEntry = {
  keyHash: string;
  fingerprint: string;
  createdAt: number;
  state: "complete" | "uncertain";
  result?: unknown;
};

export class IdempotencyConflictError extends Error {
  readonly code = "IDEMPOTENCY_KEY_REUSED";
  constructor() {
    super("La clave de idempotencia ya se uso con una solicitud diferente.");
    this.name = "IdempotencyConflictError";
  }
}

export class IdempotencyOutcomeUnknownError extends Error {
  readonly code = "IDEMPOTENCY_OUTCOME_UNKNOWN";
  constructor() {
    super("La operación con esta clave ya comenzo, pero no se pudo guardar un resultado terminal; no se repetira para evitar duplicados.");
    this.name = "IdempotencyOutcomeUnknownError";
  }
}

function ordenar(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordenar);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, ordenar(v)]));
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** Registro SQLite local: el INSERT por clave es el claim atomico entre procesos. */
export class IdempotencyStore {
  private readonly databases = new Map<string, Database>();

  constructor(private readonly directory?: string) {}

  async run<T>(key: string, operation: string, input: unknown, action: () => Promise<T>): Promise<T> {
    const trimmed = key.trim();
    if (trimmed.length < 8 || trimmed.length > 200) throw new Error("Idempotency-Key debe tener entre 8 y 200 caracteres.");
    const keyHash = sha256(trimmed);
    const fingerprint = sha256(JSON.stringify(ordenar({
      operation,
      project: process.env.TALEND_PROJECT ?? null,
      input,
    })));
    const databasePath = join(this.getDirectory(), "idempotency.sqlite");
    const database = this.getDatabase(databasePath);
    const inflightKey = `${databasePath}:${keyHash}`;
    const active = INFLIGHT.get(inflightKey);
    if (active) {
      if (active.fingerprint !== fingerprint) throw new IdempotencyConflictError();
      return await active.promise as T;
    }

    const promise = Promise.resolve().then(async () => {
      while (true) {
        const claim = this.claim(database, keyHash, fingerprint);
        if (claim.kind === "complete") return claim.result as T;
        if (claim.kind === "pending") {
          await new Promise<void>((resolve) => setTimeout(resolve, 50));
          continue;
        }
        return await this.executeAndRecord(database, keyHash, action);
      }
    });
    INFLIGHT.set(inflightKey, { fingerprint, promise });
    try {
      return await promise;
    } finally {
      INFLIGHT.delete(inflightKey);
    }
  }

  close(): void {
    for (const database of this.databases.values()) database.close();
    this.databases.clear();
  }

  private claim(database: Database, keyHash: string, fingerprint: string): Claim {
    this.prune(database);
    const insert = database.query(`
      INSERT OR IGNORE INTO idempotency_entries
        (key_hash, fingerprint, created_at, state, owner_pid, owner_instance, result_json)
      VALUES (?, ?, ?, 'pending', ?, ?, NULL)
    `).run(keyHash, fingerprint, Date.now(), process.pid, PROCESS_INSTANCE_ID);
    if (insert.changes === 1) return { kind: "owner" };

    const row = database.query(`
      SELECT key_hash AS keyHash, fingerprint, created_at AS createdAt, state,
             owner_pid AS ownerPid, owner_instance AS ownerInstance, result_json AS resultJson
      FROM idempotency_entries WHERE key_hash = ?
    `).get(keyHash) as Entry | null;
    if (!row) return this.claim(database, keyHash, fingerprint);
    if (row.fingerprint !== fingerprint) throw new IdempotencyConflictError();
    if (row.state === "complete") {
      if (typeof row.resultJson !== "string") throw new IdempotencyOutcomeUnknownError();
      return { kind: "complete", result: JSON.parse(row.resultJson) as unknown };
    }
    if (row.state === "uncertain") throw new IdempotencyOutcomeUnknownError();

    const sameProcess = row.ownerPid === process.pid && row.ownerInstance === PROCESS_INSTANCE_ID;
    if (!sameProcess && (row.ownerPid === null || !processIsAlive(row.ownerPid))) {
      database.query(`
        UPDATE idempotency_entries
        SET state = 'uncertain', owner_pid = NULL, owner_instance = NULL
        WHERE key_hash = ? AND state = 'pending' AND owner_pid IS ? AND owner_instance IS ?
      `).run(keyHash, row.ownerPid, row.ownerInstance);
      throw new IdempotencyOutcomeUnknownError();
    }
    return { kind: "pending" };
  }

  private async executeAndRecord<T>(database: Database, keyHash: string, action: () => Promise<T>): Promise<T> {
    try {
      const result = await action();
      const serialized = JSON.stringify(result);
      if (serialized === undefined || Buffer.byteLength(serialized, "utf8") > MAX_RESULT_BYTES) {
        this.markUncertain(database, keyHash);
        throw new IdempotencyOutcomeUnknownError();
      }
      const updated = database.query(`
        UPDATE idempotency_entries
        SET state = 'complete', owner_pid = NULL, owner_instance = NULL, result_json = ?
        WHERE key_hash = ? AND state = 'pending' AND owner_pid = ? AND owner_instance = ?
      `).run(serialized, keyHash, process.pid, PROCESS_INSTANCE_ID);
      if (updated.changes !== 1) throw new IdempotencyOutcomeUnknownError();
      return result;
    } catch (error) {
      this.markUncertain(database, keyHash);
      throw error;
    }
  }

  private markUncertain(database: Database, keyHash: string): void {
    database.query(`
      UPDATE idempotency_entries
      SET state = 'uncertain', owner_pid = NULL, owner_instance = NULL, result_json = NULL
      WHERE key_hash = ? AND state = 'pending' AND owner_pid = ? AND owner_instance = ?
    `).run(keyHash, process.pid, PROCESS_INSTANCE_ID);
  }

  private getDatabase(path: string): Database {
    const directory = this.getDirectory();
    const cached = this.databases.get(path);
    if (cached) return cached;

    mkdirSync(directory, { recursive: true });
    const database = new Database(path, { create: true });
    database.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
    database.exec(`
      CREATE TABLE IF NOT EXISTS idempotency_entries (
        key_hash TEXT PRIMARY KEY,
        fingerprint TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        state TEXT NOT NULL CHECK (state IN ('pending', 'complete', 'uncertain')),
        owner_pid INTEGER,
        owner_instance TEXT,
        result_json TEXT
      );
      CREATE INDEX IF NOT EXISTS idempotency_entries_created_at ON idempotency_entries(created_at);
    `);
    try { chmodSync(path, 0o600); } catch { /* ACL de Windows o permisos del volumen */ }
    this.migrateLegacyJson(database, directory);
    this.databases.set(path, database);
    return database;
  }

  private getDirectory(): string {
    return this.directory ?? process.env.TALEND_MCP_IDEMPOTENCY_DIR ?? join(process.cwd(), ".talend-mcp");
  }

  private migrateLegacyJson(database: Database, directory: string): void {
    const legacyPath = join(directory, "idempotency.json");
    if (!existsSync(legacyPath)) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(legacyPath, "utf8"));
    } catch {
      return;
    }
    if (!Array.isArray(parsed)) return;
    const cutoff = Date.now() - TTL_MS;
    const insert = database.query(`
      INSERT OR IGNORE INTO idempotency_entries
        (key_hash, fingerprint, created_at, state, owner_pid, owner_instance, result_json)
      VALUES (?, ?, ?, ?, NULL, NULL, ?)
    `);
    const migrate = database.transaction(() => {
      for (const raw of parsed) {
        if (!raw || typeof raw !== "object") continue;
        const entry = raw as LegacyEntry;
        if (typeof entry.keyHash !== "string" || typeof entry.fingerprint !== "string"
          || typeof entry.createdAt !== "number" || entry.createdAt < cutoff
          || (entry.state !== "complete" && entry.state !== "uncertain")) continue;
        const resultJson = entry.state === "complete" && entry.result !== undefined ? JSON.stringify(entry.result) : null;
        insert.run(entry.keyHash, entry.fingerprint, entry.createdAt, entry.state, resultJson);
      }
    });
    migrate();
  }

  private prune(database: Database): void {
    const cutoff = Date.now() - TTL_MS;
    database.query("DELETE FROM idempotency_entries WHERE state != 'pending' AND created_at < ?").run(cutoff);
    const count = (database.query("SELECT COUNT(*) AS count FROM idempotency_entries").get() as { count: number }).count;
    const excess = count - MAX_ENTRIES + 1;
    if (excess <= 0) return;
    database.query(`
      DELETE FROM idempotency_entries WHERE key_hash IN (
        SELECT key_hash FROM idempotency_entries
        WHERE state != 'pending' ORDER BY created_at ASC LIMIT ?
      )
    `).run(excess);
    const remaining = (database.query("SELECT COUNT(*) AS count FROM idempotency_entries").get() as { count: number }).count;
    if (remaining >= MAX_ENTRIES) throw new Error("Se alcanzo el limite de registros de idempotencia activos.");
  }
}

export const idempotencyStore = new IdempotencyStore();
