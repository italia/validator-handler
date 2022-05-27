import express from "express"

export interface emptyBodyType<> extends express.Request {
    body: {}
}

export interface loginBodyType<> extends express.Request {
    body: {
        username: string,
        password: string
    }
}

export interface createEntityBodyType<> extends express.Request {
    body: {
        id: string,
        url: string,
        enable: boolean,
        type: string
    }
}