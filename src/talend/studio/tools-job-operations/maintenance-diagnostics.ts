/** Tools de jobOperationsTools: maintenance-diagnostics. */
import * as z from "zod/v4";

import { bridgeOk, loadBridge } from "../tools-base";

import { columnSchema, componentSpecShape, parameterSchema } from "../tools-job-operation-schemas";

import { jobContextTools } from "../tools-job-contexts";

import { studioMaintenanceTools } from "../tools-studio-maintenance";

import { jobDiagnosticsTools } from "../tools-job-diagnostics";

import { componentCatalogTools } from "../tools-component-catalog";

import { nodeConnectionTools } from "../tools-node-connection";
export const maintenanceDiagnostics = [
...studioMaintenanceTools,
...jobDiagnosticsTools
];
