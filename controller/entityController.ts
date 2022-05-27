'use strict'
import {createBody, updateBody} from "../types/entity"
import { define as entityDefine } from "../database/models/entity"
import { Entity } from "../types/models"

const exists = async (entityExternalId: string) : Promise<boolean> => {
    return await entityDefine().findOne({
        where: {
            external_id: entityExternalId
        }
    }) !== null
}

const create = async (entityCreateBody: createBody) : Promise<Entity> => {
    if (await exists(entityCreateBody.external_id)) {
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

const update = async (entityUpdateBody: updateBody) : Promise<Entity[]> => {
    if (!await exists(entityUpdateBody.external_id)) {
        throw new Error('Entity does not exists')
    }

    const result = await entityDefine().update(
        { enable: entityUpdateBody.data.enable, url: entityUpdateBody.data.url },
        { where: { external_id: entityUpdateBody.external_id }, returning: true }
    )

    if (result.length <= 0) {
        throw new Error('Update returned empty result')
    }

    const updatedEntities = result[1]

    let returnEntities: Entity[] = []
    for (let updateEntity of updatedEntities) {
        returnEntities.push(updateEntity.get())
    }

    return returnEntities
}

const retrieve = async (entityExternalId: string) : Promise<Entity> | null => {
    const result = await entityDefine().findOne({
        where: {
            external_id: entityExternalId
        }
    })

    if (result != null) {
        return result.get()
    }

    return null
}

export { exists, create, update, retrieve }