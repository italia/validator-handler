'use strict'

import { Job } from "../types/models"
import { mappedJob } from "../types/job"
import { define as entityDefine } from "../database/models/entity"
import { Model, Op } from "sequelize"

const list = async (entityExternalId: string, dateFrom, dateTo): Promise<mappedJob[]> => {
    let returnValues = []

    if ((Boolean(dateFrom) && !Boolean(dateTo)) || (!Boolean(dateFrom) && Boolean(dateTo))) {
        throw new Error('dateFrom and dateTo both must be passed or neither')
    }

    const result: Model<Job, Job> = await entityDefine().findOne({
        where: {
            external_id: entityExternalId
        }
    })

    if (result === null) {
        return returnValues
    }

    let betweenCondition = {}
    if (Boolean(dateFrom) && Boolean(dateTo)) {
        betweenCondition = {
            where: {
                updatedAt: {
                    [Op.between]: [dateFrom, dateTo]
                }
            }
        }
    }

    //@ts-ignore - getJobs(): metodo autogenerato dall'ORM Sequelize dopo l'associazione
    const jobList = await result.getJobs(betweenCondition)

    jobList.forEach(job => {
        const jobElement = job.toJSON()
        returnValues.push({
            id: jobElement.id,
            startAt: jobElement.start_at,
            endAt: jobElement.end_at,
            scanUrl: jobElement.scan_url,
            type: jobElement.type,
            status: jobElement.status,
            s3HTMLUrl: jobElement.s3_html_url,
            s3JSONUrl: jobElement.s3_json_url,
            jsonResult: jobElement.json_result,
            preserve: jobElement.preserve
        })
    })

    return returnValues
}

const updatePreserve = async (entityExternalId: string, jobId: number) => {
    return {}
}

export { list, updatePreserve }