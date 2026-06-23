import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const routeSource = await readFile(
    new URL('../app/api/v1/audit-log/route.js', import.meta.url),
    'utf8'
)

const mockState = {
    authUser: null,
    authResponse: null,
    requirePermissionCalls: [],
    executeQueue: [],
    executeCalls: [],
}

function resetMockState() {
    mockState.authUser = { id: 'U001', permissions: ['audit.view'] }
    mockState.authResponse = null
    mockState.requirePermissionCalls = []
    mockState.executeQueue = []
    mockState.executeCalls = []
}

const mockDb = {
    async execute(sql, params = []) {
        mockState.executeCalls.push({ sql, params })

        if (mockState.executeQueue.length > 0) {
            return mockState.executeQueue.shift()
        }

        return [[]]
    },
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

async function loadRouteModule() {
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
                hasPermissionKey(user, permissionKey) {
                    return Array.isArray(user?.permissions) &&
                        user.permissions.includes(permissionKey)
                },
                async requirePermission(_request, permissionKey) {
                    mockState.requirePermissionCalls.push(permissionKey)

                    return {
                        user: mockState.authUser,
                        response: mockState.authResponse,
                    }
                },
            })
        } else {
            throw new Error(`Unexpected import: ${specifier}`)
        }

        moduleCache.set(specifier, vmModule)
        return vmModule
    }

    const vmModule = new vm.SourceTextModule(routeSource, {
        identifier: 'app/api/v1/audit-log/route.js',
    })

    await vmModule.link(linker)
    await vmModule.evaluate()

    return vmModule.namespace
}

const route = await loadRouteModule()

test('GET /api/v1/audit-log requires audit.view', async () => {
    resetMockState()
    mockState.authResponse = {
        body: {
            success: false,
        },
        status: 403,
    }

    const response = await route.GET({
        url: 'http://localhost/api/v1/audit-log',
    })

    assert.equal(response.status, 403)
    assert.deepEqual(mockState.requirePermissionCalls, ['audit.view'])
    assert.equal(mockState.executeCalls.length, 0)
})

test('GET /api/v1/audit-log returns filtered audit rows', async () => {
    resetMockState()
    mockState.executeQueue.push(
        [[{ total: 1 }]],
        [[
            {
                audit_id: 10,
                actor_id: 'U001',
                action: 'project.create',
                entity_type: 'project',
                entity_id: '42',
                summary: 'Create project',
                metadata: JSON.stringify({
                    project_code: 'P-001',
                }),
                created_at: '2026-06-23 10:00:00',
                actor_name: 'Admin User',
                actor_email: 'admin@example.com',
            },
        ]]
    )

    const response = await route.GET({
        url: 'http://localhost/api/v1/audit-log?action=project.create&entity_type=project&page=2&limit=5',
    })

    assert.equal(response.status, 200)
    assert.equal(response.body.success, true)
    assert.deepEqual(mockState.requirePermissionCalls, ['audit.view'])
    assert.deepEqual(mockState.executeCalls[0].params, [
        'project.create',
        'project',
    ])
    assert.equal(mockState.executeCalls[1].sql.includes('LIMIT 5'), true)
    assert.equal(mockState.executeCalls[1].sql.includes('OFFSET 5'), true)
    assert.deepEqual(response.body.data[0].metadata, {
        project_code: 'P-001',
    })
    assert.deepEqual(response.body.pagination, {
        page: 2,
        limit: 5,
        total: 1,
        total_pages: 1,
    })
})

test('GET /api/v1/audit-log falls back for invalid pagination', async () => {
    resetMockState()
    mockState.executeQueue.push([[{ total: 0 }]], [[]])

    const response = await route.GET({
        url: 'http://localhost/api/v1/audit-log?page=abc&limit=999',
    })

    assert.equal(response.status, 200)
    assert.equal(mockState.executeCalls[1].sql.includes('LIMIT 100'), true)
    assert.equal(mockState.executeCalls[1].sql.includes('OFFSET 0'), true)
    assert.deepEqual(response.body.pagination, {
        page: 1,
        limit: 100,
        total: 0,
        total_pages: 0,
    })
})
