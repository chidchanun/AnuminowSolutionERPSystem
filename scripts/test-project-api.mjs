import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const projectRouteSource = await readFile(
    new URL('../app/api/v1/project/route.js', import.meta.url),
    'utf8'
)

const projectDetailRouteSource = await readFile(
    new URL('../app/api/v1/project/[id]/route.js', import.meta.url),
    'utf8'
)

const mockState = {
    authUser: null,
    authResponse: null,
    requirePermissionCalls: [],
    hasAnyPermissionResult: false,
    hasAnyPermissionCalls: [],
    projectWideAccess: false,
    executeQueue: [],
    executeCalls: [],
    auditLogCalls: [],
    connection: null,
}

function resetMockState() {
    mockState.authUser = { id: 'U001', permissions: [] }
    mockState.authResponse = null
    mockState.requirePermissionCalls = []
    mockState.hasAnyPermissionResult = false
    mockState.hasAnyPermissionCalls = []
    mockState.projectWideAccess = false
    mockState.executeQueue = []
    mockState.executeCalls = []
    mockState.auditLogCalls = []
    mockState.connection = createMockConnection()
}

function createMockConnection() {
    return {
        executeCalls: [],
        queryCalls: [],
        beginCount: 0,
        commitCount: 0,
        rollbackCount: 0,
        releaseCount: 0,
        executeQueue: [],
        async beginTransaction() {
            this.beginCount += 1
        },
        async execute(sql, params = []) {
            this.executeCalls.push({ sql, params })

            if (this.executeQueue.length > 0) {
                const nextResult = this.executeQueue.shift()

                if (nextResult instanceof Error) {
                    throw nextResult
                }

                return nextResult
            }

            return [{ affectedRows: 1 }]
        },
        async query(sql, params = []) {
            this.queryCalls.push({ sql, params })
            return [{ affectedRows: 1 }]
        },
        async commit() {
            this.commitCount += 1
        },
        async rollback() {
            this.rollbackCount += 1
        },
        release() {
            this.releaseCount += 1
        },
    }
}

const mockDb = {
    async execute(sql, params = []) {
        mockState.executeCalls.push({ sql, params })

        if (mockState.executeQueue.length > 0) {
            return mockState.executeQueue.shift()
        }

        return [[]]
    },
    async getConnection() {
        return mockState.connection
    },
}

function createJsonRequest(body) {
    return {
        url: 'http://localhost/api/v1/project',
        async json() {
            if (body instanceof Error) {
                throw body
            }

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
        } else if (specifier === '@/app/lib/auditLog') {
            vmModule = await createMockModule(specifier, {
                async writeAuditLog(payload) {
                    mockState.auditLogCalls.push(payload)
                    return true
                },
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
                async hasAnyPermission(userId, permissionKeys) {
                    mockState.hasAnyPermissionCalls.push({
                        userId,
                        permissionKeys,
                    })

                    return mockState.hasAnyPermissionResult
                },
                hasProjectWideAccess() {
                    return mockState.projectWideAccess
                },
            })
        } else {
            throw new Error(`Unexpected import: ${specifier}`)
        }

        moduleCache.set(specifier, vmModule)
        return vmModule
    }

    const vmModule = new vm.SourceTextModule(source, {
        identifier,
    })

    await vmModule.link(linker)
    await vmModule.evaluate()

    return vmModule.namespace
}

const projectRoute = await loadRouteModule(
    projectRouteSource,
    'app/api/v1/project/route.js'
)

const projectDetailRoute = await loadRouteModule(
    projectDetailRouteSource,
    'app/api/v1/project/[id]/route.js'
)

test('GET /api/v1/project filters to project members without project-wide permission', async () => {
    resetMockState()
    mockState.executeQueue.push([
        [
            {
                project_id: 10,
                project_name: 'ERP',
            },
        ],
    ])

    const response = await projectRoute.GET({
        url: 'http://localhost/api/v1/project',
    })

    assert.equal(response.status, 200)
    assert.equal(response.body.success, true)
    assert.equal(response.body.permission.can_view_all, false)
    assert.deepEqual(mockState.requirePermissionCalls, ['project.view'])
    assert.equal(mockState.executeCalls[0].sql.includes('project_member'), true)
    assert.deepEqual(mockState.executeCalls[0].params, ['U001'])
})

test('GET /api/v1/project lists all projects with project-wide permission', async () => {
    resetMockState()
    mockState.hasAnyPermissionResult = true
    mockState.executeQueue.push([[]])

    const response = await projectRoute.GET({
        url: 'http://localhost/api/v1/project',
    })

    assert.equal(response.status, 200)
    assert.equal(response.body.permission.can_view_all, true)
    assert.equal(mockState.executeCalls[0].sql.includes('project_member'), false)
    assert.deepEqual(mockState.executeCalls[0].params, [])
})

