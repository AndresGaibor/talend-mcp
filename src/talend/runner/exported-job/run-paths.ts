import { join } from "node:path";

export function getRunsDir(): string {
  return join(process.cwd(), ".talend-mcp", "runs");
}

export function generateRunId(): string {
  const now = new Date();
  const ds = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  return `run_${ds}`;
}
