export interface NewServerOptions {
  port?: number;
  host?: string;
  /** Tope del cuerpo de una peticion. Por defecto, `TALEND_MCP_MAX_BODY_BYTES`. */
  maxBodyBytes?: number;
  /** Plazo de una tool. Por defecto, `TALEND_MCP_TOOL_TIMEOUT_MS`. */
  toolTimeoutMs?: number;
  /** Tools simultaneas. Por defecto, `TALEND_MCP_MAX_CONCURRENT_CALLS`. */
  maxConcurrentCalls?: number;
}

export interface NewServerHandle {
  localUrl: string;
  close(): Promise<void>;
}
