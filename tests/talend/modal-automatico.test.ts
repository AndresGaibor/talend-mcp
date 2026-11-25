import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { modalesAutomaticosActivos } from "../../src/talend/studio/recuperacion-de-bridge";

/**
 * Las rutas automaticas no pueden cerrar ventanas que abrio una persona: el transporte del bridge no
 * pulsa dialogos mientras escribe, y el vigilante y la recuperacion solo aplican reglas propias.
 * Se comprueba en el codigo fuente porque estas rutas dependen de UI Automation y de Studio abierto.
 */

const ROOT = join(import.meta.dir, "..", "..");

test("el transporte del bridge no pulsa dialogos mientras escribe", () => {
  const transporte = readFileSync(join(ROOT, "src/modules/studio-bridge/adapters/bridge-transport.ts"), "utf8");

  expect(transporte).not.toContain("handleModals");
  expect(transporte).not.toContain("iniciarVigilanciaDeDialogos");
});

test("la recuperacion y el supervisor solo aplican reglas propias", () => {
  const recuperacion = readFileSync(join(ROOT, "src/talend/studio/recuperacion-de-bridge.ts"), "utf8");
  expect(recuperacion).toContain("onlyKnown: true");

  const supervisor = readFileSync(join(ROOT, "scripts/supervisor.ts"), "utf8");
  expect(supervisor).toContain("handleModals({ onlyKnown: true })");
});

test("la pulsacion automatica esta apagada salvo que se pida con TALEND_MODALS_AUTO=1", () => {
  const previo = process.env.TALEND_MODALS_AUTO;
  try {
    delete process.env.TALEND_MODALS_AUTO;
    expect(modalesAutomaticosActivos()).toBe(false);
    process.env.TALEND_MODALS_AUTO = "0";
    expect(modalesAutomaticosActivos()).toBe(false);
    process.env.TALEND_MODALS_AUTO = "1";
    expect(modalesAutomaticosActivos()).toBe(true);
    process.env.TALEND_MODALS_AUTO = "true";
    expect(modalesAutomaticosActivos()).toBe(true);
  } finally {
    if (previo === undefined) delete process.env.TALEND_MODALS_AUTO;
    else process.env.TALEND_MODALS_AUTO = previo;
  }
});
