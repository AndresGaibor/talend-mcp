/**
 * Sumidero TCP local para las pruebas L5 de tSocketOutput.
 *
 *   bun run scripts/l5/socket-sink.ts
 *
 * Acepta conexiones en L5_SOCKET_PORT (18090) y guarda en `testdata/l5_socket_recibido.txt`
 * todo lo que llega, de forma que el escenario compruebe el fichero. Tiene que estar
 * levantado antes de correr el escenario `archivos: enviar filas por socket con tSocketOutput`.
 */
import { appendFileSync, writeFileSync } from "node:fs";

const host = process.env.L5_SOCKET_HOST ?? "127.0.0.1";
const port = Number(process.env.L5_SOCKET_PORT ?? 18090);
const salida = `${import.meta.dir}/../../testdata/l5_socket_recibido.txt`;

writeFileSync(salida, "");
Bun.listen({
  hostname: host,
  port,
  socket: {
    data(_socket, datos) {
      appendFileSync(salida, Buffer.from(datos));
    },
  },
});
console.log(`sumidero TCP L5 escuchando en ${host}:${port}`);
