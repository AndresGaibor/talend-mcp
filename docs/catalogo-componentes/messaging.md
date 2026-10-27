# Catalogo: Messaging

> Generado por `bun run scripts/catalogo-componentes.ts`. No lo edites: cambia el script o los datos de origen.

30 componentes · 0 compilan (L4) · 0 con escenario L5 que pasa o esta definido.

Subfamilias: Messaging/Kafka · Messaging/Kinesis · Messaging/MOM and JMS · Messaging/MQTT · Messaging/MapR Streams · Messaging/PubSub

| Componente | Nivel | Paleta | Params (oblig.) | Conectores | Libs oblig. | Servicio externo | L4 (compila) | L5 | Plan |
|---|---|---|---|---|---|---|---|---|---|
| `tJMSInput` | 13 | SPARKSTREAMING | 17/5 | FLOW SUBJOB_OK | 1 | broker: Kafka/ActiveMQ | n/a | n/a | P10 |
| `tJMSOutput` | 13 | SPARKSTREAMING | 23/4 | FLOW ITERATE SUBJOB_OK COMPONENT_OK COMPONENT_ERROR RUN_IF | 2 | broker: Kafka/ActiveMQ | n/a | n/a | P10 |
| `tKafkaAbstractInputAvro` | 13 | SPARKSTREAMING | 32/13 | FLOW SUBJOB_OK | - | broker: Kafka/ActiveMQ | n/a | n/a | P10 |
| `tKafkaCommit` | 13 | SPARKSTREAMING | 2/1 | FLOW | - | broker: Kafka/ActiveMQ | n/a | n/a | P10 |
| `tKafkaConfiguration` | 13 | SPARKSTREAMING | 28/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | broker: Kafka/ActiveMQ | n/a | n/a | P10 |
| `tKafkaConfiguration` | 13 | STRUCTUREDSTREAMING | 28/4 | FLOW ITERATE COMPONENT_OK COMPONENT_ERROR RUN_IF | 1 | broker: Kafka/ActiveMQ | n/a | n/a | P10 |
| `tKafkaInput` | 13 | SPARKSTREAMING | 25/10 | FLOW SUBJOB_OK | - | broker: Kafka/ActiveMQ | n/a | n/a | P10 |
| `tKafkaInput` | 13 | STRUCTUREDSTREAMING | 21/13 | FLOW SUBJOB_OK | - | broker: Kafka/ActiveMQ | n/a | n/a | P10 |
| `tKafkaInputAvro` | 13 | SPARKSTREAMING | 34/14 | FLOW SUBJOB_OK | - | broker: Kafka/ActiveMQ | n/a | n/a | P10 |
| `tKafkaOutput` | 13 | SPARKSTREAMING | 32/11 | FLOW | 1 | broker: Kafka/ActiveMQ | n/a | n/a | P10 |
| `tKafkaOutput` | 13 | STRUCTUREDSTREAMING | 25/9 | FLOW | 1 | broker: Kafka/ActiveMQ | n/a | n/a | P10 |
| `tKinesisAbstractInputAvro` | 13 | SPARKSTREAMING | 14/13 | FLOW SUBJOB_OK | - | AWS: LocalStack/moto | n/a | n/a | P10 |
| `tKinesisConfiguration` | 13 | STRUCTUREDSTREAMING | 9/4 | FLOW ITERATE COMPONENT_OK COMPONENT_ERROR RUN_IF | - | AWS: LocalStack/moto | n/a | n/a | P10 |
| `tKinesisInput` | 13 | SPARKSTREAMING | 12/11 | FLOW SUBJOB_OK | - | AWS: LocalStack/moto | n/a | n/a | P10 |
| `tKinesisInput` | 13 | STRUCTUREDSTREAMING | 12/7 | FLOW SUBJOB_OK | - | AWS: LocalStack/moto | n/a | n/a | P10 |
| `tKinesisInputAvro` | 13 | SPARKSTREAMING | 16/15 | FLOW SUBJOB_OK | - | AWS: LocalStack/moto | n/a | n/a | P10 |
| `tKinesisOutput` | 13 | SPARKSTREAMING | 16/7 | FLOW | - | AWS: LocalStack/moto | n/a | n/a | P10 |
| `tKinesisOutput` | 13 | STRUCTUREDSTREAMING | 15/7 | FLOW | - | AWS: LocalStack/moto | n/a | n/a | P10 |
| `tMapRStreamsAbstractInputAvro` | 13 | SPARKSTREAMING | 10/6 | FLOW SUBJOB_OK | - | ninguno | n/a | n/a | P10 |
| `tMapRStreamsInput` | 13 | SPARKSTREAMING | 11/6 | FLOW SUBJOB_OK | - | ninguno | n/a | n/a | P10 |
| `tMapRStreamsInputAvro` | 13 | SPARKSTREAMING | 13/8 | FLOW SUBJOB_OK | - | ninguno | n/a | n/a | P10 |
| `tMapRStreamsOutput` | 13 | SPARKSTREAMING | 15/4 | FLOW | 1 | ninguno | n/a | n/a | P10 |
| `tMQTTInput` | 13 | SPARKSTREAMING | 6/3 | FLOW SUBJOB_OK | 1 | ninguno | n/a | n/a | P10 |
| `tMQTTOutput` | 13 | SPARKSTREAMING | 13/2 | FLOW ITERATE SUBJOB_OK COMPONENT_OK COMPONENT_ERROR RUN_IF | 2 | ninguno | n/a | n/a | P10 |
| `tPubSubAbstractInputAvro` | 13 | SPARKSTREAMING | 10/7 | FLOW SUBJOB_OK | - | Google: emuladores | n/a | n/a | P10 |
| `tPubSubInput` | 13 | SPARKSTREAMING | 9/5 | FLOW SUBJOB_OK | 1 | Google: emuladores | n/a | n/a | P10 |
| `tPubSubInput` | 13 | STRUCTUREDSTREAMING | 13/6 | FLOW SUBJOB_OK | - | Google: emuladores | n/a | n/a | P10 |
| `tPubSubInputAvro` | 13 | SPARKSTREAMING | 12/9 | FLOW SUBJOB_OK | - | Google: emuladores | n/a | n/a | P10 |
| `tPubSubOutput` | 13 | SPARKSTREAMING | 15/5 | FLOW | 1 | Google: emuladores | n/a | n/a | P10 |
| `tPubSubOutput` | 13 | STRUCTUREDSTREAMING | 15/6 | FLOW | - | Google: emuladores | n/a | n/a | P10 |
