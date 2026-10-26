/**
 * Sumidero SMTP local para las pruebas L5 de tSendMail.
 *
 *   bun run scripts/l5/smtp-sink.ts
 *
 * Acepta cualquier correo sin autenticacion y anota su destinatario y su asunto en un fichero, una
 * linea por campo (`To: ...`, `Subject: ...`). No reenvia ni valida nada mas. Los escenarios comprueban
 * la entrega leyendo ese fichero, asi que el sumidero tiene que estar levantado antes de correr L5.
 *
 * Config (opcional): L5_SMTP_HOST (127.0.0.1), L5_SMTP_PORT (2525) y L5_SMTP_LOG (testdata/l5-correos.log).
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const host = process.env.L5_SMTP_HOST ?? "127.0.0.1";
const port = Number(process.env.L5_SMTP_PORT ?? 2525);
const logPath = process.env.L5_SMTP_LOG ?? "testdata/l5-correos.log";
mkdirSync(dirname(logPath), { recursive: true });

type Session = { modo: "comandos" | "datos"; lineas: string[]; resto: string; contenido: string[] };

function responder(socket: { write: (texto: string) => number }, linea: string): void {
  socket.write(`${linea}\r\n`);
}

/** Anota los encabezados que interesan de un correo recibido. */
function anotar(destinatarios: string[], contenido: string[]): void {
  const cabeceras = contenido.join("\r\n").split(/\r\n\r\n/)[0] ?? "";
  const asunto = cabeceras.split(/\r\n/).find((linea) => /^subject:/i.test(linea));
  const para = destinatarios.join(", ");
  const lineas = [`To: ${para}`, asunto ?? "Subject: (sin asunto)"];
  appendFileSync(logPath, `${lineas.join("\n")}\n`, "utf8");
}

const servidor = Bun.listen<Session>({
  hostname: host,
  port,
  socket: {
    open(socket) {
      socket.data = { modo: "comandos", lineas: [], resto: "", contenido: [] };
      responder(socket, "220 talend-mcp l5 smtp sink");
    },
    data(socket, chunk) {
      const sesion = socket.data;
      const texto = sesion.resto + Buffer.from(chunk).toString("utf8");
      const partes = texto.split("\r\n");
      sesion.resto = partes.pop() ?? "";
      for (const linea of partes) {
        if (sesion.modo === "datos") {
          if (linea === ".") {
            anotar(sesion.lineas, sesion.contenido);
            sesion.lineas = [];
            sesion.contenido = [];
            sesion.modo = "comandos";
            responder(socket, "250 OK recibido por el sumidero L5");
          } else {
            sesion.contenido.push(linea.startsWith("..") ? linea.slice(1) : linea);
          }
          continue;
        }
        const orden = linea.slice(0, 4).toUpperCase();
        if (orden === "EHLO" || orden === "HELO") {
          responder(socket, "250 talend-mcp");
        } else if (orden === "MAIL") {
          responder(socket, "250 OK");
        } else if (orden === "RCPT") {
          const destino = linea.replace(/^RCPT TO:\s*/i, "").replace(/[<>]/g, "").trim();
          sesion.lineas.push(destino);
          responder(socket, "250 OK");
        } else if (orden === "DATA") {
          sesion.modo = "datos";
          responder(socket, "354 Fin con una linea que solo tenga un punto");
        } else if (orden === "RSET" || orden === "NOOP") {
          sesion.lineas = [];
          responder(socket, "250 OK");
        } else if (orden === "QUIT") {
          responder(socket, "221 adios");
          socket.end();
        } else {
          responder(socket, "502 orden no soportada por el sumidero");
        }
      }
    },
  },
});

console.log(`sumidero SMTP L5 escuchando en ${servidor.hostname}:${servidor.port}, log: ${logPath}`);
