export function componentsThatCompiled(reports: string[]): Set<string> {
  const compiled = new Set<string>();
  for (const report of reports) {
    const rows = report.split(/\r?\n/);
    const header = rows[0]?.split(",") ?? [];
    const compileIndex = header.indexOf("compila");
    if (compileIndex < 0) continue;
    for (const row of rows.slice(1)) {
      const fields = row.split(",");
      if (fields[0] && fields[compileIndex] === "si") compiled.add(fields[0]);
    }
  }
  return compiled;
}

export function filterUncompiled(candidates: string[], reports: string[]): string[] {
  const compiled = componentsThatCompiled(reports);
  return candidates.filter((name) => !compiled.has(name));
}
