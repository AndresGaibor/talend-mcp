# P09 · Calidad y privacidad de datos

Nivel 11 del catalogo (63 componentes Standard). En banca la privacidad (enmascarar, cifrar, mezclar) y la calidad
(emparejar, deduplicar, validar direcciones, telefonos y correos) son requisitos regulatorios, no extras.

- Catalogo: [data-quality](../catalogo-componentes/data-quality.md), [data-privacy](../catalogo-componentes/data-privacy.md),
  [processing](../catalogo-componentes/processing.md).
- Suites: `privacidad` y `calidad` (existen).
- Ya con L5: `tDataMasking`, `tDataShuffling`, `tDataEncrypt`, `tDataDecrypt`, `tStandardizePhoneNumber`, `tSynonymSearch`,
  `tSynonymOutput`, `tDuplicateRow`.

## 1. Grupos

| Grupo | Componentes | Servicio / sustituto |
|---|---|---|
| Enmascarado y cifrado | `tDataMasking`, `tDataUnmasking`, `tPatternMasking`, `tPatternUnmasking`, `tDataShuffling`, `tDataEncrypt`, `tDataDecrypt` | Ninguno. Todo local |
| Patrones y validacion | `tPatternCheck`, `tMultiPatternCheck`, `tPatternExtract`, `tFindRegexlibExpressions`, `tLastRegexlibExpressions`, `tVerifyEmail`, `tSchemaComplianceCheck` | `tVerifyEmail` consulta DNS/SMTP: servidor falso o dominios de prueba |
| Emparejamiento | `tFuzzyMatch`, `tFuzzyUniqRow`, `tIntervalMatch`, `tFirstnameMatch`, `tRecordMatching`, `tMatchGroup`, `tGenKey`, `tRuleSurvivorship`, `tSurviveFields` | Ninguno. Datos de prueba con duplicados conocidos |
| Estandarizacion | `tStandardizePhoneNumber`, `tStandardizeRow`, `tTransliterate`, `tStem`, `tJapaneseNumberNormalize`, `tJapaneseTokenize`, `tJapaneseTransliterate`, `tReplaceList` | Reglas locales; `tStandardizeRow` usa un indice (`tSynonymOutput` lo crea) |
| Indices | `tSynonymOutput`, `tSynonymSearch`, `tAddCRCRow`, `tReservoirSampling` | Local |
| Direcciones y geografia | `tAddressRowCloud`, `tBatchAddressRowCloud`, `tGoogleAddressRow`, `tGoogleGeocoder`, `tGoogleMapLookup`, `tLoqateAddressRow`, `tMelissaDataAddress`, `tQASAddressRow`, `tQASBatchAddressRow`, `tPersonator`, `tAddLocationFromIP` | Servidor HTTP falso del proveedor con respuestas grabadas (Peldano 5) |
| Reglas y alertas | `tDataQualityRules`, `tDqReportRun`, `tThresholdViolationAlert` | Repositorio local de reglas; alerta por correo con MailHog |

(Los `*In`/`*Out` de `tMatchGroup`, `tRecordMatching`, `tPersonator`, `tSurvive`, `tReservoirSampling`,
`tThresholdViolationAlert`, `tBatchAddressRowCloud` y `tDataShuffling` son pares internos: se cubren con su componente
visible, ver [P02](P02-archivos.md) seccion 7.)

## 2. Principio: el dato de prueba tiene la respuesta conocida

Estos componentes son heuristicos. Para que la salida se pueda declarar **exacta**, el dato de prueba se disena con la
respuesta decidida de antemano:

| Componente | Dato de prueba | Salida declarada |
|---|---|---|
| `tFuzzyMatch` | `Jose`, `Josep`, `Pepe` contra `Jose` con distancia 1 | solo `Jose` y `Josep` |
| `tMatchGroup` | 6 clientes, 2 grupos de duplicados evidentes | 2 grupos con sus ids |
| `tRecordMatching` | Maestro de 3 y entrada de 3 con un cambio de letra | los 3 pares con su puntuacion |
| `tPatternCheck` | `^[A-Z]{3}\d{4}$` con 4 valores buenos y 2 malos | buenos al `FLOW`, malos al `REJECT` |
| `tStandardizePhoneNumber` | `+57 300 123 4567` y variantes | formato E.164 (ya hay escenario) |
| `tDataMasking` | Nombres y numeros de cuenta fijos | la salida enmascarada es **determinista** si se fija la semilla: declararla; si no lo es, comprobar longitud y que difiere del original |
| `tDataEncrypt` / `tDataDecrypt` | texto + clave fija | ida y vuelta devuelve el original |

## 3. Orden de trabajo

1. Cerrar privacidad (`tDataUnmasking`, `tPatternMasking`, `tPatternUnmasking`).
2. Patrones y validacion.
3. Estandarizacion e indices.
4. Emparejamiento (`tFuzzyMatch`, `tMatchGroup`, `tRecordMatching`, `tGenKey`, `tRuleSurvivorship`).
5. Direcciones y geografia con servidores falsos.
6. Reglas y alertas.

## 4. Trampas

| Trampa | Que hacer |
|---|---|
| Resultados con aleatoriedad (`tDataShuffling`, `tReservoirSampling`) | Fijar la semilla; si no se puede, comprobar propiedades (mismas filas, distinto orden) |
| Librerias de calidad muy grandes | `installMissing`; primera compilacion lenta |
| `tVerifyEmail` necesita red | Servidor falso de DNS/SMTP o el modo "solo sintaxis" |
| Proveedores de direcciones (Melissa, QAS, Loqate, Google, Personator) | El componente no deja cambiar la URL: proxy + truststore de prueba hacia el servidor falso (EMULADORES.md seccion 3) |
| `tDqReportRun` | Requiere un proyecto de Data Quality: crearlo en el workspace de pruebas |
| Avisos de fecha en los catchers | Ya resueltos por el bridge (patron de fecha) |
| Idiomas japoneses | Fichero de prueba con texto japones en UTF-8 |

## 5. Aceptacion de P09

- Los 63 componentes ejecutados (A los locales; A-emu los de direcciones y verificacion con servidor falso).
- Cada heuristico con datos de respuesta conocida y salida exacta.
- Fichas en `docs/fichas-componentes/data-quality.md` y `data-privacy.md`, con una nota de **cumplimiento**: que garantiza
  (p. ej. el enmascarado es irreversible) y que no.
