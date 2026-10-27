# Plantilla de la ficha de un componente

Una ficha por componente, en `docs/fichas-componentes/<grupo>.md` (el grupo es el del catalogo: `file`, `databases`,
`processing`...). Los componentes del mismo grupo van en el mismo fichero, ordenados por nombre. Copia el bloque de
abajo y rellenalo. **Todo dato de la ficha sale de algo ejecutado**; si no lo pudiste comprobar, escribe "no
comprobado" en vez de suponerlo.

````markdown
### tNombreDelComponente

| Campo | Valor |
|---|---|
| Familia / paleta | File/Input · DI |
| Nivel de aceptacion | A (servicio real) / A-emu (sustituto: indicar cual y que NO demuestra) / X (excepcion, ver EXCEPCIONES.md) |
| Para que sirve | Una frase, en lenguaje de negocio. |
| Servicio externo | ninguno / Postgres (puerto 5433) / H2 modo Oracle / driver shim -> Postgres / servidor falso ... |
| Que no demuestra el sustituto | Solo en A-emu: dialecto real, tipos propios, cargadores masivos, autenticacion... |
| Librerias | Las que descarga Studio (`talend_job_compile` con `installMissing`) |
| Escenario L5 | `tests/fixtures/talend/escenarios-l5/<suite>/<nombre>.json` |
| Verificado | AAAA-MM-DD · `bun run scripts/execution-check.ts ...` · resultado |

**Conectores:** entrada `FLOW` (max 1) · salida `FLOW`, `REJECT` · dispara `SUBJOB_OK`.

**Lo que decide quien lo usa** (parametros sin valor por defecto):

| Parametro | Tipo | Ejemplo | Notas |
|---|---|---|---|
| `FILENAME` | FILE | `"C:/datos/clientes.csv"` | Entre comillas: es un literal Java |

**Ya viene resuelto** (no hace falta tocarlo): `ENCODING`, `ROWSEPARATOR`...

**Esquema:** columnas que hay que declarar y en que lado (origen antes o despues de conectar).

**Ejemplo copiable** (es el escenario que pasa):

```json
{ "...": "el JSON del escenario, completo" }
```

**Salida esperada:** las lineas o el fichero exacto.

**Trampas conocidas:**
- Lo que fallo al principio y como se arreglo (sintoma -> causa -> arreglo).

**Caso de error:** que pasa si falta X y que mensaje da (C7).
````

## Reglas de redaccion

- Espanol claro, frases cortas, sin relleno. Nada de flechas decorativas ni emojis en el texto.
- Cada trampa lleva sintoma, causa y arreglo. "Falla a veces" no es una trampa; es una investigacion pendiente.
- No copies la descripcion de Talend: explica que **decide** quien lo usa y que se rellena solo.
- Los valores literales Java van entre comillas y los de listas cerradas (`*_LIST`) sin comillas; el ejemplo lo
  muestra tal cual lo acepta el MCP.
- Si el componente se comporta distinto en otra paleta (Spark), dilo en una linea y enlaza a P10.

## Lista de comprobacion antes de dar la ficha por buena

- [ ] El JSON del ejemplo es exactamente el del escenario del repositorio.
- [ ] `bun run l5:validar` pasa.
- [ ] El comando de `Verificado` se ejecuto y su salida coincide con "Salida esperada".
- [ ] Los avisos de Studio y los `[WARN]` de la salida estan informados (o tolerados con motivo).
- [ ] La fila del catalogo se regenero (`bun run scripts/catalogo-componentes.ts`).
- [ ] Hay una linea en el seguimiento.
