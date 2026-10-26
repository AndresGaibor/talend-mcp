import java.io.ByteArrayInputStream;
import java.io.DataInputStream;
import java.io.File;
import java.io.IOException;
import java.io.PrintStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import java.util.stream.Stream;

/**
 * Detector de deriva de la API de Talend.
 *
 * El bridge llama a las APIs de Talend por reflexion, con nombres de clase y de
 * metodo escritos como texto. Si una version de Studio renombra algo, la llamada
 * no falla ruidosamente: devuelve null y el resultado parece "no existe".
 *
 * Esta herramienta compara esos textos con la API real de una instalacion de
 * Studio. Lee los .class directamente de los jars (sin cargarlos ni necesitar sus
 * dependencias) y reporta:
 *   - clases que el codigo nombra y que no existen en esa instalacion;
 *   - nombres de metodo o de campo que no aparecen en ninguna de las clases de
 *     Talend que el mismo archivo referencia (incluidos sus supertipos).
 *
 * Uso: java ApiDrift.java <carpeta plugins de Studio> <carpeta src del bridge>
 *
 * Es una señal, no un veredicto: un nombre comun (getName, getLabel) puede
 * coincidir con otra clase. Los hallazgos se revisan a mano.
 */
public final class ApiDrift {

  /** Nombres tan comunes que no permiten afirmar nada: se ignoran. */
  private static final Set<String> IGNORED_NAMES = Set.of(
      "getClass", "hashCode", "equals", "toString", "getName", "getMethods", "getMethod",
      "getField", "getConstructor", "newInstance", "invoke", "getLabel", "getDeclaredMethod");

  /** Nombres de clase entre comillas; `$` marca las clases anidadas (Externa$Interna). */
  private static final Pattern TALEND_CLASS = Pattern.compile("\"(org\\.talend\\.[A-Za-z0-9_.$]+)\"");
  private static final Pattern IMPORT = Pattern.compile("^import (?!static )([A-Za-z0-9_.]+);", Pattern.MULTILINE);
  private static final Pattern MEMBER_REF = Pattern.compile(
      "getMethod\\(\\s*\"([A-Za-z0-9_$]+)\"|invokeOrNull\\([^;]*?,\\s*\"([A-Za-z0-9_$]+)\"|getField\\(\\s*\"([A-Za-z0-9_$]+)\"");

  /** Lo que hace falta de un .class: su nombre, su superclase, sus interfaces y sus miembros. */
  static final class ClassInfo {
    String superName;
    final List<String> interfaces = new ArrayList<>();
    final Set<String> members = new HashSet<>();
  }

  /** Nombre de clase -> jar que la contiene. */
  private final Map<String, String> index = new HashMap<>();
  private final Map<String, ClassInfo> parsed = new HashMap<>();

  public static void main(String[] args) throws IOException {
    if (args.length < 2) {
      System.err.println("Uso: java ApiDrift.java <carpeta plugins de Studio> <carpeta src del bridge>");
      System.err.println("     java ApiDrift.java <carpeta plugins de Studio> --find <nombre> [<nombre>...]");
      System.exit(2);
    }
    ApiDrift drift = new ApiDrift();
    drift.indexJars(Paths.get(args[0]));
    System.out.println("Clases de Studio indexadas: " + drift.index.size());
    if ("--find".equals(args[1])) {
      drift.find(List.of(args).subList(2, args.length), System.out);
      System.exit(0);
    }
    Report report = drift.scan(Paths.get(args[1]));
    report.print(System.out);
    System.exit(report.isClean() ? 0 : 1);
  }

  /**
   * Modo exploracion: en que clases de org.talend se declara cada nombre
   * (metodo o campo). Sirve para comprobar a mano un hallazgo del modo normal.
   */
  void find(List<String> names, PrintStream out) {
    Map<String, List<String>> hits = new TreeMap<>();
    for (String name : names) hits.put(name, new ArrayList<>());
    for (String className : index.keySet()) {
      if (!className.startsWith("org.talend.")) continue;
      ClassInfo info = load(className);
      if (info == null) continue;
      for (String name : names) {
        if (info.members.contains(name)) hits.get(name).add(className);
      }
    }
    for (Map.Entry<String, List<String>> entry : hits.entrySet()) {
      List<String> classes = entry.getValue();
      out.println(entry.getKey() + ": " + (classes.isEmpty() ? "NO DECLARADO en org.talend.*" : classes.size() + " clase(s)"));
      classes.stream().sorted().limit(12).forEach(c -> out.println("  " + c));
    }
  }

