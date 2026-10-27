package com.andres.talend.bridge.automation;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.jar.Attributes;
import java.util.jar.JarOutputStream;
import java.util.jar.Manifest;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import javax.tools.JavaCompiler;
import javax.tools.ToolProvider;
import javax.xml.parsers.DocumentBuilderFactory;

import org.w3c.dom.Element;
import org.w3c.dom.Node;

import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.core.runtime.NullProgressMonitor;

import com.andres.talend.bridge.UiThread;
import com.google.gson.JsonObject;

/**
 * Construye un job sin ejecutarlo: genera el codigo, lo compila y deja el
 * `target/classpath.jar` que lee `executeJob`.
 *
 * Un job principal se compila con `javac` directamente: el build de Maven tardaba unos
 * 6 s por job, casi todo en el `install`, y el job no necesita estar en el `.m2`. Un
 * auxiliar (el hijo de un tRunJob) si se instala con Maven: su padre lo resuelve desde
 * el `.m2` por coordenada.
 *
 * La generacion va en el hilo de la UI: la validacion de sintaxis toca widgets del
 * editor, igual que en JobCompiler. La compilacion no toca widgets: corre en el hilo que
 * atiende la peticion y la UI queda libre mientras tanto.
 */
public final class JobBuilder {

  private JobBuilder() {}

  private static final long GENERATE_TIMEOUT_MS = 180_000L;
  private static final String VERSION = "0.1";
  /** Opciones de ProcessorUtilities.generateCode (constantes de Studio, comprobadas con javap). */
  private static final int GENERATE_MAIN_ONLY = 2;
  private static final int GENERATE_WITHOUT_COMPILING = 32;

  /** Jars del .m2 de Studio por nombre de archivo. Se llena una vez y se reutiliza. */
  private static Map<String, Path> indiceM2;

  /**
   * @param spec `job` opcional (si no, el job activo); `instalar` true para un auxiliar.
   */
  public static Map<String, Object> build(JsonObject spec) throws Exception {
    Generated generated = UiThread.sync(() -> generate(spec), GENERATE_TIMEOUT_MS);

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("job", generated.jobName);
    result.put("generationMs", generated.generationMs);
    result.put("generateMs", generated.generateMs);
    if (generated.error != null) {
      result.put("compiles", false);
      result.put("error", generated.error);
      return result;
    }
    result.put("compiles", true);

    long started = System.currentTimeMillis();
    try {
      Path folder = JobExecutor.generatedFolder(generated.jobName, VERSION);
      if (folder == null) {
        throw new IllegalStateException("No se encuentra la carpeta generada del job " + generated.jobName);
      }
      long paso = System.currentTimeMillis();
      List<Path> classpath = classpathDelJob(generated.processor, folder);
      result.put("classpathMs", System.currentTimeMillis() - paso);
      paso = System.currentTimeMillis();
      if (JsonSpec.booleanOf(spec, "instalar", false)) {
        construirConMaven(generated.processor);
        result.put("metodo", "maven");
      } else {
        compilarConJavac(folder, classpath);
        result.put("metodo", "javac");
      }
      result.put("compileMs", System.currentTimeMillis() - paso);
      paso = System.currentTimeMillis();
      escribirClasspathJar(folder, classpath);
      result.put("jarMs", System.currentTimeMillis() - paso);
      result.put("built", true);
    } catch (Exception e) {
      result.put("built", false);
      result.put("error", JobCompiler.describe(JobCompiler.rootMessage(e)));
    }
    result.put("buildMs", System.currentTimeMillis() - started);
    return result;
  }

  /**
   * El build de Maven de Studio (`buildModules` del proyecto Java del job). Instala el jar
   * en el `.m2`, que es lo que necesita un job padre para llamar a este.
   */
  private static void construirConMaven(Object processor) throws Exception {
    Object project = processor.getClass().getMethod("getTalendJavaProject").invoke(processor);
    Class<?> projectInterface = TalendClasses.load("org.talend.core.runtime.process.ITalendProcessJavaProject");
    Method buildModules = projectInterface.getMethod("buildModules", IProgressMonitor.class, String[].class, Map.class);
    // El segundo argumento son los modulos a construir: vacio = el job.
    buildModules.invoke(project, new NullProgressMonitor(), new String[0], new HashMap<String, Object>());
  }

