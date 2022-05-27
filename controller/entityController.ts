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

const create = async (entity: createBody) : Promise<Entity> => {
    if (await exists(entity.external_id)) {
        throw new Error('Entity already exists for the passed id')
    }

    const result = await entityDefine().create({
        external_id: entity.external_id,
        url: entity.url,
        enable: entity.enable,
        type: entity.type
    })

    return result.get()
}

const update = async (entity: updateBody) : Promise<Entity[]> => {
    if (!await exists(entity.external_id)) {
        throw new Error('Entity does not exists')
    }

    const result = await entityDefine().update(
        { enable: entity.enable, url: entity.url },
        { where: { external_id: entity.external_id }, returning: true }
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

export { exists, create, update }