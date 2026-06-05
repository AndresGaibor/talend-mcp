export type ComponentConnector = {
  name: string;
  type:
    | "FLOW_MAIN"
    | "ITERATE"
    | "ON_COMPONENT_OK"
    | "ON_COMPONENT_ERROR"
    | "RUN_IF"
    | "LOOKUP"
    | "REJECT"
    | "UNKNOWN";
  direction: "input" | "output";
  required?: boolean;
  maxConnections?: number;
};
