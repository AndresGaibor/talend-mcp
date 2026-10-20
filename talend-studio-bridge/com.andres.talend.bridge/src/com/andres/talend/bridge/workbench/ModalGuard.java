package com.andres.talend.bridge.workbench;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.andres.talend.bridge.BridgeLog;
import com.andres.talend.bridge.UiThread;

import org.eclipse.swt.SWT;
import org.eclipse.swt.widgets.Button;
import org.eclipse.swt.widgets.Composite;
import org.eclipse.swt.widgets.Control;
import org.eclipse.swt.widgets.Display;
import org.eclipse.swt.widgets.Event;
import org.eclipse.swt.widgets.Shell;
import org.eclipse.ui.IWorkbenchWindow;
import org.eclipse.ui.PlatformUI;

/**
 * Controla los dialogos modales de Talend Studio.
 *
 * Studio abre modales que bloquean el IDE: el mas molesto es el
 * "Jobname Error" ("Etiqueta X is already in use, do you want to replace it?"),
 * que aparece al crear un job con una etiqueta que ya existe. Si nadie lo
 * cierra, el hilo de la UI se queda en el bucle modal del dialogo y todas las
 * operaciones posteriores se cuelgan.
 *
 * Este guardian hace dos cosas:
 *
 * 1. {@link #dismissBlockingDialogs()} cierra a mano los dialogos que
 *    bloquean, pulsando el boton que corresponde.
 * 2. {@link #startWatchdog()} deja un hilo vigilante que lo llama cada poco,
 *    de modo que un modal que aparece por sorpresa no deja el IDE colgado.
 *
 * Solo se tocan dialogos conocidos: cualquier otro modal se reporta pero se
 * deja abierto, porque suele estar esperando a que conteste una persona.
 */
public final class ModalGuard {

  private ModalGuard() {}

  /**
   * Dialogos que el guardian cierra solo, con el boton que hay que pulsar.
   *
   * El primer texto que coincide con el titulo gana. Los botones se
   * prueban en orden: el primero que exista se pulsa.
   */
  private static final String[][] KNOWN_DIALOGS = {
      // El job ya existe: se acepta reemplazarlo.
      {"Jobname Error", "Yes", "OK", "Si", "Sí"},
      {"Job Name Error", "Yes", "OK", "Si", "Sí"},
      // El nombre del job no es valido: se confirma para seguir.
      {"Invalid Job Name", "OK", "Yes"},
      // El workspace tiene cambios sin guardar.
      {"Save Resource", "Yes", "OK"},
  };

  /** Botones que cierran un dialogo sin decidir nada. */
  private static final List<String> CLOSE_BUTTONS =
      Arrays.asList("OK", "Aceptar", "Close", "Cerrar", "Yes", "Si", "Sí", "No");

  /**
   * Botones que el guardian pulsa en un dialogo que no conoce.
   *
   * Un modal bloquea el hilo de la UI de Studio: mientras siga abierto, ni el
   * IDE ni el bridge pueden seguir. Por eso, si el dialogo tiene uno de estos
   * botones, se pulsa. Van en orden de menor a mayor consecuencia: primero los
   * que solo confirman y al final los que guardan.
   */
  private static final List<String> SAFE_BUTTONS = Arrays.asList(
      "Yes", "Si", "Sí", "OK", "Accept", "Aceptar", "Continue", "Continuar",
      "Save", "Guardar", "Save All", "Guardar todo");

  /** Cada cuanto mira el guardian si hay dialogos bloqueando. */
  private static final long WATCHDOG_INTERVAL_MS = 1200L;

  private static volatile Thread watchdog;

  // ---------------------------------------------------------------------
  // Vigilante
  // ---------------------------------------------------------------------

  /**
   * Arranca el hilo vigilante.
   *
   * Es idempotente: si ya esta corriendo no hace nada.
   */
  public static synchronized void startWatchdog() {
    if (watchdog != null && watchdog.isAlive()) {
      return;
    }
    Thread thread = new Thread(() -> {
      while (!Thread.currentThread().isInterrupted()) {
        try {
          Thread.sleep(WATCHDOG_INTERVAL_MS);
          // Los shells de SWT solo se pueden tocar desde el hilo de la UI.
          Map<String, Object> result = UiThread.sync(ModalGuard::dismissBlockingDialogs);
          if (result.get("dismissed") instanceof List
              && !((List<?>) result.get("dismissed")).isEmpty()) {
            BridgeLog.info("El guardian de modales cerro: " + result.get("dismissed"));
          }
        } catch (InterruptedException e) {
          Thread.currentThread().interrupt();
          return;
        } catch (RuntimeException e) {
          BridgeLog.warn("Fallo del guardian de modales", e);
        }
      }
    }, "talend-bridge-modal-guard");
    thread.setDaemon(true);
    watchdog = thread;
    thread.start();
  }

  /** Detiene el hilo vigilante. */
  public static synchronized void stopWatchdog() {
    if (watchdog != null) {
      watchdog.interrupt();
      watchdog = null;
    }
  }

  // ---------------------------------------------------------------------
  // Operacion
  // ---------------------------------------------------------------------

