"use strict";

import { DataTypes } from "sequelize";
import {
  IntegerDataTypeConstructor,
  StringDataTypeConstructor,
  BooleanDataTypeConstructor,
  DateDataTypeConstructor,
  AbstractDataTypeConstructor,
} from "sequelize/types/data-types";

export interface entityModel<> {
  id: {
    type: IntegerDataTypeConstructor;
    autoIncrement: boolean;
    primaryKey: boolean;
  };
  external_id: {
    type: StringDataTypeConstructor;
    allowNull: boolean;
  };
  url: {
    type: StringDataTypeConstructor;
    allowNull: boolean;
  };
  enable: {
    type: BooleanDataTypeConstructor;
    allowNull: boolean;
  };
  type: {
    type: StringDataTypeConstructor;
    allowNull: boolean;
    validate: {
      isIn: Array<Array<string>>;
    };
  };
}

export interface jobModel<> {
  id: {
    type: IntegerDataTypeConstructor;
    autoIncrement: boolean;
    primaryKey: boolean;
  };
  entity_id: {
    type: DataTypes.INTEGER;
    allowNull: boolean;
    references: {
      model: string;
      key: string;
    };
  };
  start_at: {
    type: DateDataTypeConstructor;
    allowNull: boolean;
  };
  end_at: {
    type: DateDataTypeConstructor;
    allowNull: boolean;
  };
  scan_url: {
    type: StringDataTypeConstructor;
    allowNull: boolean;
  };
  type: {
    type: StringDataTypeConstructor;
    allowNull: boolean;
    validate: {
      isIn: Array<Array<string>>;
    };
  };
  status: {
    type: StringDataTypeConstructor;
    allowNull: boolean;
    validate: {
      isIn: Array<Array<string>>;
    };
  };
  s3_html_url: {
    type: StringDataTypeConstructor;
    allowNull: boolean;
  };
  s3_json_url: {
    type: StringDataTypeConstructor;
    allowNull: boolean;
  };
  json_result: {
    type: AbstractDataTypeConstructor;
    allowNull: boolean;
  };
  preserve: {
    type: BooleanDataTypeConstructor;
    allowNull: boolean;
    defaultValue: boolean;
  };
}

export interface userModel<> {
  id: {
    type: IntegerDataTypeConstructor;
    autoIncrement: boolean;
    primaryKey: boolean;
  };
  username: {
    type: StringDataTypeConstructor;
    allowNull: boolean;
  };
  password: {
    type: StringDataTypeConstructor;
    allowNull: boolean;
  };
  role: {
    type: StringDataTypeConstructor;
    validate: {
      isIn: Array<Array<string>>;
    };
  };
}
