import type { ComponentDefinition, DefinitionIndex } from "../../src/modules/component-definitions/domain/component-definition.types";
import { filterUncompiled } from "../coverage-selection";
import type { CoverageOptions } from "./opciones";

export function componentesPedidos(value: string | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  return value.split(",").map((name) => name.trim()).filter(Boolean);
}

export function pideArtefacto(definition: ComponentDefinition): boolean {
  return (definition.imports ?? []).some((item) => item.required && Boolean(item.mvn));
}

export function filtrarDelCatalogo(
  definitions: ComponentDefinition[],
  mount: Record<string, unknown>,
  options: CoverageOptions,
): string[] {
  const wanted = (options.familia ?? "")
    .split(",")
    .map((family) => family.trim().toLowerCase())
    .filter(Boolean);
  return definitions
    .filter((definition) => definition.palette === "DI")
    .filter((definition) => wanted.length === 0
      || definition.families.some((family) => wanted.includes(family.toLowerCase())))
    .filter((definition) => !options.sinArtefacto || !pideArtefacto(definition))
    .map((definition) => definition.name)
    .filter((name) => name in mount);
}

export async function elegirComponentes(
  options: CoverageOptions,
  mount: Record<string, unknown>,
  dependencies: {
    cargarIndice: () => Promise<DefinitionIndex>;
    leerReportes: () => string[];
  },
): Promise<string[] | undefined> {
  let selected: string[] | undefined;
  if (options.componentes) {
    selected = options.componentes;
  } else if (!options.familia && !options.conDefinicion && !options.sinArtefacto) {
    selected = undefined;
  } else if (options.conDefinicion) {
    selected = Object.keys(mount);
  } else {
    const index = await dependencies.cargarIndice();
    selected = filtrarDelCatalogo(index.components, mount, options);
  }

  if (!options.soloPendientes) return selected;
  return filterUncompiled(selected ?? Object.keys(mount), dependencies.leerReportes());
}
