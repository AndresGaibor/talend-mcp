/** Facade del catalogo de tools de mastery; conserva el orden de registro. */
import { masteryDiscoveryTools } from "./tools-mastery/discovery";
import { masteryReportTools } from "./tools-mastery/report";
import { masteryFixtureTools } from "./tools-mastery/fixtures";
import { masteryValidationTools } from "./tools-mastery/validation";
import { masteryLevelTools } from "./tools-mastery/mastery-levels";

export const masteryTools = [
  ...masteryDiscoveryTools,
  ...masteryReportTools,
  ...masteryFixtureTools,
  ...masteryValidationTools,
  ...masteryLevelTools,
];
