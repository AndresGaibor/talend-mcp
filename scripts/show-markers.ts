import { TalendStudioBridgeClient } from "../src/talend/studio/bridge-client";

async function main() {
  const client = await TalendStudioBridgeClient.create();
  const markersResult = await client.problemsMarkers();
  if (!markersResult.ok) {
    console.error("Failed to get markers:", markersResult.error);
    return;
  }
  const data = markersResult.data as any;
  if (!data || !data.markers) {
    console.log("No markers key in response:", data);
    return;
  }

  const markers = data.markers;
  console.log(`Total markers found: ${markers.length}`);
  
  const errors = markers.filter((m: any) => m.severity === "ERROR" || m.severity === 2);
  const warnings = markers.filter((m: any) => m.severity === "WARNING" || m.severity === 1);

  console.log(`\n--- ERRORS (${errors.length}) ---`);
  for (const err of errors) {
    console.log(`- [${err.type || "Error"}] ${err.message}`);
    console.log(`  Resource: ${err.resource || "unknown"} (Line: ${err.lineNumber || "unknown"})`);
  }

  console.log(`\n--- WARNINGS (${warnings.length}) ---`);
  for (const warn of warnings) {
    console.log(`- [${warn.type || "Warning"}] ${warn.message}`);
    console.log(`  Resource: ${warn.resource || "unknown"} (Line: ${warn.lineNumber || "unknown"})`);
  }
}

main().catch(console.error);
