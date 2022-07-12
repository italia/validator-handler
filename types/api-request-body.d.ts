import express from "express";

export interface emptyBodyType<>extends express.Request {
  body: Record<string, never>;
}

export interface loginBodyType<>extends express.Request {
  body: {
    username: string;
    password: string;
  };
}

export interface createEntityBodyType<>extends express.Request {
  body: {
    external_id: string;
    url: string;
    enable: boolean;
    type: string;
    subtype: string;
  };
}

export interface updateEntityBodyType<>extends express.Request {
  body: {
    url: string;
    enable: boolean;
    asseverationJobId: string;
    subtype: string;
  };
}

export interface updatePreserveBodyType<>extends express.Request {
  body: {
    value: boolean;
    reason: string;
  };
}
