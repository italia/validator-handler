'use strict'

//@ts-ignore
import yargs from "yargs"
import { hideBin } from "yargs/helpers"

import { db }  from "../database/connection"
import { define as jobDefine } from "../database/models/job"
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { run } from "pa-website-validator/dist/controller/spawnCrawler"

//@ts-ignore
const __dirname = dirname(fileURLToPath(import.meta.url))

const command = yargs(hideBin(process.argv))
    .usage("Usage: --spawnCode <spawnCode>")
    .option("spawnCode", { describe: "Spawn code dell'istanza di cui caricare i Job", type: "string", demandOption: true })
    .argv

db
    .authenticate()
    .then(async () => {
        console.log(`[DB-SYNC]: Database ${db.getDatabaseName()} connected!`)

        const jobObjs: any = await jobDefine().findAll({
            where: {
                spawn_code: command.spawnCode,
                status: 'PENDING'
            }
        })

        for (let jobObj of jobObjs) {
            await jobObj.update({
                status: 'IN_PROGRESS',
                start_at: Date.now()
            })

            const type    = jobObj.type
            const scanUrl = jobObj.scan_url
            const path    = __dirname + '/../tmp/' + jobObj.entity_id + '/' + jobObj.id
            const child   = await run(scanUrl, type, 'online', path, 'report')

            child.on('close', async (code) => {
                if (code === 0) {
                    await successReport(jobObj, path)
                } else {
                    await errorReport(jobObj)
                }
            })
        }

    })
    .catch(err => {
        console.error('[DB-SYNC]: Unable to connect to the database:', err)
    })

const successReport = async (jobObj, path) => {
    const status = 'PASSED'

    //TODO: Push report on AWS S3

    const s3JsonUrl = 'test'
    const s3HtmlUrl = 'test'
    const jsonResult = generateJSONReport(path)

    //TODO: empty tmp folder

    await jobObj.update({
        status: status,
        end_at: Date.now(),
        json_result: jsonResult,
        s3_json_url: s3JsonUrl,
        s3_html_url: s3HtmlUrl
    })
}

const errorReport = async (jobObj) => {
    await jobObj.update({
        status: 'ERROR',
        end_at: Date.now()
    })
}

const generateJSONReport = async (path) => {
    //TODO
}