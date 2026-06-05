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
        defaultSpec: {
          name: "csv_ingestion_job",
          version: "0.1",
          stages: [
            {
              id: "stage_1",
              name: "Load CSV",
              components: [
                {
                  id: "tFileInputDelimited_1",
                  name: "CSV Input",
                  type: "tFileInputDelimited",
                  configuration: {
                    FILENAME: '"/path/to/input.csv"',
                    ROWSEPARATOR: '"\\n"',
                    FIELDSEPARATOR: '";"',
                  },
                },
                {
                  id: "tDBOutput_1",
                  name: "DB Output",
                  type: "tDBOutput",
                  configuration: {
                    TABLE: '"users"',
                    ACTION_ON_DATA: '"INSERT"',
                  },
                },
              ],
              connections: [
                {
                  id: "row1",
                  sourceComponentId: "tFileInputDelimited_1",
                  targetComponentId: "tDBOutput_1",
                },
              ],
            },
          ],
        },
      },
      {
        id: "api-to-json",
        name: "REST API to JSON File",
        description: "Fetch data from an API and save it as JSON files.",
        defaultSpec: {
          name: "api_to_json_job",
          version: "0.1",
          stages: [
            {
              id: "stage_1",
              name: "Fetch API",
              components: [
                {
                  id: "tRESTClient_1",
                  name: "API Request",
                  type: "tRESTClient",
                  configuration: {
                    URL: '"https://api.example.com/data"',
                    METHOD: '"GET"',
                  },
                },
                {
                  id: "tFileOutputJSON_1",
                  name: "JSON Output",
                  type: "tFileOutputJSON",
                  configuration: {
                    FILENAME: '"/path/to/output.json"',
                  },
                },
              ],
              connections: [
                {
                  id: "row1",
                  sourceComponentId: "tRESTClient_1",
                  targetComponentId: "tFileOutputJSON_1",
                },
              ],
            },
          ],
        },
      },
      {
        id: "data-masking",
        name: "PII Data Masking",
        description: "Read sensitive data and apply masking transformations before storage.",
        defaultSpec: {
          name: "pii_data_masking_job",
          version: "0.1",
          stages: [
            {
              id: "stage_1",
              name: "Mask Data",
              components: [
                {
                  id: "tFileInputDelimited_1",
                  name: "CSV Input",
                  type: "tFileInputDelimited",
                  configuration: {
                    FILENAME: '"/path/to/sensitive.csv"',
                  },
                },
                {
                  id: "tDataMasking_1",
                  name: "Masking Transform",
                  type: "tDataMasking",
                  configuration: {
                    METHOD: '"MD5"',
                  },
                },
                {
                  id: "tDBOutput_1",
                  name: "DB Output",
                  type: "tDBOutput",
                  configuration: {
                    TABLE: '"masked_users"',
                  },
                },
              ],
              connections: [
                {
                  id: "row1",
                  sourceComponentId: "tFileInputDelimited_1",
                  targetComponentId: "tDataMasking_1",
                },
                {
                  id: "row2",
                  sourceComponentId: "tDataMasking_1",
                  targetComponentId: "tDBOutput_1",
                },
              ],
            },
          ],
        },
      },
    ];
    return {
      content: [{ type: "text", text: JSON.stringify(patterns, null, 2) }],
      structuredContent: patterns,
      isError: false,
    };
  },
};
