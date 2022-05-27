import { successResponseType, errorResponseType } from "../types/api-response-body"

const errorResponse = (error_code: number, errorObj: any, http_code: number, res: errorResponseType) : void => {
    let message = 'Generic error'

    if (typeof errorObj == 'string') {
        message = errorObj
    } else if (Boolean(errorObj.message)) {
        message = errorObj.message
    }

    res.status(http_code).json({
        'status': 'ko',
        'timestamp': Date.now(),
        'error': {
            'code': error_code,
            'message': message
        }
    })
}

const succesResponse = (response: any, res: successResponseType, http_code: number = 200, isHtml: boolean = false) : void => {
    if (isHtml) {
        res.writeHead(http_code,  {"Content-Type": "text/html"})
        res.write(response)
        res.end()
    } else {
        res.status(http_code).json({
            'status': 'ok',
            'timestamp': Date.now(),
            'data': response
        })
    }
}

export { errorResponse, succesResponse }