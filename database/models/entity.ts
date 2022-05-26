'use strict'

import { DataTypes } from "sequelize"
import { entityModel } from "../../types/database"
import { db } from "../connection"

const modelName: string             = 'Entity'
const allowedTypes: string[]        = ['school', 'municipality']

const structure: entityModel = {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    external_id: {
        type: DataTypes.STRING,
        allowNull: false
    },
    url: {
        type: DataTypes.STRING,
        allowNull: false
    },
    enable: {
        type: DataTypes.BOOLEAN,
        allowNull: false
    },
    type: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            isIn: [allowedTypes],
        }
    }
}

const syncTable = () => {
    return define().sync({ alter: true })
}

const define = () => {
    return db.define(modelName, structure)
}

export { modelName, allowedTypes, syncTable, define }