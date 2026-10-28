package com.andres.talend.bridge.workbench;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.WeakHashMap;

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
 * 1. {@link #dismissBlockingDialogs()} cierra a mano los dialogos conocidos,
 *    pulsando el boton que corresponde. Es la via explicita
 *    (`talend_studio_dismiss_dialogs`).
 * 2. {@link #startWatchdog()} deja un hilo vigilante que lo llama cada poco.
 *    Solo arranca si `autoDismissModals` esta activo en la configuracion del
 *    bridge; por defecto no se cierra ningun modal solo.
 *
 * Solo se tocan dialogos conocidos: cualquier otro modal se reporta pero se
 * deja abierto, porque esta esperando a que conteste una persona. Tampoco se
 * simulan teclas.
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
      // El workspace tiene cambios sin guardar: se guardan.
      {"Save Resource", "Yes", "OK", "Save", "Guardar"},
      {"Guardar recursos", "Guardar", "Yes", "OK"},
      // Faltan modulos de terceros: se cierra sin descargarlos. Descargarlos
      // es una decision de red que no se toma sola.
      {"third party modules", "Cerrar", "Close", "Cancel", "Cancelar"},
      {"modulos de terceros", "Cerrar", "Close", "Cancel", "Cancelar"},
  };

  /** Botones que cierran un dialogo sin decidir nada. */
  private static final List<String> CLOSE_BUTTONS =
      Arrays.asList("OK", "Aceptar", "Close", "Cerrar", "Yes", "Si", "Sí", "No");

  /** Milisegundos que el dialogo de modulos faltantes espera a que el MCP pida instalarlos. */
  private static final long PROGRESS_TIMEOUT_MS = 30_000L;

  /** Momento en el que se vio cada dialogo por primera vez. */
  private static final Map<Shell, Long> FIRST_SEEN = Collections.synchronizedMap(new WeakHashMap<>());

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
          // Con poco tiempo de espera: si la UI esta ocupada compilando, el
          // guardian sigue vivo y reintenta en la ronda siguiente.
          Map<String, Object> result = UiThread.sync(ModalGuard::dismissBlockingDialogs, 3000);
          if (result.get("dismissed") instanceof List
              && !((List<?>) result.get("dismissed")).isEmpty()) {
            BridgeLog.info("El guardian de modales cerro: " + result.get("dismissed"));
          }
        } catch (IllegalStateException e) {
          // La interfaz esta ocupada (un job largo o un dialogo nativo que SWT
          // no ve). No se fuerza nada: se vuelve a mirar en la ronda siguiente.
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

      // Un dialogo de modulos faltantes: da tiempo a que el MCP pida
      // instalarlos (tool talend_studio_install_modules) antes de cerrarlo.
      if (isMissingModules(title) && !isStuck(shell)) {
        continue;
      }

      // Solo se pulsa en dialogos conocidos. Cualquier otro modal se reporta en
      // `dialogs` y se deja abierto: lo esta esperando una persona.
      String button = knownButtonFor(shell, title);
      if (button == null) {
        continue;
      }
      if (pressButton(shell, button)) {
        dialog.put("pressed", button);
        List<String> content = textsOf(shell);
        if (!content.isEmpty()) {
          dialog.put("content", content);
        }
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
  static boolean isWorkbenchShell(Shell shell) {
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
   * Instala los modulos de terceros que Studio echa de menos.
   *
   * Cuando un job usa un componente cuyo runtime no esta descargado (los de
   * "processing", por ejemplo), Studio abre un dialogo pidiendo los modulos.
   * El guardian los cierra sin instalar, porque descargar es una decision de
   * red; esta es la via explicita para si se quiere instalar.
   *
   * @return los modulos que se han pedido instalar.
   */
  public static Map<String, Object> installMissingModules() {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", true);
    payload.put("source", "studio-bridge");
    payload.put("confidence", "high");
    payload.put("endpoint", "/workbench/modules/install");

    List<Map<String, Object>> installed = new ArrayList<>();
    Display display = Display.getDefault();
    if (display == null) {
      payload.put("installed", installed);
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
      if (title == null || !isMissingModules(title)) {
        continue;
      }
      Button target = findButton(shell, "Download and install all modules available");
      if (target == null) {
        target = findButton(shell, "Download and Install");
      }
      if (target != null) {
        String button = target.getText();
        pressButton(shell, button);
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("title", title);
        item.put("pressed", button);
        installed.add(item);
      }
    }
    payload.put("installed", installed);
    return payload;
  }

  /** El dialogo pide modulos de terceros que no estan instalados. */
  private static boolean isMissingModules(String title) {
    String normalized = title.trim().toLowerCase();
    return normalized.contains("third part")
        || normalized.contains("third-party")
        || normalized.contains("missing third")
        || normalized.contains("modulos de terceros");
  }

  /**
   * Textos de un dialogo, para saber que decia cuando se cierra.
   */
  private static List<String> textsOf(Control control) {
    List<String> texts = new ArrayList<>();
    collectTexts(control, texts);
    return texts;
  }

  private static void collectTexts(Control control, List<String> texts) {
    try {
      if (control instanceof org.eclipse.swt.widgets.Label) {
        String text = ((org.eclipse.swt.widgets.Label) control).getText();
        if (text != null && !text.trim().isEmpty()) {
          texts.add(text.trim());
        }
      }
      if (control instanceof Composite) {
        for (Control child : ((Composite) control).getChildren()) {
          collectTexts(child, texts);
        }
      }
    } catch (RuntimeException e) {
      // El dialogo se ha cerrado mientras se leia: no pasa nada.
    }
  }

  /**
   * El dialogo lleva mas de {@link #PROGRESS_TIMEOUT_MS} abierto.
   */
  private static boolean isStuck(Shell shell) {
    long now = System.currentTimeMillis();
    Long first = FIRST_SEEN.get(shell);
    if (first == null) {
      FIRST_SEEN.put(shell, now);
      return false;
    }
    return now - first > PROGRESS_TIMEOUT_MS;
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
    String clean = normalize(label);
    String wanted = normalize(text);
    if (clean.equals(wanted)) {
      return true;
    }
    // Los botones de Studio a veces llevan el numero de recursos o de
    // elementos ("Gu&ardar 3 de 3", "Seleccionar 2 de 5"). Se comparan por
    // prefijo, sin espacios ni mnemonics.
    return clean.length() > wanted.length() && clean.startsWith(wanted);
  }

  /** Quita el mnemonic y los espacios de un texto de boton. */
  private static String normalize(String value) {
    return value.replace("&", "").replaceAll("\\s+", "").trim();
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
