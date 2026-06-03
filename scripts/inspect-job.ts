import { readFileSync } from "node:fs";
import { parseJobItem } from "../src/talend/job-parser";

const itemPath = "/Applications/TalendStudio-8.0.1/studio/workspace/aliware-calidad-1916860628/ALIWARECALIDAD/process/JOB_perfilado_olist_0.1.item";
const xml = readFileSync(itemPath, "utf8");
const parsed = parseJobItem(xml, "JOB_perfilado_olist_0.1.item");

console.log("=== JOB COMPONENTS ===");
for (const c of parsed.components) {
  console.log(`- ${c.uniqueName} (${c.componentName})`);
}

console.log("\n=== JOB CONNECTIONS ===");
for (const conn of parsed.connections) {
  console.log(`- ${conn.label}: ${conn.source} -> ${conn.target} (${conn.connectorName})`);
}
