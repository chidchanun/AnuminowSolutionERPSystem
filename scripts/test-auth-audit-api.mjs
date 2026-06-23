import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const loginRouteSource = await readFile(
    new URL('../app/api/v1/auth/login/route.js', import.meta.url),
    'utf8'
)
const logoutRouteSource = await readFile(
    new URL('../app/api/v1/auth/logout/route.js', import.meta.url),
    'utf8'
)
const refreshRouteSource = await readFile(
    new URL('../app/api/v1/auth/refresh/route.js', import.meta.url),
    'utf8'
)

const mockState = {
    queryQueue: [],
    queryCalls: [],
    auditLogCalls: [],
    bcryptCompareResult: true,
}

function resetMockState() {
    mockState.queryQueue = []
    mockState.queryCalls = []
    mockState.auditLogCalls = []
    mockState.bcryptCompareResult = true
}

const mockDb = {
    async query(sql, params = []) {
        mockState.queryCalls.push({ sql, params })

        if (mockState.queryQueue.length > 0) {
            return mockState.queryQueue.shift()
        }

        return [[]]
    },
}

function createMockResponse(body, init = {}) {
    return {
        body,
        status: init.status || 200,
        cookies: {
            values: [],
            set(name, value, options) {
                this.values.push({ name, value, options })
            },
        },
    }
}

function createRequest({
    body = {},
    refreshToken = null,
    ip = '127.0.0.1',
    userAgent = 'node-test',
} = {}) {
    return {
        ip,
        headers: {
            get(name) {
                const key = String(name).toLowerCase()

                if (key === 'x-forwarded-for') return ip
                if (key === 'user-agent') return userAgent

                return null
            },
        },
        cookies: {
            get(name) {
                if (name === 'refreshToken' && refreshToken) {
                    return { value: refreshToken }
                }

                return undefined
            },
        },
        async json() {
            return body
        },
    }
}

async function createMockModule(identifier, exports) {
    const vmModule = new vm.SyntheticModule(
        Object.keys(exports),
        function initialize() {
            for (const [key, value] of Object.entries(exports)) {
                this.setExport(key, value)
            }
        },
        { identifier }
    )

    await vmModule.link(() => {
        throw new Error(`Unexpected nested import in ${identifier}`)
    })
    await vmModule.evaluate()

    return vmModule
}

async function loadRouteModule(source, identifier) {
    const moduleCache = new Map()

    async function linker(specifier) {
        if (moduleCache.has(specifier)) {
            return moduleCache.get(specifier)
        }

        let vmModule

        if (specifier === 'next/server') {
            vmModule = await createMockModule(specifier, {
                NextResponse: {
                    json: createMockResponse,
                },
            })
        } else if (specifier === '@/app/lib/db') {
            vmModule = await createMockModule(specifier, {
                db: mockDb,
            })
        } else if (specifier === '@/app/lib/auditLog') {
            vmModule = await createMockModule(specifier, {
                async writeAuditLog(payload) {
                    mockState.auditLogCalls.push(payload)
                    return true
                },
            })
        } else if (specifier === 'jsonwebtoken') {
            vmModule = await createMockModule(specifier, {
                default: {
                    sign(payload, _secret, options) {
                        return `token:${payload.id}:${options.expiresIn}`
                    },
                },
            })
        } else if (specifier === 'bcrypt') {
            vmModule = await createMockModule(specifier, {
                default: {
                    async compare() {
                        return mockState.bcryptCompareResult
                    },
                },
            })
        } else {
            throw new Error(`Unexpected import: ${specifier}`)
        }

        moduleCache.set(specifier, vmModule)
        return vmModule
    }

    const vmModule = new vm.SourceTextModule(source, { identifier })

    await vmModule.link(linker)
    await vmModule.evaluate()

    return vmModule.namespace
}

const loginRoute = await loadRouteModule(
    loginRouteSource,
    'app/api/v1/auth/login/route.js'
)
const logoutRoute = await loadRouteModule(
    logoutRouteSource,
    'app/api/v1/auth/logout/route.js'
)
const refreshRoute = await loadRouteModule(
    refreshRouteSource,
    'app/api/v1/auth/refresh/route.js'
)

test('POST /api/v1/auth/login writes audit log on success', async () => {
    resetMockState()
    mockState.queryQueue.push(
        [[
            {
                id: 'U001',
                password_hash: 'hash',
                department_name: 'IT',
                role_name: 'Admin',
                picture_path: null,
                permission_role_name: 'Admin',
            },
        ]],
        [{ affectedRows: 1 }]
    )

    const response = await loginRoute.POST(createRequest({
        body: {
            id: 'U001',
            password: 'secret',
        },
    }))

    assert.equal(response.status, 200)
    assert.equal(mockState.auditLogCalls.length, 1)
    assert.deepEqual(mockState.auditLogCalls[0], {
        actorId: 'U001',
        action: 'auth.login_success',
        entityType: 'auth',
        entityId: 'U001',
        summary: 'U001 logged in',
        metadata: {
            ip: '127.0.0.1',
            user_agent: 'node-test',
            department_name: 'IT',
            role_name: 'Admin',
            permission_role: 'Admin',
        },
    })
    assert.deepEqual(
        response.cookies.values.map((item) => item.name),
        ['accessToken', 'refreshToken']
    )
})

