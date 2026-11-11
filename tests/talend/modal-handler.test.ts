import { describe, expect, test } from "bun:test";
import { handleModals } from "../../src/talend/studio/modals/modal-handler";
import { parseModalSnapshots } from "../../src/talend/studio/modals/modal-uia";
import type { ModalSnapshot } from "../../src/talend/studio/modals/modal-types";

const errorModal: ModalSnapshot = {
  handle: 42,
  title: "Error",
  texts: ["job_programa_h1:Error when loading the job", "Some errors appear after the migration in the following connections, please check them:row2"],
  buttons: ["Aceptar"],
  editableFields: 0,
  passwordFields: 0,
};

describe("handleModals", () => {
  test("lee, decide, pulsa y deja constancia con el mensaje completo", async () => {
    const pressed: Array<[number, string]> = [];
    const audit: Record<string, unknown>[] = [];
    const out = await handleModals({
      read: async () => [errorModal],
      press: async (handle, button) => {
        pressed.push([handle, button]);
        return { ok: true, pressed: button, via: "bm_click", error: null };
      },
      audit: (r) => audit.push(r),
      now: () => new Date("2026-11-11T12:00:00Z"),
    });
    expect(pressed).toEqual([[42, "Aceptar"]]);
    expect(out[0]?.decision.kind).toBe("error");
    expect(out[0]?.press?.ok).toBe(true);
    expect(JSON.stringify(audit[0])).toContain("row2");
    expect(audit[0]).toMatchObject({ at: "2026-11-11T12:00:00.000Z", dryRun: false });
  });

  test("dryRun decide pero no pulsa", async () => {
    let called = false;
    const out = await handleModals({
      dryRun: true,
      read: async () => [errorModal],
      press: async () => {
        called = true;
        return { ok: true, pressed: "x", via: null, error: null };
      },
      audit: () => {},
    });
    expect(called).toBe(false);
    expect(out[0]?.decision.action).toBe("press");
    expect(out[0]?.press).toBeUndefined();
  });

  test("un dialogo de una persona no se pulsa y queda registrado", async () => {
    const audit: Record<string, unknown>[] = [];
    const out = await handleModals({
      read: async () => [{ ...errorModal, title: "Login", passwordFields: 1, editableFields: 1 }],
      press: async () => {
        throw new Error("no debe pulsar");
      },
      audit: (r) => audit.push(r),
    });
    expect(out[0]?.decision.action).toBe("leave");
    expect(audit).toHaveLength(1);
  });

  test("si pulsar falla, el error queda en el resultado y no se lanza", async () => {
    const out = await handleModals({
      read: async () => [errorModal],
      press: async () => {
        throw new Error("PowerShell no respondio");
      },
      audit: () => {},
    });
    expect(out[0]?.press).toMatchObject({ ok: false, error: expect.stringContaining("PowerShell") });
  });

  test("sin dialogos no hay nada que hacer", async () => {
    expect(await handleModals({ read: async () => [], audit: () => {} })).toEqual([]);
  });
});

describe("parseModalSnapshots", () => {
  test("acepta una lista, un objeto suelto y vacio", () => {
    expect(parseModalSnapshots("")).toEqual([]);
    expect(parseModalSnapshots("[]")).toEqual([]);
    const one = '{"handle":7,"title":"T","texts":"solo uno","buttons":["OK"],"editableFields":0,"passwordFields":0}';
    expect(parseModalSnapshots(one)[0]).toMatchObject({ handle: 7, texts: ["solo uno"], buttons: ["OK"] });
  });
});
