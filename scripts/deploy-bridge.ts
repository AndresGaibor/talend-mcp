import { copyFileSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

function getStudioPath(): string {
  const envPath = process.env.TALEND_STUDIO_PATH;
  if (envPath && existsSync(envPath)) return envPath;

  const candidates = [
    "/Applications/TalendStudio-8.0.1/studio",
    `${process.env.HOME ?? ""}/TalendStudio/studio`.trim(),
  ];

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate;
  }

  return "/Applications/TalendStudio-8.0.1/studio";
}

function getBundlesInfoPath(): string {
  const envPath = process.env.TALEND_BUNDLES_INFO_PATH;
  if (envPath && existsSync(envPath)) return envPath;
  return join(getStudioPath(), "configuration", "org.eclipse.equinox.simpleconfigurator", "bundles.info");
}

const targetJar = "talend-studio-bridge/com.andres.talend.bridge.repository/target/repository/plugins/com.andres.talend.bridge_0.1.0.202606031644.jar";
const pluginsDir = join(getStudioPath(), "plugins");
const bundlesInfoPath = getBundlesInfoPath();

async function main() {
  console.log(`Copying ${targetJar} to ${pluginsDir}...`);
  const destJarName = "com.andres.talend.bridge_0.1.0.202606031644.jar";
  const destPath = join(pluginsDir, destJarName);
  copyFileSync(targetJar, destPath);
  console.log(`Copied successfully to ${destPath}`);

  console.log(`Updating ${bundlesInfoPath}...`);
  let content = readFileSync(bundlesInfoPath, "utf8");
  
  // Search for the line containing com.andres.talend.bridge
  const lines = content.split("\n");
  let updated = false;
  const newLine = "com.andres.talend.bridge,0.1.0.202606031644,plugins/com.andres.talend.bridge_0.1.0.202606031644.jar,4,true";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line && line.includes("com.andres.talend.bridge")) {
      console.log(`Found old line: ${line}`);
      lines[i] = newLine;
      updated = true;
      break;
    }
  }

  if (!updated) {
    console.log("No existing bridge line found. Appending to end of file...");
    lines.push(newLine);
  }

  writeFileSync(bundlesInfoPath, lines.join("\n"), "utf8");
  console.log("Updated bundles.info successfully.");
}

main().catch(console.error);
