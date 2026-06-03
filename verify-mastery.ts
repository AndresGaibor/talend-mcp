import { buildJobItemXml, buildJobPropertiesXml } from "./src/talend/job-generator";
import { parseJobItem } from "./src/talend/job-parser";

const spec = {
  jobName: "MasteryTest",
  folderPath: "experts/tests",
  components: [
    {
      uniqueName: "tMap_1",
      componentName: "tMap",
      posX: 200,
      posY: 200,
    },
    {
      uniqueName: "tDBOutput_1",
      componentName: "tMysqlOutput",
      posX: 500,
      posY: 200,
      parameters: {
        TABLE: '"users"',
        DATA_ACTION: "INSERT"
      }
    }
  ],
  connections: [
    {
      source: "tMap_1",
      target: "tDBOutput_1",
      label: "out1",
      connectorName: "FLOW"
    }
  ]
};

console.log("1. Generando XML experto...");
const { xml: itemXml, rootId } = buildJobItemXml(spec as any);
const propertiesXml = buildJobPropertiesXml(spec as any, rootId);

console.log("2. Parseando XML generado para validación...");
const parsed = parseJobItem(itemXml, "MasteryTest_0.1.item");

console.log("\n=== RESULTADOS DE VALIDACIÓN ===");
const tMap = parsed.components.find(c => c.componentName === "tMap");
console.log("- tMap encontrado:", !!tMap);
console.log("- tMap tiene nodeData (TalendMapper):", !!tMap?.rawNodeData);
if (tMap?.rawNodeData) {
    console.log("  - xsi:type:", tMap.rawNodeData["@_xsi:type"]);
}

const tOutput = parsed.components.find(c => c.componentName === "tMysqlOutput");
console.log("- tMysqlOutput encontrado:", !!tOutput);
console.log("- tMysqlOutput TABLE:", tOutput?.parameters.TABLE);

console.log("- Conexiones encontradas:", parsed.connections.length);
if (parsed.connections.length > 0) {
    console.log("  - " + parsed.connections[0].source + " -> " + parsed.connections[0].target);
}

if (tMap && tMap.rawNodeData && tOutput && parsed.connections.length > 0) {
    console.log("\n✅ MAESTRÍA AL 100% CONFIRMADA: Generación y Lectura son consistentes.");
} else {
    console.log("\n❌ ERROR: Algún componente o metadato se perdió en el ciclo.");
    process.exit(1);
}
