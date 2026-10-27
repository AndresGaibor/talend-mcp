# Fallos de compilacion conocidos (L4)

> Generado. Son los componentes que fallaron en TODAS las corridas de `testdata/cobertura-*.csv`. Muchos fallos antiguos
> eran de arnes o de memoria de Studio: **vuelve a medir antes de dar uno por malo** (ver plan P00, paso 2).

| Componente | Ultimo error |
|---|---|
| `tAddCRCRow` | [ERROR] [ERROR] Project 'org.example.prj_bancolombia.job:MCP_Coverage:0.1.0' is duplicated in the reactor @ 
 |
| `tAdvancedFileOutputXML` | nb_line_tAFOX_2 cannot be resolved to a variable |
| `tAdvancedHash` | generationManager is not initialized by the perljet/javajet! |
| `tAdvancedXMLMapHash` | IllegalStateException |
| `tAggregateIn` | AggOperationStruct_tAggregate_1 cannot be resolved to a type |
| `tAggregateSortedRow` | Syntax error, insert "}" to complete Block |
| `tArrayIn` | Structarray_tArray_1 cannot be resolved to a type |
| `tAsyncIn` | The method setFree(boolean) is undefined for the type MCP_Coverage |
| `tContextLoad` | Duplicate local variable key_tContextLoad_2 |
| `tCosmosDBClose` | com.mongodb cannot be resolved to a type |
| `tCosmosDBWriteConf` | Index 0 out of bounds for length 0 |
| `tDataQualityRules` | IllegalArgumentException |
| `tDataShuffling` | Cannot invoke "java.util.List.size()" because "outputColumns" is null |
| `tDataShufflingIn` | Cannot invoke "java.util.List.iterator()" because "inputColumns" is null |
| `tDataShufflingOut` | Index 0 out of bounds for length 0 |
| `tDataUnmasking` | nullStruct cannot be resolved to a type |
| `tDenormalize` | ciudad cannot be resolved or is not a field |
| `tDenormalizeOut` | OnRowsEndStructtDenormalize_1 cannot be resolved to a type |
| `tDenormalizeSortedRow` | Syntax error on token "==", Expression expected after this token |
| `tDqReportRun` | [ERROR] [ERROR] Project 'org.example.prj_bancolombia.job:MCP_Coverage:0.1.0' is duplicated in the reactor @ 
 |
| `tDuplicateRow` | Return type for the method is missing |
| `tDynamicGuessSchema` | metadatas cannot be resolved or is not a field |
| `tEDIFACTtoXML` | [ERROR] [ERROR] Project 'org.example.prj_bancolombia.job:MCP_Coverage:0.1.0' is duplicated in the reactor @ 
 |
| `tExtractDelimitedFields` | Cannot invoke "org.talend.core.model.process.IConnection.getMetadataTable()" because "outConn" is null |
| `tExtractXMLField` | [ERROR] [ERROR] Project 'org.example.prj_bancolombia.job:MCP_Coverage:0.1.0' is duplicated in the reactor @ 
 |
| `tFileArchive` | [ERROR] [ERROR] Project 'org.example.prj_bancolombia.job:MCP_Coverage:0.1.0' is duplicated in the reactor @ 
 |
| `tFileCopy` | IllegalArgumentException |
| `tFileInputExcel` | Syntax error on token ",", delete this token |
| `tFileInputMSXML` | Syntax error, insert "}" to complete ClassBody |
| `tFileInputXML` | NameSpaceTool_tFileInputXML_2 cannot be resolved to a type |
| `tFileOutputARFF` | The method addStringValue(String) in the type Attribute is not applicable for the arguments (Integer) |
| `tFileRowCount` | [ERROR] [ERROR] Project 'org.example.prj_bancolombia.job:MCP_Coverage:0.1.0' is duplicated in the reactor @ 
 |
