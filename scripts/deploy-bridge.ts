import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const targetJar = "talend-studio-bridge/com.andres.talend.bridge.repository/target/repository/plugins/com.andres.talend.bridge_0.1.0.202606030558.jar";
const pluginsDir = "/Applications/TalendStudio-8.0.1/studio/plugins";
const bundlesInfoPath = "/Applications/TalendStudio-8.0.1/studio/configuration/org.eclipse.equinox.simpleconfigurator/bundles.info";

async function main() {
  console.log(`Copying ${targetJar} to ${pluginsDir}...`);
  const destJarName = "com.andres.talend.bridge_0.1.0.202606030558.jar";
  const destPath = join(pluginsDir, destJarName);
  copyFileSync(targetJar, destPath);
  console.log(`Copied successfully to ${destPath}`);

  console.log(`Updating ${bundlesInfoPath}...`);
  let content = readFileSync(bundlesInfoPath, "utf8");
  
  // Search for the line containing com.andres.talend.bridge
  const lines = content.split("\n");
  let updated = false;
  const newLine = "com.andres.talend.bridge,0.1.0.202606030558,plugins/com.andres.talend.bridge_0.1.0.202606030558.jar,4,true";

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("com.andres.talend.bridge")) {
      console.log(`Found old line: ${lines[i]}`);
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
