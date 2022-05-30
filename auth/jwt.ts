"use strict";

import jwt from "jsonwebtoken";
import { authUser } from "../types/user";
import express from "express";

const generate = async (
  key: string,
  payload: authUser,
  expiresIn: number
): Promise<string> => {
  if (!key || !payload || !expiresIn) {
    throw new Error(
      "Error in generate token: empty key or payload or expiresIn"
    );
  }

  const jwtToken: string = jwt.sign(payload, key, {
    expiresIn: `${expiresIn}s`,
  });

  if (!jwtToken) {
    throw new Error("Error in generating access token");
  }

  return jwtToken;
};

const verify = async (key: string, token: string): Promise<void> => {
  if (!token || !key) {
    throw new Error("Unauthorized");
  }

  jwt.verify(token, key, (error, user) => {
    if (error) throw new Error("Error in verify token - " + error);
  });
};

const getPayload = async (token: string): Promise<authUser> => {
  const decoded = jwt.decode(token, { complete: true });

  if (!decoded) {
    throw new Error("Error in decoding token");
  }

  if (!decoded.payload) {
    throw new Error("Empty JTW payload");
  }

  return <authUser>decoded.payload;
};

const refreshToken = async (
  key: string,
  expiresIn: number,
  token: string
): Promise<string> => {
  const payload: authUser = await getPayload(token);

  return await generate(
    key,
    { username: payload.username, role: payload.role },
    expiresIn
  );
};

const getToken = async (req: express.Request): Promise<string> => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    throw new Error("Missing token from authorization header");
  }

  return token;
};

export { generate, verify, getPayload, refreshToken, getToken };
