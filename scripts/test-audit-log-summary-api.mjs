import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const routeSource = await readFile(
    new URL('../app/api/v1/audit-log/summary/route.js', import.meta.url),
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
    async function linker(specifier) {
        if (specifier === 'next/server') {
            return createMockModule(specifier, {
                NextResponse: {
                    json(body, init = {}) {
                        return {
                            body,
                            status: init.status || 200,
                        }
                    },
                },
            })
        }

        if (specifier === '@/app/lib/db') {
            return createMockModule(specifier, {
                db: mockDb,
            })
        }

        if (specifier === '@/app/lib/permission') {
            return createMockModule(specifier, {
                async requirePermission(_request, permissionKey) {
                    mockState.requirePermissionCalls.push(permissionKey)

                    return {
                        user: mockState.authUser,
                        response: mockState.authResponse,
                    }
                },
            })
        }

        throw new Error(`Unexpected import: ${specifier}`)
    }

    const vmModule = new vm.SourceTextModule(routeSource, {
        identifier: 'app/api/v1/audit-log/summary/route.js',
    })

    await vmModule.link(linker)
    await vmModule.evaluate()

    return vmModule.namespace
}

const route = await loadRouteModule()

test('GET /api/v1/audit-log/summary requires audit.view', async () => {
    resetMockState()
    mockState.authResponse = {
        body: {
            success: false,
        },
        status: 403,
    }

    const response = await route.GET({
        url: 'http://localhost/api/v1/audit-log/summary',
    })

    assert.equal(response.status, 403)
    assert.deepEqual(mockState.requirePermissionCalls, ['audit.view'])
    assert.equal(mockState.executeCalls.length, 0)
})

test('GET /api/v1/audit-log/summary returns counts and top lists', async () => {
    resetMockState()
    mockState.executeQueue.push(
        [[{
            total_logs: 20,
            today_logs: 4,
            permission_logs: 2,
            task_logs: 8,
        }]],
        [[{
            actor_id: 'U001',
            actor_name: 'Admin User',
            total: 6,
        }]],
        [[{
            action: 'task.create',
            total: 5,
        }]],
        [[{
            audit_id: 1,
            action: 'task.create',
            entity_type: 'task',
            entity_id: '42',
            summary: 'Create task',
            created_at: '2026-06-23 10:00:00',
            actor_id: 'U001',
            actor_name: 'Admin User',
        }]]
    )

    const response = await route.GET({
        url: 'http://localhost/api/v1/audit-log/summary',
    })

    assert.equal(response.status, 200)
    assert.deepEqual(mockState.requirePermissionCalls, ['audit.view'])
    assert.equal(mockState.executeCalls.length, 4)
    assert.deepEqual(response.body.summary, {
        total_logs: 20,
        today_logs: 4,
        permission_logs: 2,
        task_logs: 8,
    })
    assert.equal(response.body.top_actors[0].total, 6)
    assert.equal(response.body.top_actions[0].action, 'task.create')
    assert.equal(response.body.latest_logs[0].audit_id, 1)
})
