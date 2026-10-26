/** Facade del registro de tools de job-spec; preserva su orden original. */
import { jobSpecValidationTools } from "./tools-job-spec/validation";
import { jobSpecGenerationTools } from "./tools-job-spec/generation";
import { jobSpecApplyTools } from "./tools-job-spec/apply";
import { jobSpecCustomTools } from "./tools-job-spec/custom";

export const jobSpecTools = [
  ...jobSpecValidationTools,
  ...jobSpecGenerationTools,
  ...jobSpecApplyTools,
  ...jobSpecCustomTools,
];
