import { masteryAllComponents, generateMasteryReport } from "../src/talend/mastery/component-mastery-runner";

console.log("Iniciando verificación detallada de Maestría uno por uno en todos los componentes de Talend Studio...");
console.log("Esto evaluará el ciclo completo de Round-Trip (Generación de Job Spec -> Generación de XML -> Parseo y Verificación)...");

const start = Date.now();
const report = await masteryAllComponents();
const duration = ((Date.now() - start) / 1000).toFixed(2);

console.log("\n=== REPORT DE MAESTRÍA DE COMPONENTES ===");
console.log(`- Total de Componentes Evaluados: ${report.totalComponents}`);
console.log(`- Puntuación Promedio de Maestría: ${report.averageScore.toFixed(2)}/100`);
console.log("\nDistribución por Niveles de Maestría:");
for (const [level, count] of Object.entries(report.levelDistribution)) {
  if (count > 0) {
    console.log(`  * Nivel ${level}: ${count} componentes`);
  }
}

console.log(`\n- Duración total del proceso: ${duration} segundos`);
console.log("- Los archivos de maestría individuales se han guardado en .talend-mcp/mastery/");
