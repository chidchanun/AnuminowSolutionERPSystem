import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const departmentRouteSource = await readFile(
    new URL('../app/api/v1/department/route.js', import.meta.url),
    'utf8'
)
const roleRouteSource = await readFile(
    new URL('../app/api/v1/role/route.js', import.meta.url),
    'utf8'
)

const mockState = {
    authUser: null,
    authResponse: null,
    requirePermissionCalls: [],
    queryQueue: [],
    queryCalls: [],
    auditLogCalls: [],
}

function resetMockState() {
    mockState.authUser = { id: 'U001', permissions: ['master_data.manage'] }
    mockState.authResponse = null
    mockState.requirePermissionCalls = []
    mockState.queryQueue = []
    mockState.queryCalls = []
    mockState.auditLogCalls = []
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

function createJsonRequest(body) {
    return {
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
            })
        } else if (specifier === '@/app/lib/auditLog') {
            vmModule = await createMockModule(specifier, {
                async writeAuditLog(payload) {
                    mockState.auditLogCalls.push(payload)
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

const departmentRoute = await loadRouteModule(
    departmentRouteSource,
    'app/api/v1/department/route.js'
)
const roleRoute = await loadRouteModule(
    roleRouteSource,
    'app/api/v1/role/route.js'
)

test('POST /api/v1/department requires master_data.manage and writes audit log', async () => {
    resetMockState()
    mockState.queryQueue.push([{ insertId: 12 }])

    const response = await departmentRoute.POST(createJsonRequest({
        department_name: 'Engineering',
        department_code: 'ENG',
    }))

    assert.equal(response.status, 201)
    assert.deepEqual(mockState.requirePermissionCalls, ['master_data.manage'])
    assert.equal(mockState.queryCalls[0].params[0], 'Engineering')
    assert.deepEqual(mockState.auditLogCalls[0], {
        actorId: 'U001',
        action: 'master.department.create',
        entityType: 'department',
        entityId: 12,
        summary: 'Create department Engineering',
        metadata: {
            department_name: 'Engineering',
            department_code: 'ENG',
        },
    })
})

test('DELETE /api/v1/role blocks deleting a role that employees use', async () => {
    resetMockState()
    mockState.queryQueue.push(
        [[{ role_id: 3, role_name: 'Developer', department_id: 1 }]],
        [[{ total: 2 }]]
    )

    const response = await roleRoute.DELETE(createJsonRequest({
        role_id: 3,
    }))

    assert.equal(response.status, 409)
    assert.deepEqual(mockState.requirePermissionCalls, ['master_data.manage'])
    assert.equal(mockState.auditLogCalls.length, 0)
})
