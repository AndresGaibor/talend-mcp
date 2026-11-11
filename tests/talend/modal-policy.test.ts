import { describe, expect, test } from "bun:test";
import { decideModal } from "../../src/talend/studio/modals/modal-policy";
import type { ModalSnapshot } from "../../src/talend/studio/modals/modal-types";

function modal(partial: Partial<ModalSnapshot>): ModalSnapshot {
  return { handle: 1, title: "", texts: [], buttons: ["OK"], editableFields: 0, passwordFields: 0, ...partial };
}

describe("decideModal: dialogos conocidos de Studio", () => {
  test("el job ya existe: se acepta reemplazarlo", () => {
    const d = decideModal(modal({ title: "Jobname Error", texts: ["Etiqueta X is already in use, do you want to replace it?"], buttons: ["&Yes", "&No"] }));
    expect(d).toMatchObject({ action: "press", button: "&Yes", rule: "job-ya-existe" });
  });

  test("pregunta de esquema del componente destino: se contesta No", () => {
    const d = decideModal(modal({ texts: ["Do you want to get the schema of the target component?"], buttons: ["&Yes", "&No"] }));
    expect(d).toMatchObject({ action: "press", button: "&No", rule: "esquema-del-destino" });
  });

  test("licencia de modulos de terceros: se acepta", () => {
    const d = decideModal(modal({ title: "Install additional third-party libraries", texts: ["Please read and accept the license terms"], buttons: ["Accept all", "Cancel"] }));
    expect(d).toMatchObject({ kind: "license", action: "press", button: "Accept all" });
  });

  test("modulos faltantes: se descargan e instalan", () => {
    const d = decideModal(modal({ title: "Third party modules required", buttons: ["Download and install all modules available", "Cancel"] }));
    expect(d).toMatchObject({ kind: "modules", action: "press", button: "Download and install all modules available" });
  });

  test("Network Issue: se registra como error y se cierra", () => {
    const d = decideModal(modal({ title: "Network Issue", texts: ["Cannot reach the server"], buttons: ["OK"] }));
    expect(d).toMatchObject({ kind: "error", action: "press", button: "OK" });
  });
});

describe("decideModal: errores y avisos desconocidos", () => {
  test("error al cargar el Job (row2): kind error, se pulsa OK y la razon conserva el texto", () => {
    const d = decideModal(modal({
      title: "Error",
      texts: ["job_programa_h1:Error when loading the job", "Some errors appear after the migration in the following connections, please check them:row2"],
      buttons: ["OK"],
    }));
    expect(d.kind).toBe("error");
    expect(d).toMatchObject({ action: "press", button: "OK" });
    expect(d.reason).toContain("row2");
  });

  test("un aviso informativo se cierra con Aceptar", () => {
    expect(decideModal(modal({ title: "Information", buttons: ["Aceptar"] }))).toMatchObject({ kind: "info", action: "press", button: "Aceptar" });
  });

  test("pregunta desconocida: se elige la respuesta que no cambia nada", () => {
    const d = decideModal(modal({ title: "Confirm", texts: ["Continue?"], buttons: ["&Yes", "&No"] }));
    expect(d).toMatchObject({ kind: "question", action: "press", button: "&No" });
  });
});

describe("decideModal: cuando decide una persona", () => {
  test("con un campo de contrasena no se toca", () => {
    const d = decideModal(modal({ title: "Login", buttons: ["OK"], passwordFields: 1, editableFields: 2 }));
    expect(d.action).toBe("leave");
    expect(d.reason).toContain("contrase");
  });

  test("con campos editables y sin regla explicita no se toca", () => {
    expect(decideModal(modal({ title: "Rename", buttons: ["OK", "Cancel"], editableFields: 1 })).action).toBe("leave");
  });

  test("nunca se pulsa un boton destructivo en un dialogo desconocido", () => {
    const d = decideModal(modal({ title: "Warning", texts: ["Clean the workspace?"], buttons: ["Delete all", "Eliminar"] }));
    expect(d.action).toBe("leave");
  });

  test("sin botones conocidos se deja abierto", () => {
    expect(decideModal(modal({ title: "Extraño", buttons: ["Zeta"] })).action).toBe("leave");
  });
});
