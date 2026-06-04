import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join, basename, resolve } from "node:path";
import { mkdir, readFile, writeFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";

const CACHE_BASE = join(homedir(), ".talend-mcp");
const CACHE_DIR = join(CACHE_BASE, "repos");
const STATE_FILE = join(CACHE_BASE, "state.json");

export interface RepoState {
  activePath?: string;
  activeBranch?: string;
  activeProject?: string;
}

export interface CachedRepo {
  name: string;
  source: string;
  path: string;
  branch: string;
}

export interface RepoInfo {
  branch: string;
  lastCommit: string;
  hasRemote: boolean;
}

export interface DiscoveredProject {
  projectName: string;
  jobCount: number;
  hasMetadata: boolean;
}

export interface PullResult {
  branch: string;
  lastCommit: string;
  changes: number;
}

export async function loadState(): Promise<RepoState> {
  try {
    const data = await readFile(STATE_FILE, "utf-8");
    return JSON.parse(data) as RepoState;
  } catch {
    return {};
  }
}

export async function saveState(state: RepoState): Promise<void> {
  await mkdir(CACHE_BASE, { recursive: true });
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

export function parseSource(source: string): { type: "remote"; url: string; name: string } | { type: "local"; path: string; name: string } {
  if (source.startsWith("/") || source.startsWith("./") || source.startsWith("~") || /^[a-zA-Z]:\\/.test(source)) {
    const abspath = resolve(source);
    return { type: "local", path: abspath, name: basename(abspath).replace(/\.git$/, "") };
  }

  if (source.startsWith("git@")) {
    const match = source.match(/git@[^:]+:(.+)\.git$/);
    const repoPath = match?.[1] ?? source.replace(/^git@[^:]+:/, "").replace(/\.git$/, "");
    return { type: "remote", url: source, name: repoPath.replace(/[/\\]/g, "-") };
  }

  if (source.startsWith("https://") || source.startsWith("http://")) {
    const url = source.endsWith(".git") ? source : `${source}.git`;
    const match = source.match(/\/([^/]+\/[^/]+?)(\.git)?$/);
    const repoPath = match?.[1] ?? source.replace(/^https?:\/\//, "").replace(/\.git$/, "");
    return { type: "remote", url, name: repoPath.replace(/[/\\]/g, "-") };
  }

  if (source.includes("/")) {
    return { type: "remote", url: `https://github.com/${source}.git`, name: source.replace(/[/\\]/g, "-") };
  }

  const abspath = resolve(source);
  return { type: "local", path: abspath, name: basename(abspath) };
}

function runGit(args: string[], cwd?: string, timeoutMs = 30_000): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      if (process.platform === "win32") {
        spawn("taskkill", ["/F", "/T", "/PID", String(child.pid)]);
      } else {
        child.kill("SIGKILL");
      }
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({ ok: exitCode === 0, stdout, stderr });
    });
    child.on("error", () => {
      clearTimeout(timer);
      resolve({ ok: false, stdout, stderr });
    });
  });
}

export async function cloneRepo(source: string, targetDir: string, branch?: string): Promise<void> {
  const parsed = parseSource(source);
  if (parsed.type !== "remote") throw new Error(`No es una URL remota: ${source}`);

  await mkdir(CACHE_BASE, { recursive: true });

  const args = ["clone", "--depth", "1"];
  if (branch) args.push("--branch", branch);
  args.push(parsed.url, targetDir);

  const result = await runGit(args);
  if (!result.ok) throw new Error(`Error clonando repo: ${result.stderr.trim() || result.stdout.trim() || "desconocido"}`);
}

export async function pullRepo(repoPath: string): Promise<PullResult> {
  const branchResult = await runGit(["rev-parse", "--abbrev-ref", "HEAD"], repoPath);
  const branch = branchResult.ok ? branchResult.stdout.trim() : "unknown";

  await runGit(["pull", "--ff-only"], repoPath);

  const commitResult = await runGit(["log", "--oneline", "-1"], repoPath);
  const lastCommit = commitResult.ok ? commitResult.stdout.trim() : "unknown";

  const diffResult = await runGit(["diff", "--shortstat", "HEAD@{1}"], repoPath);
  const changes = diffResult.ok && diffResult.stdout.trim()
    ? (Number(diffResult.stdout.match(/\d+/)?.[0]) || 0)
    : 0;

  return { branch, lastCommit, changes };
}

export async function getRepoInfo(repoPath: string): Promise<RepoInfo> {
  const branchResult = await runGit(["rev-parse", "--abbrev-ref", "HEAD"], repoPath);
  const branch = branchResult.ok ? branchResult.stdout.trim() : "unknown";

  const commitResult = await runGit(["log", "--oneline", "-1"], repoPath);
  const lastCommit = commitResult.ok ? commitResult.stdout.trim() : "unknown";

  const remoteResult = await runGit(["remote", "-v"], repoPath);
  const hasRemote = remoteResult.ok && remoteResult.stdout.trim().length > 0;

  return { branch, lastCommit, hasRemote };
}

export async function discoverTalendProject(repoPath: string): Promise<DiscoveredProject> {
  const processDir = join(repoPath, "process");
  let jobCount = 0;
  try {
    const entries = await readdir(processDir);
    jobCount = entries.filter((e) => e.endsWith(".item")).length;
  } catch {
    jobCount = 0;
  }

  const hasMetadata = existsSync(join(repoPath, ".metadata"));
  const projectName = basename(repoPath).replace(/\.git$/, "");

  return { projectName, jobCount, hasMetadata };
}

export async function getCachedRepos(): Promise<CachedRepo[]> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
  } catch {
    return [];
  }

  try {
    const entries = await readdir(CACHE_DIR);
    const repos: CachedRepo[] = [];

    for (const entry of entries) {
      const repoPath = join(CACHE_DIR, entry);
      try {
        const s = await stat(repoPath);
        if (!s.isDirectory()) continue;
      } catch {
        continue;
      }

      if (!existsSync(join(repoPath, ".git"))) continue;

      const info = await getRepoInfo(repoPath);
      repos.push({ name: entry, source: `cache:${entry}`, path: repoPath, branch: info.branch });
    }

    return repos;
  } catch {
    return [];
  }
}

export function getCacheDir(): string {
  return CACHE_DIR;
}