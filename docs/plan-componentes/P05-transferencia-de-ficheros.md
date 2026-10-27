# P05 · Transferencia de ficheros: FTP, SFTP, FTPS, SCP, SSH, sockets

Nivel 7 del catalogo (22 componentes Standard). Los intercambios entre sistemas bancarios pasan casi siempre por un
servidor de ficheros, asi que la familia importa aunque sea pequena.

- Catalogo: [internet](../catalogo-componentes/internet.md) (los `tFTP*`, `tSCP*`, `tSSH`, `tSocket*`).
- Suite L5: `archivos` (hay ya 6 escenarios de FTP) y `sistema`.
- Servicios: **FTP** ya esta en `testdata/docker-compose.yml` (`stilliard/pure-ftpd`, puerto 2121, pasivo
  30000-30009). Faltan **SFTP/SCP/SSH** y **FTPS**.

## 1. Componentes y cobertura

| Grupo | Componentes | Estado |
|---|---|---|
| FTP/SFTP/FTPS | `tFTPConnection`, `tFTPPut`, `tFTPGet`, `tFTPDelete`, `tFTPRename`, `tFTPFileList` | Con L5 (FTP plano) |
| FTP, resto | `tFTPFileExist`, `tFTPFileProperties`, `tFTPTruncate`, `tFTPClose` | Sin escenario |
| SCP | `tSCPConnection`, `tSCPPut`, `tSCPGet`, `tSCPDelete`, `tSCPRename`, `tSCPFileList`, `tSCPFileExists`, `tSCPTruncate`, `tSCPClose` | Sin escenario |
| SSH | `tSSH` (ejecuta un comando remoto) | Sin escenario |
| Sockets | `tSocketInput`, `tSocketOutput` | Sin escenario |

## 2. Servicios que anadir a `testdata/docker-compose.yml`

```yaml
sftp:
  image: atmoz/sftp
  command: talend:talend:1001:100:upload      # usuario:clave:uid:gid:carpeta
  ports: ["2222:22"]
  volumes: ["./sftp-data:/home/talend/upload"]
ssh:
  image: linuxserver/openssh-server
  environment: { USER_NAME: talend, USER_PASSWORD: talend, PASSWORD_ACCESS: "true" }
  ports: ["2223:2222"]
ftps:
  image: stilliard/pure-ftpd      # con ADDED_FLAGS="--tls=2" y certificado de prueba
  ports: ["2122:21"]
```

Notas:

- `tFTPConnection` cubre **FTP, FTPS y SFTP** con dos checks excluyentes, `SFTP` y `FTPS` (este con `SECURITY_MODE` `IMPLICIT`/`EXPLICIT`); con SFTP el `AUTH_METHOD` elige contrasena, clave publica o ambas (`PRIVATEKEY`, `PASSPHRASE`). Se prueban los tres
  modos con los mismos escenarios, cambiando los checks y el servicio.
- `tSCP*` y `tSSH` usan el servidor SSH (puerto 2223). Con `PASSWORD_ACCESS=true` basta usuario y clave de laboratorio;
  anade un caso con **clave privada** (genera el par con `ssh-keygen` en `testdata/`).
- Modo pasivo: los puertos `30000-30009` deben estar publicados. Si un `tFTPGet` se cuelga, es casi siempre esto.
- `tSocketInput/Output`: servidor y cliente TCP de prueba con `Bun.listen` / `Bun.connect` (ver el patron de
  `scripts/l5/http-sink.ts`); no hace falta contenedor.

## 3. Escenarios (cada uno con salida comprobada)

| # | Escenario | Que demuestra |
|---|---|---|
| F1 | `tFTPConnection` + `tFTPPut` + `tFTPFileList` | Sube un fichero y aparece en el listado |
| F2 | `tFTPGet` | Descarga y el contenido coincide (`tFileCompare` con el original) |
| F3 | `tFTPRename` + `tFTPFileExist` + `tFTPFileProperties` | Renombra, comprueba existencia y tamano |
| F4 | `tFTPDelete` + `tFTPTruncate` | Borra y vacia; `tFTPFileExist` devuelve `false` |
| F5 | `tFTPClose` | Cierra la conexion compartida; un uso posterior falla con mensaje claro |
| F6 | Los mismos con SFTP y con FTPS | Cambian los checks `SFTP` / `FTPS` (y `SECURITY_MODE`) y el servicio |
| F7 | `tSCPPut/Get/Rename/Delete/FileList/FileExists/Truncate` | Equivalentes contra el servidor SSH |
| F8 | `tSSH` | Ejecuta `echo hola` y `exit 3`; la salida y el codigo llegan al job |
| F9 | `tSocketOutput` -> `tSocketInput` | Un job escribe, otro lee (o el servidor de prueba hace de contraparte) |
| F10 | Errores | Clave mala (ya hay `contrasena-ftp-incorrecta-falla-el-job.json`), servidor caido, fichero inexistente, permiso denegado |

El FTP plano ya tiene `subir-y-bajar`, `listar-y-renombrar`, `borrar` y `contrasena incorrecta`: no los rehagas; anade F3
(existencia/propiedades), F4 (truncate), F5 y todo lo de SFTP/SCP/SSH/sockets.

## 4. Trampas

| Trampa | Que hacer |
|---|---|
| Fichero del servidor con permisos 600 | Crear con el usuario del servidor; el contenedor `atmoz/sftp` exige carpeta `upload` |
| `tFTPFileList` ordena distinto en cada servidor | Comparar con `espera.contiene`, no con `lineas` |
| Rutas remotas | Siempre con `/`; rutas relativas al `chroot` del usuario |
| `tSSH` con comando que no termina | Usar comandos cortos; probar `TIMEOUT` aparte |
| Fecha de los ficheros | `tFTPFileProperties` da la fecha del servidor: comprobar solo tamano |
| Claves de host | Aceptar la clave en la primera conexion (`KNOWN_HOSTS` desactivado en laboratorio) y documentarlo |

## 5. Aceptacion de P05

- Los 22 componentes ejecutados (A: servicios reales en contenedor).
- FTP, SFTP y FTPS cubiertos; SCP y SSH con clave y con contrasena.
- Servicios nuevos en el compose, con `healthcheck`.
- Fichas en `docs/fichas-componentes/internet.md`.
