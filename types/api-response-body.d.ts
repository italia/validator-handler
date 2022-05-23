import express from "express"

export interface successResponseType<> extends express.Response {
    json: Send<{
        status: string,
        timestamp: number,
        data: any
    }, this>
}

export interface errorResponseType<> extends express.Response {
    json: Send<{
        status: string,
        timestamp: number,
        error: {
            code: number,
            message: string
        }
    }, this>
}

