/**
 * Escritor ZIP minimo (sin compresion).
 *
 * Lo usa el generador de XLSX de prueba: un libro de Excel es un ZIP con XML.
 * No se usa una dependencia porque el unico requisito es escribir un archivo
 * pequeno y reproducible.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date): { time: number; date: number } {
  const time = ((date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() / 2)) & 0xffff;
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, date: day };
}

/** Crea un zip sin compresion con las entradas dadas (path -> contenido). */
export function writeZip(entries: Array<{ path: string; data: Uint8Array }>): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.path);
    const crc = crc32(entry.data);
    const size = entry.data.length;
    const { time, date } = dosDateTime(new Date());
    const local = new Uint8Array(30 + nameBytes.length + size);
    const view = new DataView(local.buffer);

    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, time, true);
    view.setUint16(12, date, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, size, true);
    view.setUint32(22, size, true);
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    local.set(entry.data, 30 + nameBytes.length);
    chunks.push(local);

    const header = new Uint8Array(46 + nameBytes.length);
    const hview = new DataView(header.buffer);
    hview.setUint32(0, 0x02014b50, true);
    hview.setUint16(4, 20, true);
    hview.setUint16(6, 20, true);
    hview.setUint16(8, 0, true);
    hview.setUint16(10, 0, true);
    hview.setUint16(12, time, true);
    hview.setUint16(14, date, true);
    hview.setUint32(16, crc, true);
    hview.setUint32(20, size, true);
    hview.setUint32(24, size, true);
    hview.setUint16(28, nameBytes.length, true);
    hview.setUint16(30, 0, true);
    hview.setUint16(32, 0, true);
    hview.setUint16(34, 0, true);
    hview.setUint16(36, 0, true);
    hview.setUint32(38, 0, true);
    hview.setUint32(42, offset, true);
    header.set(nameBytes, 46);
    central.push(header);

    offset += local.length;
  }

  const centralSize = central.reduce((total, part) => total + part.length, 0);
  const end = new Uint8Array(22);
  const eview = new DataView(end.buffer);
  eview.setUint32(0, 0x06054b50, true);
  eview.setUint16(8, entries.length, true);
  eview.setUint16(10, entries.length, true);
  eview.setUint32(12, centralSize, true);
  eview.setUint32(16, offset, true);

  const total = offset + centralSize + end.length;
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const part of chunks) {
    out.set(part, cursor);
    cursor += part.length;
  }
  for (const part of central) {
    out.set(part, cursor);
    cursor += part.length;
  }
  out.set(end, cursor);
  return out;
}
