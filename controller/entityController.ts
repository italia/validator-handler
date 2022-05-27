'use strict'
import { create } from "../types/entity"
import { define as entityDefine } from "../database/models/entity"
import { Entity } from "../types/models"

const create = async (entity: create) : Promise<Entity> => {
    if (await exists(entity.id)) {
        throw new Error('Entity already exists for the passed id')
    }

    const result = await entityDefine().create({
        external_id: entity.id,
        url: entity.url,
        enable: entity.enable,
        type: entity.type
    })

    return result.get()
}

const exists = async (entityExternalId: string) : Promise<boolean> => {
    return await entityDefine().findOne({
        where: {
            external_id: entityExternalId
        }
    }) !== null
}

export { create }