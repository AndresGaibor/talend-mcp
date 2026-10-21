/**
 * Muestra las definiciones de componentes que hay instaladas en Talend Studio.
 *
 *   bun run scripts/component-definitions.ts                 # resumen del catálogo en disco
 *   bun run scripts/component-definitions.ts tFileOutput    # componentes que cuadran
 *   bun run scripts/component-definitions.ts --detail tFileOutputDelimited
 *
 * Las definiciones salen de los XML `<nombre>_java.xml` de los plugins de
 * Studio: son la fuente de qué parámetros son obligatorios, con qué valor y
 * qué conexiones admite cada componente. No hace falta abrir Studio.
 */

import { DefinitionIndexRepository } from "../src/modules/component-definitions/infrastructure/definition-index.repository";
import { GetComponentDefinitionsUseCase } from "../src/modules/component-definitions/application/get-component-definitions.use-case";

const args = process.argv.slice(2);
const detailIndex = args.indexOf("--detail");
const detail = detailIndex >= 0 ? args[detailIndex + 1] : undefined;
const filter = args.find((arg) => !arg.startsWith("--") && arg !== detail);

const repository = new DefinitionIndexRepository();
const useCase = new GetComponentDefinitionsUseCase(repository);

if (detail) {
  const definition = await useCase.get(detail);
  if (!definition) {
    console.error(`No se encontro la definicion de '${detail}'.`);
    process.exit(1);
  }
  console.log(`${definition.name} (${definition.family}, ${definition.palette})`);
  console.log(`  plugin:    ${definition.pluginId}`);
  console.log(`  fichero:   ${definition.definitionPath}`);
  console.log(`  conectores: ${definition.connectors.map((c) => c.type).join(", ")}`);
  console.log(`  imports:   ${definition.imports.map((i) => i.mvn ?? i.name).join(", ")}`);
  console.log(`  parametros obligatorios (${definition.requiredParameters.length}):`);
  for (const parameter of definition.requiredParameters) {
    const suggested = parameter.suggestedValue ?? "(sin valor)";
    console.log(`    ${parameter.name} [${parameter.field}] = ${suggested}`);
  }
  if (definition.plan.skipped.length > 0) {
    console.log(`  sin valor posible (${definition.plan.skipped.length}):`);
    for (const skipped of definition.plan.skipped) {
      console.log(`    ${skipped.name} [${skipped.field}]: ${skipped.reason}`);
    }
  }
} else {
  const summary = await useCase.summary();
  console.log(`Instalacion: ${summary.pluginsDir || "no detectada"}`);
  console.log(`Definiciones: ${summary.total}`);
  console.log(`Por paleta:   ${JSON.stringify(summary.byPalette)}`);
  const families = Object.entries(summary.byFamily).sort((a, b) => b[1] - a[1]);
  console.log(`Familias:     ${families.length}`);
  for (const [family, count] of families.slice(0, 25)) {
    console.log(`  ${count.toString().padStart(4)}  ${family}`);
  }
  if (filter) {
    const list = await useCase.list(filter, { limit: 40 });
    console.log(`\nCoinciden con '${filter}': ${list.length}`);
    for (const item of list) {
      console.log(`  ${item.name} (${item.family}, ${item.palette}) obligatorios: ${item.requiredCount}`);
    }
  }
}
