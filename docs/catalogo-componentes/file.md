# Catalogo: File

> Generado por `bun run scripts/catalogo-componentes.ts`. No lo edites: cambia el script o los datos de origen.

111 componentes · 49 compilan (L4) · 20 con escenario L5 que pasa o esta definido.

Subfamilias: File/Hadoop · File/Input · File/Management · File/NamedPipe · File/Output · File/Sqoop

| Componente | Nivel | Paleta | Params (oblig.) | Conectores | Libs oblig. | Servicio externo | L4 (compila) | L5 | Plan |
|---|---|---|---|---|---|---|---|---|---|
| `tAdvancedFileOutputXML` | 4 | DI | 36/22 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 2 | ninguno | falla | sin escenario | P02 |
| `tApacheLogInput` | 3 | DI | 7/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | compila | sin escenario | P02 |
| `tAvroInput` | 13 | SPARK | 13/11 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tAvroInput` | 13 | SPARKSTREAMING | 13/11 | FLOW | - | ninguno | n/a | n/a | P10 |
| `tAvroInput` | 13 | STRUCTUREDSTREAMING | 13/11 | FLOW | - | ninguno | n/a | n/a | P10 |
| `tAvroOutput` | 13 | SPARK | 12/8 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tAvroOutput` | 13 | SPARKSTREAMING | 11/7 | FLOW | - | ninguno | n/a | n/a | P10 |
| `tAvroOutput` | 13 | STRUCTUREDSTREAMING | 14/6 | FLOW | - | ninguno | n/a | n/a | P10 |
| `tAvroStreamInput` | 13 | SPARKSTREAMING | 11/9 | FLOW SUBJOB_OK | 1 | ninguno | n/a | n/a | P10 |
| `tAvroStreamInput` | 13 | STRUCTUREDSTREAMING | 12/7 | FLOW SUBJOB_OK | - | ninguno | n/a | n/a | P10 |
| `tChangeFileEncoding` | 3 | DI | 7/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P02 |
| `tCreateTemporaryFile` | 3 | DI | 8/0 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P02 |
| `tExternalSortOutput` | 12 | DI | 11/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P01 |
| `tFileArchive` | 3 | DI | 17/10 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 6 | ninguno | falla | sin escenario | P02 |
| `tFileCompare` | 3 | DI | 8/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | con escenario | P02 |
| `tFileCopy` | 3 | DI | 12/10 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | falla | con escenario | P02 |
| `tFileDelete` | 3 | DI | 7/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | con escenario | P02 |
| `tFileExist` | 3 | DI | 1/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | con escenario | P02 |
| `tFileInputARFF` | 3 | DI | 4/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | compila | sin escenario | P02 |
| `tFileInputDelimited` | 1 | DI | 36/18 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 2 | ninguno | compila | con escenario | P01 |
| `tFileInputDelimited` | 13 | SPARK | 39/21 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tFileInputDelimited` | 13 | SPARKSTREAMING | 30/19 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tFileInputExcel` | 3 | DI | 32/16 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | falla | con escenario | P02 |
| `tFileInputFullRow` | 3 | DI | 10/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | compila | sin escenario | P02 |
| `tFileInputFullRow` | 13 | SPARK | 15/12 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tFileInputFullRow` | 13 | SPARKSTREAMING | 15/12 | FLOW | - | ninguno | n/a | n/a | P10 |
| `tFileInputJSON` | 3 | DI | 20/10 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | con escenario | P02 |
| `tFileInputJSON` | 13 | SPARK | 28/19 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 4 | ninguno | n/a | n/a | P10 |
| `tFileInputJSON` | 13 | SPARKSTREAMING | 23/16 | FLOW | 1 | ninguno | n/a | n/a | P10 |
| `tFileInputLDIF` | 3 | DI | 10/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | compila | sin escenario | P02 |
| `tFileInputMail` | 3 | DI | 7/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P02 |
| `tFileInputMSDelimited` | 3 | DI | 19/12 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 2 | ninguno | compila | sin escenario | P02 |
| `tFileInputMSPositional` | 3 | DI | 19/12 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | compila | sin escenario | P02 |
| `tFileInputMSXML` | 3 | DI | 10/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 3 | ninguno | falla | sin escenario | P02 |
| `tFileInputORC` | 3 | DI | 3/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 21 | ninguno | compila | sin escenario | P02 |
| `tFileInputParquet` | 13 | SPARK | 10/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tFileInputParquet` | 13 | SPARKSTREAMING | 7/5 | FLOW | - | ninguno | n/a | n/a | P10 |
| `tFileInputParquet` | 13 | STRUCTUREDSTREAMING | 7/5 | FLOW | - | ninguno | n/a | n/a | P10 |
| `tFileInputParquet` | 3 | DI | 3/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 22 | ninguno | compila | sin escenario | P02 |
| `tFileInputPositional` | 3 | DI | 25/12 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | compila | con escenario | P02 |
| `tFileInputPositional` | 13 | SPARK | 23/18 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tFileInputPositional` | 13 | SPARKSTREAMING | 23/18 | FLOW | - | ninguno | n/a | n/a | P10 |
| `tFileInputProperties` | 3 | DI | 6/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P02 |
| `tFileInputRaw` | 3 | DI | 7/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | compila | con escenario | P02 |
| `tFileInputRegex` | 3 | DI | 14/6 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | compila | con escenario | P02 |
| `tFileInputRegex` | 13 | SPARK | 17/12 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tFileInputRegex` | 13 | SPARKSTREAMING | 17/12 | FLOW | - | ninguno | n/a | n/a | P10 |
| `tFileInputXML` | 3 | DI | 20/10 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | falla | con escenario | P02 |
| `tFileInputXML` | 13 | SPARK | 24/13 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tFileInputXML` | 13 | SPARKSTREAMING | 24/13 | FLOW | - | ninguno | n/a | n/a | P10 |
| `tFileList` | 3 | DI | 16/0 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | compila | con escenario | P02 |
| `tFileOutputARFF` | 3 | DI | 8/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | falla | sin escenario | P02 |
| `tFileOutputDelimited` | 1 | DI | 28/18 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | compila | con escenario | P01 |
| `tFileOutputDelimited` | 13 | SPARK | 26/17 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tFileOutputDelimited` | 13 | SPARKSTREAMING | 27/18 | FLOW | - | ninguno | n/a | n/a | P10 |
| `tFileOutputExcel` | 3 | DI | 32/17 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | con escenario | P02 |
| `tFileOutputJSON` | 3 | DI | 5/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | compila | con escenario | P02 |
| `tFileOutputJSON` | 13 | SPARK | 10/8 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | n/a | n/a | P10 |
| `tFileOutputJSON` | 13 | SPARKSTREAMING | 11/9 | FLOW | 1 | ninguno | n/a | n/a | P10 |
| `tFileOutputLDIF` | 3 | DI | 13/9 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 2 | ninguno | compila | sin escenario | P02 |
| `tFileOutputMSDelimited` | 3 | DI | 14/8 | FLOW MERGE ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 3 | ninguno | compila | sin escenario | P02 |
| `tFileOutputMSPositional` | 3 | DI | 8/6 | FLOW MERGE ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 2 | ninguno | compila | sin escenario | P02 |
| `tFileOutputMSXML` | 3 | DI | 16/13 | FLOW MERGE ITERATE SUBJOB_OK COMPONENT_OK COMPONENT_ERROR RUN_IF | 3 | ninguno | compila | sin escenario | P02 |
| `tFileOutputORC` | 3 | DI | 5/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 21 | ninguno | compila | sin escenario | P02 |
| `tFileOutputParquet` | 13 | SPARK | 17/10 | FLOW | - | ninguno | n/a | n/a | P10 |
| `tFileOutputParquet` | 13 | SPARKSTREAMING | 13/7 | FLOW | - | ninguno | n/a | n/a | P10 |
| `tFileOutputParquet` | 13 | STRUCTUREDSTREAMING | 17/6 | FLOW | - | ninguno | n/a | n/a | P10 |
| `tFileOutputParquet` | 3 | DI | 7/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 25 | ninguno | compila | sin escenario | P02 |
| `tFileOutputPositional` | 3 | DI | 22/15 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | con escenario | P02 |
| `tFileOutputPositional` | 13 | SPARK | 23/17 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | n/a | n/a | P10 |
| `tFileOutputPositional` | 13 | SPARKSTREAMING | 24/18 | FLOW | - | ninguno | n/a | n/a | P10 |
| `tFileOutputProperties` | 3 | DI | 6/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P02 |
| `tFileOutputRaw` | 3 | DI | 4/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | compila | sin escenario | P02 |
| `tFileOutputXML` | 3 | DI | 20/17 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | compila | sin escenario | P02 |
| `tFileOutputXML` | 13 | SPARK | 19/13 | FLOW | - | ninguno | n/a | n/a | P10 |
| `tFileOutputXML` | 13 | SPARKSTREAMING | 20/14 | FLOW | - | ninguno | n/a | n/a | P10 |
| `tFileProperties` | 3 | DI | 3/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | con escenario | P02 |
| `tFileRowCount` | 3 | DI | 4/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | falla | sin escenario | P02 |
| `tFileStreamInputDelimited` | 13 | SPARKSTREAMING | 28/17 | FLOW SUBJOB_OK | - | ninguno | n/a | n/a | P10 |
| `tFileStreamInputFullRow` | 13 | SPARKSTREAMING | 13/10 | FLOW SUBJOB_OK | - | ninguno | n/a | n/a | P10 |
| `tFileStreamInputJSON` | 13 | SPARKSTREAMING | 21/14 | FLOW SUBJOB_OK | 2 | ninguno | n/a | n/a | P10 |
| `tFileStreamInputParquet` | 13 | SPARKSTREAMING | 7/5 | FLOW | - | ninguno | n/a | n/a | P10 |
| `tFileStreamInputParquet` | 13 | STRUCTUREDSTREAMING | 11/6 | FLOW SUBJOB_OK | - | ninguno | n/a | n/a | P10 |
| `tFileStreamInputPositional` | 13 | SPARKSTREAMING | 21/16 | FLOW SUBJOB_OK | - | ninguno | n/a | n/a | P10 |
| `tFileStreamInputRegex` | 13 | SPARKSTREAMING | 15/10 | FLOW SUBJOB_OK | - | ninguno | n/a | n/a | P10 |
| `tFileStreamInputXML` | 13 | SPARKSTREAMING | 22/11 | FLOW SUBJOB_OK | - | ninguno | n/a | n/a | P10 |
| `tFileTouch` | 3 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | con escenario | P02 |
| `tFileUnarchive` | 3 | DI | 12/8 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 7 | ninguno | sin medir | con escenario | P02 |
| `tGPGDecrypt` | 3 | DI | 7/0 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P02 |
| `tHDFSCompare` | 10 | DI | 35/24 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | Hadoop: compose/local | compila | sin escenario | P08 |
| `tHDFSConnection` | 10 | DI | 34/19 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | Hadoop: compose/local | compila | sin escenario | P08 |
| `tHDFSCopy` | 10 | DI | 35/25 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | Hadoop: compose/local | sin medir | sin escenario | P08 |
| `tHDFSDelete` | 10 | DI | 34/18 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | Hadoop: compose/local | compila | sin escenario | P08 |
| `tHDFSExist` | 10 | DI | 36/18 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | Hadoop: compose/local | compila | sin escenario | P08 |
| `tHDFSGet` | 10 | DI | 39/17 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | Hadoop: compose/local | compila | sin escenario | P08 |
| `tHDFSInput` | 10 | DI | 42/27 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | Hadoop: compose/local | sin medir | sin escenario | P08 |
| `tHDFSList` | 10 | DI | 47/17 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | Hadoop: compose/local | sin medir | sin escenario | P08 |
| `tHDFSOutput` | 10 | DI | 44/29 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | Hadoop: compose/local | compila | sin escenario | P08 |
| `tHDFSOutputRaw` | 10 | DI | 36/22 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | Hadoop: compose/local | compila | sin escenario | P08 |
| `tHDFSProperties` | 10 | DI | 36/20 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | Hadoop: compose/local | compila | sin escenario | P08 |
| `tHDFSPut` | 10 | DI | 39/17 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | Hadoop: compose/local | compila | con escenario | P08 |
| `tHDFSRename` | 10 | DI | 37/17 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | Hadoop: compose/local | compila | sin escenario | P08 |
| `tHDFSRowCount` | 10 | DI | 33/22 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | Hadoop: compose/local | falla | sin escenario | P08 |
| `tNamedPipeClose` | 3 | DI | 1/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | sin medir | sin escenario | P02 |
| `tNamedPipeOpen` | 3 | DI | 2/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | sin medir | sin escenario | P02 |
| `tNamedPipeOutput` | 3 | DI | 13/12 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | sin medir | sin escenario | P02 |
| `tPivotToColumnsDelimited` | 4 | DI | 16/12 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | compila | sin escenario | P02 |
| `tSqoopExport` | 10 | DI | 83/36 | ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | Hadoop: compose/local | falla | sin escenario | P08 |
| `tSqoopImport` | 10 | DI | 89/35 | ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | Hadoop: compose/local | falla | sin escenario | P08 |
| `tSqoopImportAllTables` | 10 | DI | 70/33 | ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | Hadoop: compose/local | falla | sin escenario | P08 |
| `tSqoopMerge` | 10 | DI | 63/43 | ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | Hadoop: compose/local | falla | sin escenario | P08 |
