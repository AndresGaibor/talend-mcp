/**
 * Sondas Java de solo lectura para `talend_studio_ui_inventory`.
 *
 * Se envian a `/automation/run-code`. Son constantes y no rutas de fichero: el
 * tool funciona igual desde cualquier maquina. Ninguna sonda pulsa botones,
 * cierra ventanas, guarda ni cambia la seleccion: lo verifica
 * `tests/talend/studio-ui-inventory.test.ts`.
 */

/** Lee widgets del workbench. Debe correr en el hilo de la UI (`uiThread: true`). */
export const UI_WIDGET_PROBE_CLASS = "TalendUiWidgetProbe";

export const UI_WIDGET_PROBE_SOURCE = `import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.eclipse.swt.custom.CLabel;
import org.eclipse.swt.custom.CTabFolder;
import org.eclipse.swt.custom.CTabItem;
import org.eclipse.swt.widgets.Button;
import org.eclipse.swt.widgets.Composite;
import org.eclipse.swt.widgets.Control;
import org.eclipse.swt.widgets.Display;
import org.eclipse.swt.widgets.Label;
import org.eclipse.swt.widgets.Menu;
import org.eclipse.swt.widgets.MenuItem;
import org.eclipse.swt.widgets.Shell;
import org.eclipse.swt.widgets.Table;
import org.eclipse.swt.widgets.TableColumn;
import org.eclipse.swt.widgets.ToolBar;
import org.eclipse.swt.widgets.ToolItem;
import org.eclipse.swt.widgets.Tree;
import org.eclipse.swt.widgets.TreeItem;
import org.eclipse.ui.PlatformUI;

// Solo lectura: no pulsa, no cierra, no guarda y no cambia la seleccion.
public class TalendUiWidgetProbe {

  static final int CAP = 140;

  static String clean(String text) {
    return text == null ? "" : text.replace("&", "").trim();
  }

  static void menus(Menu menu, String prefix, int depth, List<String> acc) {
    if (menu == null || depth > 1) {
      return;
    }
    for (MenuItem item : menu.getItems()) {
      String text = clean(item.getText());
      String path = prefix.isEmpty() ? text : prefix + " > " + text;
      if (!text.isEmpty()) {
        acc.add(item.getEnabled() ? path : path + " [off]");
      }
      menus(item.getMenu(), path, depth + 1, acc);
    }
  }

  static void collect(Control control, List<Control> acc) {
    acc.add(control);
    if (control instanceof Composite) {
      for (Control child : ((Composite) control).getChildren()) {
        collect(child, acc);
      }
    }
  }

  static void contents(Control control, List<String> acc) {
    if (acc.size() >= CAP) {
      return;
    }
    if (control instanceof Button) {
      String text = clean(((Button) control).getText());
      if (!text.isEmpty()) {
        acc.add("btn:" + text);
      }
    } else if (control instanceof Label) {
      String text = clean(((Label) control).getText());
      if (!text.isEmpty()) {
        acc.add("lbl:" + text);
      }
    } else if (control instanceof CLabel) {
      String text = clean(((CLabel) control).getText());
      if (!text.isEmpty()) {
        acc.add("clbl:" + text);
      }
    } else if (control instanceof Table) {
      for (TableColumn column : ((Table) control).getColumns()) {
        acc.add("col:" + clean(column.getText()));
      }
    } else if (control instanceof ToolBar) {
      for (ToolItem item : ((ToolBar) control).getItems()) {
        String tip = item.getToolTipText();
        if (tip != null && !tip.isEmpty()) {
          acc.add("tool:" + tip.replace("\\n", " "));
        }
      }
    }
    if (control instanceof Composite) {
      for (Control child : ((Composite) control).getChildren()) {
        contents(child, acc);
      }
    }
  }

  public static Object run() {
    Map<String, Object> out = new LinkedHashMap<>();
    Shell main = PlatformUI.getWorkbench().getActiveWorkbenchWindow().getShell();
    out.put("windowTitle", clean(main.getText()));

    List<String> visibleShells = new ArrayList<>();
    for (Shell shell : Display.getDefault().getShells()) {
      if (!shell.isDisposed() && shell.isVisible()) {
        visibleShells.add(clean(shell.getText()) + " | " + shell.getClass().getSimpleName());
      }
    }
    out.put("visibleShells", visibleShells);

    List<String> menuBar = new ArrayList<>();
    menus(main.getMenuBar(), "", 0, menuBar);
    out.put("menuBar", menuBar);

    List<Control> all = new ArrayList<>();
    collect(main, all);

    List<Object> folders = new ArrayList<>();
    List<String> toolBar = new ArrayList<>();
    List<Object> trees = new ArrayList<>();
    Map<String, Object> panels = new LinkedHashMap<>();
    for (Control control : all) {
      if (control instanceof CTabFolder) {
        CTabFolder folder = (CTabFolder) control;
        Map<String, Object> entry = new LinkedHashMap<>();
        List<String> items = new ArrayList<>();
        for (CTabItem item : folder.getItems()) {
          items.add(clean(item.getText()));
        }
        entry.put("items", items);
        entry.put("selected", folder.getSelection() == null ? null : clean(folder.getSelection().getText()));
        folders.add(entry);
        for (CTabItem item : folder.getItems()) {
          if (item.getControl() != null && !item.getControl().isDisposed()) {
            List<String> content = new ArrayList<>();
            contents(item.getControl(), content);
            panels.put(clean(item.getText()) + " #" + folders.size(), content);
          }
        }
      } else if (control instanceof ToolBar) {
        for (ToolItem item : ((ToolBar) control).getItems()) {
          String tip = item.getToolTipText();
          if (tip != null && !tip.isEmpty()) {
            toolBar.add(tip.replace("\\n", " "));
          }
        }
      } else if (control instanceof Tree && control.isVisible()) {
        List<String> roots = new ArrayList<>();
        for (TreeItem item : ((Tree) control).getItems()) {
          roots.add(clean(item.getText()));
        }
        trees.add(roots);
      }
    }
    out.put("tabFolders", folders);
    out.put("toolBarTooltips", toolBar);
    out.put("trees", trees);
    out.put("panels", panels);
    return out;
  }
}
`;

