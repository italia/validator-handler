'use strict'
import {createBody, updateBody} from "../types/entity"
import { define as entityDefine } from "../database/models/entity"
import { Entity } from "../types/models"
import { Model } from "sequelize"

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

    return result.get()
}

const update = async (entityExternalId: string, entityUpdateBody: updateBody) : Promise<Entity> => {
    const entity = await retrieve(entityExternalId)
    if (entity === null) {
        throw new Error('Entity does not exists')
    }

    let updateObj = {}

    if ("url" in entityUpdateBody) {
        console.log('qui1')
        updateObj = {...updateObj, ...{ url: entityUpdateBody.url }}
    }

    if ("enable" in entityUpdateBody) {
        console.log('qui2')
        updateObj = {...updateObj, ...{ enable: entityUpdateBody.enable }}
    }

    console.log('update obj', updateObj)

    const result = await entity.update(updateObj)

    return result.get()
}

export { retrieve, create, update }