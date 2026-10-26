/**
 * Dependencias Maven que Studio no encuentra al compilar un job.
 *
 * El build de Studio falla con dos formas de mensaje (ver INTERNALS 25):
 *
 *   Offline / Missing artifact com.jayway.jsonpath:json-path:jar:2.9.0
 *   El contenedor Maven Dependencies referencia biblioteca ...json-path-2.9.0.jar inexistente
 *
 * La primera trae la coordenada completa. La segunda solo trae el nombre del
 * jar: sin groupId no se puede descargar, asi que se devuelve tal cual para
 * que quien llama lo resuelva.
 */

export type MissingArtifact = {
  groupId: string | null;
  artifactId: string;
  version: string;
  /** Coordenada completa `grupo:artefacto:version`, solo si se conoce el groupId. */
  coordinate: string | null;
};

const COORDINATE = /Missing artifact\s+([A-Za-z0-9_.-]+):([A-Za-z0-9_.-]+):(?:([A-Za-z0-9_.-]+):)?([A-Za-z0-9_.-]+)/g;
const JAR_NAME = /([A-Za-z0-9_.-]+?)-(\d[A-Za-z0-9_.-]*)\.jar\s+inexistente/g;

/**
 * Busca las dependencias que faltan en un texto (mensaje de error, respuesta
 * JSON completa...). Sin duplicados.
 */
export function findMissingArtifacts(text: string): MissingArtifact[] {
  const found: MissingArtifact[] = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(COORDINATE)) {
    const groupId = match[1];
    const artifactId = match[2];
    const version = match[4];
    if (!groupId || !artifactId || !version) {
      continue;
    }
    const coordinate = `${groupId}:${artifactId}:${version}`;
    if (!seen.has(coordinate)) {
      seen.add(coordinate);
      found.push({ groupId, artifactId, version, coordinate });
    }
  }

  for (const match of text.matchAll(JAR_NAME)) {
    // El nombre del jar viene precedido de puntos o de texto ("...json-path-2.9.0.jar"): solo cuenta lo que empieza por letra o digito.
    const artifactId = match[1]?.replace(/^[^A-Za-z0-9]+/, "");
    const version = match[2];
    if (!artifactId || !version) {
      continue;
    }
    // Si la coordenada completa ya salio, el nombre del jar es el mismo artefacto.
    const covered = found.some((item) => item.artifactId === artifactId && item.version === version);
    if (!covered) {
      const key = `${artifactId}:${version}`;
      if (!seen.has(key)) {
        seen.add(key);
        found.push({ groupId: null, artifactId, version, coordinate: null });
      }
    }
  }

  return found;
}

/** Que hacer con las dependencias que faltan, en una frase por caso. */
export function missingArtifactsHint(missing: MissingArtifact[]): string {
  const withGroup = missing.filter((item) => item.groupId !== null);
  const withoutGroup = missing.filter((item) => item.groupId === null);
  const parts: string[] = [];
  if (withGroup.length > 0) {
    const coordinates = withGroup.map((item) => item.coordinate).join(", ");
    parts.push(
      `Faltan ${withGroup.length} dependencia(s) Maven: ${coordinates}. Vuelve a llamar con installMissing:true, o instalalas con talend_studio_install_artifact.`,
    );
  }
  if (withoutGroup.length > 0) {
    const jars = withoutGroup.map((item) => `${item.artifactId}-${item.version}.jar`).join(", ");
    parts.push(
      `Faltan jars sin groupId conocido (${jars}): busca su coordenada Maven y usa talend_studio_install_artifact.`,
    );
  }
  return parts.join(" ");
}
