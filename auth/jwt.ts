import * as jwt from "jsonwebtoken"
import { JwtPayload } from "jsonwebtoken"

const generate = async (key: string, payload: JwtPayload, expiresIn: number) : Promise<string> => {
    if (!Boolean(key) || !Boolean(payload) || !Boolean(expiresIn)) {
        throw new Error('Erro in generate token: empty key or payload or expiresIn')
    }

    const jwtToken: string = jwt.sign(payload, key, {
        expiresIn: `${expiresIn}s`
    })

    if (!Boolean(jwtToken)) {
        throw new Error('Error in generating access token')
    }

    return jwtToken
}

const authenticate = async (key: string, token: string) : Promise<boolean> => {
    if (!Boolean(token)) {
        throw new Error ('Unauthorized')
    }

    jwt.verify(token, key,  (error, user) => {
        if (error) throw new Error ('Error in authenticateToken: ' + error)
    })

    return true
}

const getPayload = (token: string) :JwtPayload => {
    const decoded = jwt.decode(token, {complete: true})

    if (!Boolean(decoded)) {
        throw new Error('Error in decoding token')
    }

    if (!Boolean(decoded.payload)) {
        throw new Error('Empty JTW payload')
    }

    return <JwtPayload>decoded.payload
}

const refreshToken = async (key: string, expiresIn: number, token: string) : Promise<string> => {
    const payload: JwtPayload = getPayload(token)

    return await generate(key, payload, expiresIn)
}

export { generate, authenticate, getPayload, refreshToken }