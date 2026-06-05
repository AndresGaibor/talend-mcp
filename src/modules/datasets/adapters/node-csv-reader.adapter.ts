import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { ICsvReader } from "../ports/csv-reader.port";
import type { CsvColumn, CsvColumnType, CsvFileInfo } from "../domain/dataset.types";

export class NodeCsvReaderAdapter implements ICsvReader {
  private detectDelimiter(line: string): string {
    const delimiters = [",", ";", "\t", "|", ":"];
    let best = ",";
    let bestCount = 0;
    for (const d of delimiters) {
      const count = (line.match(new RegExp(d === "\t" ? "\\t" : d, "g")) ?? []).length;
      if (count > bestCount) {
        bestCount = count;
        best = d;
      }
    }
    return best;
  }

  private inferColumnType(values: string[]): CsvColumnType {
    const nonEmpty = values.filter((v) => v.trim() !== "");
    if (nonEmpty.length === 0) return "unknown";

    let isNumber = true;
    let isDate = true;
    let isBoolean = true;

    for (const v of nonEmpty.slice(0, 100)) {
      if (isNumber && isNaN(Number(v))) isNumber = false;
      if (isDate) {
        const d = new Date(v);
        if (isNaN(d.getTime()) && !/^\d{4}-\d{2}-\d{2}/.test(v)) isDate = false;
      }
      if (isBoolean && !["true", "false", "1", "0", "yes", "no"].includes(v.toLowerCase())) isBoolean = false;
    }

    if (isNumber) return "number";
    if (isDate) return "date";
    if (isBoolean) return "boolean";
    return "string";
  }

  private parseCsvLine(line: string, delimiter: string, quoteChar: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line.charAt(i);
      if (ch === quoteChar) {
        inQuotes = !inQuotes;
      } else if (ch === delimiter && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  }

  async readCsvFile(filePath: string, basePath: string): Promise<CsvFileInfo | null> {
    try {
      if (!existsSync(filePath)) return null;

      const content = readFileSync(filePath, "utf8");
      const lines = content.split(/\r?\n/);
      if (lines.length < 2) return null;

      const firstLine = lines[0] ?? "";
      const delimiter = this.detectDelimiter(firstLine);
      const quoteChar = firstLine.includes('"') ? '"' : "'";
      const headers = this.parseCsvLine(firstLine, delimiter, quoteChar).map((h) => h.trim().replace(/^["']|["']$/g, ""));

      const dataLines = lines.slice(1).filter((l) => l.trim() !== "");
      const rowCount = dataLines.length;

      const columnData: Record<string, string[]> = {};
      for (const h of headers) {
        columnData[h] = [];
      }

      for (const line of dataLines) {
        const values = this.parseCsvLine(line, delimiter, quoteChar);
        headers.forEach((h, i) => {
          const val = values[i];
          if (val !== undefined) {
            const trimmed = val.trim().replace(/^["']|["']$/g, "");
            columnData[h]?.push(trimmed);
          }
        });
      }

      const columns: CsvColumn[] = headers.map((name) => {
        const values = columnData[name] ?? [];
        const nullable = values.some((v) => v === "" || v === "NULL" || v === "null");
        const sampleValues = values.filter((v) => v !== "" && v !== "NULL" && v !== "null").slice(0, 5);
        return {
          name,
          inferredType: this.inferColumnType(values),
          nullable,
          sampleValues,
        };
      });

      return {
        path: filePath,
        relativePath: relative(basePath, filePath),
        rowCount,
        columns,
        delimiter,
        quoteChar,
        lineEnding: content.includes("\r\n") ? "CRLF" : "LF",
        encoding: "UTF-8",
      };
    } catch {
      return null;
    }
  }
}
