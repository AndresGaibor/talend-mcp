import { spawnSync, execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { homedir, platform, tmpdir } from "node:os";
import { createInterface } from "node:readline";
import { fileURLToPath } from "url";

import { buildBridgeFast } from "./fast-bridge-build";

/**
 * Instalador del plugin Java del bridge (Talend Studio Bridge).
 *
 * Todo el proceso se hace por CLI:
 *   1. Detecta la instalacion de Talend Studio y su JDK.
 *   2. Compila el plugin con Maven + Tycho.
 *   3. Desinstala la version anterior del plugin (si existe).
 *   4. Instala la version nueva con el p2 director, que reemplaza la anterior.
 *
 * Se ejecuta desde `bun run scripts/start.ts --install-bridge`.
 */

const IS_WIN = platform() === "win32";

const C = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
};

function c(valor: unknown, color: string): string {
  return `${color}${valor}${C.reset}`;
}

function log(icono: string, msg: string, color = C.reset): void {
  console.error(`${color}${icono}${C.reset} ${msg}`);
}
function ok(msg: string): void { log("✓", msg, C.green); }
function info(msg: string): void { log("•", msg, C.cyan); }
function warn(msg: string): void { log("⚠", msg, C.yellow); }
function fail(msg: string): void { log("✖", msg, C.red); }
function step(msg: string): void { log("→", msg, C.bold); }

function separador(): void {
  console.error(`  ${c("─".repeat(52), C.dim)}`);
}

function banner(titulo: string, lineas: string[], color = C.magenta): void {
  const border = "─".repeat(52);
  console.error();
  console.error(`  ${c(border, color)}`);
  console.error(`  ${c(titulo, C.bold)}`);
  console.error(`  ${c(border, color)}`);
  for (const l of lineas) console.error(`  ${l}`);
  console.error(`  ${c(border, color)}`);
  console.error();
}

async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); });
  });
}

// ─── Deteccion de Talend Studio ─────────────────────────────────────────────

export type StudioInstall = {
  /** Carpeta raiz de la instalacion (la que contiene plugins/ y features/). */
  dir: string;
  /** Ejecutable de Talend Studio, usado para invocar el p2 director. */
  exe: string;
  /** JDK con el que se compila el plugin. */
  jdk: string;
  /** carpeta studio/ dentro de la instalacion. */
  studioDir: string;
};

function isStudioDir(dir: string): boolean {
  return existsSync(join(dir, "plugins")) && existsSync(join(dir, "features"));
}

function findStudioExecutable(studioDir: string): string | null {
  if (IS_WIN) {
    // En Windows el ejecutable puede estar en studio/ o en la raiz de la
    // instalacion (por ejemplo C:/Talend/8.0.1/studio/Talend-Studio-win-x86_64.exe).
    const roots = [studioDir, dirname(studioDir)];
    const candidates: string[] = [];

    for (const root of roots) {
      for (const name of safeReaddir(root)) {
        if (!name.toLowerCase().endsWith(".exe")) continue;
        if (!name.toLowerCase().startsWith("talend-studio")) continue;
        candidates.push(join(root, name));
      }
    }

    const preferred = candidates.find((p) => p.toLowerCase().includes("win")) ?? candidates[0];
    return preferred && existsSync(preferred) ? preferred : null;
  }

  const direct = join(studioDir, "Talend-Studio");
  if (existsSync(direct)) return direct;

  const macApp = join(studioDir, "Talend-Studio.app/Contents/MacOS/Talend-Studio");
  if (existsSync(macApp)) return macApp;

  const cocoa = readdirSync(studioDir)
    .filter((name) => name.startsWith("Talend-Studio") && name.endsWith(".app"))
    .map((name) => join(studioDir, name, "Contents", "MacOS",
      readdirSync(join(studioDir, name, "Contents", "MacOS")).find((n) => n.startsWith("Talend-Studio")) ?? "Talend-Studio"))
    .find((p) => existsSync(p));

  return cocoa ?? null;
}

/**
 * Busca un JDK utilizable: primero el que trae Talend Studio (siempre con la
 * version de Java que el producto exige), luego JAVA_HOME y por ultimo el PATH.
 */
