package com.andres.talend.bridge.automation;

import static com.andres.talend.bridge.TestSupport.check;

/**
 * Reglas puras de TalendApi: que editor pertenece a que job. Un error aqui
 * manda las operaciones al job equivocado, por eso se prueban los casos limite.
 */
public final class TalendApiTests {
  private TalendApiTests() {}

  public static void run() {
    check(TalendApi.isEditorOfJob("Job MCP_X 0.1", "MCP_X"),
        "el editor de 'Job MCP_X 0.1' es el del job MCP_X");
    check(TalendApi.isEditorOfJob("*Job MCP_X 0.1", "MCP_X"),
        "un editor con cambios sin guardar (asterisco) sigue siendo del job");
    check(TalendApi.isEditorOfJob("Job MCP_X", "MCP_X"),
        "el titulo sin version tambien es del job");
    check(!TalendApi.isEditorOfJob("Job MCP_Fase10 0.1", "MCP_Fase1"),
        "MCP_Fase1 no casa con el editor de MCP_Fase10 (coincidencia exacta)");
    check(!TalendApi.isEditorOfJob(null, "MCP_X"), "un titulo nulo no casa con ningun job");
    check(!TalendApi.isEditorOfJob("Job Otro 0.1", "MCP_X"), "un editor de otro job no casa");

    // invokeOrNull: exito y ausencia del metodo (que no debe lanzar).
    check(Integer.valueOf(3).equals(TalendApi.invokeOrNull("abc", "length")),
        "invokeOrNull invoca un metodo publico y devuelve su resultado");
    check(TalendApi.invokeOrNull("abc", "noExisteEsteMetodo") == null,
        "invokeOrNull devuelve null si el metodo no existe, sin lanzar");
  }
}
