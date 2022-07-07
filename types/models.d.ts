import { Model, InferAttributes, InferCreationAttributes } from "sequelize";

export class Job extends Model<
  InferAttributes<Job>,
  InferCreationAttributes<Job>
> {
  declare id: number;
  declare entity_id: number;
  declare start_at: number;
  declare end_at: number;
  declare scan_url: string;
  declare type: string;
  declare status: string;
  declare s3_html_url: string;
  declare s3_json_url: string;
  declare s3_clean_json_result_url: string;
  declare json_result: object;
  declare preserve: boolean;
  declare preserve_reason: string;
  declare data_sent_status: string;
  declare data_sent_date: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class Entity extends Model<
  InferAttributes<Entity>,
  InferCreationAttributes<Entity>
> {
  declare id: number;
  declare external_id: string;
  declare url: string;
  declare enable: boolean;
  declare type: string;
  declare subtype: string;
  declare status: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class User extends Model<
  InferAttributes<User>,
  InferCreationAttributes<User>
> {
  declare id: number;
  declare username: string;
  declare password: string;
  declare role: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