function findJdk(studioDir: string): string | null {
  const candidates: string[] = [];

  const installRoot = dirname(studioDir);
  for (const entry of safeReaddir(installRoot)) {
    if (!/jdk|jre|zulu|temurin|corretto/i.test(entry)) continue;
    const jdkDir = join(installRoot, entry);
    if (existsSync(join(jdkDir, "bin", IS_WIN ? "java.exe" : "java"))) {
      candidates.push(jdkDir);
    }
  }

  if (process.env.JAVA_HOME && existsSync(join(process.env.JAVA_HOME, "bin", IS_WIN ? "java.exe" : "java"))) {
    candidates.push(process.env.JAVA_HOME);
  }

  for (const candidate of candidates) {
    const version = runJavaVersion(candidate);
    if (version && Number(version) >= 17) {
      return candidate;
    }
  }

  return null;
}

function safeReaddir(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

const javaVersions = new Map<string, string | null>();

/** Cada `java -version` cuesta una JVM: se pregunta una sola vez por JDK. */
function runJavaVersion(jdk: string): string | null {
  if (javaVersions.has(jdk)) return javaVersions.get(jdk) ?? null;
  const result = spawnSync(join(jdk, "bin", IS_WIN ? "java.exe" : "java"), ["-version"], { encoding: "utf8" });
  const output = `${result.stderr ?? ""}${result.stdout ?? ""}`;
  const version = output.match(/version "(\d+)/)?.[1] ?? null;
  javaVersions.set(jdk, version);
  return version;
}

function studioCandidates(): string[] {
  const candidates: string[] = [];

  if (IS_WIN) {
    const roots = [
      process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "Talend Studio") : "",
      process.env.PROGRAMFILES ? join(process.env.PROGRAMFILES, "Talend Studio") : "",
      process.env["PROGRAMFILES(X86)"] ? join(process.env["PROGRAMFILES(X86)"], "Talend Studio") : "",
      "C:/Talend",
      "D:/Talend",
    ].filter(Boolean);

    for (const root of roots) {
      if (!existsSync(root)) continue;
      if (isStudioDir(root)) {
        candidates.push(root);
        continue;
      }
      // Formato <raiz>/<version>/studio
      for (const entry of safeReaddir(root)) {
        const nested = join(root, entry, "studio");
        if (isStudioDir(nested)) candidates.push(nested);
      }
    }
  } else if (platform() === "darwin") {
    candidates.push(
      "/Applications/Talend Studio/studio",
      "/Applications/TalendStudio-8.0.1/studio",
      "/Applications/Talend Studio 8.0.1/studio",
    );
    for (const entry of safeReaddir("/Applications")) {
      if (/Talend/i.test(entry)) candidates.push(join("/Applications", entry, "studio"));
    }
  } else {
    candidates.push(
      "/opt/Talend Studio",
      "/opt/talend-studio",
      "/usr/local/Talend Studio",
    );
    for (const root of ["/mnt/c/Talend", "/mnt/c/Program Files", "/mnt/c/Program Files (x86)"]) {
      for (const entry of safeReaddir(root)) {
        const nested = join(root, entry, "studio");
        if (isStudioDir(nested)) candidates.push(nested);
        if (isStudioDir(join(root, entry))) candidates.push(join(root, entry));
      }
    }
  }

  return candidates.filter((dir) => isStudioDir(dir));
}

export function detectStudio(): StudioInstall | null {
  for (const studioDir of studioCandidates()) {
    const exe = findStudioExecutable(studioDir);
    if (!exe) continue;
    const jdk = findJdk(studioDir);
    if (!jdk) continue;
    return { dir: dirname(studioDir), exe, jdk, studioDir };
  }
  return null;
}

// ─── Maven ──────────────────────────────────────────────────────────────────

function resolveMaven(): string | null {
  const which = spawnSync(IS_WIN ? "where" : "which", ["mvn"], { encoding: "utf8" });
  if (which.status === 0) {
    const first = which.stdout.split(/\r?\n/).map((l) => l.trim()).find(Boolean);
    if (first) return first;
  }

  const mavenRoot = join(process.env.LOCALAPPDATA ?? join(homedir(), ".local", "share"), "maven");
  for (const entry of safeReaddir(mavenRoot)) {
    if (!entry.startsWith("apache-maven-")) continue;
    const bin = join(mavenRoot, entry, "bin", IS_WIN ? "mvn.cmd" : "mvn");
    if (existsSync(bin)) return bin;
  }

  return null;
}

// ─── Compilacion ────────────────────────────────────────────────────────────

function buildBridge(projectRoot: string, jdk: string): boolean {
  const mvn = resolveMaven();
  if (!mvn) {
    fail("No se encontro Maven. Instala Maven 3.9+ o agregalo al PATH.");
    return false;
  }

  const bridgeDir = join(projectRoot, "talend-studio-bridge");
  const env = { ...process.env, JAVA_HOME: jdk, PATH: `${join(jdk, "bin")};${process.env.PATH ?? ""}` };

  info(`Maven: ${c(basename(dirname(dirname(mvn))), C.cyan)}`);
  info(`JDK: ${c(jdk, C.cyan)} (Java ${runJavaVersion(jdk)})`);

  const result = spawnSync(mvn, ["clean", "verify", "-DskipTests", "-B"], {
    cwd: bridgeDir,
    env,
    stdio: "inherit",
    shell: IS_WIN,
  });

  return result.status === 0;
}

// ─── Instalacion / actualizacion con el p2 director ─────────────────────────

const FEATURE_IU = "com.andres.talend.bridge.feature.feature.group";

function p2Director(studio: StudioInstall, args: string[]): number {
  const result = spawnSync(studio.exe, args, { stdio: "inherit", shell: false });
  return result.status ?? 1;
}
const BRIDGE_PING_URL = "http://127.0.0.1:3930/ping";

/** Version del bundle que esta sirviendo el bridge ahora, o null si no responde. */
async function runningBridgeVersion(): Promise<string | null> {
  try {
    const response = await fetch(BRIDGE_PING_URL, { signal: AbortSignal.timeout(1000) });
    if (!response.ok) return null;
    const payload = (await response.json()) as { plugin?: string; version?: string };
    return payload.plugin === "com.andres.talend.bridge" ? (payload.version ?? "") : null;
  } catch {
    return null;
  }
}

async function isStudioRunning(studio: StudioInstall): Promise<boolean> {
  // Si el bridge contesta, Studio esta abierto: evita lanzar `tasklist` (~0,5 s).
  if ((await runningBridgeVersion()) !== null) return true;
  if (IS_WIN) {
    // tasklist trunca el nombre de la imagen a 25 caracteres, asi que no se
    // puede filtrar por el nombre completo: se busca el prefijo.
    const result = spawnSync("tasklist", ["/NH", "/FO", "CSV"], { encoding: "utf8" });
    const marker = basename(studio.exe).slice(0, 15).toLowerCase();
    return (result.stdout ?? "").toLowerCase().includes(marker);
  }
  try {
    const out = execSync("pgrep -fl Talend-Studio 2>/dev/null || echo ''", { encoding: "utf8" });
    return out.includes("Talend-Studio");
  } catch {
    return false;
  }
}

function closeStudio(studio: StudioInstall): void {
  if (IS_WIN) {
    spawnSync("taskkill", ["/F", "/IM", basename(studio.exe)], { stdio: "ignore" });
  } else {
    try {
      execSync("pkill -f Talend-Studio 2>/dev/null || true");
    } catch {}
  }
}

/**
 * Elimina jars del plugin que quedaran copiados a mano en plugins/ o dropins/.
 * Sin esto, un jar suelto duplica el bundle y rompe la activacion.
 */
function cleanLeftoverJars(studio: StudioInstall): number {
  let removed = 0;
  const folders = [join(studio.studioDir, "plugins"), join(studio.studioDir, "dropins")];

  for (const folder of folders) {
    for (const entry of safeReaddir(folder)) {
      if (!entry.startsWith("com.andres.talend.bridge")) continue;
      const full = join(folder, entry);
      try {
        rmSync(full, { recursive: true, force: true });
        removed += 1;
        info(`Jar previo eliminado: ${c(join(basename(folder), entry), C.dim)}`);
      } catch {}
    }
  }

  return removed;
}

/**
 * Ruta estable donde se copia el update site antes de instalar.
 *
 * Se usa una ruta fija (y no una temporal) porque p2 cachea los repositorios
 * en el area de datos de la instalacion: si la ruta cambia en cada ejecucion,
 * el cache queda obsoleto y p2 intenta releer rutas inexistentes.
 */
function stagingRepositoryPath(): string {
  const root = join(process.env.LOCALAPPDATA ?? join(homedir(), ".talend-mcp"), "talend-mcp");
  const dir = join(root, "bridge-repository");
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Convierte el nombre que p2 guarda en el cache a una ruta local, si se puede. */
function referencedPath(name: string): string | null {
  let value = name.trim();

  const prefix = value.match(/^(?:update site|reference|site)\s*:\s*(.+)$/i);
  if (prefix) value = prefix[1]!;

  if (value.startsWith("file:///")) {
    value = decodeURIComponent(value.slice("file:///".length));
    value = value.replace(/\//g, "\\");
    return value;
  }

  if (/^[a-zA-Z]:[\\/]/.test(value) || value.startsWith("/") || value.startsWith("\\")) {
    return value;
  }

  return null;
}

/** Una ubicacion es un update site de p2 si tiene los marcadores estandar. */
function isUpdateSite(path: string): boolean {
  const markers = ["p2.index", "content.xml", "content.jar", "content.xml.xz"];
  return markers.some((marker) => existsSync(join(path, marker)));
}

/**
 * Limpia del cache de p2 los repositorios que apuntan a rutas que ya no
 * sirven como repositorio para el director.
 *
 * p2 guarda en el area de datos de la instalacion los repositorios que ha
 * descargado. Si esa entrada apunta a un update site (un directorio con
 * content.jar y artifacts.jar), p2 intenta releerlo como ubicacion de
 * extension y falla en cada instalacion, llenando la salida de errores que no
 * afectan el resultado. Como los companeros ya tienen el plugin instalado, ese
 * cache queda en el mismo estado en sus maquinas, por eso hay que limpiarlo
 * desde aqui.
 */
function cleanStaleP2Repositories(studio: StudioInstall): number {
  const osgiDir = join(studio.studioDir, "configuration", "org.eclipse.osgi");
  let removed = 0;

  for (const instance of safeReaddir(osgiDir)) {
    const dataDir = join(osgiDir, instance, "data");
    for (const entry of safeReaddir(dataDir)) {
      const cacheDir = join(dataDir, entry);
      const artifacts = join(cacheDir, "artifacts.xml");
      if (!existsSync(artifacts)) continue;

      try {
        const content = readFileSync(artifacts, "utf8");
        const raw = content.match(/<repository[^>]*\sname='([^']*)'/)?.[1];
        if (!raw) continue;

        const referenced = referencedPath(raw);
        if (!referenced) continue;

        const isStale = isUpdateSite(referenced) || !existsSync(referenced);
        if (!isStale) continue;

        rmSync(cacheDir, { recursive: true, force: true });
        removed += 1;
        info(`Cache p2 obsoleto eliminado: ${c(referenced, C.dim)}`);
      } catch {}
    }
  }

  return removed;
}

/**
 * Prepara una copia del update site en una ruta estable y un area de datos
 * aislada para el director de p2.
 */
function prepareWorkspace(repoDir: string): { repo: string; data: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), "talend-bridge-install-"));
  const repo = stagingRepositoryPath();
  const data = join(root, "p2data");
  mkdirSync(data, { recursive: true });

  rmSync(repo, { recursive: true, force: true });
  mkdirSync(repo, { recursive: true });
  cpSync(repoDir, repo, { recursive: true });

  return {
    repo,
    data,
    cleanup: () => {
      try { rmSync(root, { recursive: true, force: true }); } catch {}
    },
  };
}

