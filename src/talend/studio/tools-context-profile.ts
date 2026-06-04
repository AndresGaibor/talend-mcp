import * as z from "zod/v4";
import { bridgeOk, bridgeFail } from "./tools-base";
import { listContextProfiles, getContextProfile, applyContextToJobSpec } from "../contexts/context-profile";

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
];
