import { z } from "zod/v4";

const column = z.strictObject({ name: z.string().min(1), type: z.string().min(1), length: z.number().optional(), precision: z.number().optional(), nullable: z.boolean().optional(), key: z.boolean().optional(), sourceType: z.string().optional(), pattern: z.string().optional() });
const schema = z.strictObject({ name: z.string().min(1), connector: z.string().optional(), columns: z.array(column) });
export const customComponentSchema = z.strictObject({
  uniqueName: z.string().regex(/^[A-Za-z_]\w*$/), componentName: z.string().regex(/^t[A-Za-z0-9_]+$/),
  posX: z.number().finite().optional(), posY: z.number().finite().optional(), label: z.string().optional(),
  parameters: z.record(z.string(), z.string()).optional(), schema: schema.optional(),
  tables: z.record(z.string(), z.object({ columns: z.array(z.string()).optional(), rows: z.array(z.union([z.array(z.string()), z.record(z.string(), z.string())])) })).optional(),
  mapper: z.record(z.string(), z.unknown()).optional(), draftOnly: z.boolean().optional(), draftReason: z.string().optional(),
});
const connection = z.strictObject({ source: z.string(), target: z.string(), label: z.string(), connectorName: z.string().optional(), metaname: z.string().optional(), uniqueName: z.string().optional() });
const context = z.strictObject({ name: z.string().regex(/^[A-Za-z_]\w*$/), type: z.string(), value: z.string(), comment: z.string().optional() });
export type CustomJobSpec = {
  jobName: string; version?: string; defaultContext?: string; folderPath?: string;
  description?: string; purpose?: string; components: z.infer<typeof customComponentSchema>[];
  connections?: z.infer<typeof connection>[]; contexts?: z.infer<typeof context>[];
  childJobs?: CustomJobSpec[]; instructions?: Record<string, unknown>; replaceManagedTodoContexts?: boolean;
};
export const customJobSpecSchema: z.ZodType<CustomJobSpec> = z.strictObject({
  jobName: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/), version: z.string().regex(/^\d+\.\d+$/).optional(),
  defaultContext: z.string().min(1).optional(), folderPath: z.string().optional(), description: z.string().optional(), purpose: z.string().optional(),
  components: z.array(customComponentSchema).max(2000), connections: z.array(connection).max(4000).optional(), contexts: z.array(context).max(2000).optional(),
  childJobs: z.lazy(() => z.array(customJobSpecSchema).max(100)).optional(), instructions: z.record(z.string(), z.unknown()).optional(), replaceManagedTodoContexts: z.boolean().optional(),
});
