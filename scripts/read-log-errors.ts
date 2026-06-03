import { readFileSync, existsSync } from "node:fs";

const logPath = "/Applications/TalendStudio-8.0.1/studio/workspace/.metadata/.log";

async function main() {
  if (!existsSync(logPath)) {
    console.error("Log file does not exist.");
    return;
  }
  const content = readFileSync(logPath, "utf8");
  const lines = content.split("\n");
  console.log("Last 150 lines of .metadata/.log:");
  console.log(lines.slice(-150).join("\n"));
}

main().catch(console.error);
