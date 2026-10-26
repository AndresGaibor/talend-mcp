package com.andres.talend.bridge.workbench;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.eclipse.swt.SWT;
import org.eclipse.swt.custom.CLabel;
import org.eclipse.swt.widgets.Button;
import org.eclipse.swt.widgets.Composite;
import org.eclipse.swt.widgets.Control;
import org.eclipse.swt.widgets.Display;
import org.eclipse.swt.widgets.Label;
import org.eclipse.swt.widgets.Shell;

/**
 * Lista los dialogos visibles de Studio que no son la ventana principal.
 *
 * Es de solo lectura: no pulsa ni cierra nada, a diferencia de
 * {@link ModalGuard#dismissBlockingDialogs()}. Lee widgets, asi que corre en el
 * hilo de la UI, y no compila nada: responde en milisegundos, lo que permite
 * consultarlo antes de cada lanzamiento o compilacion.
 *
 * No lee los campos de texto (`Text`): pueden contener contrasenas.
 */
public final class DialogListService {

  /** Maximo de textos y botones por dialogo. */
  private static final int CAP = 60;

  private DialogListService() {}

  public static Map<String, Object> list() {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", true);
    payload.put("source", "studio-bridge");
    payload.put("confidence", "high");
    payload.put("endpoint", "/workbench/dialogs/list");

    List<Map<String, Object>> dialogs = new ArrayList<>();
    for (Shell shell : Display.getDefault().getShells()) {
      if (shell == null || shell.isDisposed() || !shell.isVisible() || ModalGuard.isWorkbenchShell(shell)) {
        continue;
      }
      Map<String, Object> dialog = new LinkedHashMap<>();
      dialog.put("title", clean(shell.getText()));
      dialog.put("modal", (shell.getStyle() & (SWT.APPLICATION_MODAL | SWT.PRIMARY_MODAL | SWT.SYSTEM_MODAL)) != 0);
      List<String> texts = new ArrayList<>();
      List<String> buttons = new ArrayList<>();
      collect(shell, texts, buttons);
      dialog.put("texts", texts);
      dialog.put("buttons", buttons);
      dialogs.add(dialog);
    }
    payload.put("dialogs", dialogs);
    return payload;
  }

  private static void collect(Control control, List<String> texts, List<String> buttons) {
    if (control instanceof Button) {
      String text = clean(((Button) control).getText());
      if (!text.isEmpty() && buttons.size() < CAP) {
        buttons.add(text);
      }
    } else if (control instanceof Label) {
      String text = clean(((Label) control).getText());
      if (!text.isEmpty() && texts.size() < CAP) {
        texts.add(text);
      }
    } else if (control instanceof CLabel) {
      String text = clean(((CLabel) control).getText());
      if (!text.isEmpty() && texts.size() < CAP) {
        texts.add(text);
      }
    }
    if (control instanceof Composite) {
      for (Control child : ((Composite) control).getChildren()) {
        collect(child, texts, buttons);
      }
    }
  }

  private static String clean(String text) {
    return text == null ? "" : text.replace("&", "").trim();
  }
}
