# Talend Studio Bridge

Bridge local en Java/Eclipse RCP para auditar Talend Studio desde MCP.

## Build

```bash
mvn clean verify
```

## Salida

El update site queda en:

```txt
com.andres.talend.bridge.repository/target/repository/
```

## Instalar en Talend

Usa `p2 director` contra el repository local o copia el plugin generado a la carpeta `plugins/` del producto.