test('POST /api/v1/project creates a project and members in one transaction', async () => {
    resetMockState()
    mockState.executeQueue.push([[]])
    mockState.connection.executeQueue.push([{ insertId: 42 }])

    const response = await projectRoute.POST(
        createJsonRequest({
            project_name: 'ERP Upgrade',
            project_code: 'ERP-001',
            description: 'Phase 1',
            status: 'active',
            member_ids: ['U002', '', 'U002', 'U003'],
        })
    )

    assert.equal(response.status, 201)
    assert.equal(response.body.success, true)
    assert.equal(response.body.project_id, 42)
    assert.deepEqual(mockState.requirePermissionCalls, ['project.create'])
    assert.equal(mockState.connection.beginCount, 1)
    assert.equal(mockState.connection.commitCount, 1)
    assert.equal(mockState.connection.rollbackCount, 0)
    assert.equal(mockState.connection.releaseCount, 1)

    assert.deepEqual(mockState.connection.executeCalls[0].params, [
        'ERP Upgrade',
        'ERP-001',
        'Phase 1',
        null,
        null,
        'active',
        'U001',
    ])

    assert.deepEqual(mockState.connection.queryCalls[0].params[0], [
        [42, 'U001'],
        [42, 'U002'],
        [42, 'U003'],
    ])
})

test('POST /api/v1/project rejects duplicate project code before transaction', async () => {
    resetMockState()
    mockState.executeQueue.push([[{ project_id: 99 }]])

    const response = await projectRoute.POST(
        createJsonRequest({
            project_name: 'ERP Upgrade',
            project_code: 'ERP-001',
        })
    )

    assert.equal(response.status, 409)
    assert.equal(response.body.success, false)
    assert.equal(mockState.connection.beginCount, 0)
})

test('PUT /api/v1/project/:id updates the project and replaces members', async () => {
    resetMockState()
    mockState.executeQueue.push([[{ project_id: 42 }]])

    const response = await projectDetailRoute.PUT(
        createJsonRequest({
            project_name: 'ERP Upgrade',
            project_code: 'ERP-001',
            description: 'Phase 2',
            start_date: '2026-07-01',
            end_date: '2026-08-01',
            status: 'active',
            member_ids: ['U002', 'U003'],
        }),
        {
            params: Promise.resolve({ id: '42' }),
        }
    )

    assert.equal(response.status, 200)
    assert.equal(response.body.message, 'Project updated')
    assert.deepEqual(mockState.requirePermissionCalls, ['project.update'])
    assert.equal(mockState.connection.beginCount, 1)
    assert.equal(mockState.connection.commitCount, 1)
    assert.equal(mockState.connection.releaseCount, 1)
    assert.deepEqual(mockState.connection.executeCalls[0].params, [
        'ERP Upgrade',
        'ERP-001',
        'Phase 2',
        '2026-07-01',
        '2026-08-01',
        'active',
        '42',
    ])
    assert.deepEqual(mockState.connection.queryCalls[0].params[0], [
        ['42', 'U002'],
        ['42', 'U003'],
    ])
})

test('DELETE /api/v1/project/:id soft deletes the project and writes history', async () => {
    resetMockState()
    mockState.executeQueue.push([
        [
            {
                project_id: 42,
                project_name: 'ERP Upgrade',
                created_by: 'U001',
            },
        ],
    ])

    const response = await projectDetailRoute.DELETE(
        {
            url: 'http://localhost/api/v1/project/42',
        },
        {
            params: Promise.resolve({ id: '42' }),
        }
    )

    assert.equal(response.status, 200)
    assert.equal(response.body.success, true)
    assert.equal(response.body.project_id, 42)
    assert.deepEqual(mockState.requirePermissionCalls, ['project.delete'])
    assert.equal(mockState.connection.beginCount, 1)
    assert.equal(mockState.connection.commitCount, 1)
    assert.equal(mockState.connection.rollbackCount, 0)
    assert.equal(mockState.connection.releaseCount, 1)
    assert.equal(
        mockState.connection.executeCalls[0].sql.includes('SET deleted_at'),
        true
    )
    assert.deepEqual(mockState.connection.executeCalls[0].params, [42])
    assert.equal(
        mockState.connection.executeCalls[1].sql.includes('task_history'),
        true
    )
})

test('DELETE /api/v1/project/:id rolls back when the transaction fails', async () => {
    resetMockState()
    mockState.executeQueue.push([
        [
            {
                project_id: 42,
                project_name: 'ERP Upgrade',
                created_by: 'U001',
            },
        ],
    ])
    mockState.connection.executeQueue.push(new Error('database failed'))

    const originalConsoleError = console.error
    console.error = () => {}

    let response

    try {
        response = await projectDetailRoute.DELETE(
            {
                url: 'http://localhost/api/v1/project/42',
            },
            {
                params: Promise.resolve({ id: '42' }),
            }
        )
    } finally {
        console.error = originalConsoleError
    }

    assert.equal(response.status, 500)
    assert.equal(response.body.success, false)
    assert.equal(mockState.connection.beginCount, 1)
    assert.equal(mockState.connection.rollbackCount, 1)
    assert.equal(mockState.connection.releaseCount, 1)
})
