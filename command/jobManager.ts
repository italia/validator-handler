'use strict'

import { db }  from "../database/connection"

//@ts-ignore
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { QueryTypes } from "sequelize"
import dateFormat from "dateformat"
import { v4 as uuidv4 } from 'uuid'
import { define as entityDefine } from "../database/models/entity"
import { define as jobDefine } from "../database/models/job"
import { arrayChunkify as instancesChunkify } from "../utils/utils"

const command = yargs(hideBin(process.argv))
    .usage("Usage: --instances <instances> --items <items> --passedOlderThanDays <passedOlderThanDays> --failedOlderThanDays <failedOlderThanDays>")
    .option("instances", { describe: "Numero di istanze da lanciare", type: "integer", demandOption: true, default: 10})
    .option("items", { describe: "Numero di entity da analizzare per istanza", type: "integer", demandOption: true, default: 100})
    .option("passedOlderThanDays", { describe: "Giorni dopo i quali le entity con Job che ha fornito risultato PASSED vengono riaccodate per essere scansionate", type: "integer", demandOption: true, default: 28})
    .option("failedOlderThanDays", { describe: "Giorni dopo i quali le entity con Job che ha fornito risultato FAILED vengono riaccodate per essere scansionate", type: "integer", demandOption: true, default: 14})
    .argv

db
    .authenticate()
    .then(async () => {
        console.log(`[DB-SYNC]: Database ${db.getDatabaseName()} connected!`)

        const instancesNumber: number     = parseInt(command.instances)
        const itemsNumber: number         = parseInt(command.items)
        const passedOlderThanDays: number = parseInt(command.passedOlderThanDays)
        const failedOlderThanDays: number = parseInt(command.failedOlderThanDays)

        const paramsLimit: number = instancesNumber * itemsNumber

        const firstTimeEntityToBeAnalyzed = await getFirstTimeEntityToBeAnalyzed(paramsLimit)

        let rescanEntityToBeAnalyzed = []
        const gapLimit: number = paramsLimit - firstTimeEntityToBeAnalyzed.length
        if (gapLimit > 0) {
            rescanEntityToBeAnalyzed = await getRescanEntityToBeAnalyzed(passedOlderThanDays, failedOlderThanDays, gapLimit)
        }

        let totalEntities = [...firstTimeEntityToBeAnalyzed, ...rescanEntityToBeAnalyzed]
        let spawnCodes: string[] = []
        if (totalEntities.length > 0) {
            spawnCodes = await generateJobs(totalEntities, instancesNumber)
        }

        console.log(spawnCodes)
    })
    .catch(err => {
        console.error('[DB-SYNC]: Unable to connect to the database:', err)
    })

const getFirstTimeEntityToBeAnalyzed = async (limit: number) => {
    let returnValues = []

    let firstTimeEntityToBeAnalyzed = await db.query(
        'SELECT E.id FROM "Entities" as E LEFT JOIN "Jobs" as J ON E.id = J.entity_id WHERE J.id IS NULL LIMIT :limit',
        {
            replacements: { limit: limit },
            type: QueryTypes.RAW
        }
    )

    if (firstTimeEntityToBeAnalyzed[0].length > 0) {
        returnValues = firstTimeEntityToBeAnalyzed[0]
    }

    return returnValues
}

const getRescanEntityToBeAnalyzed = async (passedOlderThanDays: number, failedOlderThanDays: number, limit: number) => {
    let returnValues = []

    let passedDate = new Date()
    passedDate.setDate(passedDate.getDate() + passedOlderThanDays)

    let failedDate = new Date()
    failedDate.setDate(failedDate.getDate() + failedOlderThanDays)

    const rescanEntityToBeAnalyzed = await db.query(
        `SELECT E.id\
                 FROM "Entities" AS E\
                 JOIN "Jobs" J1 ON (E.id = J1.entity_id)\
                 LEFT OUTER JOIN "Jobs" J2 ON (E.id = J2.entity_id AND\
                 (J1."updatedAt" < J2."updatedAt" OR (J1."updatedAt" = J2."updatedAt" AND J1.id < J2.id)))\
                 WHERE J2.id IS NULL\ 
                    AND (J1.status='ERROR'\ 
                        OR (J1.status = 'PASSED' AND DATE(J1."updatedAt") > DATE(:passedDate))\
                        OR (J1.status = 'FAILED' AND DATE(J1."updatedAt") > DATE(:failedDate))\
                    )\
                 ORDER BY J1.status DESC, J1."updatedAt" LIMIT :limit`,
        {
            replacements: {
                limit: limit,
                passedDate: dateFormat(passedDate, 'yyyy-mm-dd'),
                failedDate: dateFormat(failedDate, 'yyyy-mm-dd')
            },
            type: QueryTypes.RAW
        }
    )

    if (rescanEntityToBeAnalyzed[0].length > 0) {
        returnValues = rescanEntityToBeAnalyzed[0]
    }

    return returnValues
}

const generateJobs = async (entities, instancesNumber: number) : Promise<string[]> => {
    const chunks = await instancesChunkify(entities, instancesNumber)
    const spawnCodes = Array.apply(null, { length: chunks.length }).map( spawnCode => uuidv4() )

    for (const [index, chunk] of chunks.entries()) {
        const spawnCode = spawnCodes[index]
        for (const pieceOfChunk of chunk) {
            let entityObj: any = await entityDefine().findByPk(pieceOfChunk.id)
            if (entityObj === null) {
                continue
            }

            await jobDefine().create({
                entity_id: entityObj.id,
                start_at: null,
                end_at: null,
                spawn_code: spawnCode,
                scan_url: entityObj.url,
                type: entityObj.type,
                status: 'PENDING',
                s3_html_url: null,
                s3_json_url: null,
                json_result: null,
            })
        }
    }

    return spawnCodes
}