  /**
   * Compila las fuentes generadas (`src/main/java`) a `target/classes` con el compilador del
   * JDK de Studio, y copia los recursos (`src/main/resources`) junto a las clases.
   */
  private static void compilarConJavac(Path folder, List<Path> classpath) throws Exception {
    JavaCompiler compilador = ToolProvider.getSystemJavaCompiler();
    if (compilador == null) {
      throw new IllegalStateException("Studio no tiene un compilador de Java (JDK)");
    }
    Path clases = folder.resolve("target").resolve("classes");
    Path fuentes = folder.resolve("src").resolve("main").resolve("java");
    Files.createDirectories(clases);

    List<String> argumentos = new ArrayList<>(Arrays.asList(
        "-encoding", "UTF-8", "-nowarn", "-proc:none",
        "-d", clases.toString(),
        // Sin target/classes: puede tener clases de builds anteriores que no deben entrar.
        "-cp", classpath.stream().filter(ruta -> !ruta.equals(clases))
            .map(Path::toString).collect(Collectors.joining(File.pathSeparator))));
    try (Stream<Path> archivos = Files.walk(fuentes)) {
      archivos.filter(ruta -> ruta.toString().endsWith(".java"))
          .forEach(ruta -> argumentos.add(ruta.toString()));
    }
    ByteArrayOutputStream errores = new ByteArrayOutputStream();
    int codigo = compilador.run(null, null, errores, argumentos.toArray(new String[0]));
    if (codigo != 0) {
      long existentes = classpath.stream().filter(Files::exists).count();
      throw new IllegalStateException(errores.toString(StandardCharsets.UTF_8.name()).trim()
          + " [classpath: " + existentes + " de " + classpath.size() + " entradas existen]");
    }
    copiarRecursos(folder.resolve("src").resolve("main").resolve("resources"), clases);
  }

  /** Copia el contenido de `origen` a `destino`, conservando la estructura. */
  private static void copiarRecursos(Path origen, Path destino) throws IOException {
    if (!Files.isDirectory(origen)) {
      return;
    }
    try (Stream<Path> recursos = Files.walk(origen)) {
      for (Path recurso : recursos.collect(Collectors.toList())) {
        Path copia = destino.resolve(origen.relativize(recurso).toString());
        if (Files.isDirectory(recurso)) {
          Files.createDirectories(copia);
        } else {
          Files.createDirectories(copia.getParent());
          Files.copy(recurso, copia, StandardCopyOption.REPLACE_EXISTING);
        }
      }
    }
  }

  /**
   * Las carpetas y jars que necesita el job, en el orden del classpath: sus clases, sus
   * recursos, las rutinas del proyecto y las librerias.
   *
   * Studio calcula la lista de librerias en `initJobClasspath` (campos del procesador, en
   * rutas relativas). Aqui se fuerza el modo absoluto y se resuelven las relativas en el
   * `.m2` por nombre. Los jobs hijos (tRunJob) van en el pom del job, no en esa lista.
   */
  private static List<Path> classpathDelJob(Object processor, Path folder) throws Exception {
    desactivarClasspathRelativo(processor);
    processor.getClass().getMethod("initJobClasspath").invoke(processor);

    // Las rutinas estan en poms/code. La carpeta del job cuelga de poms a distinta profundidad segun
    // como se creo: poms/jobs/process/<JOB>/<job>_<version> (editor) o poms/jobs/process/<job>_<version>.
    Path poms = folder;
    while (poms != null && !"poms".equals(String.valueOf(poms.getFileName()))) {
      poms = poms.getParent();
    }
    if (poms == null) {
      throw new IllegalStateException("La carpeta del job no esta bajo una carpeta poms: " + folder);
    }
    List<Path> rutas = new ArrayList<>();
    rutas.add(folder.resolve("target").resolve("classes"));
    rutas.add(folder.resolve("src").resolve("main").resolve("ext-resources"));
    rutas.add(poms.resolve("code").resolve("routines").resolve("target").resolve("classes"));
    List<Path> libs = librerias(processor);
    rutas.addAll(libs);
    Path m2 = raizDelM2(libs.stream().map(Path::toString).collect(Collectors.toList()));
    if (m2 == null) {
      m2 = m2DeStudio();
    }
    if (m2 != null) {
      rutas.addAll(dependenciasDelPom(folder.resolve("pom.xml"), m2));
      // Las rutinas del sistema van en todo job de Talend. Un item que no las declara (p. ej. uno escrito
      // por fichero) no las trae en su lista, y el codigo generado no compila ("package routines does not exist").
      // jboss-marshalling la usan las clases de fila generadas (readData/writeData) en todo job.
      for (String libreria : new String[] {"system-routines.jar", "system-routines-dq.jar", "routines.jar",
          "jboss-marshalling.jar"}) {
        Path jar = jarDelM2(m2, libreria);
        if (jar != null && !rutas.contains(jar)) {
          rutas.add(jar);
        }
      }
    }
    return rutas;
  }

