"use strict";

import { authUser } from "../types/user.js";
import { InferAttributes, Sequelize } from "sequelize";
import { User } from "../types/models.js";
import { define as userDefine } from "../database/models/user.js";

export class userController {
  db;
  ADMIN_ROLE = "admin";
  API_USER_ROLE = "api-user";

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

  async veryfyAdmin(tokenPayload: authUser) {
    if (!(tokenPayload.role == this.ADMIN_ROLE)) {
      throw new Error("Unauthorized");
    }
  }

  async create(createBody): Promise<User> {
    const existingUser = await userDefine(this.db).findOne({
      where: { username: createBody.username },
    });

    if (existingUser) {
      throw new Error("Username already in use");
    }

    const newUser = await userDefine(this.db).create({
      username: createBody.username,
      password: createBody.password,
      role: this.API_USER_ROLE,
    });

    // eslint-disable-next-line
    const { password, ...user } = newUser.dataValues;

    return user as User;
  }

  async update(updateBody) {
    const existingUser = await userDefine(this.db).findOne({
      where: { username: updateBody.username },
    });

    if (!existingUser) {
      throw new Error("User does not exist");
    }

    const [affectedCount] = await userDefine(this.db).update(
      {
        password: updateBody.password,
      },
      {
        where: {
          username: updateBody.username,
        },
      },
    );

    return affectedCount > 0;
  }

  async delete(deleteBody) {
    const existingUser = await userDefine(this.db).findOne({
      where: { username: deleteBody.username, role: this.API_USER_ROLE },
    });

    if (!existingUser) {
      throw new Error("User does not exist");
    }

    const affectedCount = await userDefine(this.db).destroy({
      where: {
        username: deleteBody.username,
        role: this.API_USER_ROLE,
      },
    });

    return affectedCount > 0;
  }

  async changePassword(changePasswordBody, tokenPayload) {
    const username = tokenPayload.username;

    const existingUser = await userDefine(this.db).findOne({
      where: { username: username, password: changePasswordBody.oldPassword },
    });

    if (!existingUser) {
      throw new Error("Wrong Password");
    }

    const [affectedCount] = await userDefine(this.db).update(
      {
        password: changePasswordBody.newPassword,
      },
      {
        where: {
          username: username,
        },
      },
    );

    return affectedCount > 0;
  }

  async list(page: number, limit: number, role: string | null) {
    let userQueryArgs = {};

    if (limit > 0 && page >= 0) {
      userQueryArgs = {
        limit: limit,
        offset: page * limit,
      };
    }

    if (role) {
      Object.assign(userQueryArgs, { where: { role: role } });
    }

    const { rows: users, count: totalCount } = await userDefine(
      this.db,
    ).findAndCountAll(userQueryArgs);

    return {
      totalElements: totalCount,
      currentPage: limit > 0 ? page : 0,
      pages: limit > 0 ? Math.ceil(totalCount / limit) : 1,
      users: users,
    };
  }
}
