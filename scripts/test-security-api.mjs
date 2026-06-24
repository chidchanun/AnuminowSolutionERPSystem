import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const userRouteSource = await readFile(
    new URL('../app/api/v1/user/route.js', import.meta.url),
    'utf8'
)
const statsRouteSource = await readFile(
    new URL('../app/api/v1/stats/route.js', import.meta.url),
    'utf8'
)
const dueTaskRouteSource = await readFile(
    new URL('../app/api/v1/notification/due-task/route.js', import.meta.url),
    'utf8'
)

const mockState = {
    authUser: null,
    authResponse: null,
    requirePermissionCalls: [],
    requireAnyPermissionCalls: [],
    executeQueue: [],
    executeCalls: [],
    queryQueue: [],
    queryCalls: [],
    createNotificationCalls: [],
    emitNotificationCalls: [],
}

function resetMockState() {
    mockState.authUser = { id: 'U001', permissions: [] }
    mockState.authResponse = null
    mockState.requirePermissionCalls = []
    mockState.requireAnyPermissionCalls = []
    mockState.executeQueue = []
    mockState.executeCalls = []
    mockState.queryQueue = []
    mockState.queryCalls = []
    mockState.createNotificationCalls = []
    mockState.emitNotificationCalls = []
}

const mockDb = {
    async execute(sql, params = []) {
        mockState.executeCalls.push({ sql, params })

        if (mockState.executeQueue.length > 0) {
            return mockState.executeQueue.shift()
        }

        return [[]]
    },
    async query(sql, params = []) {
        mockState.queryCalls.push({ sql, params })

        if (mockState.queryQueue.length > 0) {
            return mockState.queryQueue.shift()
        }

        return [[]]
    },
}

function createRequest(url = 'http://localhost/api', headers = {}) {
    const normalizedHeaders = Object.fromEntries(
        Object.entries(headers).map(([key, value]) => [
            key.toLowerCase(),
            value,
        ])
    )

    return {
        url,
        headers: {
            get(name) {
                return normalizedHeaders[name.toLowerCase()] ?? null
            },
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
                    json(body, init = {}) {
                        return {
                            body,
                            status: init.status || 200,
                        }
                    },
                },
            })
        } else if (specifier === '@/app/lib/db') {
            vmModule = await createMockModule(specifier, {
                db: mockDb,
            })
        } else if (specifier === '@/app/lib/permission') {
            vmModule = await createMockModule(specifier, {
                async requirePermission(_request, permissionKey) {
                    mockState.requirePermissionCalls.push(permissionKey)

                    return {
                        user: mockState.authUser,
                        response: mockState.authResponse,
                    }
                },
                async requireAnyPermission(_request, permissionKeys) {
                    mockState.requireAnyPermissionCalls.push(permissionKeys)

                    return {
                        user: mockState.authUser,
                        response: mockState.authResponse,
                    }
                },
            })
        } else if (specifier === '@/app/lib/notification') {
            vmModule = await createMockModule(specifier, {
                async createNotification(payload) {
                    mockState.createNotificationCalls.push(payload)
                    return { affectedRows: 1 }
                },
            })
        } else if (specifier === '@/app/lib/socketEmit') {
            vmModule = await createMockModule(specifier, {
                async emitNotificationToUsers(userIds) {
                    mockState.emitNotificationCalls.push(userIds)
                    return true
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

const userRoute = await loadRouteModule(
    userRouteSource,
    'app/api/v1/user/route.js'
)
const statsRoute = await loadRouteModule(
    statsRouteSource,
    'app/api/v1/stats/route.js'
)
const dueTaskRoute = await loadRouteModule(
    dueTaskRouteSource,
    'app/api/v1/notification/due-task/route.js'
)

test('GET /api/v1/user requires an employee/project/task permission', async () => {
    resetMockState()
    mockState.authResponse = {
        body: {
            success: false,
        },
        status: 403,
    }

    const response = await userRoute.GET(createRequest())

    assert.equal(response.status, 403)
    assert.deepEqual(mockState.requireAnyPermissionCalls, [[
        'employee.view',
        'project.create',
        'project.update',
        'task.create',
        'task.update',
    ]])
    assert.equal(mockState.executeCalls.length, 0)
})

test('GET /api/v1/user only returns active non-deleted users', async () => {
    resetMockState()
    mockState.executeQueue.push([[
        {
            id: 'U001',
            first_name_th: 'Admin',
            last_name_th: 'User',
        },
    ]])

    const response = await userRoute.GET(createRequest())

    assert.equal(response.status, 200)
    assert.equal(response.body.userData.length, 1)
    assert.equal(mockState.executeCalls[0].sql.includes('u.deleted_at IS NULL'), true)
    assert.equal(mockState.executeCalls[0].sql.includes("u.status = 'active'"), true)
})

test('GET /api/v1/stats requires dashboard.view', async () => {
    resetMockState()
    mockState.authResponse = {
        body: {
            success: false,
        },
        status: 403,
    }

    const response = await statsRoute.GET(
        createRequest('http://localhost/api/v1/stats?type=employee')
    )

    assert.equal(response.status, 403)
    assert.deepEqual(mockState.requirePermissionCalls, ['dashboard.view'])
    assert.equal(mockState.queryCalls.length, 0)
})

test('POST /api/v1/notification/due-task rejects missing CRON_SECRET', async () => {
    resetMockState()
    const previousSecret = process.env.CRON_SECRET
    delete process.env.CRON_SECRET

    try {
        const response = await dueTaskRoute.POST(
            createRequest(
                'http://localhost/api/v1/notification/due-task',
                {
                    'x-cron-secret': 'any',
                }
            )
        )

        assert.equal(response.status, 500)
        assert.equal(response.body.success, false)
        assert.equal(mockState.executeCalls.length, 0)
    } finally {
        if (previousSecret === undefined) {
            delete process.env.CRON_SECRET
        } else {
            process.env.CRON_SECRET = previousSecret
        }
    }
})

test('POST /api/v1/notification/due-task rejects an invalid secret', async () => {
    resetMockState()
    const previousSecret = process.env.CRON_SECRET
    process.env.CRON_SECRET = 'expected-secret'

    try {
        const response = await dueTaskRoute.POST(
            createRequest(
                'http://localhost/api/v1/notification/due-task',
                {
                    'x-cron-secret': 'wrong-secret',
                }
            )
        )

        assert.equal(response.status, 403)
        assert.equal(response.body.success, false)
        assert.equal(mockState.executeCalls.length, 0)
        assert.equal(mockState.createNotificationCalls.length, 0)
        assert.equal(mockState.emitNotificationCalls.length, 0)
    } finally {
        if (previousSecret === undefined) {
            delete process.env.CRON_SECRET
        } else {
            process.env.CRON_SECRET = previousSecret
        }
    }
})
