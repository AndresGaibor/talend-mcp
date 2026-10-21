import { createBridgeClient } from "../src/modules/studio-bridge/adapters/http-studio-bridge.client";
const bridge = await createBridgeClient({ config: { timeoutMs: 120000 } });
const code = `
import java.lang.reflect.*;
import java.util.*;
public class Probe {
  public static Object run() throws Exception {
    StringBuilder sb = new StringBuilder();
    Class<?> itemClass = Class.forName("org.talend.core.model.properties.ContextItem");
    Object eClass = itemClass.getMethod("eClass").invoke(null);
    Method getter = null;
    for (Method m : eClass.getClass().getMethods()) {
      if ("getEStructuralFeature".equals(m.getName()) && m.getParameterCount() == 1 && m.getParameterTypes()[0] == String.class) { getter = m; break; }
    }
    Object feature = getter.invoke(eClass, "context");
    Object etype = feature.getClass().getMethod("getEType").invoke(feature);
    sb.append("tipo de la referencia: ").append(etype.getClass().getName()).append("\\n");
    Object instanceClass = etype.getClass().getMethod("getInstanceClassName").invoke(etype);
    sb.append("clase: ").append(instanceClass).append("\\n");
    // Sus metodos
    try {
      Class<?> ref = Class.forName(String.valueOf(instanceClass));
      for (Method m : ref.getMethods()) {
        if (m.getDeclaringClass() == Object.class) continue;
        if (m.getParameterCount() == 1) sb.append("   .").append(m.getName()).append("(").append(m.getParameterTypes()[0].getSimpleName()).append(")\\n");
      }
    } catch (Throwable e) { sb.append("no se pudo cargar: ").append(e).append("\\n"); }
    return sb.toString();
  }
}`;
const r = await bridge.runCode({ code, className: "Probe" });
console.log(JSON.stringify(r.data ?? r.error, null, 1).slice(0, 2500));