  void indexJars(Path pluginsDir) throws IOException {
    File[] jars = pluginsDir.toFile().listFiles((dir, name) -> name.endsWith(".jar"));
    if (jars == null) {
      throw new IOException("No se puede leer la carpeta de plugins: " + pluginsDir);
    }
    for (File jar : jars) {
      try (ZipFile zip = new ZipFile(jar)) {
        for (Enumeration<? extends ZipEntry> entries = zip.entries(); entries.hasMoreElements(); ) {
          String name = entries.nextElement().getName();
          if (name.endsWith(".class") && !name.endsWith("module-info.class")) {
            String className = name.substring(0, name.length() - ".class".length()).replace('/', '.');
            index.putIfAbsent(className, jar.getPath());
          }
        }
      } catch (IOException unreadable) {
        // Un jar ilegible no impide revisar el resto.
      }
    }
  }

  Report scan(Path srcDir) throws IOException {
    Report report = new Report();
    List<Path> sources;
    try (Stream<Path> walk = Files.walk(srcDir)) {
      sources = walk.filter(p -> p.toString().endsWith(".java")).sorted().toList();
    }
    Map<Path, String> texts = new LinkedHashMap<>();
    for (Path source : sources) {
      texts.put(source, Files.readString(source));
    }

    // Pool: las clases de Talend que el bridge nombra en cualquier archivo, con sus miembros.
    // Un metodo se busca en el pool completo porque el objeto receptor casi nunca aparece
    // como texto en el mismo archivo que lo invoca (Process, por ejemplo).
    Set<String> pool = new TreeSet<>();
    for (String text : texts.values()) {
      Matcher classes = TALEND_CLASS.matcher(text);
      while (classes.find()) {
        if (index.containsKey(classes.group(1))) pool.add(classes.group(1));
      }
      // Los tipos de Eclipse, EMF y GEF que el bridge importa tambien son API en uso.
      Matcher imports = IMPORT.matcher(text);
      while (imports.find()) {
        if (index.containsKey(imports.group(1))) pool.add(imports.group(1));
      }
    }
    Set<String> available = new HashSet<>();
    for (String type : pool) available.addAll(membersOf(type));

    for (Map.Entry<Path, String> entry : texts.entrySet()) {
      Matcher classes = TALEND_CLASS.matcher(entry.getValue());
      while (classes.find()) {
        String name = classes.group(1);
        if (!index.containsKey(name) && looksLikeClass(name)) {
          report.missingClass(entry.getKey(), name);
        }
      }
      Matcher refs = MEMBER_REF.matcher(entry.getValue());
      Set<String> missing = new TreeSet<>();
      while (refs.find()) {
        String name = firstNonNull(refs.group(1), refs.group(2), refs.group(3));
        if (name != null && !IGNORED_NAMES.contains(name) && !available.contains(name)) {
          missing.add(name);
        }
      }
      if (!missing.isEmpty()) {
        report.missingMembers(entry.getKey(), pool.size(), missing);
      }
    }
    report.scanned(sources.size());
    return report;
  }

  /** Un nombre cuyo ultimo segmento empieza en mayuscula es una clase; el resto son bundles o puntos de extension. */
  static boolean looksLikeClass(String name) {
    String last = name.substring(name.lastIndexOf('.') + 1);
    return !last.isEmpty() && Character.isUpperCase(last.charAt(0));
  }

  /** Miembros del tipo y de sus supertipos, recorridos en anchura. */
  Set<String> membersOf(String type) {
    Set<String> out = new HashSet<>();
    Deque<String> queue = new ArrayDeque<>();
    Set<String> seen = new HashSet<>();
    queue.add(type);
    while (!queue.isEmpty() && seen.size() < 200) {
      String current = queue.poll();
      if (!seen.add(current)) continue;
      ClassInfo info = load(current);
      if (info == null) continue;
      out.addAll(info.members);
      if (info.superName != null) queue.add(info.superName);
      queue.addAll(info.interfaces);
    }
    return out;
  }

