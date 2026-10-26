/** Fachada de jobOperationsTools; conserva el orden publico de registro. */
import { jobLifecycle } from "./tools-job-operations/job-lifecycle";
import { nodesCreateConfigure } from "./tools-job-operations/nodes-create-configure";
import { connectionsContexts } from "./tools-job-operations/connections-contexts";
import { nodeEditing } from "./tools-job-operations/node-editing";
import { maintenanceDiagnostics } from "./tools-job-operations/maintenance-diagnostics";
import { catalog } from "./tools-job-operations/catalog";
import { studioUtilities } from "./tools-job-operations/studio-utilities";
import { studioUiInventory } from "./tools-job-operations/studio-ui-inventory";
import { studioUiDialogs } from "./tools-job-operations/studio-ui-dialogs";
export const jobOperationsTools = [...jobLifecycle, ...nodesCreateConfigure, ...connectionsContexts, ...nodeEditing, ...maintenanceDiagnostics, ...catalog, ...studioUtilities, ...studioUiInventory, ...studioUiDialogs];