  /**
   * Escribe el `target/classpath.jar` que lee executeJob: un jar sin clases cuyo MANIFEST
   * lista en `Class-Path` las rutas del classpath (solo las que existen). El build de Maven
   * no lo escribe; el Run lo hace con rutas absolutas, igual que aqui.
   */
  private static void escribirClasspathJar(Path folder, List<Path> classpath) throws IOException {
    List<String> urls = new ArrayList<>();
    for (Path ruta : classpath) {
      urls.add(urlDe(ruta));
    }
    Manifest manifest = new Manifest();
    manifest.getMainAttributes().put(Attributes.Name.MANIFEST_VERSION, "1.0");
    manifest.getMainAttributes().put(Attributes.Name.CLASS_PATH,
        urls.stream().filter(url -> !url.isEmpty()).collect(Collectors.joining(" ")));

    Path jar = folder.resolve("target").resolve("classpath.jar");
    Files.createDirectories(jar.getParent());
    try (JarOutputStream out = new JarOutputStream(Files.newOutputStream(jar), manifest)) {
      // El manifest se escribe al abrir el jar; no hay entradas que añadir.
    }
  }

  /**
   * Las librerias del job que existen en disco.
   *
   * Vienen de `getLibsClasspath()` y del campo de classpath del procesador. Las absolutas
   * se usan tal cual; las relativas (`../lib/X.jar`) se buscan en el .m2 por nombre.
   */
  private static List<Path> librerias(Object processor) throws Exception {
    Set<String> entradas = new LinkedHashSet<>();
    try {
      Method libs = metodoDelProcesador(processor, "getLibsClasspath");
      libs.setAccessible(true);
      entradas.addAll(Arrays.asList(String.valueOf(libs.invoke(processor)).split(";")));
    } catch (NoSuchMethodException e) {
      // Sin el metodo, quedan las entradas del campo.
    }
    String campo = System.getProperty("os.name", "").toLowerCase().startsWith("windows")
        ? "windowsClasspath" : "unixClasspath";
    Field field = campoDelProcesador(processor, campo);
    field.setAccessible(true);
    entradas.addAll(Arrays.asList(String.valueOf(field.get(processor)).split(";")));

    Path m2 = raizDelM2(entradas);
    if (m2 == null) {
      m2 = m2DeStudio();
    }
    List<Path> rutas = new ArrayList<>();
    for (String entrada : entradas) {
      String ruta = entrada.trim();
      if (ruta.matches("^([A-Za-z]:|/).*")) {
        // Studio escribe las rutas de Windows como "/C:/..."; Paths.get solo acepta "C:/...".
        String sinBarra = ruta.matches("^/[A-Za-z]:.*") ? ruta.substring(1) : ruta;
        rutas.add(Paths.get(sinBarra));
      } else if (m2 != null && ruta.endsWith(".jar")) {
        // Una libreria relativa (`../lib/X.jar`) es la que Studio tiene en su .m2: se busca por nombre.
        Path jar = jarDelM2(m2, ruta.substring(ruta.lastIndexOf('/') + 1));
        if (jar != null) {
          rutas.add(jar);
        }
      }
    }
    return rutas;
  }

