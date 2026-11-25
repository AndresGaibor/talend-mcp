/**
 * Recuperacion automatica cuando el bridge no contesta.
 *
 * Un dialogo modal de Studio bloquea el hilo de la interfaz y, con el, al
 * bridge: la peticion expira aunque la operacion siga esperando una respuesta.
 * Antes de rendirse, el cliente lee los dialogos por UI Automation (que no
 * depende del bridge), pulsa solo los botones que la politica considera
 * seguros y repite una vez las lecturas.
 *
 * Este archivo vive en `src/talend/studio` a proposito: el transporte del
 * bridge no debe saber de la politica de modales. Aqui se registra el hook que
 * el transporte usa.
 */

import { detectRuntimeOS, type RuntimeOS } from "../../platform/runtime";
import {
  setBridgeRecoveryHook,
  type BridgeRecoveryMotivo,
  type BridgeRecoveryOutcome,
} from "../../modules/studio-bridge/adapters/bridge-transport";
import type { BridgeDialogoAtendido } from "../../modules/studio-bridge/adapters/bridge-types";
import { handleModals, type HandledModal } from "./modals/modal-handler";

/** Motivos que un dialogo puede explicar. Un bridge caido no se arregla pulsando botones. */
const MOTIVOS_RECUPERABLES = new Set<BridgeRecoveryMotivo["codigo"]>(["timeout", "conexion-cortada"]);

/**
 * La pulsacion automatica esta apagada por defecto.
 *
 * Un dialogo de Studio puede ser una ventana que abrio una persona; pulsar "Save" o "Yes" sin que lo pida
 * cierra o guarda cosas que no eran del bridge. Solo se activa con TALEND_MODALS_AUTO=1 (o `true`).
 */
export function modalesAutomaticosActivos(): boolean {
  const valor = process.env.TALEND_MODALS_AUTO;
  return valor === "1" || valor === "true";
}

type Opciones = {
  /** Solo para pruebas: fuerza el sistema operativo del que se leen los dialogos. */
  runtime?: RuntimeOS;
  /** Solo para pruebas: sustituto de `handleModals`. */
  handle?: (options: { dryRun?: boolean; onlyKnown?: boolean }) => Promise<HandledModal[]>;
};

function dialogoParaResultado(modal: HandledModal): BridgeDialogoAtendido {
  const decision =
    modal.decision.action === "press" ? `pulsar ${modal.decision.button ?? "?"}` : `dejar (${modal.decision.rule})`;
  return {
    title: modal.title,
    decision,
    pressed: modal.press?.ok ? modal.press.pressed : null,
  };
}

/**
 * Lee y contesta los dialogos conocidos tras un fallo del bridge.
 *
 * Devuelve `reintentar: true` solo si se pulso algun boton: sin dialogo que
 * atender, repetir la peticion alarga la espera sin cambiar nada.
 */
export async function atenderDialogosTrasFallo(
  motivo: BridgeRecoveryMotivo,
  opciones: Opciones = {},
): Promise<BridgeRecoveryOutcome> {
  if (!modalesAutomaticosActivos()) {
    return {
      reintentar: false,
      detalle:
        "La recuperacion automatica de dialogos esta apagada. Activala con TALEND_MODALS_AUTO=1 " +
        "solo si aceptas que se pulsen dialogos conocidos de Studio.",
    };
  }
  if (!MOTIVOS_RECUPERABLES.has(motivo.codigo)) {
    return { reintentar: false, detalle: `Un fallo de tipo ${motivo.codigo} no se resuelve cerrando dialogos.` };
  }

  const runtime = opciones.runtime ?? detectRuntimeOS();
  if (runtime !== "windows" && runtime !== "wsl") {
    return { reintentar: false, detalle: "La lectura de dialogos por UI Automation solo esta disponible en Windows." };
  }

  const leer = opciones.handle ?? ((options) => handleModals(options));
  let atendidos: HandledModal[];
  try {
    // Solo se pulsan dialogos con regla propia: si la ventana la abrio una persona, se deja como esta.
    atendidos = await leer({ onlyKnown: true });
  } catch (error) {
    return {
      reintentar: false,
      detalle: `No se pudieron leer los dialogos de Studio: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const dialogos = atendidos.map(dialogoParaResultado);
  const pulsados = atendidos.filter((modal) => modal.press?.ok).length;
  return {
    reintentar: pulsados > 0,
    dialogos,
    detalle:
      pulsados > 0
        ? undefined
        : "No se pulso ningun dialogo conocido: puede ser una operacion lenta o un dialogo que necesita una persona.",
  };
}

let registrado = false;

/**
 * Instala el hook en el transporte del bridge. Es idempotente: se llama al
 * cargar las tools y otra vez al pedir un cliente.
 */
export function registrarRecuperacionDeModales(): void {
  if (registrado) return;
  registrado = true;
  if (!modalesAutomaticosActivos()) return;
  setBridgeRecoveryHook(atenderDialogosTrasFallo);
}

/** Solo para pruebas: vuelve a dejar el transporte sin hook. */
export function reiniciarRecuperacionDeModales(): void {
  registrado = false;
  setBridgeRecoveryHook(undefined);
}