/** Lee registros de perspectivas, vistas y clases de dialogos. Corre fuera del hilo de la UI. */
export const UI_REGISTRY_PROBE_CLASS = "TalendUiRegistryProbe";

export const UI_REGISTRY_PROBE_SOURCE = `import java.net.URL;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Enumeration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.TreeSet;

import org.eclipse.ui.IPerspectiveDescriptor;
import org.eclipse.ui.PlatformUI;
import org.eclipse.ui.views.IViewDescriptor;
import org.osgi.framework.Bundle;
import org.osgi.framework.FrameworkUtil;

// Solo lectura. Recorrer los bundles es lento: por eso no corre en el hilo de la UI.
public class TalendUiRegistryProbe {

  static final String BUNDLE_FILTER = "(?i).*(publish|feature|studiolite|module|runprocess|designer.core|repository.ui|core.ui|cloud|git|problem|exception|error|contextmanager|dataprofiler|jobsettings|setting|export|import|testcontainer).*";
  static final String CLASS_FILTER = ".*(Dialog|Wizard|WizardPage|PreferencePage|View|Handler)$";
  static final int SAMPLE = 40;

  public static Object run() throws Exception {
    Map<String, Object> out = new LinkedHashMap<>();

    List<String> perspectives = new ArrayList<>();
    for (IPerspectiveDescriptor p : PlatformUI.getWorkbench().getPerspectiveRegistry().getPerspectives()) {
      perspectives.add(p.getId() + " = " + p.getLabel());
    }
    Collections.sort(perspectives);
    out.put("perspectives", perspectives);

    int totalViews = 0;
    List<String> talendViews = new ArrayList<>();
    for (IViewDescriptor view : PlatformUI.getWorkbench().getViewRegistry().getViews()) {
      totalViews++;
      if (view.getId().startsWith("org.talend") || view.getId().contains("designer")) {
        talendViews.add(view.getId() + " = " + view.getLabel());
      }
    }
    Collections.sort(talendViews);
    Map<String, Object> views = new LinkedHashMap<>();
    views.put("total", totalViews);
    views.put("talend", talendViews);
    out.put("views", views);

    Bundle[] all = FrameworkUtil.getBundle(PlatformUI.class).getBundleContext().getBundles();
    Map<String, Object> dialogs = new TreeMap<>();
    int talendBundles = 0;
    for (Bundle bundle : all) {
      String name = bundle.getSymbolicName();
      if (name == null || !name.startsWith("org.talend")) {
        continue;
      }
      talendBundles++;
      if (!name.matches(BUNDLE_FILTER)) {
        continue;
      }
      TreeSet<String> hits = new TreeSet<>();
      Enumeration<URL> entries = bundle.findEntries("/", "*.class", true);
      while (entries != null && entries.hasMoreElements()) {
        String path = entries.nextElement().getPath();
        String simple = path.substring(path.lastIndexOf('/') + 1).replace(".class", "");
        if (!simple.contains("$") && simple.matches(CLASS_FILTER)) {
          hits.add(simple);
        }
      }
      if (!hits.isEmpty()) {
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("count", hits.size());
        entry.put("sample", new ArrayList<>(hits).subList(0, Math.min(SAMPLE, hits.size())));
        dialogs.put(name, entry);
      }
    }
    out.put("talendBundles", talendBundles);
    out.put("dialogs", dialogs);
    return out;
  }
}
`;

/**
 * Lista los dialogos visibles que no son la ventana principal. Rapida: solo
 * lee widgets, asi que puede correr en cada lanzamiento. No lee campos de texto
 * (`Text`), porque pueden contener contrasenas. Debe correr en el hilo de la UI.
 */
export const UI_DIALOG_PROBE_CLASS = "TalendUiDialogProbe";

export const UI_DIALOG_PROBE_SOURCE = `import java.util.ArrayList;
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
import org.eclipse.ui.IWorkbenchWindow;
import org.eclipse.ui.PlatformUI;

// Solo lectura: no pulsa, no cierra y no cambia nada.
public class TalendUiDialogProbe {

  static final int CAP = 60;

  static String clean(String text) {
    return text == null ? "" : text.replace("&", "").trim();
  }

  static boolean isWorkbench(Shell shell) {
    for (IWorkbenchWindow window : PlatformUI.getWorkbench().getWorkbenchWindows()) {
      if (window.getShell() == shell) {
        return true;
      }
    }
    return false;
  }

  static void collect(Control control, List<String> texts, List<String> buttons) {
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

  public static Object run() {
    List<Object> dialogs = new ArrayList<>();
    for (Shell shell : Display.getDefault().getShells()) {
      if (shell.isDisposed() || !shell.isVisible() || isWorkbench(shell)) {
        continue;
      }
      Map<String, Object> entry = new LinkedHashMap<>();
      entry.put("title", clean(shell.getText()));
      entry.put("modal", (shell.getStyle() & (SWT.APPLICATION_MODAL | SWT.PRIMARY_MODAL | SWT.SYSTEM_MODAL)) != 0);
      List<String> texts = new ArrayList<>();
      List<String> buttons = new ArrayList<>();
      collect(shell, texts, buttons);
      entry.put("texts", texts);
      entry.put("buttons", buttons);
      dialogs.add(entry);
    }
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("dialogs", dialogs);
    return out;
  }
}
`;