  /**
   * Los jars de las dependencias de primer nivel del pom del job, resueltos en el .m2 por
   * coordenada (`groupId/artifactId/version/artifactId-version.jar`). Solo los que existen.
   */
  private static List<Path> dependenciasDelPom(Path pom, Path raiz) throws Exception {
    List<Path> rutas = new ArrayList<>();
    if (!Files.isRegularFile(pom)) {
      return rutas;
    }
    Element proyecto = DocumentBuilderFactory.newInstance().newDocumentBuilder()
        .parse(pom.toFile()).getDocumentElement();
    for (Element dependencias : elementosHijos(proyecto, "dependencies")) {
      for (Element dependencia : elementosHijos(dependencias, "dependency")) {
        String grupo = textoDeHijo(dependencia, "groupId");
        String artefacto = textoDeHijo(dependencia, "artifactId");
        String version = textoDeHijo(dependencia, "version");
        if (grupo.isEmpty() || artefacto.isEmpty() || version.isEmpty() || version.contains("${")) {
          continue;
        }
        Path jar = raiz.resolve(grupo.replace('.', '/')).resolve(artefacto).resolve(version)
            .resolve(artefacto + "-" + version + ".jar");
        if (Files.exists(jar)) {
          rutas.add(jar);
        }
      }
    }
    return rutas;
  }

  private static List<Element> elementosHijos(Element padre, String nombre) {
    List<Element> hijos = new ArrayList<>();
    for (Node nodo = padre.getFirstChild(); nodo != null; nodo = nodo.getNextSibling()) {
      if (nodo instanceof Element && nombre.equals(nodo.getNodeName())) {
        hijos.add((Element) nodo);
      }
    }
    return hijos;
  }

  private static String textoDeHijo(Element padre, String nombre) {
    List<Element> hijos = elementosHijos(padre, nombre);
    return hijos.isEmpty() ? "" : hijos.get(0).getTextContent().trim();
  }

  /**
   * La raiz del .m2 de Studio (`<instalacion>/configuration/.m2/repository`), de la propiedad
   * `osgi.install.area`. Es el respaldo cuando la lista de Studio no trae ninguna ruta absoluta de la que deducirla.
   */
  private static Path m2DeStudio() {
    try {
      Path instalacion = Paths.get(new java.net.URI(System.getProperty("osgi.install.area")));
      Path m2 = instalacion.resolve("configuration").resolve(".m2").resolve("repository");
      return Files.isDirectory(m2) ? m2 : null;
    } catch (Exception e) {
      return null;
    }
  }

  /** La raiz del .m2 de Studio, deducida de una ruta absoluta de las entradas (o null si no hay ninguna). */
  private static Path raizDelM2(Collection<String> entradas) {
    for (String entrada : entradas) {
      String ruta = entrada.trim().replace('\\', '/');
      int fin = ruta.indexOf("/.m2/repository");
      if (fin >= 0 && ruta.matches("^([A-Za-z]:|/).*")) {
        String raiz = ruta.substring(0, fin + "/.m2/repository".length());
        return Paths.get(raiz.matches("^/[A-Za-z]:.*") ? raiz.substring(1) : raiz);
      }
    }
    return null;
  }

  /**
   * El jar de un nombre relativo dentro del .m2: el mismo nombre, o `X-<version>.jar` cuando
   * Studio lo lista sin version (`system-routines.jar` es `system-routines-8.0.1.jar`).
   */
  private static Path jarDelM2(Path raiz, String nombre) throws IOException {
    Map<String, Path> indice = indiceDelM2(raiz);
    Path exacto = indice.get(nombre);
    if (exacto != null) {
      return exacto;
    }
    // Los `-sources` y `-javadoc` cumplen el mismo patron y no son el jar que hace falta.
    Pattern conVersion = Pattern.compile(Pattern.quote(nombre.substring(0, nombre.length() - 4)) + "-\\d.*\\.jar");
    return indice.entrySet().stream()
        .filter(entrada -> conVersion.matcher(entrada.getKey()).matches())
        .filter(entrada -> !entrada.getKey().endsWith("-sources.jar") && !entrada.getKey().endsWith("-javadoc.jar"))
        .map(Map.Entry::getValue)
        .sorted()
        .findFirst()
        .orElse(null);
  }

