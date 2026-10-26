export type TalendJobSpec = {
  name: string;
  version: string;
  folder?: string;
  description?: string;
  components: Array<{
    id: string;
    type: string;
    label?: string;
    position?: { x: number; y: number };
    parameters?: Record<string, string | { value: string; field?: string }>;
    schema?: Array<{
      name: string;
      type: string;
      nullable?: boolean;
      length?: number;
      precision?: number;
    }>;
  }>;
  connections: Array<{
    name: string;
    source: string;
    target: string;
    type: "FLOW" | "ITERATE" | "REJECT" | "LOOKUP";
    label?: string;
  }>;
  contexts?: Record<string, Record<string, string>>;
};

export type CreateJobFromSpecResult = {
  ok: boolean;
  jobName: string;
  folderPath: string;
  itemPath: string | null;
  propertiesPath: string | null;
  errors: string[];
};
