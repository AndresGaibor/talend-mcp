/**
 * Servidor HTTP local para las pruebas L5 de tHttpRequest.
 *
 *   bun run scripts/l5/http-sink.ts
 *
 * Responde `hola` a `GET /saludo` y 404 al resto. Igual que el sumidero SMTP, tiene que estar
 * levantado antes de correr el escenario `sistema: llamar a un servicio HTTP con tHttpRequest`.
 *
 * Config (opcional): L5_HTTP_HOST (127.0.0.1) y L5_HTTP_PORT (18080).
 */

const host = process.env.L5_HTTP_HOST ?? "127.0.0.1";
const port = Number(process.env.L5_HTTP_PORT ?? 18080);

const servidor = Bun.serve({
  hostname: host,
  port,
  fetch(request) {
    const { pathname } = new URL(request.url);
    if (request.method === "GET" && pathname === "/saludo") {
      return new Response("hola", { status: 200, headers: { "Content-Type": "text/plain" } });
    }
    return new Response("no encontrado", { status: 404 });
  },
});

console.log(`servidor HTTP L5 escuchando en http://${servidor.hostname}:${servidor.port}/saludo`);
