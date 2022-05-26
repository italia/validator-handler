'use strict'

import yargs from "yargs"
import { db }  from "../database/connection"
import { hideBin } from "yargs/helpers"
import { define as jobDefine } from "../database/models/job"
import { run } from "pa-website-validator/dist/controller/launchLighthouse"
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { Job } from "../types/models"
import { Model } from "sequelize"
const __dirname = dirname(fileURLToPath(import.meta.url))

const command = yargs(hideBin(process.argv))
    .usage("Usage: --spawnCode <spawnCode>")
    .option("spawnCode", { describe: "Spawn code dell'istanza di cui caricare i Job", type: "string", demandOption: true })
    .argv

db
    .authenticate()
    .then(async () => {
        console.log(`[DB-SYNC]: Database ${db.getDatabaseName()} connected!`)

        const jobObjs: Model<Job, Job>[] = await jobDefine().findAll({
            where: {
                spawn_code: command.spawnCode,
                status: 'PENDING'
            }
        })

        for (let element of jobObjs) {
            await element.update({
                status: 'IN_PROGRESS',
                start_at: Date.now()
            })

            const jobObj: Job = element.get()

            const type    = jobObj.type
            const scanUrl = jobObj.scan_url
            const path    = __dirname + '/../tmp/' + jobObj.entity_id + '/' + jobObj.id
            const result  = await run(scanUrl, type, 'online', path, 'report')

            if (result.status) {
                await successReport(jobObj, path)
            } else {
                await errorReport(jobObj)
            }
        }
    })
    .catch(err => {
        console.error('[DB-SYNC]: Unable to connect to the database:', err)
    })

const successReport = async (jobObj: Job, path: string) => {
    const status = 'PASSED'

    //TODO: Push report on AWS S3

    const s3JsonUrl = 'test'
    const s3HtmlUrl = 'test'
    const jsonResult = await generateJSONReport(path)

    //TODO: empty tmp folder

    await jobObj.update({
        status: status,
        end_at: Date.now(),
        json_result: jsonResult,
        s3_json_url: s3JsonUrl,
        s3_html_url: s3HtmlUrl
    })
}

const errorReport = async (jobObj: Job) => {
    await jobObj.update({
        status: 'ERROR',
        end_at: Date.now()
    })
}

const generateJSONReport = async (path: string) => {
    return {}
}