import { inspectComponent } from "./query";

export async function generateComponentTemplate(componentName: string): Promise<{ ok: boolean; template?: string; error?: string }> {
  const entry = await inspectComponent(componentName);
  if (!entry) {
    return { ok: false, error: "Component not found: " + componentName };
  }

  const requiredParams = entry.parameters.filter((p) => p.required);
  const template = {
    componentName: entry.componentName ?? componentName,
    family: entry.family,
    requiredParameters: requiredParams.map((p) => ({
      name: p.name,
      defaultValue: p.defaultValue,
      description: p.description ?? "",
    })),
    optionalParameters: entry.parameters
      .filter((p) => !p.required)
      .map((p) => ({
        name: p.name,
        defaultValue: p.defaultValue,
      })),
    schemas: entry.schemas,
    connectors: entry.connectors,
  };

  return { ok: true, template: JSON.stringify(template, null, 2) };
}

export async function validateComponentUsage(
  componentName: string,
  parameters: Record<string, string>,
): Promise<{ ok: boolean; valid: boolean; errors: string[]; warnings: string[] }> {
  const entry = await inspectComponent(componentName);
  if (!entry) {
    return { ok: false, valid: false, errors: ["Component not found: " + componentName], warnings: [] };
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  const requiredParams = entry.parameters.filter((p) => p.required);

  for (const req of requiredParams) {
    const value = parameters[req.name];
    if (!value || value.trim() === "") {
      errors.push("Parámetro requerido faltante: " + req.name);
    }
  }

  const unknownParams = Object.keys(parameters).filter((k) => !entry.parameters.find((p) => p.name === k));
  if (unknownParams.length > 0) {
    warnings.push("Parámetros desconocidos: " + unknownParams.join(", "));
  }

  return { ok: true, valid: errors.length === 0, errors, warnings };
}
