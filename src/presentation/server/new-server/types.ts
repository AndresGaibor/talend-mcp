export interface NewServerOptions {
  port?: number;
  host?: string;
}

export interface NewServerHandle {
  localUrl: string;
  close(): Promise<void>;
}