| `tFindRegexlibExpressions` | [ERROR] [ERROR] Project 'org.example.prj_bancolombia.job:MCP_Coverage:0.1.0' is duplicated in the reactor @ 
 |
| `tForeach` | Syntax error on tokens, delete these tokens |
| `tFTPClose` | org.apache.commons.net cannot be resolved to a type |
| `tHashInput` | Syntax error on token ".", ; expected |
| `tHBaseClose` | org.apache.hadoop.hbase.client.ConnectionFactory cannot be resolved to a type |
| `tHDFSRowCount` | org.apache.hadoop cannot be resolved to a type |
| `tIngresBulkExec` | executableFilePath_tDBBulkExec_4 cannot be resolved to a variable |
| `tIntervalMatch` | Cannot invoke "org.talend.core.model.process.IConnection.getName()" because "inRefCon" is null |
| `tIterateToFlowOut` | OnSubjobOkStructtIterateToFlow_1 cannot be resolved to a type |
| `tJapaneseNumberNormalize` | [ERROR] [ERROR] Project 'org.example.prj_bancolombia.job:MCP_Coverage:0.1.0' is duplicated in the reactor @ 
 |
| `tJapaneseTokenize` | [ERROR] [ERROR] Project 'org.example.prj_bancolombia.job:MCP_Coverage:0.1.0' is duplicated in the reactor @ 
 |
| `tJapaneseTransliterate` | [ERROR] [ERROR] Project 'org.example.prj_bancolombia.job:MCP_Coverage:0.1.0' is duplicated in the reactor @ 
 |
| `tJBossESBInput` | org.jboss.soa cannot be resolved to a type |
| `tJBossESBOutput` | org.jboss.soa cannot be resolved to a type |
| `tJobStructureCatcher` | auditLogger_talendJobLog cannot be resolved |
| `tKafkaCommit` | Cannot invoke "org.talend.core.model.process.INode.getUniqueName()" because "kiNode" is null |
| `tKafkaInput` | Cannot invoke "org.talend.core.model.process.IConnection.getName()" because "this.outgoingConnection" is null |
| `tMapRDBClose` | org.apache.hadoop cannot be resolved to a type |
| `tMapRDBInput` | org.apache.hadoop.hbase.client.ConnectionFactory cannot be resolved to a type |
| `tMapRDBOutput` | org.apache.hadoop cannot be resolved to a type |
| `tMapROjaiInput` | Cannot invoke "org.talend.core.model.metadata.IMetadataTable.getListColumns()" because "metadata" is null |
| `tMapROjaiOutput` | Cannot invoke "org.talend.core.model.metadata.IMetadataColumn.getOriginalDbColumnName()" because the return va |
| `tMapRStreamsCommit` | Cannot invoke "org.talend.core.model.process.INode.getUniqueName()" because "msiNode" is null |
| `tMapRStreamsConnection` | The distribution  with the version  doesn't exist |
| `tMapRStreamsCreateStream` | Cannot invoke "org.talend.core.model.process.INode.getUniqueName()" because "this.connNode" is null |
| `tMapRStreamsInput` | The distribution  with the version  doesn't exist |
| `tMapRStreamsOutput` | The distribution  with the version  doesn't exist |
| `tMomCommit` | com.ibm cannot be resolved to a type |
| `tMomInputIn` | nb_line_tMomInputIn_2 cannot be resolved to a variable |
| `tMomRollback` | com.ibm cannot be resolved to a type |
| `tMongoDBClose` | com.mongodb cannot be resolved to a type |
| `tMongoDBWriteConf` | Index 0 out of bounds for length 0 |
| `tNormalize` | The method split(String, int) is undefined for the type Integer |
| `tPatternCheck` | Syntax error on token "=", VariableInitializer expected after this token |
| `tPatternExtract` | Syntax error on token "=", VariableInitializer expected after this token |
| `tPatternMasking` | nullStruct cannot be resolved to a type |
| `tPatternUnmasking` | Return type for the method is missing |
| `tRecordMatchingIn` | Index 0 out of bounds for length 0 |
| `tReplaceList` | replacement cannot be resolved to a variable |
| `tReservoirSampling` | Cannot invoke "java.util.List.size()" because "outputColumns" is null |
| `tReservoirSamplingIn` | [ERROR] [ERROR] Project 'org.example.prj_bancolombia.job:MCP_Coverage:0.1.0' is duplicated in the reactor @ 
 |
