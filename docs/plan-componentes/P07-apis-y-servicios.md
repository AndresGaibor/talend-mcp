# P07 · APIs, servicios web y directorios

Nivel 9 del catalogo (15 componentes Standard). Son pocos pero criticos: son la forma de integrarse con sistemas que
no dan base de datos.

- Catalogo: [internet](../catalogo-componentes/internet.md), [webservice](../catalogo-componentes/webservice.md),
  [business](../catalogo-componentes/business.md) (LDAP).
- Suites: `sistema` (existe) y nueva `servicios` si hace falta.
- Servidores falsos: `Bun.serve` (ver `scripts/l5/http-sink.ts`); LDAP en contenedor.

## 1. Componentes

| Grupo | Componentes | Sustituto |
|---|---|---|
| HTTP | `tHttpRequest` (ya con L5), `tREST` | Servidor HTTP de prueba con `Bun.serve` |
| SOAP | `tSOAP`, `tWebService`, `tWebServiceInput` | Servidor SOAP falso + WSDL en `testdata/` |
| XML-RPC | `tXMLRPCInput` | Servidor XML-RPC falso |
| RSS | `tRSSInput`, `tRSSOutput` | Fichero/servidor que sirve un feed |
| Correo | `tPOP` | GreenMail (`greenmail/standalone`) |
| LDAP | `tLDAPConnection`, `tLDAPInput`, `tLDAPOutput`, `tLDAPAttributesInput`, `tLDAPRenameEntry`, `tLDAPClose` | `osixia/openldap` con un LDIF de prueba |

## 2. El servidor falso: un patron reutilizable

Un unico modulo `scripts/l5/servidor-falso.ts` con `Bun.serve` que:

1. Se levanta antes del escenario y se baja despues (puerto libre fijo, p. ej. 18080).
2. Sirve **respuestas grabadas** de `testdata/servicios/<nombre>/*.json|xml`, elegidas por metodo y ruta.
3. **Registra cada peticion** (metodo, ruta, cabeceras, cuerpo) para que el test verifique lo que envia Talend.
4. Permite simular **errores**: 401, 404, 500, lentitud (para el timeout) y respuesta mal formada.

El escenario declara que servidor necesita (`requiere: ["servidor-falso:rest"]`, ver EMULADORES.md seccion 6) y lo que
espera: la salida del job **y** las peticiones registradas.

## 3. Escenarios

| Componente | Escenarios |
|---|---|
| `tHttpRequest` | GET, POST con cuerpo, cabeceras, autenticacion basica, 404 y 500 (ya hay uno; anadir errores y POST) |
| `tREST` | GET/POST/PUT/DELETE, JSON de entrada y salida, parametros de consulta, `Content-Type`, codigos de error, paginacion simple |
| `tSOAP` / `tWebService` / `tWebServiceInput` | Una operacion con un parametro, una con tipos complejos, una que devuelve `SOAP Fault` |
| `tXMLRPCInput` | Una llamada con argumentos y respuesta estructurada |
| `tRSSInput` / `tRSSOutput` | Leer un feed de 3 entradas; escribir uno y volver a leerlo |
| `tPOP` | Mensaje en GreenMail: leer, filtrar por asunto, borrar |
| LDAP | Conectar; buscar con filtro; leer atributos; insertar, modificar y renombrar entradas; cerrar |

## 4. Trampas

| Trampa | Que hacer |
|---|---|
| HTTPS con certificado propio | Truststore de prueba y `tSetKeystore`; documentar |
| Codificacion del cuerpo | UTF-8 explicito en el servidor y en el componente |
| Redireccion 302 | Probar con y sin seguir redirecciones |
| Timeout | Un endpoint lento de 5 s con `TIMEOUT` de 1 s debe fallar con mensaje claro |
| SOAP: namespaces | Copiar el `.item` que genera Studio al importar el WSDL |
| LDAP: sufijo y ACL | Usar el dominio del contenedor (`dc=example,dc=org`) y el admin de laboratorio |
| Cabeceras sensibles | Que el servidor falso no registre contrasenas en claro en los logs del repositorio |

## 5. Aceptacion de P07

- Los 15 componentes ejecutados (A: LDAP/POP con contenedor; A-emu: HTTP/SOAP/RSS/XML-RPC con servidor falso).
- Cada escenario comprueba la salida y las peticiones recibidas por el servidor.
- Un caso de error por componente (C7): servicio caido, 401, timeout.
- Fichas en `docs/fichas-componentes/internet.md`, `webservice.md`.
