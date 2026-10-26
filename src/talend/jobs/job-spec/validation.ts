import type { JobSpec as GeneratorJobSpec } from "../../job-generator";

export function validateGeneratorSpec(spec: GeneratorJobSpec): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!spec.jobName || spec.jobName.trim() === "") {
    errors.push("jobName is required");
  }

  if (!spec.components || spec.components.length === 0) {
    errors.push("At least one component is required");
  }

  const uniqueNames = new Set<string>();
  for (const comp of spec.components) {
    if (!comp.uniqueName) {
      errors.push(`Component missing uniqueName`);
    } else if (uniqueNames.has(comp.uniqueName)) {
      errors.push(`Duplicate uniqueName: ${comp.uniqueName}`);
    } else {
      uniqueNames.add(comp.uniqueName);
    }
  }

  for (const conn of spec.connections ?? []) {
    if (!uniqueNames.has(conn.source)) {
      errors.push(`Connection source not found: ${conn.source}`);
    }
    if (!uniqueNames.has(conn.target)) {
      errors.push(`Connection target not found: ${conn.target}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
