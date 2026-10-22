export function validateJobSpec(spec: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!spec || typeof spec !== "object") {
    return { valid: false, errors: ["Spec must be an object"] };
  }

  const value = spec as Record<string, unknown>;

  if (typeof value.jobName !== "string" || value.jobName.length === 0) {
    errors.push("jobName is required and must be a non-empty string");
  }

  if (!Array.isArray(value.components)) {
    errors.push("components is required and must be an array");
  } else {
    const uniqueNames = new Set<string>();
    for (let index = 0; index < value.components.length; index++) {
      const component = value.components[index] as Record<string, unknown>;
      if (typeof component.uniqueName !== "string") {
        errors.push(`components[${index}].uniqueName is required`);
      }
      if (typeof component.componentName !== "string") {
        errors.push(`components[${index}].componentName is required`);
      }
      if (typeof component.uniqueName === "string" && uniqueNames.has(component.uniqueName)) {
        errors.push(`Duplicate uniqueName: ${component.uniqueName}`);
      }
      if (typeof component.uniqueName === "string") uniqueNames.add(component.uniqueName);
    }
  }

  if (Array.isArray(value.connections)) {
    const uniqueNames = new Set<string>();
    for (let index = 0; index < value.connections.length; index++) {
      const connection = value.connections[index] as Record<string, unknown>;
      if (typeof connection.source !== "string") {
        errors.push(`connections[${index}].source is required`);
      }
      if (typeof connection.target !== "string") {
        errors.push(`connections[${index}].target is required`);
      }
      if (typeof connection.label !== "string") {
        errors.push(`connections[${index}].label is required`);
      }
      if (typeof connection.uniqueName === "string" && uniqueNames.has(connection.uniqueName)) {
        errors.push(`Duplicate connection uniqueName: ${connection.uniqueName}`);
      }
      if (typeof connection.uniqueName === "string") uniqueNames.add(connection.uniqueName);
      else if (typeof connection.label === "string") uniqueNames.add(connection.label);
    }
  }

  return { valid: errors.length === 0, errors };
}
