import * as z from "zod/v4";
import { bridgeOk, bridgeFail } from "./tools-base";
import { listContextProfiles, getContextProfile, applyContextToJobSpec } from "../contexts/context-profile";
import { readFileSync } from "node:fs";
import type { ContextProfile } from "../contexts/context-types";

export const contextTools = [
  {
    name: "talend_context_profile_list",
    description: "Lista todos los perfiles de contexto disponibles.",
    inputSchema: z.object({}),
    handler: async () => {
      try {
        const profiles = listContextProfiles();
        return bridgeOk({
          ok: true,
          source: "context-profile",
          confidence: "high",
          endpoint: "/context/profile-list",
          data: { profiles, count: profiles.length },
        });
      } catch (err) {
        return bridgeFail({
          ok: false,
          source: "context-profile",
          confidence: "low",
          endpoint: "/context/profile-list",
          error: { code: "LIST_FAILED", message: String(err) },
        });
      }
    },
  },
  {
    name: "talend_context_profile_get",
    description: "Obtiene un perfil de contexto por nombre.",
    inputSchema: z.object({
      profileName: z.string().describe("Nombre del perfil"),
    }),
    handler: async ({ profileName }: { profileName: string }) => {
      const profile = getContextProfile(profileName);
      if (!profile) {
        return bridgeFail({
          ok: false,
          source: "context-profile",
          confidence: "high",
          endpoint: "/context/profile-get",
          error: { code: "NOT_FOUND", message: `Perfil no encontrado: ${profileName}` },
        });
      }
      return bridgeOk({
        ok: true,
        source: "context-profile",
        confidence: "high",
        endpoint: "/context/profile-get",
        data: { profile },
      });
    },
  },
  {
    name: "talend_context_profile_apply_to_job",
    description: "Aplica un perfil de contexto a una especificación de job.",
    inputSchema: z.object({
      profileName: z.string().describe("Nombre del perfil de contexto"),
      jobSpec: z.record(z.string(), z.unknown()).describe("Especificación del job"),
    }),
    handler: async (input: { profileName: string; jobSpec: Record<string, unknown> }) => {
      const profile = getContextProfile(input.profileName);
      if (!profile) {
        return bridgeFail({
          ok: false,
          source: "context-profile",
          confidence: "high",
          endpoint: "/context/profile-apply",
          error: { code: "NOT_FOUND", message: `Perfil no encontrado: ${input.profileName}` },
        });
      }
      const result = applyContextToJobSpec(profile, input.jobSpec);
      return bridgeOk({
        ok: true,
        source: "context-profile",
        confidence: "high",
        endpoint: "/context/profile-apply",
        data: { jobSpecWithContext: result },
      });
    },
  },
  {
    name: "talend_context_profile_load_from_file",
    description: "Carga un perfil de contexto desde un archivo JSON externo.",
    inputSchema: z.object({
      filePath: z.string().describe("Ruta al archivo .context.json"),
    }),
    handler: async (input: { filePath: string }) => {
      try {
        const content = readFileSync(input.filePath, "utf8");
        const profile = JSON.parse(content) as ContextProfile;

        if (!profile.name || !profile.variables) {
          return bridgeFail({
            ok: false,
            source: "context-profile",
            confidence: "high",
            endpoint: "/context/profile-load-from-file",
            error: { code: "INVALID_FORMAT", message: "El archivo no tiene el formato válido de perfil de contexto" },
          });
        }

        return bridgeOk({
          ok: true,
          source: "context-profile",
          confidence: "high",
          endpoint: "/context/profile-load-from-file",
          data: {
            profile,
            loadedFrom: input.filePath,
          },
        });
      } catch (err) {
        return bridgeFail({
          ok: false,
          source: "context-profile",
          confidence: "high",
          endpoint: "/context/profile-load-from-file",
          error: { code: "LOAD_FAILED", message: String(err) },
        });
      }
    },
  },
];
