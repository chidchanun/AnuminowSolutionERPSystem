require('dotenv').config()

const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cookie = require('cookie')
const jwt = require('jsonwebtoken')

const app = express()
const server = http.createServer(app)

app.use(express.json())

const port = Number(process.env.SOCKET_PORT || 4001)

const allowedOrigins = String(
    process.env.SOCKET_ALLOWED_ORIGIN || ''
)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        credentials: true,
    },
})

function getTokenFromSocket(socket) {
    const rawCookie =
        socket.handshake.headers.cookie || ''

    const cookies = cookie.parse(rawCookie)

    return (
        cookies.accessToken ||
        socket.handshake.auth?.token ||
        null
    )
}

io.use((socket, next) => {
    try {
        const token = getTokenFromSocket(socket)

        if (!token) {
            return next(new Error('Unauthorized'))
        }

        const payload = jwt.verify(
            token,
            process.env.JWT_SECRET
        )

        if (!payload?.id) {
            return next(new Error('Invalid token'))
        }

        socket.user = {
            id: String(payload.id),
            role: payload.permission_role || 'Employee',
        }

        next()
    } catch (error) {
        console.error('Socket auth error:', error.message)
        next(new Error('Unauthorized'))
    }
})

io.on('connection', (socket) => {
    const userId = socket.user.id
    const roomName = `user:${userId}`

    socket.join(roomName)

    console.log(`Socket connected: user=${userId}, socket=${socket.id}`)

    socket.emit('socket:connected', {
        success: true,
        userId,
    })

    socket.on('disconnect', () => {
        console.log(`Socket disconnected: user=${userId}, socket=${socket.id}`)
    })
})

app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Socket server is running',
    })
})

app.post('/emit/notification', (req, res) => {
    const secret =
        req.headers['x-socket-secret']

    if (
        !process.env.SOCKET_SERVER_SECRET ||
        secret !== process.env.SOCKET_SERVER_SECRET
    ) {
        return res.status(403).json({
            success: false,
            message: 'Forbidden',
        })
    }

    const {
        userIds = [],
        event = 'notification:new',
        payload = {
            refresh: true,
        },
    } = req.body || {}

    const uniqueUserIds = [
        ...new Set(
            userIds
                .filter(Boolean)
                .map((id) => String(id))
        ),
    ]

    for (const userId of uniqueUserIds) {
        io.to(`user:${userId}`).emit(event, payload)
    }

    return res.json({
        success: true,
        message: 'Emit notification success',
        sent_to: uniqueUserIds,
    })
})

server.listen(port, '0.0.0.0', () => {
    console.log(`Socket.IO server running on port ${port}`)
})