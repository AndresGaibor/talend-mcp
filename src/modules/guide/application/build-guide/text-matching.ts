import type { GuideTask, GuideToolSummary } from "../../domain/guide.types";

/** Minúsculas y sin tildes, para comparar texto libre. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Palabras significativas de una consulta. */
export function tokens(text: string): string[] {
  return normalize(text)
    .split(/[^a-z0-9_]+/)
    .filter((token) => token.length > 1 && !new Set(["de", "del", "la", "las", "el", "los", "un", "una", "para", "por", "con", "que", "como"]).has(token));
}

/** Puntúa una tarea contra la consulta. */
export function scoreTask(task: GuideTask, query: string): number {
  const q = normalize(query).trim();
  if (!q) return 0;
  if (normalize(task.id) === q) return 100;
  let score = 0;
  if (normalize(task.id).includes(q)) score += 40;
  if (normalize(task.title).includes(q)) score += 25;
  if (task.aliases.some((alias) => normalize(alias).includes(q))) score += 20;
  if (normalize(task.goal).includes(q)) score += 10;
  for (const token of tokens(q)) {
    if (normalize(task.id).includes(token)) score += 6;
    if (normalize(task.title).includes(token)) score += 5;
    if (task.aliases.some((alias) => normalize(alias).includes(token))) score += 4;
    if (task.steps.some((step) => normalize(step.tool).includes(token))) score += 3;
    if (normalize(task.whenToUse).includes(token)) score += 2;
  }
  return score;
}

/** Puntúa una tool contra la consulta. */
export function scoreTool(tool: GuideToolSummary, query: string): number {
  const q = normalize(query).trim();
  if (!q) return 0;
  if (tool.name === q || tool.name === `talend_${q}`) return 100;
  let score = 0;
  if (tool.name.includes(q.replace(/\s+/g, "_"))) score += 40;
  if (tool.description && normalize(tool.description).includes(q)) score += 12;
  for (const token of tokens(q)) {
    if (tool.name.includes(token)) score += 6;
    if (normalize(tool.description).includes(token)) score += 2;
    if (normalize(tool.area).includes(token)) score += 1;
  }
  const queryTokens = tokens(q);
  if (queryTokens.length > 1) {
    const searchable = normalize(`${tool.name} ${tool.description} ${tool.area}`);
    const matchedTokens = queryTokens.filter((token) => searchable.includes(token)).length;
    if (matchedTokens === queryTokens.length) score += 25;
    else score -= (queryTokens.length - matchedTokens) * 4;
  }
  return score;
}
