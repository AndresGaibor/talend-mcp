import { getAllRuntimeTools } from "../src/server/registered-tools";
import { GUIDE_TASKS } from "../src/modules/guide/domain/task-catalog";
import { areaForTool, areaName, GUIDE_AREAS, requiresStudio } from "../src/modules/guide/domain/areas";

type JsonSchema = {
  properties?: Record<string, { description?: string; type?: string; enum?: string[]; default?: unknown }>;
  required?: string[];
};

const tools = getAllRuntimeTools().sort((a, b) => a.name.localeCompare(b.name));
const groups = new Map<string, typeof tools>();
for (const tool of tools) {
  const area = areaForTool(tool.name);
  const group = groups.get(area) ?? [];
  group.push(tool);
  groups.set(area, group);
}

const lines = [
  "# Catalogo de tools MCP para Talend",
  "",
  "> Generado con `bun run docs:tools`. Fuente de verdad: registro de tools y `talend_guide`.",
  "> En tiempo de ejecucion, llama `talend_guide` para conocer el preset y las capacidades realmente expuestas.",
  "",
  `Tools registradas en el preset actual: **${tools.length}**.`,
  "",
  "## Empezar",
  "",
  "- `talend_guide { mode: \"overview\" }`: mapa de tareas, familias y estado basico.",
  "- `talend_guide { mode: \"task\", task: \"crear-job\" }`: secuencia de tools, argumentos de ejemplo y reglas.",
  "- `talend_guide { mode: \"search\", query: \"contextos\" }`: buscar por lenguaje natural.",
  "- `talend_guide { mode: \"tool\", tool: \"talend_jobs_list\" }`: schema y condiciones de una tool.",
  "- `talend_guide { mode: \"rules\" }`: reglas de Talend que evitan fallos silenciosos.",
  "",
  "## Flujos habituales",
  "",
];

for (const task of GUIDE_TASKS) {
  lines.push(`### ${task.title} (\`${task.id}\`)`, "", task.goal, "", `**Cuando:** ${task.whenToUse}`, "");
  task.steps.forEach((step, index) => {
    lines.push(`${index + 1}. \`${step.tool}\`${step.optional ? " (opcional)" : ""}: ${step.purpose}`);
    if (step.input) lines.push(`   - Ejemplo: \`${JSON.stringify(step.input)}\``);
  });
  if (task.pitfalls?.length) {
    lines.push("", "Evita:");
    for (const pitfall of task.pitfalls) lines.push(`- ${pitfall}`);
  }
  lines.push("", `**Completado cuando:** ${task.doneWhen}`, "");
}

lines.push("## Todas las tools", "");
for (const area of GUIDE_AREAS) {
  const entries = groups.get(area.id);
  if (!entries?.length) continue;
  lines.push(`### ${area.name}`, "", area.useFor, "");
  for (const tool of entries) {
    const annotations = tool.annotations;
    const labels = [
      annotations?.readOnlyHint ? "solo lectura" : "escribe/ejecuta",
      annotations?.requiresConfirmation ? "requiere confirmacion" : undefined,
      requiresStudio(tool.name) ? "requiere Studio + bridge" : "funciona sin Studio",
    ].filter(Boolean);
    lines.push(`#### \`${tool.name}\``, "", tool.description, "", `**Uso:** ${labels.join("; ")}.`, "");

    const schema = tool.inputSchema as JsonSchema;
    const properties = Object.entries(schema?.properties ?? {});
    if (properties.length > 0) {
      lines.push("Argumentos principales:", "");
      for (const [name, property] of properties) {
        const required = schema.required?.includes(name) ? "obligatorio" : "opcional";
        const type = property.type ?? (property.enum ? property.enum.join(" | ") : "valor");
        lines.push(`- \`${name}\` (${type}, ${required})${property.description ? `: ${property.description}` : ""}`);
      }
      lines.push("");
    }
  }
}

const output = new URL("../docs/CATALOGO-DE-TOOLS.md", import.meta.url);
await Bun.write(output, `${lines.join("\n")}\n`);
console.log(`Catalogo generado: ${tools.length} tools -> ${output.pathname}`);
