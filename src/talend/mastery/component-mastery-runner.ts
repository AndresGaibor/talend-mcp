// Fachada de maestria por componente. La implementacion vive en ./components/.
export { getComponentMastery, saveComponentMastery, getAllMastery } from "./components/persistence";
export { discoverComponent } from "./components/discovery";
export { validateTemplateGeneration, validateRoundTrip } from "./components/validation";
export {
  markOpensInStudio,
  markCompilesWithoutProblems,
  markRunsInStudio,
  markHandlesErrors,
  markSafeEditingSupported,
  markAutomationValidated,
} from "./components/markers";
export { generateMasteryReport } from "./components/report";
export { masteryComponent } from "./components/component-evaluation";
export { masteryAllComponents, masteryGenerateFixture } from "./components/fixtures";
