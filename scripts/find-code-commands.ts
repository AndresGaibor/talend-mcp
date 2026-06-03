import { TalendStudioBridgeClient } from "../src/talend/studio/bridge-client";

async function main() {
  const client = await TalendStudioBridgeClient.create();
  const res = await client.commandsList();
  if (!res.ok || !res.data?.commands) {
    console.error("Failed to get commands list:", res.error);
    return;
  }
  const matching = res.data.commands.filter((c: any) => 
    (c.id && (c.id.toLowerCase().includes("generate") || c.id.toLowerCase().includes("build") || c.id.toLowerCase().includes("compile"))) || 
    (c.name && (c.name.toLowerCase().includes("generate") || c.name.toLowerCase().includes("build") || c.name.toLowerCase().includes("compile")))
  );
  console.log(`Found ${matching.length} matching commands:`);
  console.log(JSON.stringify(matching, null, 2));
}

main().catch(console.error);
