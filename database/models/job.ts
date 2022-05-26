'use strict'

import {DataTypes, Sequelize} from "sequelize"
import { jobModel } from "../../types/database"
import { allowedTypes } from "./entity"
import { db } from "../connection"
import { define as entityDefine, primaryKey as entityPrimaryKey } from "./entity"

const modelName: string             = 'Job'
const statusAllowedValues: string[] = ['IN_PROGRESS', 'PENDING', 'ERROR', 'PASSED', 'FAILED']

const structure: jobModel = {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    entity_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: entityDefine().getTableName().toString(),
            key: entityPrimaryKey
        }
    },
    start_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    end_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    spawn_code: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    scan_url: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    type: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            isIn: [allowedTypes],
        }
    },
    status: {
        type:  DataTypes.STRING,
        allowNull: false,
        validate: {
            isIn: [statusAllowedValues],
        }
    },
    s3_html_url: {
        type: DataTypes.STRING,
        allowNull: true
    },
    s3_json_url: {
        type: DataTypes.STRING,
        allowNull: true
    },
    json_result: {
        type: DataTypes.JSONB,
        allowNull: true
    },
    preserve: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false
    }
}

const syncTable = () => {
    return db.define(modelName, structure).sync({ alter: true })
}

const define = () => {
    return db.define(modelName, structure)
}

export { modelName, statusAllowedValues, syncTable, define }