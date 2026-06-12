import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
    throw new Error('Missing JWT_SECRET environment variable')
}

export function verifyToken(token) {
    if (!token) {
        throw new Error('Missing token')
    }

    return jwt.verify(token, JWT_SECRET)
}

export function safeVerifyToken(token) {
    try {
        return verifyToken(token)
    } catch {
        return null
    }
}

export function decodeToken(token) {
    if (!token) {
        return null
    }

    return jwt.decode(token)
}