/**
 * Limpia del perfil de p2 los repositorios que quedaron registrados con una
 * URI invalida.
 *
 * Cuando una instalacion falla a mitad de camino, p2 deja el repositorio
 * registrado como "extension location" con una URI malformada (file://C:/...).
 * En cada instalacion posterior p2 intenta releer esa entrada y falla, aunque
 * la operacion termine bien. Como los companeros ya tienen el plugin instalado
 * con la version anterior, hay que reparar el perfil desde el CLI.
 */
function cleanMalformedP2Repositories(studio: StudioInstall): number {
  const prefsDir = join(
    studio.studioDir, "p2", "org.eclipse.equinox.p2.engine", "profileRegistry",
    "profile.profile", ".data", ".settings",
  );

  const files = [
    "org.eclipse.equinox.p2.artifact.repository.prefs",
    "org.eclipse.equinox.p2.metadata.repository.prefs",
  ];

  let removed = 0;

  for (const fileName of files) {
    const file = join(prefsDir, fileName);
    if (!existsSync(file)) continue;

    try {
      const lines = readFileSync(file, "utf8").split(/\r?\n/);
      const groups = new Map<string, string[]>();
      const order: string[] = [];

      for (const line of lines) {
        const match = line.match(/^(repositories\/[^/]+)\/(.*)$/);
        if (!match) continue;
        const key = match[1]!;
        if (!groups.has(key)) {
          groups.set(key, []);
          order.push(key);
        }
        groups.get(key)!.push(line);
      }

      const drop = new Set<string>();

      for (const key of order) {
        const group = groups.get(key)!;
        const uri = unescapePrefsValue(group.map((l) => l.match(/\/uri=(.*)$/)).find(Boolean)?.[1] ?? "");
        const type = unescapePrefsValue(group.map((l) => l.match(/\/type=(.*)$/)).find(Boolean)?.[1] ?? "");

        const malformed = /^file:\/\/[a-zA-Z]:/.test(uri);
        const extensionLocation = type.includes("extensionlocation");
        const localPath = referencedPath(uri);
        const missing = localPath !== null && !existsSync(localPath);

        if (malformed || extensionLocation || missing) drop.add(key);
      }

      if (drop.size === 0) continue;

      const kept = lines.filter((line) => {
        const match = line.match(/^(repositories\/[^/]+)\//);
        return !match || !drop.has(match[1]!);
      });

      writeFileSync(file, kept.join("\n"), "utf8");
      removed += drop.size;
      info(`Entradas de repositorio p2 invalidas eliminadas de ${c(fileName, C.dim)}: ${drop.size}`);
    } catch (error) {
      warn(`No se pudo limpiar ${fileName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return removed;
}

/** Despliega los escapes de los archivos de preferencias de Eclipse. */
function unescapePrefsValue(value: string): string {
  return value.replace(/\\:/g, ":").replace(/\\\\/g, "\\");
}

/** Desinstala la version anterior del plugin, si estaba instalada. */
function uninstallPrevious(studio: StudioInstall, data: string): void {
  info("Buscando una version anterior instalada...");
  const status = p2Director(studio, [
    "-application", "org.eclipse.equinox.p2.director",
    "-uninstallIU", FEATURE_IU,
    "-destination", studio.studioDir,
    "-data", data,
    "-nosplash", "-console",
  ]);

  if (status === 0) {
    ok("Version anterior desinstalada.");
  } else {
    info("No habia una version anterior instalada.");
  }
}

function installNew(studio: StudioInstall, repoDir: string, data: string): boolean {
  const normalized = repoDir.replace(/\\/g, "/");
  // En Windows la URI de un drive necesita tres barras: file:///C:/ruta
  const repoUri = normalized.startsWith("/") ? `file://${normalized}` : `file:///${normalized}`;

  const status = p2Director(studio, [
    "-application", "org.eclipse.equinox.p2.director",
    "-repository", repoUri,
    "-installIU", FEATURE_IU,
    "-destination", studio.studioDir,
    "-profileProperties", "org.eclipse.update.install.features=true",
    "-clean",
    "-data", data,
    "-nosplash", "-console",
  ]);

  return status === 0;
}

function installedFeatureVersion(studio: StudioInstall): string | null {
  const featureJar = join(studio.studioDir, "features");
  const match = safeReaddir(featureJar).find((name) => name.startsWith("com.andres.talend.bridge.feature_"));
  if (!match) return null;
  const version = match.match(/_(\d+\.\d+\.\d+\.\d+)/)?.[1];
  return version ?? match;
}

/**
 * Carpeta donde el plugin vigila el jar para recargarse en caliente.
 * Debe coincidir con `HotReloadService.hotJarPath()` del lado Java.
 */
function hotJarPath(): string {
  const dir = process.env.TALEND_BRIDGE_HOT_DIR
    ?? join(homedir(), ".talend-bridge", "hot");
  return join(dir, "bridge.jar");
}

/** Copia el jar compilado a la carpeta de carga en caliente. */
function publishHotJar(jarPath: string): string | undefined {
  try {
    const target = hotJarPath();
    mkdirSync(dirname(target), { recursive: true });
    cpSync(jarPath, target, { force: true });
    return target;
  } catch (error) {
    warn(`No se pudo publicar el jar para carga en caliente: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

function builtJarPath(projectRoot: string): string | undefined {
  const targetDir = join(projectRoot, "talend-studio-bridge", "com.andres.talend.bridge", "target");
  const jar = safeReaddir(targetDir).find((name) => name.endsWith(".jar") && !name.includes("sources"));
  return jar ? join(targetDir, jar) : undefined;
}

/**
 * Espera a que el bridge responda con la version recien publicada.
 *
 * El watcher del plugin lee el jar nuevo, recarga el bundle y reinicia el
 * servidor HTTP: la respuesta llega con el mismo numero de version (la version
 * la fija el build), asi que se valida que el bridge siga respondiendo.
 */
async function waitForHotReload(expectedVersion?: string, timeoutMs = 30_000): Promise<boolean> {
  const started = Date.now();
  const deadline = started + timeoutMs;
  let sawDown = false;
  let sawUp = false;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 250));

    const version = await runningBridgeVersion();
    if (version === null) {
      sawDown = true;
      // Si el bridge ni siquiera estaba arriba (Studio arrancando), no hay
      // nada que recargar: el watcher tomara el jar cuando el plugin cargue.
      if (!sawUp && Date.now() - started > 8_000) {
        warn("El bridge no responde (¿Studio todavia arrancando?). Cargara el bundle nuevo al iniciar.");
        return false;
      }
      continue;
    }
    sawUp = true;

    // Con una version esperada (build rapido: lleva un calificador unico) se
    // sabe exactamente cuando el bundle nuevo ya atiende. Sin ella, solo se
    // puede confiar en haber visto el bridge caer y volver.
    if (expectedVersion ? version === expectedVersion : sawDown) {
      ok("El bridge se reinicio con el bundle nuevo.");
      return true;
    }
  }

  return false;
}

// ─── Entry point ────────────────────────────────────────────────────────────

/** Resultado de compilar: el jar y, si se conoce, la version que traera el bundle. */
type Compiled = { jar: string; version?: string; reused?: boolean };

function compileWithMaven(projectRoot: string, jdk: string): Compiled | null {
  step("Compilando el plugin (Maven + Tycho)...");
  if (!buildBridge(projectRoot, jdk)) {
    fail("La compilacion fallo.");
    return null;
  }
  ok("Plugin compilado.");

  const jar = builtJarPath(projectRoot);
  if (!jar) {
    fail("No se encontro el jar compilado del bundle.");
    return null;
  }
  return { jar };
}

function compileFast(projectRoot: string, jdk: string, force: boolean): Compiled | null | "fallback" {
  step("Compilando el plugin (javac, sin Maven)...");
  const started = Date.now();
  const result = buildBridgeFast(projectRoot, jdk, force);

  if (result.status === "unavailable") {
    warn(`Compilacion rapida no disponible: ${result.reason}. Se usa Maven.`);
    return "fallback";
  }
  if (result.status === "failed") {
    fail("La compilacion fallo.");
    console.error(result.errors);
    return null;
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (result.build.reused) {
    ok(`Sin cambios en las fuentes: se reutiliza el jar (${seconds} s).`);
  } else {
    ok(`Plugin compilado en ${seconds} s (version ${result.build.version}).`);
  }
  return { jar: result.build.jar, version: result.build.version, reused: result.build.reused };
}

export async function installBridge(): Promise<void> {
  const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const flags = new Set(process.argv.slice(2));
  const useMaven = flags.has("--maven");
  const force = flags.has("--force");

  banner("Talend Studio Bridge", [
    `  ${c("Compila el plugin y lo instala (o actualiza) en Talend Studio.", C.dim)}`,
  ]);

  step("Detectando Talend Studio...");
  const studio = detectStudio();
  if (!studio) {
    fail("No se encontro una instalacion de Talend Studio con su JDK.");
    console.error();
    console.error("  Rutas revisadas:");
    for (const candidate of studioCandidates()) console.error(`  - ${candidate}`);
    console.error();
    console.error("  Instala Talend Studio o ajusta las rutas del instalador.");
    process.exitCode = 1;
    return;
  }

  ok(`Talend Studio: ${c(studio.studioDir, C.cyan)}`);
  ok(`Ejecutable: ${c(basename(studio.exe), C.cyan)}`);
  ok(`JDK: ${c(studio.jdk, C.cyan)} (Java ${runJavaVersion(studio.jdk)})`);

  const studioRunning = await isStudioRunning(studio);
  if (studioRunning) {
    info("Talend Studio esta corriendo: se usara carga en caliente (sin reiniciar).");
  }

  separador();
  // Con Studio abierto solo hace falta el jar: se compila con javac. Maven
  // queda para el update site de p2 (Studio cerrado) y como respaldo.
  let compiled: Compiled | null;
  if (studioRunning && !useMaven) {
    const fast = compileFast(projectRoot, studio.jdk, force);
    compiled = fast === "fallback" ? compileWithMaven(projectRoot, studio.jdk) : fast;
  } else {
    compiled = compileWithMaven(projectRoot, studio.jdk);
  }
  if (!compiled) {
    process.exitCode = 1;
    return;
  }
  const jar = compiled.jar;

  // Nada que recargar: las fuentes no cambiaron y Studio ya sirve esta version.
  if (studioRunning && compiled.reused && compiled.version && !force) {
    if ((await runningBridgeVersion()) === compiled.version) {
      separador();
      ok("El bridge ya esta actualizado: no hay nada que recargar.");
      return;
    }
  }

  // ── Carga en caliente ─────────────────────────────────────────────────────
  // El plugin instalado vigila ~/.talend-bridge/hot/bridge.jar y se recarga
  // solo cuando el archivo cambia. No requiere reiniciar Talend Studio.
  separador();
  step("Publicando el bundle para carga en caliente...");
  const hotJar = publishHotJar(jar);
  if (hotJar) {
    ok(`Bundle publicado en ${c(hotJar, C.cyan)}`);
  }

  if (studioRunning) {
    const reloaded = await waitForHotReload(compiled.version);
    separador();
    banner(reloaded ? "Actualizacion en caliente completada" : "Bundle publicado", [
      `  ${c("Plugin:", C.dim)} com.andres.talend.bridge`,
      reloaded
        ? `  ${c("Estado:", C.dim)} ${c("recargado en caliente, sin reiniciar Studio", C.green)}`
        : `  ${c("Estado:", C.dim)} ${c("el plugin lo detectara en los proximos segundos", C.yellow)}`,
      ``,
      `  ${c("El bridge sigue escuchando en http://127.0.0.1:3930", C.dim)}`,
    ], reloaded ? C.green : C.yellow);
    return;
  }

  // ── Instalacion con p2 (Studio cerrado) ──────────────────────────────────
  const repoDir = join(projectRoot, "talend-studio-bridge", "com.andres.talend.bridge.repository", "target", "repository");
  if (!existsSync(repoDir)) {
    fail(`No se encontro el update site en ${repoDir}`);
    process.exitCode = 1;
    return;
  }

  separador();
  step("Actualizando el plugin en Talend Studio...");

  const previous = installedFeatureVersion(studio);
  if (previous) {
    info(`Version instalada actualmente: ${c(previous, C.yellow)}`);
  }

  const workspace = prepareWorkspace(repoDir);

  try {
    cleanLeftoverJars(studio);
    cleanStaleP2Repositories(studio);
    cleanMalformedP2Repositories(studio);
    uninstallPrevious(studio, workspace.data);

    if (!installNew(studio, workspace.repo, workspace.data)) {
      fail("La instalacion del plugin fallo.");
      process.exitCode = 1;
      return;
    }
  } finally {
    workspace.cleanup();
  }

  const installed = installedFeatureVersion(studio);

  separador();
  banner("Instalacion completada", [
    `  ${c("Plugin:", C.dim)} com.andres.talend.bridge`,
    `  ${c("Version instalada:", C.dim)} ${c(installed ?? "desconocida", C.green)}`,
    previous ? `  ${c("Version anterior:", C.dim)} ${c(previous, C.yellow)}` : "",
    ``,
    `  ${c("El bridge queda escuchando en http://127.0.0.1:3930", C.dim)}`,
    `  ${c("El token esta en ~/.talend-bridge/token", C.dim)}`,
  ].filter(Boolean), C.green);
}
