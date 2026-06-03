import { TalendStudioBridgeClient } from "../src/talend/studio/bridge-client";
import { existsSync } from "node:fs";

const olistPath = "/Applications/TalendStudio-8.0.1/studio/workspace/aliware-calidad-1916860628/ALIWARECALIDAD/process/JOB_perfilado_olist_0.1.item";
const expertPath = "/Applications/TalendStudio-8.0.1/studio/workspace/aliware-calidad-1916860628/ALIWARECALIDAD/process/automation/experts/ExpertFlowControl_0.1.item";
const apiPath = "/Applications/TalendStudio-8.0.1/studio/workspace/aliware-calidad-1916860628/ALIWARECALIDAD/process/automation/experts/api/Expert_API_to_DB_0.1.item";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("Connecting to Talend Studio Bridge...");
  const client = await TalendStudioBridgeClient.create({
    config: { timeoutMs: 15000 } as any
  });

  // 1. Close all open editors in Talend Studio
  console.log("\n1. Closing all open editors to clear editor cache...");
  const closeAll = await client.executeCommand("org.eclipse.ui.file.closeAll", false);
  console.log("Result:", JSON.stringify(closeAll));
  await sleep(2000);

  // 2. Open JOB_perfilado_olist
  console.log("\n2. Opening JOB_perfilado_olist...");
  const openOlistResult = await client.openResource(olistPath);
  console.log("Result:", JSON.stringify(openOlistResult));
  await sleep(4000);

  // 3. Open Expert_API_to_DB
  console.log("\n3. Opening Expert_API_to_DB...");
  const openApiResult = await client.openResource(apiPath);
  console.log("Result:", JSON.stringify(openApiResult));
  await sleep(4000);

  // 4. Open ExpertFlowControl
  console.log("\n4. Opening ExpertFlowControl...");
  const openExpertResult = await client.openResource(expertPath);
  console.log("Result:", JSON.stringify(openExpertResult));
  await sleep(4000);

  // 5. Check problem markers
  console.log("\n5. Checking compiler markers...");
  const markersResult = await client.problemsMarkers();
  if (markersResult.ok) {
    const markers = (markersResult.data as any).markers || [];
    const errors = markers.filter((m: any) => m.severity === "ERROR" || m.severity === 2);
    console.log(`Total compiler errors remaining: ${errors.length}`);
    for (const err of errors) {
      console.log(`- [${err.resource}] ${err.message}`);
    }
  } else {
    console.error("Failed to check markers:", markersResult.error);
  }

  // 6. Run ExpertFlowControl!
  console.log("\n6. Running ExpertFlowControl...");
  const runResult = await client.executeCommand("org.talend.common.runTalendElement", false);
  console.log("Execution trigger result:", JSON.stringify(runResult));
  
  console.log("Waiting 10 seconds for execution/compilation to proceed...");
  await sleep(10000);

  // 7. Check if ExpertFlowControl Java class was generated/compiled
  const classPath = "/Applications/TalendStudio-8.0.1/studio/workspace/aliware-calidad-1916860628/ALIWARECALIDAD/poms/jobs/process/automation/experts/expertflowcontrol_0.1/target/classes/aliwarecalidad/expertflowcontrol_0_1/ExpertFlowControl.class";
  console.log(`\n7. Checking if ExpertFlowControl.class exists at ${classPath}...`);
  if (existsSync(classPath)) {
    console.log("SUCCESS: ExpertFlowControl.class exists!");
  } else {
    console.log("WARNING: ExpertFlowControl.class does not exist yet.");
  }
}

main().catch(console.error);
