# Catalogo: Internet

> Generado por `bun run scripts/catalogo-componentes.ts`. No lo edites: cambia el script o los datos de origen.

55 componentes · 20 compilan (L4) · 7 con escenario L5 que pasa o esta definido.

Subfamilias: Internet · Internet/ESB · Internet/FTP · Internet/Kafka · Internet/MOM and JMS · Internet/MapR Streams · Internet/SCP

| Componente | Nivel | Paleta | Params (oblig.) | Conectores | Libs oblig. | Servicio externo | L4 (compila) | L5 | Plan |
|---|---|---|---|---|---|---|---|---|---|
| `tFTPClose` | 7 | DI | 1/0 | ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | FTP/SFTP/SSH: contenedor | falla | sin escenario | P05 |
| `tFTPConnection` | 7 | DI | 32/12 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | FTP/SFTP/SSH: contenedor | compila | con escenario | P05 |
| `tFTPDelete` | 7 | DI | 41/14 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | FTP/SFTP/SSH: contenedor | compila | con escenario | P05 |
| `tFTPFileExist` | 7 | DI | 40/13 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | FTP/SFTP/SSH: contenedor | compila | sin escenario | P05 |
| `tFTPFileList` | 7 | DI | 39/13 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | FTP/SFTP/SSH: contenedor | compila | con escenario | P05 |
| `tFTPFileProperties` | 7 | DI | 40/15 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | FTP/SFTP/SSH: contenedor | compila | sin escenario | P05 |
| `tFTPGet` | 7 | DI | 46/14 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | FTP/SFTP/SSH: contenedor | compila | con escenario | P05 |
| `tFTPPut` | 7 | DI | 48/15 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | FTP/SFTP/SSH: contenedor | compila | con escenario | P05 |
| `tFTPRename` | 7 | DI | 40/14 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | FTP/SFTP/SSH: contenedor | compila | con escenario | P05 |
| `tFTPTruncate` | 7 | DI | 39/14 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | FTP/SFTP/SSH: contenedor | compila | sin escenario | P05 |
| `tJBossESBInput` | 8 | DI | 1/0 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | falla | sin escenario | P06 |
| `tJBossESBOutput` | 8 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | falla | sin escenario | P06 |
| `tJMSInput` | 8 | DI | 20/6 | FLOW ITERATE SUBJOB_OK COMPONENT_OK COMPONENT_ERROR RUN_IF | - | broker: Kafka/ActiveMQ | compila | sin escenario | P06 |
| `tJMSOutput` | 8 | DI | 15/4 | FLOW ITERATE SUBJOB_OK COMPONENT_OK COMPONENT_ERROR RUN_IF | - | broker: Kafka/ActiveMQ | compila | sin escenario | P06 |
| `tKafkaCommit` | 8 | DI | 1/1 | FLOW SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | broker: Kafka/ActiveMQ | falla | sin escenario | P06 |
| `tKafkaConnection` | 8 | DI | 12/1 | FLOW SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | broker: Kafka/ActiveMQ | compila | sin escenario | P06 |
| `tKafkaCreateTopic` | 8 | DI | 23/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | broker: Kafka/ActiveMQ | compila | sin escenario | P06 |
| `tKafkaInput` | 8 | DI | 49/19 | FLOW SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | broker: Kafka/ActiveMQ | falla | sin escenario | P06 |
| `tKafkaOutput` | 8 | DI | 39/14 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | broker: Kafka/ActiveMQ | compila | sin escenario | P06 |
| `tMapRStreamsCommit` | 8 | DI | 1/1 | FLOW SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | falla | sin escenario | P06 |
| `tMapRStreamsConnection` | 8 | DI | 18/12 | FLOW SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | falla | sin escenario | P06 |
| `tMapRStreamsCreateStream` | 8 | DI | 26/11 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | falla | sin escenario | P06 |
| `tMapRStreamsInput` | 8 | DI | 22/11 | FLOW SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | falla | sin escenario | P06 |
| `tMapRStreamsOutput` | 8 | DI | 8/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | falla | sin escenario | P06 |
| `tMicrosoftMQInput` | 8 | DI | 5/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | broker: Kafka/ActiveMQ | sin medir | sin escenario | P06 |
| `tMicrosoftMQOutput` | 8 | DI | 7/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | broker: Kafka/ActiveMQ | sin medir | sin escenario | P06 |
| `tMomCommit` | 8 | DI | 2/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | broker: Kafka/ActiveMQ | falla | sin escenario | P06 |
| `tMomConnection` | 8 | DI | 25/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | broker: Kafka/ActiveMQ | compila | sin escenario | P06 |
| `tMomInput` | 8 | DI | 57/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | broker: Kafka/ActiveMQ | compila | sin escenario | P06 |
| `tMomMessageIdList` | 8 | DI | 9/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | broker: Kafka/ActiveMQ | compila | sin escenario | P06 |
| `tMomOutput` | 8 | DI | 49/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | broker: Kafka/ActiveMQ | sin medir | sin escenario | P06 |
| `tMomRollback` | 8 | DI | 3/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | broker: Kafka/ActiveMQ | falla | sin escenario | P06 |
| `tPOP` | 9 | DI | 23/17 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 3 | correo: MailHog/GreenMail | sin medir | sin escenario | P07 |
| `tRSSInput` | 9 | DI | 12/7 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 4 | ninguno | sin medir | sin escenario | P07 |
| `tRSSOutput` | 9 | DI | 16/15 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 2 | ninguno | sin medir | sin escenario | P07 |
| `tSCPClose` | 7 | DI | 1/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | FTP/SFTP/SSH: contenedor | falla | sin escenario | P05 |
| `tSCPConnection` | 7 | DI | 7/0 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 2 | FTP/SFTP/SSH: contenedor | sin medir | sin escenario | P05 |
| `tSCPDelete` | 7 | DI | 11/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 2 | FTP/SFTP/SSH: contenedor | sin medir | sin escenario | P05 |
| `tSCPFileExists` | 7 | DI | 11/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 2 | FTP/SFTP/SSH: contenedor | sin medir | sin escenario | P05 |
| `tSCPFileList` | 7 | DI | 11/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 2 | FTP/SFTP/SSH: contenedor | sin medir | sin escenario | P05 |
| `tSCPGet` | 7 | DI | 13/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 4 | FTP/SFTP/SSH: contenedor | sin medir | sin escenario | P05 |
| `tSCPPut` | 7 | DI | 11/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 4 | FTP/SFTP/SSH: contenedor | sin medir | sin escenario | P05 |
| `tSCPRename` | 7 | DI | 11/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 2 | FTP/SFTP/SSH: contenedor | sin medir | sin escenario | P05 |
| `tSCPTruncate` | 7 | DI | 11/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 4 | FTP/SFTP/SSH: contenedor | sin medir | sin escenario | P05 |
| `tSendMail` | 1 | DI | 27/19 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 3 | correo: MailHog/GreenMail | sin medir | con escenario | P01 |
| `tSetKerberosConfiguration` | 2 | DI | 4/0 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P01 |
| `tSetKeystore` | 2 | DI | 11/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P01 |
| `tSetProxy` | 2 | DI | 11/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | sin escenario | P01 |
| `tSOAP` | 9 | DI | 24/14 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 8 | HTTP: servidor falso | sin medir | sin escenario | P07 |
| `tSocketInput` | 7 | DI | 13/3 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | sin medir | sin escenario | P05 |
| `tSocketOutput` | 7 | DI | 11/2 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | sin medir | sin escenario | P05 |
| `tSVNLogInput` | 12 | DI | 8/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | ninguno | sin medir | sin escenario | P01 |
| `tWebService` | 9 | DI | 30/17 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 32 | HTTP: servidor falso | sin medir | sin escenario | P07 |
| `tWebServiceInput` | 9 | DI | 26/12 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 8 | HTTP: servidor falso | sin medir | sin escenario | P07 |
| `tXMLRPCInput` | 9 | DI | 7/5 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 7 | HTTP: servidor falso | sin medir | sin escenario | P07 |
