import type { RepositoryContext } from "./types";

export function formatRepositoryContext(context: RepositoryContext): string {
  const lines: string[] = [];
  lines.push(`${context.name} (v${context.version})${context.purpose ? ` — ${context.purpose}` : ""}`);
  if (context.description) lines.push(`  ${context.description}`);
  for (const ctx of context.contexts) {
    lines.push(`  Contexto: ${ctx.contextName} (${ctx.parameters.length} variables)`);
    for (const param of ctx.parameters) {
      lines.push(`    - ${param.name} = ${param.value ?? ""}${param.type ? ` (${param.type})` : ""}`);
    }
  }
  return lines.join("\n");
}

export function formatRepositoryContextList(contexts: RepositoryContext[]): string {
  if (contexts.length === 0) return "No se encontraron contextos de repositorio.";
  return contexts
    .map((ctx) => {
      const totalParams = ctx.contexts.reduce((acc, c) => acc + c.parameters.length, 0);
      return `${ctx.name} (v${ctx.version}) — ${ctx.contexts.length} contexto(s), ${totalParams} variable(s)${ctx.purpose ? ` | ${ctx.purpose}` : ""}`;
    })
    .join("\n");
}
