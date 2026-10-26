import type { z } from "zod/v4";
import { isPlainJsonSchema, isZodSchema } from "./schema-guards";

function sanitizeSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) {
    return schema.map(sanitizeSchema);
  }
  if (schema && typeof schema === "object") {
    const obj = schema as Record<string, unknown>;
    const res: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (key === "$schema" || key === "propertyNames") {
        continue;
      }
      res[key] = sanitizeSchema(val);
    }
    return res;
  }
  return schema;
}

function removeDefaultedRequiredFields(schema: unknown): unknown {
  if (Array.isArray(schema)) {
    return schema.map(removeDefaultedRequiredFields);
  }

  if (!schema || typeof schema !== "object") {
    return schema;
  }

  const obj = schema as Record<string, unknown>;
  const cloned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    cloned[key] = removeDefaultedRequiredFields(value);
  }

  if (
    cloned.type === "object" &&
    cloned.properties &&
    typeof cloned.properties === "object" &&
    Array.isArray(cloned.required)
  ) {
    const properties = cloned.properties as Record<string, Record<string, unknown>>;

    cloned.required = cloned.required.filter((field) => {
      const prop = properties[String(field)];
      return prop?.default === undefined;
    });
  }

  return cloned;
}

export function convertInputSchema(schema: unknown): unknown {
  let result: unknown;
  if (isZodSchema(schema)) {
    try {
      result = (schema as z.ZodType<unknown>).toJSONSchema();
    } catch {
      result = schema;
    }
  } else if (schema && typeof schema === "object" && "~standard" in schema) {
    try {
      const std = (schema as any)["~standard"];
      if (std && std.jsonSchema && typeof std.jsonSchema.input === "function") {
        result = std.jsonSchema.input();
      } else {
        result = schema;
      }
    } catch {
      result = schema;
    }
  } else if (isPlainJsonSchema(schema)) {
    result = schema;
  } else {
    result = schema;
  }
  return removeDefaultedRequiredFields(sanitizeSchema(result));
}
