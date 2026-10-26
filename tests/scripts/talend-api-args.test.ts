import { describe, expect, test } from "bun:test";

import { parseTalendApiArgs, splitMember } from "../../scripts/talend-api";

describe("interpretacion de la linea de comandos de talend-api", () => {
  test("sin argumentos o con help muestra la ayuda", () => {
    expect(parseTalendApiArgs([])).toEqual({ command: "help" });
    expect(parseTalendApiArgs(["--help"])).toEqual({ command: "help" });
  });

  test("drift no necesita argumentos", () => {
    expect(parseTalendApiArgs(["drift"])).toEqual({ command: "drift" });
  });

  test("find acepta uno o varios nombres y exige al menos uno", () => {
    expect(parseTalendApiArgs(["find", "getListContext", "setModified"])).toEqual({
      command: "find",
      names: ["getListContext", "setModified"],
    });
    expect(parseTalendApiArgs(["find"]).command).toBe("error");
  });

  test("live separa clases, metodos (--member) y campos (--field)", () => {
    const parsed = parseTalendApiArgs([
      "live",
      "org.talend.core.model.process.IProcess",
      "--member",
      "org.talend.core.model.process.IProcess#getUniqueName",
      "--field",
      "org.talend.repository.ProjectManager#INSTANCE",
    ]);

    expect(parsed).toEqual({
      command: "live",
      classes: ["org.talend.core.model.process.IProcess"],
      members: [
        { class: "org.talend.core.model.process.IProcess", name: "getUniqueName", kind: "method" },
        { class: "org.talend.repository.ProjectManager", name: "INSTANCE", kind: "field" },
      ],
    });
  });

  test("live sin clases ni miembros es un error", () => {
    expect(parseTalendApiArgs(["live"]).command).toBe("error");
  });

  test("--member sin Clase#nombre es un error con el flag en el mensaje", () => {
    const parsed = parseTalendApiArgs(["live", "--member", "org.talend.X"]);
    expect(parsed).toEqual({ command: "error", message: "--member necesita Clase#nombre" });
  });

  test("un comando desconocido se rechaza", () => {
    expect(parseTalendApiArgs(["borrar"]).command).toBe("error");
  });
});

describe("division de Clase#nombre", () => {
  test("separa en la ultima almohadilla y respeta clases anidadas con $", () => {
    expect(splitMember("org.talend.Externa$Interna#POJO")).toEqual({
      class: "org.talend.Externa$Interna",
      name: "POJO",
    });
  });

  test("rechaza formas incompletas", () => {
    expect(splitMember("org.talend.X#")).toBeNull();
    expect(splitMember("#metodo")).toBeNull();
    expect(splitMember("sin-almohadilla")).toBeNull();
  });
});
