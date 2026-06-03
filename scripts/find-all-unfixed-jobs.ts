import { readdirSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const projectDir = "/Applications/TalendStudio-8.0.1/studio/workspace/aliware-calidad-1916860628/ALIWARECALIDAD";

function scanDirectory(dir: string, filesList: string[] = []) {
  const files = readdirSync(dir);
  for (const file of files) {
    const fullPath = join(dir, file);
    if (statSync(fullPath).isDirectory()) {
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

  const missingJobs: string[] = [];
  for (const itemPath of itemFiles) {
    const content = readFileSync(itemPath, "utf8");
    // Only process Talend Job files (ProcessType)
    if (content.includes("<talendfile:ProcessType") || content.includes(":ProcessType")) {
      if (!content.includes("<parameters>") && !content.includes("<parameters/>")) {
        missingJobs.push(itemPath);
      }
    }
  }

  console.log(`\nFound ${missingJobs.length} Job process files missing <parameters>:`);
  for (const path of missingJobs) {
    console.log(`- ${path.replace(projectDir, "")}`);
  }

  if (missingJobs.length > 0) {
    console.log("\nFixing missing parameters in these Job files...");
    for (const path of missingJobs) {
      let content = readFileSync(path, "utf8");
      
      // Find the end of the root <talendfile:ProcessType ... > tag
      // This works even if the tag is multi-line
      const processTypeIndex = content.indexOf("ProcessType");
      if (processTypeIndex !== -1) {
        const rootTagEndIndex = content.indexOf(">", processTypeIndex);
        if (rootTagEndIndex !== -1) {
          const index = rootTagEndIndex + 1;
          const newContent = content.slice(0, index) + "\n  <parameters/>" + content.slice(index);
          writeFileSync(path, newContent, "utf8");
          console.log(`Fixed: ${path.replace(projectDir, "")}`);
        } else {
          console.log(`Error: Could not find closing '>' of root tag in ${path.replace(projectDir, "")}`);
        }
      } else {
        console.log(`Error: Could not find 'ProcessType' in ${path.replace(projectDir, "")}`);
      }
    }
    console.log("\nAll Job files fixed successfully!");
  } else {
    console.log("\nNo Job files are missing <parameters>.");
  }
}

main().catch(console.error);
