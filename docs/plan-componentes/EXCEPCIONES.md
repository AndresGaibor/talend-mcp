# Excepciones pendientes de decision

Registro vivo de los componentes que **no se han podido ejecutar** despues de recorrer toda la
[escalera de emulacion](EMULADORES.md). Lo mantiene el agente que ejecuta el plan; **solo la persona responsable
cierra una fila** (aceptando el sustituto, aportando el servicio o retirando el componente del alcance).

El plan no esta terminado mientras haya filas sin decision ([README, seccion 10](README.md)).

| Componente | Plan | Servicio | Peldanos intentados | Por que falla | Que haria falta | Estado | Decision |
|---|---|---|---|---|---|---|---|
| (vacio) | | | | | | | |

## Como se rellena una fila

- **Peldanos intentados**: los numeros de la escalera (1 a 6) y, en una linea, que se hizo en cada uno.
- **Por que falla**: el error exacto (con la salida del arnes), no una opinion.
- **Que haria falta**: concreto (un jar del fabricante, una licencia, una maquina Windows con MSMQ...).
- **Estado**: `pendiente de decision` | `aceptado como sustituto` | `servicio aportado` | `fuera de alcance`.
- **Decision**: fecha, quien y que se decidio.
