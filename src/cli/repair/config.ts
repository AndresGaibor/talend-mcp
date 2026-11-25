/** Configuracion del bridge: dejar el guardian de dialogos apagado sin perder el resto de claves. */

export type RepairConfigPlan = {
  changed: boolean;
  text: string | null;
  /** Valor anterior, para el informe. `null` si el archivo no se pudo leer. */
  autoDismiss: boolean | null;
  error?: string;
};

/**
 * Deja `autoDismissModals: false` en el JSON del bridge, conservando el resto de claves.
 *
 * Un archivo ausente o vacio se trata como `{}`: el plugin ya usa `false` por defecto, pero dejarlo escrito
 * evita que una version futura cambie el valor sin que se note.
 */
export function planSafeConfig(text: string | null): RepairConfigPlan {
  if (text === null) {
    return {
      changed: true,
      text: `${JSON.stringify({ autoDismissModals: false }, null, 2)}\n`,
      autoDismiss: null,
    };
  }

  const clean = text.replace(/^\uFEFF/, "").trim();
  let data: Record<string, unknown>;
  try {
    data = clean ? (JSON.parse(clean) as Record<string, unknown>) : {};
  } catch (error) {
    return {
      changed: false,
      text: null,
      autoDismiss: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return { changed: false, text: null, autoDismiss: null, error: "el contenido no es un objeto JSON" };
  }

  const previous = data.autoDismissModals;
  data.autoDismissModals = false;
  return {
    changed: previous !== false,
    text: `${JSON.stringify(data, null, 2)}\n`,
    autoDismiss: previous === true,
  };
}