| `tReservoirSamplingOut` | Cannot invoke "java.util.List.size()" because "outputColumns" is null |
| `tRunJob` | Syntax error on token "new", ClassType expected after this token |
| `tSAPADSOOutput` | [ERROR] [ERROR] Project 'org.example.prj_bancolombia.job:MCP_Coverage:0.1.0' is duplicated in the reactor @ 
 |
| `tSAPBapi` | [ERROR] [ERROR] Project 'org.example.prj_bancolombia.job:MCP_Coverage:0.1.0' is duplicated in the reactor @ 
 |
| `tSAPBapiOut` | org.talend.sap cannot be resolved to a type |
| `tSAPDataSourceOutput` | IllegalArgumentException |
| `tSAPDSOOutput` | [ERROR] [ERROR] Project 'org.example.prj_bancolombia.job:MCP_Coverage:0.1.0' is duplicated in the reactor @ 
 |
| `tSAPIDocInput` | [ERROR] [ERROR] Project 'org.example.prj_bancolombia.job:MCP_Coverage:0.1.0' is duplicated in the reactor @ 
 |
| `tSAPIDocReceiver` | [ERROR] [ERROR] Project 'org.example.prj_bancolombia.job:MCP_Coverage:0.1.0' is duplicated in the reactor @ 
 |
| `tSAPInfoCubeInput` | [ERROR] [ERROR] Project 'org.example.prj_bancolombia.job:MCP_Coverage:0.1.0' is duplicated in the reactor @ 
 |
| `tSchemaComplianceCheck` | [ERROR] [ERROR] Project 'org.example.prj_bancolombia.job:MCP_Coverage:0.1.0' is duplicated in the reactor @ 
 |
| `tSCPClose` | The method closeCloseableConnections(String, String) is undefined for the type MCP_Coverage |
| `tSortIn` | nullStruct cannot be resolved to a type |
| `tSqoopExport` | org.apache.sqoop cannot be resolved to a type |
| `tSqoopImport` | org.apache.sqoop.Sqoop cannot be resolved to a type |
| `tSqoopImportAllTables` | org.apache.sqoop.SqoopOptions cannot be resolved to a type |
| `tSqoopMerge` | org.apache.sqoop cannot be resolved to a type |
| `tStandardizeRow` | routines.Mcp_coverageTstandardizerow_2 cannot be resolved to a type |
| `tSurviveIn` | row1Struct cannot be resolved to a type |
| `tSynonymSearch` | Syntax error on token ".", , expected |
| `tThresholdViolationAlertIn` | row1Struct cannot be resolved to a type |
| `tUniqRowOut` | The left-hand side of an assignment must be a variable |
| `tVerifyEmail` | [ERROR] [ERROR] Project 'org.example.prj_bancolombia.job:MCP_Coverage:0.1.0' is duplicated in the reactor @ 
 |
| `tWriteDynamicFields` | Cannot invoke addColumnValue(Integer) on the primitive type null |
| `tWriteJSONField` | Cannot load from object array because "treeObjs" is null |
| `tWriteXMLField` | Cannot load from object array because "treeObjs" is null |
| `tWriteXMLFieldIn` | nb_line_tWriteXMLFieldIn_2 cannot be resolved to a variable |
| `tWriteXMLFieldOut` | Index 0 out of bounds for length 0 |
| `tXSLT` | IllegalArgumentException |
