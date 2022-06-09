"use strict";

import { authUser } from "../types/user";
import { InferAttributes, Sequelize } from "sequelize";
import { User } from "../types/models";
import { define as userDefine } from "../database/models/user";

export class userController {
  db;

  constructor(db: Sequelize) {
    this.db = db;
  }

  async auth(username: string, password: string): Promise<authUser> {
    const userObj: User | null = await userDefine(this.db).findOne({
      where: {
        username: username,
        password: password,
      },
    });

    if (userObj === null) {
      throw new Error("Wrong username or password");
    }

    const userObjValues: InferAttributes<User> = userObj.get();

    return {
      username: userObjValues.username,
      role: userObjValues.role,
    };
  }
}
