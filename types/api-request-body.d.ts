import express from "express"

export interface emptyBodyType<> extends express.Request {
    body: {}
}
