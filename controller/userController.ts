"use strict";

import { authUser } from "../types/user";
import { Model } from "sequelize";
import { User } from "../types/models";
import { define as userDefine } from "../database/models/user";

const auth = async (username: string, password: string): Promise<authUser> => {
  const userObj: Model<User, User> = await userDefine().findOne({
    where: {
      username: username,
      password: password,
    },
  });

  if (userObj === null) {
    throw new Error("Wrong username or password");
  }

  const userObjValues: User = userObj.get();

  return {
    username: userObjValues.username,
    role: userObjValues.role,
  };
};

export { auth };