  /** Indice nombre de archivo -> ruta de los jars del .m2, que se recorre una sola vez por proceso. */
  private static synchronized Map<String, Path> indiceDelM2(Path raiz) throws IOException {
    if (indiceM2 == null) {
      Map<String, Path> indice = new HashMap<>();
      try (Stream<Path> archivos = Files.walk(raiz)) {
        archivos.filter(ruta -> ruta.toString().endsWith(".jar"))
            .forEach(ruta -> indice.putIfAbsent(ruta.getFileName().toString(), ruta));
      }
      indiceM2 = indice;
    }
    return indiceM2;
  }

  private static Method metodoDelProcesador(Object processor, String nombre) throws NoSuchMethodException {
    for (Class<?> clase = processor.getClass(); clase != null; clase = clase.getSuperclass()) {
      try {
        return clase.getDeclaredMethod(nombre);
      } catch (NoSuchMethodException e) {
        // Se busca en la superclase.
      }
    }
    throw new NoSuchMethodException(nombre);
  }

  /** Forza el modo de classpath absoluto (la propiedad `useRelativeClasspath` del procesador de Java). */
  private static void desactivarClasspathRelativo(Object processor) {
    try {
      Field field = campoDelProcesador(processor, "useRelativeClasspath");
      field.setAccessible(true);
      field.setBoolean(processor, false);
    } catch (NoSuchFieldException | IllegalAccessException | RuntimeException e) {
      // Sin el campo, Studio decide el modo: las rutas relativas se descartan despues.
    }
  }

  private static Field campoDelProcesador(Object processor, String nombre) throws NoSuchFieldException {
    for (Class<?> clase = processor.getClass(); clase != null; clase = clase.getSuperclass()) {
      try {
        return clase.getDeclaredField(nombre);
      } catch (NoSuchFieldException e) {
        // Se busca en la superclase.
      }
    }
    throw new NoSuchFieldException(nombre);
  }

  /** La URL de una ruta para un `Class-Path`: barras normales, `/` delante en unidades de Windows. */
  private static String urlDe(Path ruta) {
    if (!Files.exists(ruta)) {
      return "";
    }
    String texto = ruta.toAbsolutePath().toString().replace('\\', '/');
    if (!texto.startsWith("/")) {
      texto = "/" + texto;
    }
    return Files.isDirectory(ruta) && !texto.endsWith("/") ? texto + "/" : texto;
  }

