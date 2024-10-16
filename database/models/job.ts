"use strict";

import { Attributes, DataTypes, ModelAttributes, Sequelize } from "sequelize";
import { define as entityDefine } from "./entity.js";
import { Job } from "../../types/models.js";

const modelName = "Job";
const statusAllowedValues: string[] = [
  "IN_PROGRESS",
  "PENDING",
  "ERROR",
  "PASSED",
  "FAILED",
];

const preserveReasons: string[] = [
  "prima scansione",
  "scansione asseverata",
  "scansione salvata dall'operatore",
  "scansione salvata in automatico",
];

const allowedDataSentStatus: string[] = ["COMPLETED", "ERROR"];

const structure: ModelAttributes<Job, Attributes<Job>> = {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  entity_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "Entities",
      key: "id",
    },
  },
  start_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  end_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  scan_url: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: [["school", "municipality"]],
    },
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: [statusAllowedValues],
    },
  },
  s3_html_url: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  s3_json_url: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  s3_clean_json_result_url: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  json_result: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  preserve: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false,
  },
  preserve_reason: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isIn: [preserveReasons],
    },
  },
  data_sent_status: {
    type: DataTypes.STRING,
    defaultValue: null,
    allowNull: true,
    validate: {
      isIn: [allowedDataSentStatus],
    },
  },
  data_sent_date: DataTypes.DATE,
  createdAt: DataTypes.DATE,
  updatedAt: DataTypes.DATE,
};

const options = {
  indexes: [
    {
      name: "index_json_result",
      fields: [
        Sequelize.literal(
          "((json_result->'raccomandazioni'->'audits'->>'school-controlled-vocabularies')::float)"
        ),
        Sequelize.literal(
          "((json_result->'raccomandazioni'->'audits'->>'school-servizi-structure-match-model')::float)"
        ),
        Sequelize.literal(
          "((json_result->'criteri-conformita'->'groups'->'normativa'->'audits'->>'school-legislation-privacy-is-present')::float)"
        ),
        Sequelize.literal(
          "((json_result->'criteri-conformita'->'groups'->'normativa'->'audits'->>'school-legislation-cookie-domain-check')::float)"
        ),
        Sequelize.literal(
          "((json_result->'criteri-conformita'->'groups'->'normativa'->'audits'->>'school-legislation-accessibility-declaration-is-present')::float)"
        ),
        Sequelize.literal(
          "((json_result->'criteri-conformita'->'groups'->'sicurezza'->'audits'->>'school-security')::float)"
        ),
        Sequelize.literal(
          "((json_result->'criteri-conformita'->'groups'->'esperienza-utente'->'audits'->>'school-menu-structure-match-model')::float)"
        ),
        Sequelize.literal(
          "((json_result->'criteri-conformita'->'groups'->'esperienza-utente'->'audits'->>'school-ux-ui-consistency-fonts-check')::float)"
        ),
        Sequelize.literal(
          "((json_result->'criteri-conformita'->'groups'->'esperienza-utente'->'audits'->>'school-ux-ui-consistency-theme-version-check')::float)"
        ),
        Sequelize.literal(
          "((json_result->'criteri-conformita'->'groups'->'esperienza-utente'->'audits'->>'school-menu-scuola-second-level-structure-match-model')::float)"
        ),
        Sequelize.literal(
          "((json_result->'criteri-conformita'->'groups'->'esperienza-utente'->'audits'->>'school-ux-ui-consistency-bootstrap-italia-double-check')::float)"
        ),

        Sequelize.literal(
          "((json_result->'raccomandazioni'->'audits'->>'municipality-metatag')::float)"
        ),

        Sequelize.literal(
          "((json_result->'cittadino-informato'->'groups'->'normativa'->'audits'->>'municipality-legislation-privacy-is-present')::float)"
        ),
        Sequelize.literal(
          "((json_result->'cittadino-informato'->'groups'->'normativa'->'audits'->>'municipality-legislation-cookie-domain-check')::float)"
        ),
        Sequelize.literal(
          "((json_result->'cittadino-informato'->'groups'->'normativa'->'audits'->>'municipality-legislation-accessibility-declaration-is-present')::float)"
        ),
        Sequelize.literal(
          "((json_result->'cittadino-informato'->'groups'->'sicurezza'->'audits'->>'municipality-domain')::float)"
        ),
        Sequelize.literal(
          "((json_result->'cittadino-informato'->'groups'->'sicurezza'->'audits'->>'municipality-security')::float)"
        ),
        Sequelize.literal(
          "((json_result->'cittadino-informato'->'groups'->'funzionalita'->'audits'->>'municipality-faq-is-present')::float)"
        ),
        Sequelize.literal(
          "((json_result->'cittadino-informato'->'groups'->'funzionalita'->'audits'->>'municipality-feedback-element')::float)"
        ),
        Sequelize.literal(
          "((json_result->'cittadino-informato'->'groups'->'funzionalita'->'audits'->>'municipality-contacts-assistency')::float)"
        ),
        Sequelize.literal(
          "((json_result->'cittadino-informato'->'groups'->'funzionalita'->'audits'->>'municipality-inefficiency-report')::float)"
        ),
        Sequelize.literal(
          "((json_result->'cittadino-informato'->'groups'->'funzionalita'->'audits'->>'municipality-booking-appointment-check')::float)"
        ),
        Sequelize.literal(
          "((json_result->'cittadino-informato'->'groups'->'esperienza-utente'->'audits'->>'municipality-second-level-pages')::float)"
        ),
        Sequelize.literal(
          "((json_result->'cittadino-informato'->'groups'->'esperienza-utente'->'audits'->>'municipality-controlled-vocabularies')::float)"
        ),
        Sequelize.literal(
          "((json_result->'cittadino-informato'->'groups'->'esperienza-utente'->'audits'->>'municipality-menu-structure-match-model')::float)"
        ),
        Sequelize.literal(
          "((json_result->'cittadino-informato'->'groups'->'esperienza-utente'->'audits'->>'municipality-servizi-structure-match-model')::float)"
        ),
        Sequelize.literal(
          "((json_result->'cittadino-informato'->'groups'->'esperienza-utente'->'audits'->>'municipality-ux-ui-consistency-fonts-check')::float)"
        ),
        Sequelize.literal(
          "((json_result->'cittadino-informato'->'groups'->'esperienza-utente'->'audits'->>'municipality-ux-ui-consistency-theme-version-check')::float)"
        ),
        Sequelize.literal(
          "((json_result->'cittadino-informato'->'groups'->'esperienza-utente'->'audits'->>'municipality-ux-ui-consistency-bootstrap-italia-double-check')::float)"
        ),
      ],
    },
  ],
};

const syncTable = (db: Sequelize) => {
  return db.define(modelName, structure, options).sync({ alter: true });
};

const define = (db: Sequelize, join = true) => {
  const jobDefineObj = db.define(modelName, structure);

  if (join) {
    jobDefineObj.belongsTo(entityDefine(db), { foreignKey: "entity_id" });
  }

  return jobDefineObj;
};

export { modelName, statusAllowedValues, syncTable, define, preserveReasons };
