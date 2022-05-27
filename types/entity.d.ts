export interface createBody {
    external_id: string
    url: string
    enable: boolean
    type: string
}

export interface updateBody {
    external_id: string
    data: {
        url: string
        enable: boolean
    }
}