  /**
   * Construye muchos jobs del repositorio sin abrir su editor: por cada uno genera el codigo desde
   * su item (`ProcessorUtilities.generateCode(ProcessItem, ...)` con GENERATE_WITHOUT_COMPILING),
   * lo compila con javac y escribe su `classpath.jar`.
   *
   * Sin editor no hay paleta que construir ni editor que Studio retenga: ~0,2 s de generacion por job
   * en vez de ~2 s, y la memoria no crece. La generacion va en serie (el generador de Talend no se
   * comparte entre hilos); la compilacion y el jar van en un grupo de hilos.
   *
   * @param spec `jobs` (nombres) y `parallelism` opcional (por defecto, la mitad de los nucleos).
   */
  public static Map<String, Object> buildBatch(JsonObject spec) throws Exception {
    List<String> nombres = new ArrayList<>();
    for (com.google.gson.JsonElement nombre : spec.getAsJsonArray("jobs")) {
      nombres.add(nombre.getAsString());
    }
    int hilos = spec.has("parallelism")
        ? Math.max(1, spec.get("parallelism").getAsInt())
        : Math.max(1, Runtime.getRuntime().availableProcessors() / 2);

    Class<?> utilities = TalendClasses.load("org.talend.designer.runprocess.ProcessorUtilities");
    Class<?> itemClass = TalendClasses.load("org.talend.core.model.properties.ProcessItem");
    Class<?> monitorClass = TalendClasses.load("org.eclipse.core.runtime.IProgressMonitor");
    Method generate = utilities.getMethod("generateCode", itemClass, String.class, String.class, Map.class,
        java.lang.reflect.Array.newInstance(monitorClass, 0).getClass());
    Object monitores = java.lang.reflect.Array.newInstance(monitorClass, 1);
    java.lang.reflect.Array.set(monitores, 0, new NullProgressMonitor());

    // Etiqueta -> {item, version}: un solo recorrido del repositorio para todo el lote.
    Class<?> factoryClass = TalendClasses.load("org.talend.core.repository.model.ProxyRepositoryFactory");
    Class<?> typesClass = TalendClasses.load("org.talend.core.model.repository.ERepositoryObjectType");
    Object factory = factoryClass.getMethod("getInstance").invoke(null);
    List<?> todos = (List<?>) factoryClass.getMethod("getAll", typesClass)
        .invoke(factory, typesClass.getField("PROCESS").get(null));
    Map<String, Object[]> items = new HashMap<>();
    for (Object objeto : todos) {
      Object propiedad = objeto.getClass().getMethod("getProperty").invoke(objeto);
      Object item = propiedad.getClass().getMethod("getItem").invoke(propiedad);
      if (itemClass.isInstance(item)) {
        items.put(String.valueOf(propiedad.getClass().getMethod("getLabel").invoke(propiedad)),
            new Object[] {item, String.valueOf(propiedad.getClass().getMethod("getVersion").invoke(propiedad))});
      }
    }

    long inicio = System.currentTimeMillis();
    java.util.concurrent.ExecutorService pool = java.util.concurrent.Executors.newFixedThreadPool(hilos);
    Map<String, Map<String, Object>> resultados = new java.util.LinkedHashMap<>();
    Map<String, java.util.concurrent.Future<Map<String, Object>>> pendientes = new java.util.LinkedHashMap<>();
    try {
      // Cada generateCode crea y reescribe recursos del workspace (proyecto Maven, pom, plantillas). Sueltos, cada
      // uno es una operacion con su regla, sus deltas y sus notificaciones, y el coste crece con el tamano del
      // workspace (medido: de 0,4 a 2,2 s por job con 1000 jobs). Agrupados en una sola operacion con la regla
      // raiz, el workspace trabaja una vez y notifica al final.
      org.eclipse.core.resources.IWorkspace workspace = org.eclipse.core.resources.ResourcesPlugin.getWorkspace();
      workspace.run(monitor -> {
      for (String nombre : nombres) {
        Map<String, Object> fila = new LinkedHashMap<>();
        resultados.put(nombre, fila);
        Object[] encontrado = items.get(nombre);
        if (encontrado == null) {
          fila.put("ok", false);
          fila.put("error", "El job no existe en el repositorio");
          continue;
        }
        long t = System.currentTimeMillis();
        Object processor;
        try {
          Map<String, Object> opciones = new HashMap<>();
          opciones.put("GENERATE_OPTION", GENERATE_MAIN_ONLY | GENERATE_WITHOUT_COMPILING);
          processor = generate.invoke(null, encontrado[0], "Default", encontrado[1], opciones, monitores);
        } catch (ReflectiveOperationException e) {
          fila.put("ok", false);
          fila.put("error", JobCompiler.describe(JobCompiler.rootMessage(e)));
          continue;
        }
        fila.put("generateMs", System.currentTimeMillis() - t);
        final Object generado = processor;
        final String version = (String) encontrado[1];
        pendientes.put(nombre, pool.submit(() -> {
          Map<String, Object> parte = new LinkedHashMap<>();
          long paso = System.currentTimeMillis();
          Path folder = JobExecutor.generatedFolder(nombre, version);
          if (folder == null) {
            throw new IllegalStateException("No se encuentra la carpeta generada del job " + nombre);
          }
          List<Path> classpath = classpathDelJob(generado, folder);
          compilarConJavac(folder, classpath);
          escribirClasspathJar(folder, classpath);
          parte.put("compileMs", System.currentTimeMillis() - paso);
          return parte;
        }));
      }
      }, workspace.getRoot(), org.eclipse.core.resources.IWorkspace.AVOID_UPDATE, new NullProgressMonitor());
      for (Map.Entry<String, java.util.concurrent.Future<Map<String, Object>>> entrada : pendientes.entrySet()) {
        Map<String, Object> fila = resultados.get(entrada.getKey());
        try {
          fila.putAll(entrada.getValue().get());
          fila.put("ok", true);
        } catch (java.util.concurrent.ExecutionException e) {
          fila.put("ok", false);
          fila.put("error", JobCompiler.describe(JobCompiler.rootMessage(e)));
        }
      }
    } finally {
      pool.shutdown();
    }

    int correctos = 0;
    for (Map<String, Object> fila : resultados.values()) {
      if (Boolean.TRUE.equals(fila.get("ok"))) {
        correctos++;
      }
    }
    Map<String, Object> resultado = new LinkedHashMap<>();
    resultado.put("total", nombres.size());
    resultado.put("correctos", correctos);
    resultado.put("parallelism", hilos);
    resultado.put("totalMs", System.currentTimeMillis() - inicio);
    resultado.put("jobs", resultados);
    return resultado;
  }

