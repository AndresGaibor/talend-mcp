/** Fachada de bridgeTools; conserva el orden publico de registro. */
import { coreConnectivity } from "./tools-bridge/core-connectivity";
import { coreWorkbench } from "./tools-bridge/core-workbench";
import { events } from "./tools-bridge/events";
import { workbenchActions } from "./tools-bridge/workbench-actions";
import { launchEditorsInspection } from "./tools-bridge/launch-editors-inspection";
import { schemasSelection } from "./tools-bridge/schemas-selection";
export const bridgeTools = [...coreConnectivity, ...coreWorkbench, ...events, ...workbenchActions, ...launchEditorsInspection, ...schemasSelection];
