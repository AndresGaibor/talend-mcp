# Plazos de las operaciones largas del bridge

Fecha: 11 de noviembre de 2026 (tarea A-4 del Plan A).

## Lo que se midio en el codigo

- `BridgeConfig.DEFAULT_TIMEOUT_MS` del cliente TypeScript es **2 500 ms**. Es el plazo de una
  lectura normal y esta bien para `ping`, `nodes/list` o `job/problems`.
- `UiThread.DEFAULT_TIMEOUT_MS` del plugin Java es **10 000 ms**, pero solo aplica a las rutas que
  tocan la interfaz (`uiBody`). `/automation/job/build-batch` y `/automation/job/build` van por la
  ruta normal (`route`), asi que ese tope no los corta.
- `JobBuilder.GENERATE_TIMEOUT_MS` es **180 000 ms**: el propio plugin ya se da tres minutos para
  generar el codigo de un Job.

## El defecto

`jobBuild` y `jobBuildBatch` no pasaban plazo, asi que heredaban los 2 500 ms del cliente. Generar y
compilar un Job tarda mas que eso: la peticion se abortaba a mitad y el error decia que el bridge no
contesta, cuando en realidad estaba trabajando. El lote de compilacion del corpus podia fallar por
plazo y no por un Job roto.

## El arreglo

En `src/modules/studio-bridge/adapters/bridge-job.client.ts`:

- `BUILD_TIMEOUT_MS = 180 000`: el mismo plazo que ya usa el plugin para generar.
- `BUILD_BATCH_TIMEOUT_MS = 300 000`: cinco minutos, que cubren miles de Jobs a los 0,2 s por Job.
- Las dos operaciones aceptan `timeoutMs` en sus opciones para pedir un plazo distinto.

Una lectura lenta sigue cortandose en su plazo y devuelve `BRIDGE_UNAVAILABLE` con el mensaje de
reintento: nunca un exito falso. Lo fija `tests/talend/bridge-long-response.test.ts`, con un bridge
de mentira que tarda 1 200 ms.

## Lo que falta

Medir un lote real de mas de 20 s con Studio libre para confirmar que 300 000 ms alcanza con el
paralelismo que usa el migrador (4). Si un lote de 5 000 Jobs se acerca al limite, hay que partirlo
en tramos por el lado del cliente, que es la opcion (b) del plan.
