import { TalendStudioBridgeClient } from "../src/talend/studio/bridge-client";
import { existsSync } from "node:fs";

const classPath = "/Applications/TalendStudio-8.0.1/studio/workspace/aliware-calidad-1916860628/ALIWARECALIDAD/poms/jobs/process/automation/experts/expertflowcontrol_0.1/target/classes/aliwarecalidad/expertflowcontrol_0_1/ExpertFlowControl.class";

async function main() {
  console.log("Checking if ExpertFlowControl.class exists...");
  if (existsSync(classPath)) {
    console.log("SUCCESS: ExpertFlowControl.class exists!");
  } else {
    console.log("WARNING: ExpertFlowControl.class does not exist yet.");
  }

  // Increase bridge timeout to 15 seconds to prevent timeouts
  const client = await TalendStudioBridgeClient.create({
    config: { timeoutMs: 15000 } as any
  });

  console.log("Checking compiler markers...");
  const markersResult = await client.problemsMarkers();
  if (markersResult.ok) {
    const markers = (markersResult.data as any).markers || [];
    const errors = markers.filter((m: any) => m.severity === "ERROR" || m.severity === 2);
    console.log(`Total errors: ${errors.length}`);
    for (const err of errors) {
      console.log(`- [${err.resource}] ${err.message}`);
    }
  } else {
    console.error("Failed to check markers:", markersResult.error);
  }

  console.log("Checking active editor...");
  const state = await client.workbenchState();
  if (state.ok && state.data?.windows) {
    console.log("Active Editor:", JSON.stringify(state.data.windows[0].activeEditor));
  }
}

main().catch(console.error);
