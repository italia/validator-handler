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