  ClassInfo load(String className) {
    if (parsed.containsKey(className)) return parsed.get(className);
    ClassInfo info = null;
    String jar = index.get(className);
    if (jar != null) {
      try (ZipFile zip = new ZipFile(jar)) {
        ZipEntry entry = zip.getEntry(className.replace('.', '/') + ".class");
        if (entry != null) {
          info = parseClass(zip.getInputStream(entry).readAllBytes());
        }
      } catch (IOException unreadable) {
        info = null;
      }
    }
    parsed.put(className, info);
    return info;
  }

  /**
   * Lee la tabla de constantes y las listas de campos y metodos de un .class.
   * Formato: JVMS, capitulo 4.
   */
  static ClassInfo parseClass(byte[] bytes) throws IOException {
    DataInputStream in = new DataInputStream(new ByteArrayInputStream(bytes));
    in.readInt(); // magic
    in.readUnsignedShort(); // minor
    in.readUnsignedShort(); // major
    int poolSize = in.readUnsignedShort();
    String[] utf8 = new String[poolSize];
    int[] classNameIndex = new int[poolSize];
    for (int i = 1; i < poolSize; i++) {
      int tag = in.readUnsignedByte();
      switch (tag) {
        case 1 -> utf8[i] = in.readUTF();
        case 7 -> classNameIndex[i] = in.readUnsignedShort();
        case 8, 16, 19, 20 -> in.readUnsignedShort();
        case 3, 4, 9, 10, 11, 12, 17, 18 -> in.readInt();
        case 5, 6 -> {
          in.readLong();
          i++; // long y double ocupan dos entradas
        }
        case 15 -> {
          in.readUnsignedByte();
          in.readUnsignedShort();
        }
        default -> throw new IOException("Etiqueta de constante desconocida: " + tag);
      }
    }
    ClassInfo info = new ClassInfo();
    in.readUnsignedShort(); // access_flags
    in.readUnsignedShort(); // this_class
    int superIndex = in.readUnsignedShort();
    info.superName = superIndex == 0 ? null : className(utf8, classNameIndex, superIndex);
    int interfaces = in.readUnsignedShort();
    for (int i = 0; i < interfaces; i++) {
      info.interfaces.add(className(utf8, classNameIndex, in.readUnsignedShort()));
    }
    for (int table = 0; table < 2; table++) { // campos, luego metodos
      int count = in.readUnsignedShort();
      for (int i = 0; i < count; i++) {
        in.readUnsignedShort(); // access_flags
        info.members.add(utf8[in.readUnsignedShort()]);
        in.readUnsignedShort(); // descriptor
        int attributes = in.readUnsignedShort();
        for (int a = 0; a < attributes; a++) {
          in.readUnsignedShort();
          in.skipNBytes(in.readInt());
        }
      }
    }
    return info;
  }

  private static String className(String[] utf8, int[] classNameIndex, int index) {
    return utf8[classNameIndex[index]].replace('/', '.');
  }

  private static String firstNonNull(String... values) {
    for (String value : values) {
      if (value != null) return value;
    }
    return null;
  }

  /** Hallazgos del analisis, agrupados por archivo. */
  static final class Report {
    private final Map<String, List<String>> lines = new TreeMap<>();
    private int files;
    private int problems;

    void missingClass(Path source, String name) {
      lines.computeIfAbsent(source.getFileName().toString(), k -> new ArrayList<>())
          .add("  clase no existe en esta instalacion: " + name);
      problems++;
    }

    void missingMembers(Path source, int poolSize, Set<String> names) {
      lines.computeIfAbsent(source.getFileName().toString(), k -> new ArrayList<>())
          .add("  metodos o campos no encontrados en ninguna de las " + poolSize + " clases de Talend: " + names);
      problems++;
    }

    void scanned(int count) {
      this.files = count;
    }

    boolean isClean() {
      return problems == 0;
    }

    void print(PrintStream out) {
      for (Map.Entry<String, List<String>> entry : lines.entrySet()) {
        out.println(entry.getKey());
        entry.getValue().forEach(out::println);
      }
      out.println("Archivos revisados: " + files + " | archivos con hallazgos: " + lines.size());
      if (problems == 0) {
        out.println("Sin deriva: todos los nombres existen en la instalacion.");
      } else {
        out.println("Un hallazgo es una pista, no un fallo: confirmalo con --find <nombre> antes de tocar el codigo.");
        out.println("Los nombres de EMF, GEF y de tipos no importados aparecen aqui aunque existan.");
      }
    }
  }
}
