import { TalendStudioBridgeClient } from "../src/talend/studio/bridge-client";

async function main() {
  console.log("Connecting to Talend Studio Bridge...");
  const client = await TalendStudioBridgeClient.create();

  console.log("\n--- PING ---");
  const ping = await client.ping();
  console.log(JSON.stringify(ping, null, 2));

  if (!ping.ok) {
    console.error("Bridge is not accessible. Make sure Talend Studio is open and the plugin is running.");
    process.exit(1);
  }

  console.log("\n--- ACTIVE JOB MODEL ---");
  const activeJob = await client.activeJobModel();
  console.log(JSON.stringify(activeJob, null, 2));

  console.log("\n--- WORKBENCH STATE ---");
  const state = await client.workbenchState();
  console.log(JSON.stringify(state, null, 2));

  console.log("\n--- PROBLEMS MARKERS ---");
  const markers = await client.problemsMarkers();
  console.log(JSON.stringify(markers, null, 2));
}

main().catch(console.error);