test('POST /api/v1/auth/login writes audit log when user is missing', async () => {
    resetMockState()
    mockState.queryQueue.push([[]])

    const response = await loginRoute.POST(createRequest({
        body: {
            id: 'UNKNOWN',
            password: 'secret',
        },
    }))

    assert.equal(response.status, 401)
    assert.equal(mockState.auditLogCalls.length, 1)
    assert.equal(mockState.auditLogCalls[0].actorId, null)
    assert.equal(mockState.auditLogCalls[0].action, 'auth.login_failed')
    assert.equal(mockState.auditLogCalls[0].entityId, 'UNKNOWN')
    assert.equal(
        mockState.auditLogCalls[0].metadata.reason,
        'user_not_found'
    )
})

test('POST /api/v1/auth/login writes audit log when password is invalid', async () => {
    resetMockState()
    mockState.bcryptCompareResult = false
    mockState.queryQueue.push([[
        {
            id: 'U001',
            password_hash: 'hash',
            department_name: 'IT',
            role_name: 'Admin',
            picture_path: null,
            permission_role_name: 'Admin',
        },
    ]])

    const response = await loginRoute.POST(createRequest({
        body: {
            id: 'U001',
            password: 'bad-secret',
        },
    }))

    assert.equal(response.status, 401)
    assert.equal(mockState.auditLogCalls.length, 1)
    assert.equal(mockState.auditLogCalls[0].actorId, null)
    assert.equal(mockState.auditLogCalls[0].action, 'auth.login_failed')
    assert.equal(mockState.auditLogCalls[0].entityId, 'U001')
    assert.equal(
        mockState.auditLogCalls[0].metadata.reason,
        'invalid_password'
    )
})

test('POST /api/v1/auth/logout writes audit log when a session is revoked', async () => {
    resetMockState()
    mockState.queryQueue.push(
        [[{ user_id: 'U001' }]],
        [{ affectedRows: 1 }]
    )

    const response = await logoutRoute.POST(createRequest({
        refreshToken: 'refresh-token',
    }))

    assert.equal(response.status, 200)
    assert.equal(mockState.auditLogCalls.length, 1)
    assert.deepEqual(mockState.auditLogCalls[0], {
        actorId: 'U001',
        action: 'auth.logout',
        entityType: 'auth',
        entityId: 'U001',
        summary: 'U001 logged out',
        metadata: {
            ip: '127.0.0.1',
            user_agent: 'node-test',
        },
    })
    assert.deepEqual(
        response.cookies.values.map((item) => item.name),
        ['accessToken', 'refreshToken']
    )
})

test('POST /api/v1/auth/refresh writes audit log when refresh token is invalid', async () => {
    resetMockState()
    mockState.queryQueue.push([[]])

    const response = await refreshRoute.POST(createRequest({
        refreshToken: 'invalid-refresh-token',
    }))

    assert.equal(response.status, 401)
    assert.equal(mockState.auditLogCalls.length, 1)
    assert.deepEqual(mockState.auditLogCalls[0], {
        actorId: null,
        action: 'auth.refresh_failed',
        entityType: 'auth',
        entityId: null,
        summary: 'Refresh token failed: invalid_refresh_token',
        metadata: {
            ip: '127.0.0.1',
            user_agent: 'node-test',
            reason: 'invalid_refresh_token',
        },
    })
})

test('POST /api/v1/auth/refresh writes audit log on success', async () => {
    resetMockState()
    mockState.queryQueue.push(
        [[
            {
                user_id: 'U001',
                revoked_at: null,
                expired_at: new Date(Date.now() + 60_000),
            },
        ]],
        [[
            {
                id: 'U001',
                picture_path: null,
                department_name: 'IT',
                role_name: 'Admin',
                permission_role_name: 'Admin',
            },
        ]]
    )

    const response = await refreshRoute.POST(createRequest({
        refreshToken: 'refresh-token',
    }))

    assert.equal(response.status, 200)
    assert.equal(mockState.auditLogCalls.length, 1)
    assert.deepEqual(mockState.auditLogCalls[0], {
        actorId: 'U001',
        action: 'auth.refresh_success',
        entityType: 'auth',
        entityId: 'U001',
        summary: 'U001 refreshed access token',
        metadata: {
            ip: '127.0.0.1',
            user_agent: 'node-test',
            reason: 'success',
        },
    })
    assert.deepEqual(
        response.cookies.values.map((item) => item.name),
        ['accessToken']
    )
})
