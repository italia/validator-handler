'use strict'

import { Entity, Job } from "../types/models"
import { createBody, updateBody } from "../types/entity"
import { mappedJob } from "../types/job"
import { define as entityDefine } from "../database/models/entity"
import { Model, Op } from "sequelize"

const retrieve = async (entityExternalId: string) : Promise<Model<Entity, Entity>> => {
    return await entityDefine().findOne({
        where: {
            external_id: entityExternalId
        }
    })
}

const create = async (entityCreateBody: createBody) : Promise<Entity> => {
    const entity = await retrieve(entityCreateBody.external_id)
    if (entity !== null) {
        throw new Error('Entity already exists for the passed id')
    }

    const result = await entityDefine().create({
        external_id: entityCreateBody.external_id,
        url: entityCreateBody.url,
        enable: entityCreateBody.enable,
        type: entityCreateBody.type
    })

    return result.toJSON()
}

const update = async (entityExternalId: string, entityUpdateBody: updateBody) : Promise<Entity> => {
    const entity: Model<Entity, Entity> = await retrieve(entityExternalId)
    if (entity === null) {
        throw new Error('Entity does not exists')
    }

    let updateObj = {}

    if ("url" in entityUpdateBody) {
        updateObj = {...updateObj, ...{ url: entityUpdateBody.url }}
    }

    if ("enable" in entityUpdateBody) {
        updateObj = {...updateObj, ...{ enable: entityUpdateBody.enable }}
    }

    const result = await entity.update(updateObj)

    return result.toJSON()
}

const jobList = async (entityExternalId: string, dateFrom, dateTo): Promise<mappedJob[]> => {
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

export { retrieve, create, update, jobList }