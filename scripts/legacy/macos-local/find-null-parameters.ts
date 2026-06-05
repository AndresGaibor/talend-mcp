import { readdirSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const projectDir = "/Applications/TalendStudio-8.0.1/studio/workspace/aliware-calidad-1916860628/ALIWARECALIDAD";

function scanDirectory(dir: string, filesList: string[] = []) {
  const files = readdirSync(dir);
  for (const file of files) {
    const fullPath = join(dir, file);
    if (statSync(fullPath).isDirectory()) {
      // Exclude poms and temp directories
      if (file !== "poms" && file !== ".settings" && file !== "metadata" && file !== "temp") {
        scanDirectory(fullPath, filesList);
      }
    } else if (file.endsWith(".item")) {
      filesList.push(fullPath);
    }
  }
  return filesList;
}

async function main() {
  console.log(`Scanning project directory ${projectDir} for .item files...`);
  const itemFiles = scanDirectory(projectDir);
  console.log(`Found ${itemFiles.length} item files.`);

  const missingParameters: string[] = [];
  for (const itemPath of itemFiles) {
    const content = readFileSync(itemPath, "utf8");
    if (!content.includes("<parameters>") && !content.includes("<parameters/>")) {
      missingParameters.push(itemPath);
    }
  }

  console.log(`\nFound ${missingParameters.length} files missing <parameters>:`);
  for (const path of missingParameters) {
    console.log(`- ${path.replace(projectDir, "")}`);
  }

  if (missingParameters.length > 0) {
    console.log("\nFixing missing parameters in these files...");
    for (const path of missingParameters) {
      let content = readFileSync(path, "utf8");
      // Find the position after </context>
      const contextEndTag = "</context>";
      if (content.includes(contextEndTag)) {
        const index = content.indexOf(contextEndTag) + contextEndTag.length;
        const newContent = content.slice(0, index) + "\n  <parameters/>" + content.slice(index);
        writeFileSync(path, newContent, "utf8");
        console.log(`Fixed: ${path.replace(projectDir, "")}`);
      } else {
        console.log(`Warning: Could not find </context> in ${path.replace(projectDir, "")}`);
      }
    }
    console.log("\nAll files fixed successfully!");
  } else {
    console.log("\nNo files are missing <parameters>.");
  }
}

main().catch(console.error);
