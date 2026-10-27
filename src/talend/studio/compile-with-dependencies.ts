/**
 * Compilar un job y, si faltan dependencias Maven, descargarlas y volver a compilar.
 *
 * La descarga va a Maven Central: es una decision de red, por eso solo ocurre
 * cuando quien llama la pide con `installMissing`. Sin esa opcion, la respuesta
 * solo lista lo que falta y como instalarlo.
 */
import { findMissingArtifacts, missingArtifactsHint, type MissingArtifact } from "./missing-artifacts";

import type { BridgeConfidence, TalendStudioBridgeClient } from "./bridge-client";

export type AutoInstalled = { coordinate: string; ok: boolean; message?: string };

export type CompileWithDependencies = {
  ok: boolean;
  source: string;
  confidence: BridgeConfidence;
  data: Record<string, unknown>;
  error?: { code: string; message: string };
  missingArtifacts: MissingArtifact[];
  autoInstalled: AutoInstalled[];
  hint?: string;
};

/**
 * El bridge responde `{ result: { compiles, error... } }`; los dobles de prueba y
 * versiones anteriores lo devolvian plano. Se acepta cualquiera de las dos formas.
 */
function aplanarResultado(data: Record<string, unknown> | undefined): Record<string, unknown> {
  const cuerpo = data ?? {};
  const resultado = cuerpo.result;
  return resultado && typeof resultado === "object" ? { ...cuerpo, ...(resultado as Record<string, unknown>) } : cuerpo;
}

export async function compileWithDependencies(
  bridge: TalendStudioBridgeClient,
  job: string | undefined,
  installMissing: boolean,
): Promise<CompileWithDependencies> {
  let result = await bridge.jobCompile({ job });
  let payload: Record<string, unknown> = aplanarResultado(result.data);
  let missing = findMissingArtifacts(JSON.stringify(payload));
  const autoInstalled: AutoInstalled[] = [];

  if (installMissing && payload.compiles !== true) {
    for (const artifact of missing) {
      if (artifact.groupId === null) {
        continue;
      }
      const installed = await bridge.installArtifact({
        groupId: artifact.groupId,
        artifactId: artifact.artifactId,
        version: artifact.version,
      });
      autoInstalled.push({
        coordinate: artifact.coordinate ?? artifact.artifactId,
        ok: installed.ok,
        message: installed.ok ? undefined : String(installed.error?.message ?? "No se pudo descargar el artefacto"),
      });
    }
    // Solo se vuelve a compilar si algo se descargo: si no, el resultado seria el mismo.
    if (autoInstalled.some((item) => item.ok)) {
      result = await bridge.jobCompile({ job });
      payload = aplanarResultado(result.data);
      missing = findMissingArtifacts(JSON.stringify(payload));
    }
  }

  return {
    ok: result.ok,
    source: result.source,
    confidence: result.confidence,
    data: payload,
    error: result.error,
    missingArtifacts: missing,
    autoInstalled,
    hint: payload.compiles !== true && missing.length > 0 ? missingArtifactsHint(missing) : undefined,
  };
}
