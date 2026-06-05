import { buildComponentCatalog } from "../src/talend/components/component-catalog-builder";

console.log("Iniciando la construcción del catálogo completo de componentes de Talend Studio...");
console.log("Ruta de Talend Studio: /Applications/TalendStudio-8.0.1/studio");

const start = Date.now();
const result = await buildComponentCatalog("/Applications/TalendStudio-8.0.1/studio");
const duration = ((Date.now() - start) / 1000).toFixed(2);

console.log("\n=== RESULTADOS ===");
console.log(`- Éxito: ${result.ok}`);
console.log(`- Ubicación del catálogo: ${result.catalogPath}`);
console.log(`- Componentes escaneados: ${result.entryCount}`);
console.log(`- Plugins analizados: ${result.scannedPlugins.length}`);
console.log(`- Errores encontrados: ${result.errors.length}`);
if (result.errors.length > 0) {
  console.log("\nPrimeros 5 errores:");
  result.errors.slice(0, 5).forEach(e => console.error(`  * ${e}`));
}
console.log(`- Duración: ${duration} segundos`);
