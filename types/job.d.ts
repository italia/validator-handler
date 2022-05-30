export interface mappedJob {
    id: number,
    startAt: string,
    endAt: string,
    scanUrl: string,
    type: string,
    status: string,
    s3HTMLUrl: string,
    s3JSONUrl: string,
    jsonResult: any,
    preserve: boolean
}

export interface updatePreserveBody {
    value: boolean
}