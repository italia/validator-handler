'use strict'

import { db }  from "./connection"
import { syncTable as entitySyncTable } from "./models/entity"
import { syncTable as jobSyncTable } from "./models/job"
import { syncTable as userSyncTable } from "./models/user"

//@ts-ignore
import yargs from "yargs"
import { hideBin } from 'yargs/helpers'

const syncCommand = yargs(hideBin(process.argv))
    .usage("Usage: --tablename <tablename>")
    .option("tablename", { describe: "Table to be synched - use 'all' to sync all the database", type: "string", demandOption: true, choices: ['all', 'entity', 'job', 'user']})
    .argv

db
    .authenticate()
    .then(async () => {
        console.log(`[DB-SYNC]: Database ${db.getDatabaseName()} connected!`)
        console.log('[DB-SYNC]: Database sync start')

        switch (syncCommand.tablename) {
            case 'entity' :
                await entitySyncTable()
                break
            case 'job':
                await jobSyncTable()
                break
            case 'user':
                await userSyncTable()
                break
            case 'all':
                await entitySyncTable()
                await jobSyncTable()
                await userSyncTable()
                break
            default:
                console.log('[DB-SYNC]: No table synched')
        }

        console.log('[DB-SYNC]: Database sync finish')
    })
    .catch(err => {
        console.error('[DB-SYNC]: Unable to connect to the database:', err)
    })