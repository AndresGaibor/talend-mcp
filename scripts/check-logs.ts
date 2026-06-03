import { readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const workspaceDir = "/Applications/TalendStudio-8.0.1/studio/workspace";

async function main() {
  console.log(`Scanning workspace at ${workspaceDir} for logs...`);
  
  // 1. Search for a 'logs' directory
  const logsDir = join(workspaceDir, "logs");
  if (existsSync(logsDir)) {
    console.log(`Found logs directory at ${logsDir}. Listing recent files:`);
    const files = readdirSync(logsDir).map(name => {
      const p = join(logsDir, name);
      const stat = statSync(p);
      return { name, modified: stat.mtime, size: stat.size };
    });
    // Sort by modified desc
    files.sort((a, b) => b.modified.getTime() - a.modified.getTime());
    for (const f of files.slice(0, 10)) {
      console.log(`- ${f.name} (Modified: ${f.modified.toISOString()}, Size: ${f.size} bytes)`);
    }
  } else {
    console.log("No logs directory found.");
  }

  // 2. Look for any log files in metadata or other locations
  const metadataLog = join(workspaceDir, ".metadata", ".log");
  if (existsSync(metadataLog)) {
    const stat = statSync(metadataLog);
    console.log(`Found .metadata/.log (Modified: ${stat.mtime.toISOString()}, Size: ${stat.size} bytes)`);
    
    // Let's read the last 50 lines of .metadata/.log
    const content = require("node:fs").readFileSync(metadataLog, "utf8");
    const lines = content.split("\n");
    console.log("\nLast 30 lines of .metadata/.log:");
    console.log(lines.slice(-30).join("\n"));
  }
}

main().catch(console.error);
