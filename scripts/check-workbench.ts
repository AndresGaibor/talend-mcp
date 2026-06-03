import { TalendStudioBridgeClient } from "../src/talend/studio/bridge-client";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const client = await TalendStudioBridgeClient.create();
  console.log("Polling workbench state...");
  
  for (let i = 1; i <= 20; i++) {
    const res = await client.workbenchState();
    if (res.ok && res.data?.windows && res.data.windows.length > 0) {
      const activePage = res.data.windows[0].activePage;
      if (activePage) {
        console.log("SUCCESS: Workbench is fully initialized and active!");
        console.log(JSON.stringify(res.data, null, 2));
        process.exit(0);
      }
    }
    console.log(`Attempt ${i}/20: Workbench not ready yet. Waiting 3 seconds...`);
    await sleep(3000);
  }

  console.error("Timeout: Workbench did not initialize in time.");
  process.exit(1);
}

main().catch(console.error);
