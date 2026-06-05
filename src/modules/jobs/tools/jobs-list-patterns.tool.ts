import { okResult } from "../../../presentation/tools/common/result";

export const talendJobsListPatternsTool = {
  name: "talend_jobs_list_patterns",
  description: "Lista los patrones de pipeline disponibles para el editor de especificaciones.",
  inputSchema: { type: "object", properties: {} },
  handler: async () => {
    const patterns = [
      {
        id: "ingestion-csv-to-db",
        name: "CSV Ingestion to Database",
        description: "Standard pattern to read CSV files and load them into a database table.",
      },
      {
        id: "api-to-json",
        name: "REST API to JSON File",
        description: "Fetch data from an API and save it as JSON files.",
      },
      {
        id: "data-masking",
        name: "PII Data Masking",
        description: "Read sensitive data and apply masking transformations before storage.",
      },
    ];
    return {
      content: [{ type: "text", text: JSON.stringify(patterns, null, 2) }],
      structuredContent: patterns,
      isError: false,
    };
  },
};
