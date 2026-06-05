import { execSync } from "node:child_process";
import { TalendStudioBridgeClient } from "../../../src/talend/studio/bridge-client";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("Locating Talend Studio process...");
  let pid: string | null = null;
  try {
    const psOut = execSync("ps aux | grep -i Talend-Studio-macosx-cocoa", { encoding: "utf8" });
    const lines = psOut.split("\n");
    for (const line of lines) {
      if (line.includes("Talend-Studio-macosx-cocoa") && !line.includes("grep")) {
        const parts = line.trim().split(/\s+/);
        if (parts.length > 1 && parts[1]) {
          pid = parts[1];
          break;
        }
      }
    }
  } catch (err) {
    console.log("Talend Studio is not running.");
  }

  if (pid) {
    console.log(`Killing Talend Studio process with PID: ${pid}...`);
    try {
      execSync(`kill ${pid}`);
      // Wait for process to fully terminate
      await sleep(3000);
    } catch (e) {
      console.error("Failed to kill Talend Studio process:", e);
    }
  }

  console.log("Launching Talend Studio...");
  try {
    execSync("open -a /Applications/TalendStudio-8.0.1/studio/Talend-Studio-macosx-cocoa-aarch64.app");
  } catch (err) {
    console.error("Failed to launch Talend Studio:", err);
    process.exit(1);
  }

  console.log("Waiting for Talend Studio Bridge to become online...");
  const client = await TalendStudioBridgeClient.create();
  
  // Poll for up to 90 seconds
  for (let i = 1; i <= 30; i++) {
    await sleep(3000);
    console.log(`Ping attempt ${i}/30...`);
    const ping = await client.ping();
    if (ping.ok) {
      console.log("Talend Studio Bridge is ONLINE!");
      process.exit(0);
    }
  }

  console.error("Timeout: Talend Studio Bridge did not come online after 90 seconds.");
  process.exit(1);
}

main().catch(console.error);
