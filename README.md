# ![developers.italia](https://avatars1.githubusercontent.com/u/15377824?s=36&v=4 "developers.italia") PA Website Validator Handler

#### Gestore del validatore della pubblica amministrazione

PA Website validator handler è un tool che gestisce le scansioni effettuate da PA Website Validator.

## Funzionalità

- Creazione e gestione di code di PA da scansionare.
- Integra Pa Website Validator per eseguire scansioni programmate e salvarne i risultati.
- Espone API.
- Si integra con la piattaforma PA2026

## Tecnologie

PA Website Validator handler utilizza le seguenti tecnologie

- [Node.js] - Javascript runtime
- [npm] - Gestore di pacchetti
- [Typescript] - Linguaggio di programmazione fortemente tipizzato che si basa su JavaScript
- [PostgreSQL] - Sistema database relazionale a oggetti
- [Redis] - Archivio dati in memoria e di tipo chiave-valore
- [Swagger] - Libreria per documentazione API

## Requirements

PA Website Validator necessita [Node.js](https://nodejs.org/it/) v16+ (LTS), [npm], [PostgreSQL] e [Redis].

## Plugins

PA Website validator handler utilizza le seguenti dipendenze esterne principali

| Plugin               | Repository                         |
| -------------------- | ---------------------------------- |
| Yargs                | [GitHub][yargs-url]                |
| Sequelize            | [Sequelize][sequelize-url]         |
| BullMQ               | [BullMQ][bull-mq-url]              |
| Express              | [Express][express-url]             |
| Swagger-ui-express   | [GitHub][swagger-ui-url]           |
| Swagger-jsondoc      | [GitHub][swagger-jsondoc-url]      |
| Redis                | [Redis][redis]                     |
| PA Website Validator | [GitHub][pa-website-validator-url] |

## Utilizzo

Comando di build:

```bash
npm run build
```

Comando di **creazione coda**:

```bash
npm run dist-queue-manager --maxItems <number> --passedOlderThanDays <number> --failedOlderThanDays <number> --asservationOlderThanDays <number>
```

Mappa opzioni comando
| Parametro Comando | Descrizione | Obbligatorio | Default
| ------- | ------- | ------- | ------- |
| - -maxItems | Numero massimo di PA da accodare | ❌ | 100
| - -passedOlderThanDays | Giorni dopo i quali le entity con Job che ha fornito risultato PASSED vengono riaccodate per essere scansionate | ❌ |28
| - -failedOlderThanDays | Giorni dopo i quali le entity con Job che ha fornito risultato FAILED vengono riaccodate per essere scansionate | ❌ | 14
| - -asservationOlderThanDays | Giorni dopo i quali le entity asseverate vengono riaccodate per essere scansionate | ❌ | 28
| - -manualScanLogic | Flag per permettere solo alle entity flaggate come 'da scansionare' su PA2026 di entrare in coda di scansione | ❌ | false

Comando di prelievo Job da coda e **start scansione**:

```bash
npm run dist-scan-manager
```

Comando di **esecuzione flusso integrazione PA2026**:

```bash
npm run dist-PA2026-manager
```

Comando di start **webserver**:

```bash
npm run dist-webserver
```

## API DOC

Per visualizzare la documentazione API avviare il webserver e andare sulla rotta: /docs

[postgresql]: https://www.postgresql.org/
[redis]: https://redis.io/
[node.js]: http://nodejs.org
[npm]: https://www.npmjs.com/
[typescript]: https://www.typescriptlang.org/
[yargs-url]: https://github.com/yargs/yargs
[sequelize-url]: https://sequelize.org/
[bull-mq-url]: https://docs.bullmq.io/
[express-url]: https://expressjs.com/it/
[swagger-ui-url]: https://github.com/scottie1984/swagger-ui-express
[swagger-jsondoc-url]: https://github.com/Surnet/swagger-jsdoc
[pa-website-validator-url]: https://github.com/italia/pa-website-validator
[swagger]: https://swagger.io/
