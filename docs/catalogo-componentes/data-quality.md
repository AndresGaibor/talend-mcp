# Catalogo: Data Quality

> Generado por `bun run scripts/catalogo-componentes.ts`. No lo edites: cambia el script o los datos de origen.

86 componentes · 8 compilan (L4) · 4 con escenario L5 que pasa o esta definido.

Subfamilias: Data Quality/Matching · Data_Quality · Data_Quality/Address · Data_Quality/Address/Experian QAS · Data_Quality/Address/Loqate · Data_Quality/Address/MelissaData · Data_Quality/Matching · Data_Quality/Matching/Pattern matching · Data_Quality/Standardization · Data_Quality/Survivorship

| Componente | Nivel | Paleta | Params (oblig.) | Conectores | Libs oblig. | Servicio externo | L4 (compila) | L5 | Plan |
|---|---|---|---|---|---|---|---|---|---|
| `tAddCRCRow` | 11 | DI | 3/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | falla | sin escenario | P09 |
| `tAddressRowCloud` | 11 | DI | 24/15 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 9 | ninguno | sin medir | sin escenario | P09 |
| `tBatchAddressRowCloud` | 11 | DI | 23/17 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 9 | ninguno | sin medir | sin escenario | P09 |
| `tBatchAddressRowCloudIn` | 11 | DI | 22/16 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 9 | ninguno | sin medir | sin escenario | P09 |
| `tBatchAddressRowCloudOut` | 11 | DI | 23/16 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 9 | ninguno | sin medir | sin escenario | P09 |
| `tDataQualityRules` | 11 | DI | 8/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR | 27 | ninguno | falla | sin escenario | P09 |
| `tDataQualityRules` | 13 | SPARK | 8/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR | 22 | ninguno | n/a | n/a | P10 |
| `tDataQualityRules` | 13 | SPARKSTREAMING | 8/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR | 22 | ninguno | n/a | n/a | P10 |
| `tDataQualityRules` | 13 | STRUCTUREDSTREAMING | 8/6 | FLOW | - | ninguno | n/a | n/a | P10 |
| `tDqReportRun` | 11 | DI | 8/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 110 | ninguno | falla | sin escenario | P09 |
| `tFindRegexlibExpressions` | 11 | DI | 5/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 3 | ninguno | falla | sin escenario | P09 |
| `tFirstnameMatch` | 11 | DI | 9/4 | FLOW SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 7 | ninguno | compila | sin escenario | P09 |
| `tFuzzyMatch` | 11 | DI | 9/8 | FLOW LOOKUP ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 2 | ninguno | sin medir | sin escenario | P09 |
| `tFuzzyUniqRow` | 11 | DI | 4/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 2 | ninguno | sin medir | sin escenario | P09 |
| `tGenKey` | 11 | DI | 6/2 | FLOW SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 5 | ninguno | sin medir | sin escenario | P09 |
| `tGenKey` | 13 | SPARK | 5/2 | FLOW SUBJOB_OK SUBJOB_ERROR | 3 | ninguno | n/a | n/a | P10 |
| `tGenKey` | 13 | SPARKSTREAMING | 5/2 | FLOW SUBJOB_OK SUBJOB_ERROR | 3 | ninguno | n/a | n/a | P10 |
| `tGoogleAddressRow` | 11 | DI | 5/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | sin medir | sin escenario | P09 |
| `tGoogleGeocoder` | 11 | DI | 5/3 | FLOW ITERATE THEN_RUN RUN_OK RUN_ERROR RUN_IF | - | ninguno | sin medir | sin escenario | P09 |
| `tGoogleMapLookup` | 11 | DI | 6/4 | FLOW LOOKUP ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | sin medir | sin escenario | P09 |
| `tIntervalMatch` | 11 | DI | 7/7 | FLOW LOOKUP ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | falla | sin escenario | P09 |
| `tJapaneseNumberNormalize` | 11 | DI | 2/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | falla | sin escenario | P09 |
| `tJapaneseNumberNormalize` | 13 | SPARK | 2/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | n/a | n/a | P10 |
| `tJapaneseNumberNormalize` | 13 | SPARKSTREAMING | 2/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | n/a | n/a | P10 |
| `tJapaneseNumberNormalize` | 13 | STRUCTUREDSTREAMING | 3/2 | FLOW LOOKUP | - | ninguno | n/a | n/a | P10 |
| `tJapaneseTokenize` | 11 | DI | 2/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 6 | ninguno | falla | sin escenario | P09 |
| `tJapaneseTokenize` | 13 | SPARK | 2/2 | FLOW LOOKUP ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 3 | ninguno | n/a | n/a | P10 |
| `tJapaneseTokenize` | 13 | SPARKSTREAMING | 2/2 | FLOW LOOKUP ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 3 | ninguno | n/a | n/a | P10 |
| `tJapaneseTokenize` | 13 | STRUCTUREDSTREAMING | 3/2 | FLOW LOOKUP | - | ninguno | n/a | n/a | P10 |
| `tJapaneseTransliterate` | 11 | DI | 2/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 7 | ninguno | falla | sin escenario | P09 |
| `tJapaneseTransliterate` | 13 | SPARK | 2/2 | FLOW LOOKUP ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 4 | ninguno | n/a | n/a | P10 |
| `tJapaneseTransliterate` | 13 | SPARKSTREAMING | 2/2 | FLOW LOOKUP ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 4 | ninguno | n/a | n/a | P10 |
| `tJapaneseTransliterate` | 13 | STRUCTUREDSTREAMING | 3/2 | FLOW LOOKUP | - | ninguno | n/a | n/a | P10 |
| `tLastRegexlibExpressions` | 11 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 3 | ninguno | sin medir | sin escenario | P09 |
| `tLoqateAddressRow` | 11 | DI | 10/10 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | sin medir | sin escenario | P09 |
| `tMatchGroup` | 11 | DI | 32/5 | FLOW | 13 | ninguno | sin medir | sin escenario | P09 |
| `tMatchGroup` | 13 | SPARK | 29/5 | FLOW | 13 | ninguno | n/a | n/a | P10 |
| `tMatchGroupIn` | 11 | DI | 17/3 | FLOW | 11 | ninguno | sin medir | sin escenario | P09 |
| `tMatchGroupOut` | 11 | DI | 8/0 | FLOW | 11 | ninguno | sin medir | sin escenario | P09 |
| `tMatchModel` | 13 | SPARK | 38/30 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tMatchPairing` | 13 | SPARK | 25/15 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tMatchPredict` | 13 | SPARK | 17/10 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tMelissaDataAddress` | 11 | DI | 8/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 3 | ninguno | sin medir | sin escenario | P09 |
| `tMultiPatternCheck` | 11 | DI | 7/2 | FLOW | - | ninguno | compila | sin escenario | P09 |
| `tPatternCheck` | 11 | DI | 9/2 | FLOW ITERATE | - | ninguno | falla | sin escenario | P09 |
| `tPatternExtract` | 11 | DI | 9/1 | FLOW ITERATE | - | ninguno | falla | sin escenario | P09 |
| `tPersonator` | 11 | DI | 56/44 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | sin medir | sin escenario | P09 |
| `tPersonatorIn` | 11 | DI | 56/44 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | sin medir | sin escenario | P09 |
| `tPersonatorOut` | 11 | DI | 56/44 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | sin medir | sin escenario | P09 |
| `tQASAddressRow` | 11 | DI | 4/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 14 | ninguno | sin medir | sin escenario | P09 |
| `tQASBatchAddressRow` | 11 | DI | 6/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | sin medir | sin escenario | P09 |
| `tRecordMatching` | 11 | DI | 16/5 | FLOW LOOKUP ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 5 | ninguno | sin medir | sin escenario | P09 |
| `tReplaceList` | 1 | DI | 4/4 | FLOW LOOKUP ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | falla | sin escenario | P01 |
| `tReservoirSampling` | 11 | DI | 3/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | falla | sin escenario | P09 |
| `tReservoirSampling` | 13 | SPARK | 3/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 2 | ninguno | n/a | n/a | P10 |
| `tReservoirSamplingIn` | 11 | DI | 4/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 3 | ninguno | falla | sin escenario | P09 |
| `tReservoirSamplingOut` | 11 | DI | 3/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 3 | ninguno | falla | sin escenario | P09 |
| `tRuleSurvivorship` | 11 | DI | 10/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 27 | ninguno | compila | sin escenario | P09 |
| `tRuleSurvivorship` | 13 | SPARK | 7/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | 20 | ninguno | n/a | n/a | P10 |
| `tSchemaComplianceCheck` | 4 | DI | 28/21 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | falla | sin escenario | P02 |
| `tSchemaComplianceCheck` | 13 | SPARK | 16/13 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tSchemaComplianceCheck` | 13 | SPARKSTREAMING | 16/13 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tStandardizePhoneNumber` | 11 | DI | 8/4 | FLOW COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | compila | con escenario | P09 |
| `tStandardizePhoneNumber` | 13 | SPARK | 8/4 | FLOW | 1 | ninguno | n/a | n/a | P10 |
| `tStandardizePhoneNumber` | 13 | SPARKSTREAMING | 8/4 | FLOW | 1 | ninguno | n/a | n/a | P10 |
| `tStandardizePhoneNumber` | 13 | STRUCTUREDSTREAMING | 8/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | - | ninguno | n/a | n/a | P10 |
| `tStandardizeRow` | 11 | DI | 12/2 | FLOW COMPONENT_OK COMPONENT_ERROR RUN_IF | 9 | ninguno | falla | sin escenario | P09 |
| `tStandardizeRow` | 13 | SPARK | 12/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 7 | ninguno | n/a | n/a | P10 |
| `tStandardizeRow` | 13 | SPARKSTREAMING | 12/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 7 | ninguno | n/a | n/a | P10 |
| `tStandardizeRow` | 13 | STRUCTUREDSTREAMING | 13/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | - | ninguno | n/a | n/a | P10 |
| `tStem` | 11 | DI | 3/2 | FLOW COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | sin medir | sin escenario | P09 |
| `tSynonymOutput` | 11 | DI | 9/3 | FLOW COMPONENT_OK COMPONENT_ERROR RUN_IF | 7 | ninguno | compila | con escenario | P09 |
| `tSynonymSearch` | 11 | DI | 5/3 | FLOW COMPONENT_OK COMPONENT_ERROR RUN_IF | 7 | ninguno | falla | con escenario | P09 |
| `tSynonymSearch` | 13 | SPARK | 5/3 | FLOW | 5 | ninguno | n/a | n/a | P10 |
| `tSynonymSearch` | 13 | SPARKSTREAMING | 5/3 | FLOW | 5 | ninguno | n/a | n/a | P10 |
| `tSynonymSearch` | 13 | STRUCTUREDSTREAMING | 4/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | - | ninguno | n/a | n/a | P10 |
| `tThresholdViolationAlert` | 11 | DI | 9/9 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P09 |
| `tTransliterate` | 11 | DI | 2/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | compila | sin escenario | P09 |
| `tTransliterate` | 13 | SPARK | 2/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | 1 | ninguno | n/a | n/a | P10 |
| `tTransliterate` | 13 | SPARKSTREAMING | 2/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | 1 | ninguno | n/a | n/a | P10 |
| `tTransliterate` | 13 | STRUCTUREDSTREAMING | 2/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | - | ninguno | n/a | n/a | P10 |
| `tUniqRow` | 1 | DI | 9/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | con escenario | P01 |
| `tVerifyEmail` | 11 | DI | 27/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 5 | ninguno | falla | sin escenario | P09 |
| `tVerifyEmail` | 13 | SPARK | 25/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | 3 | ninguno | n/a | n/a | P10 |
| `tVerifyEmail` | 13 | SPARKSTREAMING | 25/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | 3 | ninguno | n/a | n/a | P10 |
| `tVerifyEmail` | 13 | STRUCTUREDSTREAMING | 25/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR | - | ninguno | n/a | n/a | P10 |
