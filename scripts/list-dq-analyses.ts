import { listDQAnalyses, formatDQAnalysesDetails } from "../src/talend/dq-analysis";
import { getConfiguredProjectPath } from "../src/talend/workspace";

const projectPath = getConfiguredProjectPath();

if (!projectPath) {
  console.log("NO_DETECTED");
  process.exit(1);
}

const analyses = listDQAnalyses(projectPath);
console.log(formatDQAnalysesDetails(analyses));