  /** Genera el codigo en la UI y comprueba que compila. Devuelve el procesador para el build. */
  private static Generated generate(JsonObject spec) throws Exception {
    Object editor = TalendApi.designerEditor(spec);
    Object process = TalendApi.processOf(editor);
    Generated generated = new Generated();
    generated.jobName = String.valueOf(process.getClass().getMethod("getName").invoke(process));

    Object contextManager = process.getClass().getMethod("getContextManager").invoke(process);
    Object context = contextManager.getClass().getMethod("getDefaultContext").invoke(contextManager);

    Class<?> utilities = TalendClasses.load("org.talend.designer.runprocess.ProcessorUtilities");
    Class<?> processClass = TalendClasses.load("org.talend.core.model.process.IProcess");
    Class<?> contextClass = TalendClasses.load("org.talend.core.model.process.IContext");
    Method generateCode = utilities.getMethod("generateCode", processClass, contextClass,
        boolean.class, boolean.class, boolean.class);

    long started = System.currentTimeMillis();
    try {
      // Un job principal se genera sin compilar (GENERATE_WITHOUT_COMPILING, 32) y se compila con
      // javac: sin esa opcion Talend lanza un build de Maven (~7 s) para la informacion de build.
      // Un auxiliar (instalar) necesita su build de Maven, asi que se genera como siempre.
      if (JsonSpec.booleanOf(spec, "instalar", false)) {
        generated.processor = generateCode.invoke(null, process, context, false, false, true);
      } else {
        Method generateSinCompilar = utilities.getMethod("generateCode", processClass, contextClass,
            boolean.class, boolean.class, boolean.class, int.class, IProgressMonitor.class);
        int solo = GENERATE_MAIN_ONLY | GENERATE_WITHOUT_COMPILING;
        generated.processor = generateSinCompilar.invoke(null, process, context, false, false, true,
            solo, new NullProgressMonitor());
      }
      generated.generateMs = System.currentTimeMillis() - started;
      JobCompiler.checkCompilation();
    } catch (InvocationTargetException e) {
      generated.error = JobCompiler.describe(JobCompiler.rootMessage(e));
    } catch (RuntimeException e) {
      generated.error = JobCompiler.describe(JobCompiler.rootMessage(e));
    }
    generated.generationMs = System.currentTimeMillis() - started;
    return generated;
  }

  /** Resultado de la generacion: el procesador (si compila) o el error de compilacion. */
  private static final class Generated {
    String jobName;
    Object processor;
    long generationMs;
    /** Solo `generateCode`; `generationMs` suma la comprobacion de errores de compilacion. */
    long generateMs;
    Map<String, Object> error;
  }
}