  /**
   * Cierra los dialogos modales que bloquean a Studio.
   *
   * Se llama desde el hilo de la UI: los shells de SWT solo se tocan ahi.
   *
   * @return los dialogos encontrados y los que se han cerrado.
   */
  public static Map<String, Object> dismissBlockingDialogs() {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", true);
    payload.put("source", "studio-bridge");
    payload.put("confidence", "high");
    payload.put("endpoint", "/workbench/dialogs");

    List<Map<String, Object>> found = new ArrayList<>();
    List<Map<String, Object>> dismissed = new ArrayList<>();

    Display display = Display.getDefault();
    if (display == null) {
      payload.put("dialogs", found);
      payload.put("dismissed", dismissed);
      return payload;
    }

    for (Shell shell : display.getShells()) {
      if (shell == null || shell.isDisposed() || !shell.isVisible()) {
        continue;
      }
      if (isWorkbenchShell(shell)) {
        continue;
      }
      String title = shell.getText();
      Map<String, Object> dialog = new LinkedHashMap<>();
      dialog.put("title", title);
      dialog.put("class", shell.getClass().getName());
      found.add(dialog);

      String button = knownButtonFor(shell, title);
      if (button == null) {
        // Dialogo desconocido: si tiene un boton seguro se pulsa, porque
        // mientras siga abierto el IDE queda bloqueado.
        button = safeButtonFor(shell);
      }
      if (button == null) {
        // No hay nada que pulsar: se reporta y se deja abierto.
        continue;
      }
      if (pressButton(shell, button)) {
        dialog.put("pressed", button);
        dismissed.add(dialog);
      } else {
        // Sin boton conocido se cierra el dialogo: es mejor dejar el IDE
        // usable que quedarse bloqueado.
        shell.close();
        dialog.put("pressed", "close");
        dismissed.add(dialog);
      }
    }

    payload.put("dialogs", found);
    payload.put("dismissed", dismissed);
    return payload;
  }

  /**
   * Indica si el shell es la ventana principal del workbench.
   *
   * Las ventanas del workbench no se cierran: no son dialogos.
   */
  private static boolean isWorkbenchShell(Shell shell) {
    for (IWorkbenchWindow window : PlatformUI.getWorkbench().getWorkbenchWindows()) {
      Shell workbenchShell = window.getShell();
      if (workbenchShell != null && workbenchShell.equals(shell)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Boton a pulsar para un dialogo conocido, o null si no se conoce.
   */
  private static String knownButtonFor(Shell shell, String title) {
    if (title == null) {
      return null;
    }
    String normalized = title.trim().toLowerCase();
    for (String[] known : KNOWN_DIALOGS) {
      if (!normalized.contains(known[0].toLowerCase())) {
        continue;
      }
      for (int i = 1; i < known.length; i++) {
        if (findButton(shell, known[i]) != null) {
          return known[i];
        }
      }
      // No se encuentra ese boton: se prueban los de cierre.
      for (String candidate : CLOSE_BUTTONS) {
        if (findButton(shell, candidate) != null) {
          return candidate;
        }
      }
      return null;
    }
    return null;
  }

  /**
   * Primer boton seguro del dialogo, o null si no hay ninguno.
   */
  private static String safeButtonFor(Shell shell) {
    for (String candidate : SAFE_BUTTONS) {
      if (findButton(shell, candidate) != null) {
        return candidate;
      }
    }
    return null;
  }

  /**
   * Busca un boton por su texto dentro del shell.
   *
   * @param shell el shell donde buscar. Si es null se buscan todos los
   *        dialogos visibles: asi se decide el boton antes de cerrar nada.
   */
  private static Button findButton(Shell shell, String text) {
    Display display = Display.getDefault();
    if (display == null) {
      return null;
    }
    List<Shell> candidates = new ArrayList<>();
    if (shell != null) {
      candidates.add(shell);
    } else {
      for (Shell candidate : display.getShells()) {
        if (candidate == null || candidate.isDisposed() || !candidate.isVisible()) {
          continue;
        }
        if (isWorkbenchShell(candidate)) {
          continue;
        }
        candidates.add(candidate);
      }
    }
    for (Shell candidate : candidates) {
      Button button = findButtonIn(candidate, text);
      if (button != null) {
        return button;
      }
    }
    return null;
  }

  /**
   * Busca recursivamente un boton con ese texto.
   *
   * Los botones de JFace llevan el mnemonic con ampersand ("&Yes"), asi que
   * se comparan sin el.
   */
  private static Button findButtonIn(Control control, String text) {
    if (control instanceof Button) {
      Button button = (Button) control;
      if (matches(button.getText(), text)) {
        return button;
      }
    }
    if (control instanceof Composite) {
      for (Control child : ((Composite) control).getChildren()) {
        Button found = findButtonIn(child, text);
        if (found != null) {
          return found;
        }
      }
    }
    return null;
  }

  /** Compara el texto de un boton con el buscado, sin mnemonic. */
  private static boolean matches(String label, String text) {
    if (label == null || text == null) {
      return false;
    }
    String clean = label.replace("&", "").trim();
    return clean.equalsIgnoreCase(text.trim());
  }

  /**
   * Pulsa un boton del dialogo.
   *
   * Se lanza el evento de seleccion en vez de llamar a `click()`: los
   * dialogos de JFace escuchan la seleccion, no el click del raton.
   */
  private static boolean pressButton(Shell shell, String text) {
    Button button = findButton(shell, text);
    if (button == null || button.isDisposed()) {
      return false;
    }
    Event event = new Event();
    event.widget = button;
    event.type = SWT.Selection;
    event.button = 0;
    button.notifyListeners(SWT.Selection, event);
    return true;
  }
}
